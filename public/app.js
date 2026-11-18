/**
 * Ultimate Tic-Tac-Toe 9x9 Client Application
 */

(function () {
  'use strict';

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  let currentMode = 'online'; // 'online' | 'ai' | 'local'
  let aiDifficulty = 'medium'; // 'easy' | 'medium' | 'hard'
  let localGame = new UltimateTTT();
  let localRoleTurn = 'X';
  let gameStartTime = Date.now();

  // Online Multiplayer State
  let ws = null;
  let roomId = null;
  let playerToken = sessionStorage.getItem('utt_player_token') || null;
  let myOnlineRole = null; // 'X' | 'O' | 'spectator'
  let onlineRoomData = null;
  let undoCountdownInterval = null;

  // Sound instance
  const sound = window.soundFx;

  // ==========================================
  // DOM ELEMENT REFERENCES
  // ==========================================
  const boardContainer = document.getElementById('boardContainer');
  const turnInstruction = document.getElementById('turnInstruction');
  const turnInstructionText = document.getElementById('turnInstructionText');
  const turnInstructionIcon = document.getElementById('turnInstructionIcon');

  const playerXCard = document.getElementById('playerXCard');
  const playerOCard = document.getElementById('playerOCard');
  const playerXName = document.getElementById('playerXName');
  const playerOName = document.getElementById('playerOName');
  const playerXStatus = document.getElementById('playerXStatus');
  const playerOStatus = document.getElementById('playerOStatus');

  const undoBtn = document.getElementById('undoBtn');
  const undoBtnText = document.getElementById('undoBtnText');
  const resignBtn = document.getElementById('resignBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const soundToggle = document.getElementById('soundToggle');
  const rulesBtn = document.getElementById('rulesBtn');

  // Online UI Panels
  const onlineLobbyPanel = document.getElementById('onlineLobbyPanel');
  const activeRoomBar = document.getElementById('activeRoomBar');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const currentRoomCode = document.getElementById('currentRoomCode');
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  const spectatorCount = document.getElementById('spectatorCount');
  const aiBar = document.getElementById('aiBar');

  // Sidebar & Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const historyList = document.getElementById('historyList');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const emoteBtns = document.querySelectorAll('.emote-btn');

  // Modals
  const incomingUndoModal = document.getElementById('incomingUndoModal');
  const waitingUndoModal = document.getElementById('waitingUndoModal');
  const gameOverModal = document.getElementById('gameOverModal');
  const rulesModal = document.getElementById('rulesModal');
  const acceptUndoBtn = document.getElementById('acceptUndoBtn');
  const rejectUndoBtn = document.getElementById('rejectUndoBtn');
  const cancelUndoBtn = document.getElementById('cancelUndoBtn');
  const undoMoveDetails = document.getElementById('undoMoveDetails');
  const undoSecondsRemaining = document.getElementById('undoSecondsRemaining');
  const undoCountdownFill = document.getElementById('undoCountdownFill');
  const undoModalSubtitle = document.getElementById('undoModalSubtitle');
  const closeRulesBtn = document.getElementById('closeRulesBtn');
  const rematchBtn = document.getElementById('rematchBtn');
  const closeGameOverBtn = document.getElementById('closeGameOverBtn');
  const statsTotalMoves = document.getElementById('statsTotalMoves');
  const statsDuration = document.getElementById('statsDuration');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverSubtitle = document.getElementById('gameOverSubtitle');
  const gameOverEmoji = document.getElementById('gameOverEmoji');
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================
  // INITIALIZATION & BOARD RENDERING
  // ==========================================
  function init() {
    createBoardDOM();
    setupEventListeners();
    checkURLParams();

    // Set default mode
    setMode(currentMode);
  }

  function createBoardDOM() {
    boardContainer.innerHTML = '';
    for (let b = 0; b < 9; b++) {
      const miniBoard = document.createElement('div');
      miniBoard.className = 'mini-board';
      miniBoard.dataset.board = b;

      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.board = b;
        cell.dataset.cell = c;

        cell.addEventListener('click', () => handleCellClick(b, c));
        miniBoard.appendChild(cell);
      }

      boardContainer.appendChild(miniBoard);
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    // Mode switcher buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setMode(mode);
      });
    });

    // AI Difficulty buttons
    document.querySelectorAll('.ai-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        aiDifficulty = btn.dataset.diff;
        showToast(`AI difficulty set to ${aiDifficulty.toUpperCase()}`, 'gold');
      });
    });

    // Sound toggle
    soundToggle.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      soundToggle.textContent = isMuted ? '🔇' : '🔊';
      showToast(isMuted ? 'Sound Muted' : 'Sound Enabled', 'gold');
    });

    // Rules modal
    rulesBtn.addEventListener('click', () => rulesModal.classList.add('open'));
    closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('open'));

    // New Game / Reset
    newGameBtn.addEventListener('click', () => {
      if (currentMode === 'online') {
        if (ws && myOnlineRole && (myOnlineRole === 'X' || myOnlineRole === 'O')) {
          sendWsMessage({ type: 'REQUEST_REMATCH' });
          showToast('Rematch request sent to opponent', 'gold');
        } else {
          showToast('Restart available for players in a room', 'gold');
        }
      } else {
        restartLocalGame();
      }
    });

    // Undo button
    undoBtn.addEventListener('click', handleUndoClick);

    // Resign button
    resignBtn.addEventListener('click', () => {
      if (currentMode === 'online') {
        if (myOnlineRole === 'X' || myOnlineRole === 'O') {
          if (confirm('Are you sure you want to resign this match?')) {
            sendWsMessage({ type: 'RESIGN' });
          }
        }
      } else {
        if (confirm('Forfeit and restart game?')) {
          restartLocalGame();
        }
      }
    });

    // Create & Join Room buttons
    createRoomBtn.addEventListener('click', createNewRoom);
    joinRoomBtn.addEventListener('click', () => {
      const code = roomCodeInput.value.trim().toUpperCase();
      if (code) joinRoom(code);
      else showToast('Please enter a room code', 'danger');
    });
    roomCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (code) joinRoom(code);
      }
    });

    // Copy Invite link
    copyInviteBtn.addEventListener('click', () => {
      if (!roomId) return;
      const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Invite link copied to clipboard!', 'success');
      }).catch(() => {
        prompt('Copy this link:', url);
      });
    });

    // Undo Modal Actions (Opponent response)
    acceptUndoBtn.addEventListener('click', () => {
      if (ws) {
        sendWsMessage({ type: 'RESPOND_UNDO', accept: true });
        incomingUndoModal.classList.remove('open');
        clearInterval(undoCountdownInterval);
      }
    });

    rejectUndoBtn.addEventListener('click', () => {
      if (ws) {
        sendWsMessage({ type: 'RESPOND_UNDO', accept: false });
        incomingUndoModal.classList.remove('open');
        clearInterval(undoCountdownInterval);
      }
    });

    cancelUndoBtn.addEventListener('click', () => {
      if (ws) {
        sendWsMessage({ type: 'CANCEL_UNDO' });
        waitingUndoModal.classList.remove('open');
      }
    });

    // Rematch button in GameOver modal
    rematchBtn.addEventListener('click', () => {
      gameOverModal.classList.remove('open');
      if (currentMode === 'online') {
        sendWsMessage({ type: 'REQUEST_REMATCH' });
        showToast('Rematch requested...', 'gold');
      } else {
        restartLocalGame();
      }
    });

    closeGameOverBtn.addEventListener('click', () => {
      gameOverModal.classList.remove('open');
    });

    // Tab switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');

        if (tab === 'history') document.getElementById('tabHistory').classList.add('active');
        if (tab === 'chat') document.getElementById('tabChat').classList.add('active');
        if (tab === 'rules') document.getElementById('tabRules').classList.add('active');
      });
    });

    // Emote bar
    emoteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emote = btn.dataset.emote;
        if (currentMode === 'online') {
          sendWsMessage({ type: 'SEND_CHAT', text: emote });
        } else {
          appendChatMessage('You', localGame.currentTurn, emote);
        }
      });
    });

    // Chat form submit
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      if (currentMode === 'online') {
        sendWsMessage({ type: 'SEND_CHAT', text });
      } else {
        appendChatMessage('Player', localGame.currentTurn, text);
      }
      chatInput.value = '';
    });
  }

  function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setMode('online');
      joinRoom(roomParam.toUpperCase());
    }
  }

  // ==========================================
  // GAME MODE SWITCHING
  // ==========================================
  function setMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'online') {
      aiBar.style.display = 'none';
      undoBtnText.textContent = 'Request Undo';
      if (!roomId) {
        onlineLobbyPanel.style.display = 'flex';
        activeRoomBar.style.display = 'none';
      } else {
        onlineLobbyPanel.style.display = 'none';
        activeRoomBar.style.display = 'flex';
      }
      initWebSocket();
    } else if (mode === 'ai') {
      aiBar.style.display = 'flex';
      onlineLobbyPanel.style.display = 'none';
      activeRoomBar.style.display = 'none';
      undoBtnText.textContent = 'Undo Move';
      playerXName.textContent = 'You (X)';
      playerOName.textContent = 'AI Bot (O)';
      playerXStatus.innerHTML = '<span class="status-dot"></span> Ready';
      playerOStatus.innerHTML = '<span class="status-dot"></span> Ready';
      restartLocalGame();
    } else if (mode === 'local') {
      aiBar.style.display = 'none';
      onlineLobbyPanel.style.display = 'none';
      activeRoomBar.style.display = 'none';
      undoBtnText.textContent = 'Undo Move';
      playerXName.textContent = 'Player 1 (X)';
      playerOName.textContent = 'Player 2 (O)';
      playerXStatus.innerHTML = '<span class="status-dot"></span> Local';
      playerOStatus.innerHTML = '<span class="status-dot"></span> Local';
      restartLocalGame();
    }
  }

  function restartLocalGame() {
    localGame.reset();
    gameStartTime = Date.now();
    renderGameState(localGame.getState());
    renderHistory(localGame.moveHistory);
    updateUndoButton();
    showToast('Game board reset', 'gold');
  }

  // ==========================================
  // WEBSOCKET & MULTIPLAYER NETWORKING
  // ==========================================
  function initWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Real-Time Game Server');
      if (roomId) {
        joinRoom(roomId);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('Failed to parse WS msg:', err);
      }
    };

    ws.onclose = () => {
      console.log('WS Connection closed. Auto-reconnecting in 2s...');
      setTimeout(() => {
        if (currentMode === 'online') initWebSocket();
      }, 2000);
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
    };
  }

  function sendWsMessage(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function createNewRoom() {
    fetch('/api/create-room', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.roomId) {
          joinRoom(data.roomId);
        }
      })
      .catch(err => {
        console.error('Failed to create room:', err);
        showToast('Error creating room', 'danger');
      });
  }

  function joinRoom(code) {
    roomId = code;
    currentRoomCode.textContent = roomId;

    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.replaceState({}, '', newUrl);

    onlineLobbyPanel.style.display = 'none';
    activeRoomBar.style.display = 'flex';

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      initWebSocket();
      return;
    }

    sendWsMessage({
      type: 'JOIN_ROOM',
      roomId,
      playerName: playerToken ? (sessionStorage.getItem('utt_player_name') || 'Player') : 'Player',
      playerToken
    });
  }

  function handleServerMessage(msg) {
    const { type } = msg;

    switch (type) {
      case 'JOINED_SUCCESS': {
        playerToken = msg.token;
        myOnlineRole = msg.role;
        sessionStorage.setItem('utt_player_token', playerToken);
        showToast(`Joined room as ${myOnlineRole === 'spectator' ? 'Spectator' : 'Player ' + myOnlineRole}`, 'success');
        updateUndoButton();
        break;
      }

      case 'ROOM_UPDATE': {
        onlineRoomData = msg.room;
        updateRoomUI(onlineRoomData);
        break;
      }

      case 'MOVE_PLAYED': {
        sound.playMove(msg.move.player);
        renderGameState(msg.gameState);
        renderHistory(msg.gameState.lastMove ? [msg.gameState.lastMove] : [], true);
        updateUndoButton();
        break;
      }

      case 'BOARD_WON': {
        sound.playBoardWin(msg.winner);
        showToast(`Player ${msg.winner} claimed ${BOARD_NAMES[msg.boardIndex]} Board!`, 'gold');
        break;
      }

      case 'GAME_OVER': {
        sound.playGameWin();
        showGameOverModal(msg.winner, msg.reason);
        break;
      }

      // ==========================================
      // UNDO EVENT HANDLING (THE CORE LOGIC)
      // ==========================================
      case 'UNDO_REQUEST_SENT': {
        // The requester gets a waiting modal
        waitingUndoModal.classList.add('open');
        break;
      }

      case 'UNDO_REQUEST_RECEIVED': {
        // The opponent receives the prompt modal
        sound.playUndoRequest();
        openIncomingUndoModal(msg);
        break;
      }

      case 'UNDO_RESOLVED': {
        waitingUndoModal.classList.remove('open');
        incomingUndoModal.classList.remove('open');
        clearInterval(undoCountdownInterval);

        if (msg.accepted) {
          sound.playUndoAccepted();
          showToast(msg.message || 'Undo accepted! Move reverted.', 'success');
          if (msg.gameState) {
            renderGameState(msg.gameState);
            renderHistory(localGame.moveHistory); // Rebuilt state
          }
        } else {
          sound.playUndoRejected();
          showToast(msg.message || 'Undo request declined.', 'danger');
        }
        updateUndoButton();
        break;
      }

      case 'REMATCH_REQUESTED': {
        if (confirm(`${msg.requesterName} wants a rematch! Accept?`)) {
          sendWsMessage({ type: 'RESPOND_REMATCH', accept: true });
        } else {
          sendWsMessage({ type: 'RESPOND_REMATCH', accept: false });
        }
        break;
      }

      case 'REMATCH_ACCEPTED': {
        showToast('Rematch started! New game is live.', 'success');
        gameOverModal.classList.remove('open');
        renderGameState(msg.gameState);
        renderHistory([]);
        break;
      }

      case 'CHAT_MESSAGE': {
        appendChatMessage(msg.entry.sender, msg.entry.role, msg.entry.text, msg.entry.time);
        break;
      }

      case 'NOTIFICATION': {
        showToast(msg.text, 'gold');
        break;
      }

      case 'ERROR': {
        showToast(msg.message, 'danger');
        break;
      }
    }
  }

  function updateRoomUI(room) {
    if (!room) return;

    spectatorCount.textContent = room.spectatorCount;

    // Player X Card
    if (room.playerX) {
      playerXName.textContent = room.playerX.name + (myOnlineRole === 'X' ? ' (You)' : '');
      playerXStatus.innerHTML = room.playerX.connected
        ? '<span class="status-dot"></span> Connected'
        : '<span class="status-dot offline"></span> Disconnected';
    } else {
      playerXName.textContent = 'Player 1 (X)';
      playerXStatus.innerHTML = '<span class="status-dot offline"></span> Waiting...';
    }

    // Player O Card
    if (room.playerO) {
      playerOName.textContent = room.playerO.name + (myOnlineRole === 'O' ? ' (You)' : '');
      playerOStatus.innerHTML = room.playerO.connected
        ? '<span class="status-dot"></span> Connected'
        : '<span class="status-dot offline"></span> Disconnected';
    } else {
      playerOName.textContent = 'Player 2 (O)';
      playerOStatus.innerHTML = '<span class="status-dot offline"></span> Waiting for Opponent...';
    }

    renderGameState(room.gameState);
    renderHistory(room.gameState.lastMove ? [room.gameState.lastMove] : [], true);
    updateUndoButton();

    // Check pending undo state on reconnect
    if (room.pendingUndo) {
      if (room.pendingUndo.requesterRole === myOnlineRole) {
        waitingUndoModal.classList.add('open');
      }
    }
  }

  // ==========================================
  // UNDO PROMPT MODAL (OPPONENT WORKFLOW)
  // ==========================================
  function openIncomingUndoModal(msg) {
    const { requesterRole, requesterName, lastMove, expiresIn } = msg;

    undoModalSubtitle.textContent = `${requesterName} (Player ${requesterRole}) requested to take back their last move.`;
    undoMoveDetails.textContent = `Move #${lastMove.moveNumber}: ${lastMove.player} at ${lastMove.boardName} (${lastMove.cellName})`;

    incomingUndoModal.classList.add('open');

    let seconds = expiresIn || 25;
    undoSecondsRemaining.textContent = `${seconds}s`;
    undoCountdownFill.style.width = '100%';

    clearInterval(undoCountdownInterval);
    const start = Date.now();
    const totalMs = seconds * 1000;

    undoCountdownInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      undoSecondsRemaining.textContent = `${remaining}s`;

      const pct = Math.max(0, 100 - (elapsed / totalMs * 100));
      undoCountdownFill.style.width = `${pct}%`;

      if (remaining <= 0) {
        clearInterval(undoCountdownInterval);
        incomingUndoModal.classList.remove('open');
      }
    }, 200);
  }

  // ==========================================
  // GAMEPLAY & CELL CLICKS
  // ==========================================
  function handleCellClick(boardIndex, cellIndex) {
    sound.init(); // Initialize audio context on first interaction

    if (currentMode === 'online') {
      if (myOnlineRole !== 'X' && myOnlineRole !== 'O') {
        showToast('You are spectating. Only players can make moves.', 'gold');
        return;
      }
      if (!onlineRoomData) return;
      if (onlineRoomData.gameState.currentTurn !== myOnlineRole) {
        showToast(`It is Player ${onlineRoomData.gameState.currentTurn}'s turn`, 'gold');
        return;
      }
      sendWsMessage({ type: 'MAKE_MOVE', boardIndex, cellIndex });
    } else if (currentMode === 'ai') {
      if (localGame.currentTurn !== 'X') return; // AI is thinking

      const result = localGame.makeMove(boardIndex, cellIndex, 'X');
      if (!result.valid) {
        showToast(result.reason, 'danger');
        return;
      }

      sound.playMove('X');
      renderGameState(result.state);
      renderHistory(localGame.moveHistory);
      updateUndoButton();

      const lastMove = localGame.moveHistory[localGame.moveHistory.length - 1];
      if (lastMove.wonBoard && lastMove.wonBoard !== 'T') {
        sound.playBoardWin(lastMove.wonBoard);
      }

      if (result.state.winner) {
        sound.playGameWin();
        showGameOverModal(result.state.winner);
        return;
      }

      // Trigger AI Move after brief realistic delay
      triggerAIMove();
    } else if (currentMode === 'local') {
      const player = localGame.currentTurn;
      const result = localGame.makeMove(boardIndex, cellIndex, player);
      if (!result.valid) {
        showToast(result.reason, 'danger');
        return;
      }

      sound.playMove(player);
      renderGameState(result.state);
      renderHistory(localGame.moveHistory);
      updateUndoButton();

      const lastMove = localGame.moveHistory[localGame.moveHistory.length - 1];
      if (lastMove.wonBoard && lastMove.wonBoard !== 'T') {
        sound.playBoardWin(lastMove.wonBoard);
      }

      if (result.state.winner) {
        sound.playGameWin();
        showGameOverModal(result.state.winner);
      }
    }
  }

  function triggerAIMove() {
    playerOStatus.innerHTML = '<span class="status-dot"></span> Thinking...';

    setTimeout(() => {
      if (localGame.winner || currentMode !== 'ai') return;

      const aiMove = window.UltimateAI.getAIMove(localGame, aiDifficulty, 'O');
      if (!aiMove) return;

      const result = localGame.makeMove(aiMove.boardIndex, aiMove.cellIndex, 'O');
      if (result.valid) {
        sound.playMove('O');
        renderGameState(result.state);
        renderHistory(localGame.moveHistory);
        updateUndoButton();

        playerOStatus.innerHTML = '<span class="status-dot"></span> Ready';

        const lastMove = localGame.moveHistory[localGame.moveHistory.length - 1];
        if (lastMove.wonBoard && lastMove.wonBoard !== 'T') {
          sound.playBoardWin(lastMove.wonBoard);
        }

        if (result.state.winner) {
          sound.playGameWin();
          showGameOverModal(result.state.winner);
        }
      }
    }, 450);
  }

  // ==========================================
  // UNDO BUTTON HANDLER
  // ==========================================
  function handleUndoClick() {
    sound.init();

    if (currentMode === 'online') {
      if (!myOnlineRole || (myOnlineRole !== 'X' && myOnlineRole !== 'O')) {
        showToast('Only active players can request an undo', 'danger');
        return;
      }
      sendWsMessage({ type: 'REQUEST_UNDO' });
    } else if (currentMode === 'ai') {
      // In AI mode, undo 2 moves (AI move + player move) or 1 move if AI hasn't played yet
      if (localGame.moveHistory.length === 0) return;
      const steps = localGame.moveHistory.length >= 2 ? 2 : 1;
      localGame.undo(steps);
      sound.playUndoAccepted();
      renderGameState(localGame.getState());
      renderHistory(localGame.moveHistory);
      updateUndoButton();
      showToast('Move undone! Make your new choice.', 'success');
    } else if (currentMode === 'local') {
      // In Local mode, undo 1 move
      if (localGame.moveHistory.length === 0) return;
      localGame.undo(1);
      sound.playUndoAccepted();
      renderGameState(localGame.getState());
      renderHistory(localGame.moveHistory);
      updateUndoButton();
      showToast('Previous move undone.', 'success');
    }
  }

  function updateUndoButton() {
    if (currentMode === 'online') {
      const isPlayer = myOnlineRole === 'X' || myOnlineRole === 'O';
      const hasMoves = onlineRoomData && onlineRoomData.gameState && onlineRoomData.gameState.moveCount > 0;
      undoBtn.disabled = !isPlayer || !hasMoves;
      undoBtnText.textContent = 'Request Undo';
    } else {
      const hasMoves = localGame.moveHistory.length > 0;
      undoBtn.disabled = !hasMoves || (localGame.winner !== null);
      undoBtnText.textContent = 'Undo Move';
    }
  }

  // ==========================================
  // BOARD RENDERING & VISUAL STATE
  // ==========================================
  function renderGameState(state) {
    if (!state) return;

    const { boards, macroBoard, activeBoard, currentTurn, winner, validBoards, lastMove } = state;

    // Update Turn Indicator Banner
    playerXCard.classList.toggle('active-turn', currentTurn === 'X' && !winner);
    playerOCard.classList.toggle('active-turn', currentTurn === 'O' && !winner);

    if (winner) {
      turnInstruction.className = 'turn-instruction';
      turnInstructionIcon.textContent = '🏆';
      turnInstructionText.textContent = winner === 'T'
        ? "Grand Draw! All boards filled."
        : `Victory! Player ${winner} has won the match!`;
    } else if (activeBoard === -1) {
      turnInstruction.className = 'turn-instruction wildcard';
      turnInstructionIcon.textContent = '🌟';
      turnInstructionText.textContent = `${currentTurn}'s Turn — Free Move! Play in ANY open board.`;
    } else {
      turnInstruction.className = 'turn-instruction';
      turnInstructionIcon.textContent = '🎯';
      turnInstructionText.textContent = `${currentTurn}'s Turn — Play in: ${BOARD_NAMES[activeBoard]} Board`;
    }

    // Render 9 Mini-Boards
    for (let b = 0; b < 9; b++) {
      const miniBoardEl = boardContainer.children[b];
      const isDecided = macroBoard[b] !== null;
      const isValid = validBoards.includes(b);

      // Active target highlight
      miniBoardEl.classList.toggle('active-target', isValid && !winner);
      miniBoardEl.classList.toggle('inactive-board', !isValid && !isDecided && !winner);

      // Decided mini-board overlay
      let overlay = miniBoardEl.querySelector('.board-won-overlay');
      if (isDecided) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'board-won-overlay';
          miniBoardEl.appendChild(overlay);
        }
        overlay.className = `board-won-overlay won-${macroBoard[b].toLowerCase()}`;
        overlay.textContent = macroBoard[b];
      } else if (overlay) {
        overlay.remove();
      }

      // Render 9 Cells in this Mini-Board
      for (let c = 0; c < 9; c++) {
        const cellEl = miniBoardEl.children[c];
        const val = boards[b][c];

        cellEl.className = 'cell';
        cellEl.textContent = val || '';

        if (val === 'X') cellEl.classList.add('cell-x');
        if (val === 'O') cellEl.classList.add('cell-o');

        // Is cell clickable?
        const isClickable = !winner && isValid && val === null;
        if (isClickable) {
          cellEl.classList.add('clickable');
          cellEl.setAttribute('data-preview', currentTurn);
        } else {
          cellEl.removeAttribute('data-preview');
        }

        // Highlight last move played
        if (lastMove && lastMove.boardIndex === b && lastMove.cellIndex === c) {
          cellEl.classList.add('last-move-highlight');
        }
      }
    }
  }

  // ==========================================
  // MOVE HISTORY & CHAT DISPLAY
  // ==========================================
  function renderHistory(moves, appendOnly = false) {
    if (!appendOnly) {
      historyList.innerHTML = '';
      if (moves.length === 0) {
        historyList.innerHTML = `
          <div style="text-align: center; color: var(--text-dim); padding: 30px; font-size: 0.85rem;">
            No moves yet. Make the first move!
          </div>`;
        return;
      }
    }

    if (moves.length === 0) return;

    // Remove empty placeholder
    const emptyNotice = historyList.querySelector('div[style*="text-align: center"]');
    if (emptyNotice) emptyNotice.remove();

    for (const m of moves) {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <span class="history-num">#${m.moveNumber}</span>
        <span class="history-player ${m.player.toLowerCase()}">${m.player}</span>
        <div class="history-details">
          <strong>${m.boardName}</strong> → ${m.cellName}
        </div>
        ${m.wonBoard ? `<span class="history-tag won">Board Won!</span>` : ''}
      `;
      historyList.appendChild(item);
    }

    historyList.scrollTop = historyList.scrollHeight;
  }

  function appendChatMessage(sender, role, text, time) {
    const isMine = currentMode === 'online' ? (role === myOnlineRole) : (sender === 'You');

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMine ? 'mine' : 'theirs'}`;
    bubble.innerHTML = `
      <div class="chat-meta">
        <strong style="color: ${role === 'X' ? 'var(--color-x)' : role === 'O' ? 'var(--color-o)' : 'var(--text-dim)'};">${sender}</strong>
        <span>${time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div>${escapeHTML(text)}</div>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showGameOverModal(winner, reason) {
    gameOverTitle.textContent = winner === 'T' ? "It's a Grand Draw!" : `Player ${winner} Victorious!`;
    gameOverSubtitle.textContent = reason || (winner === 'T' ? 'All boards tied.' : `Conquered 3 boards in a row!`);
    gameOverEmoji.textContent = winner === 'T' ? '🤝' : '🏆';

    const totalMoves = currentMode === 'online'
      ? (onlineRoomData ? onlineRoomData.gameState.moveCount : 0)
      : localGame.moveHistory.length;
    statsTotalMoves.textContent = totalMoves;

    const elapsedSeconds = Math.round((Date.now() - gameStartTime) / 1000);
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    statsDuration.textContent = `${mins}:${secs}`;

    gameOverModal.classList.add('open');
  }

  function showToast(message, type = 'gold') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'danger' ? '✕' : 'ℹ'}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Run on page load
  window.addEventListener('DOMContentLoaded', init);
})();
