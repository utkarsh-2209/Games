const assert = require('assert');
const { UltimateTTT, BOARD_NAMES } = require('../public/game-engine.js');
const AI = require('../public/ai.js');

console.log('🧪 Starting Ultimate Tic-Tac-Toe Test Suite...\n');

// 1. Initial State Test
const game = new UltimateTTT();
assert.strictEqual(game.currentTurn, 'X', 'First player should be X');
assert.strictEqual(game.activeBoard, -1, 'Initial active board should be -1 (Wildcard)');
assert.strictEqual(game.winner, null, 'Game winner should initially be null');
assert.strictEqual(game.boards.length, 9, 'Should have 9 mini-boards');
assert.strictEqual(game.boards[0].length, 9, 'Each mini-board should have 9 cells');
console.log('✓ Test 1: Initial state verified');

// 2. First Move & Redirection Test
let res = game.makeMove(4, 2, 'X'); // Board 4 (Center), Cell 2 (Top-Right)
assert.strictEqual(res.valid, true, 'First move should be valid');
assert.strictEqual(game.currentTurn, 'O', 'Next turn must be O');
assert.strictEqual(game.activeBoard, 2, 'Next active board must be 2 (Top-Right)');
assert.deepStrictEqual(game.getValidBoards(), [2], 'Only board 2 should be valid');
console.log('✓ Test 2: Move execution and opponent redirection verified');

// 3. Illegal Move Detection Test
let illegal = game.makeMove(5, 0, 'O'); // Trying to play in board 5 when active is 2
assert.strictEqual(illegal.valid, false, 'Move in wrong board must be rejected');
console.log('✓ Test 3: Out-of-bounds / inactive board moves blocked');

// 4. Opponent Playing in Target Board
res = game.makeMove(2, 4, 'O'); // Board 2, Cell 4
assert.strictEqual(res.valid, true);
assert.strictEqual(game.activeBoard, 4, 'Next active board must be 4');
assert.strictEqual(game.currentTurn, 'X');
console.log('✓ Test 4: Follow-up move in designated board verified');

// 5. Undo Test (Popping moves and restoring exact prior state)
assert.strictEqual(game.moveHistory.length, 2, 'History should have 2 moves');
let undoRes = game.undo(1);
assert.strictEqual(undoRes.success, true);
assert.strictEqual(game.moveHistory.length, 1, 'History after undo should have 1 move');
assert.strictEqual(game.currentTurn, 'O', 'Turn after undo must return to O');
assert.strictEqual(game.activeBoard, 2, 'Active board after undo must return to 2');
assert.strictEqual(game.boards[2][4], null, 'Undone cell must be null');
console.log('✓ Test 5: Undo rollback state restored cleanly');

// 6. Mini-Board Win Test
const directWinGame = new UltimateTTT();
directWinGame.boards[0] = ['X', 'X', null, null, null, null, null, null, null];
directWinGame.activeBoard = 0;
directWinGame.currentTurn = 'X';
let winRes = directWinGame.makeMove(0, 2, 'X');
assert.strictEqual(winRes.valid, true);
assert.strictEqual(directWinGame.macroBoard[0], 'X', 'Board 0 should now be marked won by X');
console.log('✓ Test 6: Local mini-board win detection verified');

// 7. Wildcard / Free Move Test when target board is won
const wildcardGame = new UltimateTTT();
// Mark Board 5 as already won by 'O'
wildcardGame.macroBoard[5] = 'O';
// Player X plays in Board 1 (open), Cell 5 (which points to Board 5)
wildcardGame.activeBoard = 1;
wildcardGame.currentTurn = 'X';
let wildRes = wildcardGame.makeMove(1, 5, 'X');
assert.strictEqual(wildRes.valid, true, 'Move should be valid');
assert.strictEqual(wildcardGame.activeBoard, -1, 'When target board is won, next active board must be -1 (Wildcard Free Move)');
console.log('✓ Test 7: Wildcard free move trigger verified');

// 8. AI Bot Test
const aiGame = new UltimateTTT();
aiGame.makeMove(4, 1, 'X'); // Target board is 1
const aiMove = AI.getAIMove(aiGame, 'hard', 'O');
assert.strictEqual(aiMove.boardIndex, 1, 'AI must choose a move in active board 1');
console.log('✓ Test 8: AI heuristics and valid move generation verified');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
