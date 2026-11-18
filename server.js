const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UltimateTTT, BOARD_NAMES } = require('./public/game-engine.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ==========================================
// ROOM & GAME STATE STORE
// ==========================================
const rooms = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

class GameRoom {
  constructor(id) {
    this.id = id;
    this.game = new UltimateTTT();
    this.playerX = null; // { token, name, socket, connected: true }
    this.playerO = null; // { token, name, socket, connected: true }
    this.spectators = new Map(); // token => { token, name, socket }
    this.pendingUndo = null; // { requesterRole, moveIndex, timeoutTimer }
    this.pendingRematch = null; // { requesterRole }
    this.chat = [];
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  touch() {
    this.lastActivity = Date.now();
  }

  getPublicRoomInfo(forToken) {
    let role = 'spectator';
    if (this.playerX && this.playerX.token === forToken) role = 'X';
    if (this.playerO && this.playerO.token === forToken) role = 'O';

    return {
      roomId: this.id,
      myRole: role,
      playerX: this.playerX ? { name: this.playerX.name, connected: this.playerX.connected } : null,
      playerO: this.playerO ? { name: this.playerO.name, connected: this.playerO.connected } : null,
      spectatorCount: this.spectators.size,
      gameState: this.game.getState(),
      pendingUndo: this.pendingUndo ? {
        requesterRole: this.pendingUndo.requesterRole,
        moveIndex: this.pendingUndo.moveIndex,
        expiresIn: Math.max(0, Math.round((this.pendingUndo.expiresAt - Date.now()) / 1000))
      } : null,
      pendingRematch: this.pendingRematch ? {
        requesterRole: this.pendingRematch.requesterRole
      } : null,
      chat: this.chat.slice(-30)
    };
  }

  broadcast(messageObj) {
    const raw = JSON.stringify(messageObj);
    const clients = [];
    if (this.playerX && this.playerX.socket) clients.push(this.playerX.socket);
    if (this.playerO && this.playerO.socket) clients.push(this.playerO.socket);
    for (const spec of this.spectators.values()) {
      if (spec.socket) clients.push(spec.socket);
    }
    for (const ws of clients) {
      sendWs(ws, raw);
    }
  }

  sendToRole(role, messageObj) {
    const raw = JSON.stringify(messageObj);
    if (role === 'X' && this.playerX && this.playerX.socket) {
      sendWs(this.playerX.socket, raw);
    } else if (role === 'O' && this.playerO && this.playerO.socket) {
      sendWs(this.playerO.socket, raw);
    }
  }

  broadcastState() {
    if (this.playerX && this.playerX.socket) {
      sendWs(this.playerX.socket, JSON.stringify({
        type: 'ROOM_UPDATE',
        room: this.getPublicRoomInfo(this.playerX.token)
      }));
    }
    if (this.playerO && this.playerO.socket) {
      sendWs(this.playerO.socket, JSON.stringify({
        type: 'ROOM_UPDATE',
        room: this.getPublicRoomInfo(this.playerO.token)
      }));
    }
    for (const spec of this.spectators.values()) {
      if (spec.socket) {
        sendWs(spec.socket, JSON.stringify({
          type: 'ROOM_UPDATE',
          room: this.getPublicRoomInfo(spec.token)
        }));
      }
    }
  }
}

// ==========================================
// NATIVE RFC 6455 WEBSOCKET ENGINE
// ==========================================
function sendWs(socket, data, opcode = 0x1) {
  if (!socket || socket.destroyed || socket.readyState === 'closed') return;
  try {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.from([0x80 | (opcode & 0x0f), length]);
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | (opcode & 0x0f);
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | (opcode & 0x0f);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
  } catch (err) {
    console.error('Error sending WS frame:', err.message);
  }
}

function parseWsFrames(buffer) {
  let offset = 0;
  const frames = [];
  while (offset < buffer.length) {
    if (offset + 2 > buffer.length) break;
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    const opcode = byte1 & 0x0f;
    const isMasked = (byte2 & 0x80) === 0x80;
    let payloadLen = byte2 & 0x7f;
    offset += 2;

    if (payloadLen === 126) {
      if (offset + 2 > buffer.length) { offset -= 2; break; }
      payloadLen = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLen === 127) {
      if (offset + 8 > buffer.length) { offset -= 2; break; }
      payloadLen = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskKey = null;
    if (isMasked) {
      if (offset + 4 > buffer.length) { offset -= (payloadLen === 126 ? 4 : payloadLen === 127 ? 10 : 2); break; }
      maskKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (offset + payloadLen > buffer.length) {
      offset -= (isMasked ? 4 : 0) + (payloadLen === 126 ? 2 : payloadLen === 127 ? 8 : 0) + 2;
      break;
    }

    const payload = buffer.slice(offset, offset + payloadLen);
    offset += payloadLen;

    let decoded = Buffer.alloc(payloadLen);
    if (isMasked && maskKey) {
      for (let i = 0; i < payloadLen; i++) {
        decoded[i] = payload[i] ^ maskKey[i % 4];
      }
    } else {
      decoded = payload;
    }
    frames.push({ opcode, payload: decoded });
  }
  return { frames, remainder: buffer.slice(offset) };
}

// ==========================================
// HTTP SERVER & STATIC FILE DISPATCH
// ==========================================
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // API endpoints for stats or room creation
  if (pathname === '/api/create-room' && req.method === 'POST') {
    const roomId = generateRoomId();
    const room = new GameRoom(roomId);
    rooms.set(roomId, room);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, roomId }));
    return;
  }

  if (pathname === '/api/rooms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const list = [];
    for (const [id, r] of rooms.entries()) {
      list.push({
        id,
        hasPlayerX: !!r.playerX,
        hasPlayerO: !!r.playerO,
        spectators: r.spectators.size,
        moves: r.game.moveHistory.length
      });
    }
    res.end(JSON.stringify(list));
    return;
  }

  // Static file handling
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// ==========================================
// WEBSOCKET CONNECTION & GAME PROTOCOL
// ==========================================
server.on('upgrade', (req, socket, head) => {
  const upgradeHeader = (req.headers['upgrade'] || '').toLowerCase();
  if (upgradeHeader !== 'websocket') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

  let buffer = Buffer.alloc(0);
  let userSession = {
    socket,
    token: null,
    name: null,
    roomId: null,
    role: null
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const { frames, remainder } = parseWsFrames(buffer);
    buffer = remainder;

    for (const frame of frames) {
      if (frame.opcode === 0x8) { // CLOSE
        sendWs(socket, Buffer.alloc(0), 0x8);
        socket.end();
        break;
      } else if (frame.opcode === 0x9) { // PING
        sendWs(socket, frame.payload, 0xA); // PONG
      } else if (frame.opcode === 0x1) { // TEXT
        try {
          const message = JSON.parse(frame.payload.toString('utf-8'));
          handleClientMessage(userSession, message);
        } catch (e) {
          console.error('Failed to parse WS JSON:', e.message);
        }
      }
    }
  });

  socket.on('close', () => {
    handleDisconnect(userSession);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
    socket.destroy();
  });
});

function handleClientMessage(session, msg) {
  const { type } = msg;

  switch (type) {
    case 'JOIN_ROOM': {
      let { roomId, playerName, playerToken } = msg;
      roomId = (roomId || '').trim().toUpperCase();
      playerName = (playerName || 'Player').trim().slice(0, 20);

      if (!roomId) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'Room code is required' }));
        return;
      }

      let room = rooms.get(roomId);
      if (!room) {
        room = new GameRoom(roomId);
        rooms.set(roomId, room);
      }
      room.touch();

      const token = playerToken || crypto.randomUUID();
      session.token = token;
      session.name = playerName;
      session.roomId = roomId;

      // Assign or reconnect player role
      if (room.playerX && room.playerX.token === token) {
        // Reconnect X
        room.playerX.socket = session.socket;
        room.playerX.connected = true;
        room.playerX.name = playerName;
        session.role = 'X';
      } else if (room.playerO && room.playerO.token === token) {
        // Reconnect O
        room.playerO.socket = session.socket;
        room.playerO.connected = true;
        room.playerO.name = playerName;
        session.role = 'O';
      } else if (!room.playerX) {
        // Seat X
        room.playerX = { token, name: playerName, socket: session.socket, connected: true };
        session.role = 'X';
      } else if (!room.playerO) {
        // Seat O
        room.playerO = { token, name: playerName, socket: session.socket, connected: true };
        session.role = 'O';
      } else {
        // Spectator
        room.spectators.set(token, { token, name: playerName, socket: session.socket });
        session.role = 'spectator';
      }

      sendWs(session.socket, JSON.stringify({
        type: 'JOINED_SUCCESS',
        token,
        role: session.role,
        roomId
      }));

      room.broadcast({
        type: 'NOTIFICATION',
        text: `${playerName} joined as ${session.role === 'spectator' ? 'Spectator' : 'Player ' + session.role}`
      });

      room.broadcastState();
      break;
    }

    case 'MAKE_MOVE': {
      const room = rooms.get(session.roomId);
      if (!room) return;
      room.touch();

      if (session.role !== 'X' && session.role !== 'O') {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'Spectators cannot make moves' }));
        return;
      }

      if (room.pendingUndo) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'Resolve pending undo request before moving' }));
        return;
      }

      const { boardIndex, cellIndex } = msg;
      const result = room.game.makeMove(boardIndex, cellIndex, session.role);

      if (!result.valid) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: result.reason || 'Invalid move' }));
        return;
      }

      // Check if mini-board was won on this move
      const lastMove = room.game.moveHistory[room.game.moveHistory.length - 1];

      room.broadcast({
        type: 'MOVE_PLAYED',
        move: lastMove,
        gameState: room.game.getState()
      });

      if (lastMove.wonBoard && lastMove.wonBoard !== 'T') {
        room.broadcast({
          type: 'BOARD_WON',
          boardIndex: lastMove.boardIndex,
          winner: lastMove.wonBoard
        });
      }

      if (result.state.winner) {
        room.broadcast({
          type: 'GAME_OVER',
          winner: result.state.winner,
          winningLine: result.state.macroWinningLine
        });
      }

      room.broadcastState();
      break;
    }

    // ==========================================
    // THE UNDO WORKFLOW
    // ==========================================
    case 'REQUEST_UNDO': {
      const room = rooms.get(session.roomId);
      if (!room) return;
      room.touch();

      if (session.role !== 'X' && session.role !== 'O') {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'Only players can request an undo' }));
        return;
      }

      if (room.game.moveHistory.length === 0) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'No moves to undo yet' }));
        return;
      }

      if (room.pendingUndo) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'An undo request is already in progress' }));
        return;
      }

      const opponentRole = session.role === 'X' ? 'O' : 'X';
      const opponent = opponentRole === 'X' ? room.playerX : room.playerO;

      if (!opponent || !opponent.connected) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'Opponent is not connected' }));
        return;
      }

      const lastMove = room.game.moveHistory[room.game.moveHistory.length - 1];
      const timeoutDuration = 25; // 25 seconds

      // Store pending undo
      const timeoutTimer = setTimeout(() => {
        if (room.pendingUndo) {
          room.pendingUndo = null;
          room.broadcast({
            type: 'UNDO_RESOLVED',
            accepted: false,
            reason: 'timeout',
            message: 'Undo request timed out without response'
          });
          room.broadcastState();
        }
      }, timeoutDuration * 1000);

      room.pendingUndo = {
        requesterRole: session.role,
        requesterName: session.name,
        requestedAt: Date.now(),
        expiresAt: Date.now() + (timeoutDuration * 1000),
        timeoutTimer,
        moveIndex: room.game.moveHistory.length - 1,
        lastMove
      };

      // Notify the requester
      sendWs(session.socket, JSON.stringify({
        type: 'UNDO_REQUEST_SENT',
        expiresIn: timeoutDuration
      }));

      // Notify the opponent with prominent action prompt
      room.sendToRole(opponentRole, {
        type: 'UNDO_REQUEST_RECEIVED',
        requesterRole: session.role,
        requesterName: session.name,
        lastMove,
        expiresIn: timeoutDuration
      });

      room.broadcast({
        type: 'NOTIFICATION',
        text: `${session.name} (Player ${session.role}) requested to undo their last move`
      });

      room.broadcastState();
      break;
    }

    case 'RESPOND_UNDO': {
      const room = rooms.get(session.roomId);
      if (!room || !room.pendingUndo) return;
      room.touch();

      const opponentRole = room.pendingUndo.requesterRole === 'X' ? 'O' : 'X';
      if (session.role !== opponentRole) {
        sendWs(session.socket, JSON.stringify({ type: 'ERROR', message: 'Only the opponent can accept or reject undo' }));
        return;
      }

      clearTimeout(room.pendingUndo.timeoutTimer);
      const { accept } = msg;
      const requesterRole = room.pendingUndo.requesterRole;
      const requesterName = room.pendingUndo.requesterName;
      room.pendingUndo = null;

      if (accept === true) {
        // Rollback 1 move
        const undoRes = room.game.undo(1);
        if (undoRes.success) {
          room.broadcast({
            type: 'UNDO_RESOLVED',
            accepted: true,
            byRole: session.role,
            byName: session.name,
            requesterRole,
            gameState: room.game.getState(),
            message: `${session.name} accepted the undo request! Move reverted.`
          });
        }
      } else {
        // Rejected
        room.broadcast({
          type: 'UNDO_RESOLVED',
          accepted: false,
          byRole: session.role,
          byName: session.name,
          requesterRole,
          reason: 'rejected',
          message: `${session.name} rejected the undo request.`
        });
      }

      room.broadcastState();
      break;
    }

    case 'CANCEL_UNDO': {
      const room = rooms.get(session.roomId);
      if (!room || !room.pendingUndo) return;
      if (room.pendingUndo.requesterRole !== session.role) return;

      clearTimeout(room.pendingUndo.timeoutTimer);
      room.pendingUndo = null;

      room.broadcast({
        type: 'UNDO_RESOLVED',
        accepted: false,
        reason: 'cancelled',
        message: `${session.name} cancelled their undo request.`
      });

      room.broadcastState();
      break;
    }

    case 'SEND_CHAT': {
      const room = rooms.get(session.roomId);
      if (!room) return;
      room.touch();

      const rawText = (msg.text || '').trim().slice(0, 150);
      if (!rawText) return;

      const chatEntry = {
        sender: session.name,
        role: session.role,
        text: rawText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      room.chat.push(chatEntry);
      if (room.chat.length > 50) room.chat.shift();

      room.broadcast({
        type: 'CHAT_MESSAGE',
        entry: chatEntry
      });
      break;
    }

    case 'REQUEST_REMATCH': {
      const room = rooms.get(session.roomId);
      if (!room) return;
      room.touch();

      if (session.role !== 'X' && session.role !== 'O') return;
      const opponentRole = session.role === 'X' ? 'O' : 'X';

      room.pendingRematch = { requesterRole: session.role, requesterName: session.name };

      room.sendToRole(opponentRole, {
        type: 'REMATCH_REQUESTED',
        requesterRole: session.role,
        requesterName: session.name
      });

      room.broadcast({
        type: 'NOTIFICATION',
        text: `${session.name} requested a rematch!`
      });

      room.broadcastState();
      break;
    }

    case 'RESPOND_REMATCH': {
      const room = rooms.get(session.roomId);
      if (!room || !room.pendingRematch) return;
      room.touch();

      const { accept } = msg;
      room.pendingRematch = null;

      if (accept) {
        room.game.reset();
        room.broadcast({
          type: 'REMATCH_ACCEPTED',
          message: 'Rematch started! New game is live.',
          gameState: room.game.getState()
        });
      } else {
        room.broadcast({
          type: 'NOTIFICATION',
          text: 'Rematch request declined.'
        });
      }

      room.broadcastState();
      break;
    }

    case 'RESIGN': {
      const room = rooms.get(session.roomId);
      if (!room) return;
      if (session.role !== 'X' && session.role !== 'O') return;
      if (room.game.winner) return;

      const winner = session.role === 'X' ? 'O' : 'X';
      room.game.winner = winner;
      room.broadcast({
        type: 'GAME_OVER',
        winner,
        reason: `${session.name} (Player ${session.role}) resigned`
      });
      room.broadcastState();
      break;
    }
  }
}

function handleDisconnect(session) {
  if (!session.roomId) return;
  const room = rooms.get(session.roomId);
  if (!room) return;

  if (session.role === 'X' && room.playerX && room.playerX.token === session.token) {
    room.playerX.connected = false;
  } else if (session.role === 'O' && room.playerO && room.playerO.token === session.token) {
    room.playerO.connected = false;
  } else if (session.role === 'spectator') {
    room.spectators.delete(session.token);
  }

  room.broadcast({
    type: 'NOTIFICATION',
    text: `${session.name || 'A player'} disconnected`
  });

  room.broadcastState();
}

// Prune inactive rooms every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - (4 * 60 * 60 * 1000);
  for (const [id, r] of rooms.entries()) {
    if (r.lastActivity < cutoff) {
      if (r.pendingUndo && r.pendingUndo.timeoutTimer) {
        clearTimeout(r.pendingUndo.timeoutTimer);
      }
      rooms.delete(id);
    }
  }
}, 30 * 60 * 1000);

// Heartbeat ping every 30s
setInterval(() => {
  for (const r of rooms.values()) {
    const clients = [];
    if (r.playerX && r.playerX.socket) clients.push(r.playerX.socket);
    if (r.playerO && r.playerO.socket) clients.push(r.playerO.socket);
    for (const spec of r.spectators.values()) {
      if (spec.socket) clients.push(spec.socket);
    }
    for (const ws of clients) {
      sendWs(ws, Buffer.alloc(0), 0x9); // Ping
    }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎮 ULTIMATE TIC-TAC-TOE 9X9 REAL-TIME SERVER`);
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`⚡ Zero npm dependencies required`);
  console.log(`===============================================`);
});

module.exports = server;

