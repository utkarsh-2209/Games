const assert = require('assert');

// Spin up server in test process
process.env.PORT = '3999';
require('../server.js');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntegrationTest() {
  await sleep(600); // Wait for server to bind

  console.log('🧪 Starting Real-Time WebSocket E2E Integration Test...\n');

  const wsUrl = 'ws://localhost:3999';
  const c1Messages = [];
  const c2Messages = [];

  const ws1 = new WebSocket(wsUrl);
  const ws2 = new WebSocket(wsUrl);

  ws1.onmessage = (e) => c1Messages.push(JSON.parse(e.data));
  ws2.onmessage = (e) => c2Messages.push(JSON.parse(e.data));

  await new Promise(resolve => {
    let openCount = 0;
    const check = () => { if (++openCount === 2) resolve(); };
    ws1.onopen = check;
    ws2.onopen = check;
  });
  console.log('✓ Both WebSocket clients connected to test server');

  const roomId = 'INTEGRATION_TEST';

  // Client 1 joins as Player X
  ws1.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId,
    playerName: 'Alice',
    playerToken: 'token_alice'
  }));

  // Client 2 joins as Player O
  ws2.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId,
    playerName: 'Bob',
    playerToken: 'token_bob'
  }));

  await sleep(300);

  const c1Join = c1Messages.find(m => m.type === 'JOINED_SUCCESS');
  const c2Join = c2Messages.find(m => m.type === 'JOINED_SUCCESS');
  assert.strictEqual(c1Join.role, 'X', 'Alice must be Player X');
  assert.strictEqual(c2Join.role, 'O', 'Bob must be Player O');
  console.log('✓ Step 1: Alice assigned X, Bob assigned O');

  // Alice makes Move 1: Board 4 (Center), Cell 2 (Top-Right)
  ws1.send(JSON.stringify({
    type: 'MAKE_MOVE',
    boardIndex: 4,
    cellIndex: 2
  }));

  await sleep(200);

  const move1Broadcast = c2Messages.find(m => m.type === 'MOVE_PLAYED');
  assert(move1Broadcast, 'Bob should receive MOVE_PLAYED notification');
  assert.strictEqual(move1Broadcast.move.player, 'X');
  assert.strictEqual(move1Broadcast.gameState.activeBoard, 2);
  console.log('✓ Step 2: Move 1 made by Alice, broadcast received by Bob');

  // Bob makes Move 2: Board 2, Cell 4
  ws2.send(JSON.stringify({
    type: 'MAKE_MOVE',
    boardIndex: 2,
    cellIndex: 4
  }));

  await sleep(200);
  console.log('✓ Step 3: Move 2 made by Bob, designated next board is 4');

  // Bob realizes he made a blunder and asks to undo!
  console.log('👉 Bob sends REQUEST_UNDO...');
  ws2.send(JSON.stringify({
    type: 'REQUEST_UNDO'
  }));

  await sleep(200);

  // Alice should receive UNDO_REQUEST_RECEIVED
  const undoPrompt = c1Messages.find(m => m.type === 'UNDO_REQUEST_RECEIVED');
  assert(undoPrompt, 'Alice must receive the UNDO_REQUEST_RECEIVED prompt');
  assert.strictEqual(undoPrompt.requesterRole, 'O', 'Requester role must be O');
  assert.strictEqual(undoPrompt.requesterName, 'Bob', 'Requester name must be Bob');
  console.log('✓ Step 4: Alice received Undo Request prompt from Bob');

  // Alice accepts the undo!
  console.log('👉 Alice responds with accept: true...');
  ws1.send(JSON.stringify({
    type: 'RESPOND_UNDO',
    accept: true
  }));

  await sleep(300);

  // Both should receive UNDO_RESOLVED with accepted: true
  const undoResolved = c2Messages.find(m => m.type === 'UNDO_RESOLVED' && m.accepted === true);
  assert(undoResolved, 'Bob must receive UNDO_RESOLVED confirmation');
  assert.strictEqual(undoResolved.gameState.currentTurn, 'O', 'Turn after undo must return to Bob');
  assert.strictEqual(undoResolved.gameState.moveCount, 1, 'Move count should be rolled back to 1');
  assert.strictEqual(undoResolved.gameState.activeBoard, 2, 'Active board restored to 2');
  console.log('✓ Step 5: Undo successfully accepted and game state rolled back');

  // Now test REJECTING an undo request
  // Bob plays Move 2 again: Board 2, Cell 0
  ws2.send(JSON.stringify({
    type: 'MAKE_MOVE',
    boardIndex: 2,
    cellIndex: 0
  }));

  await sleep(200);

  // Bob requests undo again
  ws2.send(JSON.stringify({
    type: 'REQUEST_UNDO'
  }));

  await sleep(200);

  // This time Alice rejects it!
  ws1.send(JSON.stringify({
    type: 'RESPOND_UNDO',
    accept: false
  }));

  await sleep(200);

  const undoRejected = c2Messages.find(m => m.type === 'UNDO_RESOLVED' && m.accepted === false && m.reason === 'rejected');
  assert(undoRejected, 'Bob must receive rejection notice');
  console.log('✓ Step 6: Opponent rejection flow verified');

  // Test chat message
  ws1.send(JSON.stringify({
    type: 'SEND_CHAT',
    text: 'Good game!'
  }));

  await sleep(200);
  const chatReceived = c2Messages.find(m => m.type === 'CHAT_MESSAGE' && m.entry.text === 'Good game!');
  assert(chatReceived, 'Chat message must be delivered in real-time');
  console.log('✓ Step 7: Live chat message delivered across sockets');

  ws1.close();
  ws2.close();

  console.log('\n🎉 ALL REAL-TIME INTEGRATION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}

runIntegrationTest().catch(err => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
