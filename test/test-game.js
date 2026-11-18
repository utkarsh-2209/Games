const assert = require('assert');
const { UltimateTTT, BOARD_NAMES } = require('../public/game-engine.js');
const { SnakesGame, SNAKES, LADDERS } = require('../public/snakes-engine.js');
const { LudoGame } = require('../public/ludo-engine.js');
const AI = require('../public/ai.js');

console.log('🧪 Starting Multi-Game Hub Test Suite...\n');

// ==========================================
// 1. Ultimate Tic-Tac-Toe Tests
// ==========================================
const game = new UltimateTTT();
assert.strictEqual(game.currentTurn, 'X');
assert.strictEqual(game.activeBoard, -1);
let res = game.makeMove(4, 2, 'X');
assert.strictEqual(res.valid, true);
assert.strictEqual(game.activeBoard, 2);
assert.strictEqual(game.currentTurn, 'O');

// Test Undo on TTT
let undoRes = game.undo(1);
assert.strictEqual(undoRes.success, true);
assert.strictEqual(game.currentTurn, 'X');
console.log('✓ Game 1: Ultimate Tic-Tac-Toe core & undo verified');

// ==========================================
// 2. Snakes & Ladders Tests
// ==========================================
const snakes = new SnakesGame(2);
assert.strictEqual(snakes.positions[0], 0);
assert.strictEqual(snakes.positions[1], 0);

// Roll 4: Lands on Ladder 4 -> Climbs to 14
let sRes = snakes.rollAndMove(0, 4);
assert.strictEqual(sRes.valid, true);
assert.strictEqual(snakes.positions[0], 14, 'Ladder 4 should elevate player to 14');
assert.strictEqual(sRes.move.event, 'ladder');

// Test Snake landing
const snakeRun = new SnakesGame(2);
snakeRun.rollAndMove(0, 4); // P0: 4 -> Ladder 14
snakeRun.rollAndMove(1, 10); // P1 lands on 10
assert.strictEqual(snakeRun.positions[1], 10);

snakeRun.rollAndMove(0, 1); // P0 lands on 15
snakeRun.rollAndMove(1, 7); // P1: 10 + 7 = 17 -> Snake 17 drops to 7
assert.strictEqual(snakeRun.positions[1], 7, 'Snake 17 should drop player to 7');

// Test Undo on Snakes
let sUndo = snakeRun.undo(1);
assert.strictEqual(sUndo.success, true);
assert.strictEqual(snakeRun.positions[1], 10, 'Undoing should restore position 10');
console.log('✓ Game 2: Snakes & Ladders ladders, snakes, & undo verified');

// ==========================================
// 3. Ludo Tests
// ==========================================
const ludo = new LudoGame(2, 4);
assert.strictEqual(ludo.tokens[0][0], -1, 'Tokens start in yard (-1)');

// Roll a 6 for Player 0: Can release tokens from yard!
let lRoll = ludo.rollDice(0, 6);
assert.strictEqual(lRoll.valid, true);
assert.strictEqual(lRoll.validTokens.length, 4, 'Can release any of 4 tokens from yard with roll 6');

let lMove = ludo.moveToken(0, 0);
assert.strictEqual(lMove.valid, true);
assert.strictEqual(ludo.tokens[0][0], 0, 'Token 0 is now on starting track square');

// Test Undo on Ludo
let lUndo = ludo.undo(1);
assert.strictEqual(lUndo.success, true);
assert.strictEqual(ludo.tokens[0][0], -1, 'Undoing should return token back to yard');
console.log('✓ Game 3: Ludo yard release, track movement & undo verified');

console.log('\n🎉 ALL 3 GAMES ENGINE & UNDO TESTS PASSED PERFECTLY!\n');
