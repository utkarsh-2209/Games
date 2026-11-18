/**
 * Snakes and Ladders Core Engine
 * 100 Tiles (1 to 100), standard layout, snakes and ladders definitions.
 */

const SNAKES = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78
};

const LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91
};

const PLAYER_COLORS = ['#ff3366', '#00e5ff', '#10b981', '#f59e0b'];
const PLAYER_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];

class SnakesGame {
  constructor(numPlayers = 2) {
    this.numPlayers = Math.min(4, Math.max(2, numPlayers));
    this.reset();
  }

  reset() {
    this.positions = Array(this.numPlayers).fill(0); // 0 means not started, 1 to 100
    this.currentTurn = 0; // index 0..numPlayers-1
    this.lastDice = null;
    this.winner = null;
    this.moveHistory = [];
    this.startedAt = Date.now();
  }

  getState() {
    return {
      positions: [...this.positions],
      currentTurn: this.currentTurn,
      lastDice: this.lastDice,
      winner: this.winner,
      numPlayers: this.numPlayers,
      moveCount: this.moveHistory.length,
      lastMove: this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null
    };
  }

  rollAndMove(playerIndex = this.currentTurn, fixedDice = null) {
    if (this.winner !== null) return { valid: false, reason: 'Game has already ended' };
    if (playerIndex !== this.currentTurn) return { valid: false, reason: 'Not your turn' };

    const dice = fixedDice || (Math.floor(Math.random() * 6) + 1);
    this.lastDice = dice;

    const prevPos = this.positions[playerIndex];
    let newPos = prevPos === 0 ? dice : (prevPos + dice);
    let event = null; // 'ladder' | 'snake' | 'bounce' | null

    if (newPos > 100) {
      // Must land exactly on 100 (bounces back)
      const excess = newPos - 100;
      newPos = 100 - excess;
      event = 'bounce';
    }

    let finalPos = newPos;
    if (LADDERS[newPos]) {
      finalPos = LADDERS[newPos];
      event = 'ladder';
    } else if (SNAKES[newPos]) {
      finalPos = SNAKES[newPos];
      event = 'snake';
    }

    this.positions[playerIndex] = finalPos;

    const moveRecord = {
      moveNumber: this.moveHistory.length + 1,
      playerIndex,
      playerName: PLAYER_NAMES[playerIndex],
      playerColor: PLAYER_COLORS[playerIndex],
      dice,
      from: prevPos,
      steppedTo: newPos,
      to: finalPos,
      event,
      timestamp: Date.now()
    };

    if (finalPos === 100) {
      this.winner = playerIndex;
      moveRecord.wonGame = true;
    }

    this.moveHistory.push(moveRecord);

    // If rolled a 6, get an extra turn (unless already won)
    const extraTurn = (dice === 6 && this.winner === null);
    if (!extraTurn && this.winner === null) {
      this.currentTurn = (this.currentTurn + 1) % this.numPlayers;
    }

    return {
      valid: true,
      move: moveRecord,
      extraTurn,
      state: this.getState()
    };
  }

  undo(steps = 1) {
    if (this.moveHistory.length === 0) return { success: false, reason: 'No moves to undo' };

    const targetCount = Math.max(0, this.moveHistory.length - steps);
    const movesToReplay = this.moveHistory.slice(0, targetCount);

    this.reset();
    for (const m of movesToReplay) {
      this.rollAndMove(m.playerIndex, m.dice);
    }

    return { success: true, state: this.getState() };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SnakesGame,
    SNAKES,
    LADDERS,
    PLAYER_COLORS,
    PLAYER_NAMES
  };
}
