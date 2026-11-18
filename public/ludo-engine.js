/**
 * Ludo Game Core Engine
 * 4 Players: 0: Red, 1: Green, 2: Yellow, 3: Blue
 * 4 Tokens per player: [0, 1, 2, 3]
 * 52 Common Track Squares (0..51)
 * 5 Home Column Squares (100..104) + 1 Goal Square (105)
 * Yard: -1
 */

const LUDO_COLORS = ['#ff3366', '#10b981', '#f59e0b', '#00e5ff'];
const LUDO_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];

// Track starting index on the 52 common squares
const START_SQUARES = [0, 13, 26, 39];
// Safe squares where tokens cannot be captured
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

class LudoGame {
  constructor(numPlayers = 2, tokensPerPlayer = 4) {
    this.numPlayers = Math.min(4, Math.max(2, numPlayers));
    this.tokensPerPlayer = tokensPerPlayer; // 4 tokens standard (or 2 for quick match)
    this.reset();
  }

  reset() {
    // Array of numPlayers, each having tokensPerPlayer tokens with their step count
    // stepCount: -1 = yard, 0..50 = on track (steps from start), 51..55 = home column, 56 = finished!
    this.tokens = Array.from({ length: this.numPlayers }, () => 
      Array(this.tokensPerPlayer).fill(-1)
    );
    this.currentTurn = 0;
    this.lastDice = null;
    this.diceRolled = false;
    this.consecutiveSixes = 0;
    this.winner = null;
    this.moveHistory = [];
    this.startedAt = Date.now();
  }

  getState() {
    return {
      tokens: this.tokens.map(t => [...t]),
      currentTurn: this.currentTurn,
      lastDice: this.lastDice,
      diceRolled: this.diceRolled,
      validTokens: this.diceRolled ? this.getValidTokensToMove(this.currentTurn, this.lastDice) : [],
      winner: this.winner,
      numPlayers: this.numPlayers,
      tokensPerPlayer: this.tokensPerPlayer,
      moveCount: this.moveHistory.length,
      lastMove: this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null
    };
  }

  /**
   * Convert relative stepsFromStart (0..56) to absolute board tile
   */
  getAbsolutePosition(playerIndex, steps) {
    if (steps === -1) return { type: 'yard', index: -1 };
    if (steps >= 56) return { type: 'goal', index: 105 };
    if (steps >= 51) {
      // In home corridor
      return { type: 'home_column', index: 100 + (steps - 51) };
    }
    // On circular 52 track
    const trackIndex = (START_SQUARES[playerIndex] + steps) % 52;
    return { type: 'track', index: trackIndex };
  }

  rollDice(playerIndex = this.currentTurn, fixedDice = null) {
    if (this.winner !== null) return { valid: false, reason: 'Game has already ended' };
    if (playerIndex !== this.currentTurn) return { valid: false, reason: 'Not your turn' };
    if (this.diceRolled) return { valid: false, reason: 'Dice already rolled. Please move a token.' };

    const dice = fixedDice || (Math.floor(Math.random() * 6) + 1);
    this.lastDice = dice;
    this.diceRolled = true;

    if (dice === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes === 3) {
        // 3 consecutive 6s penalty: turn is lost!
        this.consecutiveSixes = 0;
        this.diceRolled = false;
        this.currentTurn = (this.currentTurn + 1) % this.numPlayers;
        return {
          valid: true,
          dice,
          threeSixesPenalty: true,
          state: this.getState()
        };
      }
    } else {
      this.consecutiveSixes = 0;
    }

    const validTokens = this.getValidTokensToMove(playerIndex, dice);

    // If no moves are possible, automatically pass turn
    let passed = false;
    if (validTokens.length === 0) {
      passed = true;
      this.diceRolled = false;
      if (dice !== 6) {
        this.currentTurn = (this.currentTurn + 1) % this.numPlayers;
      }
    }

    return {
      valid: true,
      dice,
      validTokens,
      passed,
      state: this.getState()
    };
  }

  getValidTokensToMove(playerIndex, dice) {
    const valid = [];
    const playerTokens = this.tokens[playerIndex];

    for (let t = 0; t < this.tokensPerPlayer; t++) {
      const steps = playerTokens[t];
      if (steps === 56) continue; // Already at goal

      if (steps === -1) {
        // In yard: only can move out on a 6
        if (dice === 6) valid.push(t);
      } else if (steps + dice <= 56) {
        // Can advance towards or into goal
        valid.push(t);
      }
    }
    return valid;
  }

  moveToken(tokenIndex, playerIndex = this.currentTurn) {
    if (this.winner !== null) return { valid: false, reason: 'Game over' };
    if (playerIndex !== this.currentTurn) return { valid: false, reason: 'Not your turn' };
    if (!this.diceRolled) return { valid: false, reason: 'Must roll dice first' };

    const dice = this.lastDice;
    const validTokens = this.getValidTokensToMove(playerIndex, dice);

    if (!validTokens.includes(tokenIndex)) {
      return { valid: false, reason: 'Invalid token move for this roll' };
    }

    const prevSteps = this.tokens[playerIndex][tokenIndex];
    let newSteps;
    if (prevSteps === -1) {
      newSteps = 0; // Move out of yard onto start tile
    } else {
      newSteps = prevSteps + dice;
    }

    this.tokens[playerIndex][tokenIndex] = newSteps;

    // Check for capturing opponent tokens
    let captured = null;
    const newPos = this.getAbsolutePosition(playerIndex, newSteps);

    if (newPos.type === 'track' && !SAFE_SQUARES.includes(newPos.index)) {
      for (let p = 0; p < this.numPlayers; p++) {
        if (p === playerIndex) continue;
        for (let t = 0; t < this.tokensPerPlayer; t++) {
          const oppPos = this.getAbsolutePosition(p, this.tokens[p][t]);
          if (oppPos.type === 'track' && oppPos.index === newPos.index) {
            // Captured! Send back to yard
            this.tokens[p][t] = -1;
            captured = { playerIndex: p, tokenIndex: t, square: newPos.index };
            break;
          }
        }
        if (captured) break;
      }
    }

    // Check if player won (all tokens reached 56)
    const allHome = this.tokens[playerIndex].every(s => s === 56);
    if (allHome) {
      this.winner = playerIndex;
    }

    const moveRecord = {
      moveNumber: this.moveHistory.length + 1,
      playerIndex,
      tokenIndex,
      dice,
      from: prevSteps,
      to: newSteps,
      captured,
      wonGame: allHome,
      timestamp: Date.now()
    };
    this.moveHistory.push(moveRecord);

    // Turn transition: extra turn if rolled 6 or captured an opponent!
    const extraTurn = (dice === 6 || captured !== null) && (this.winner === null);
    this.diceRolled = false;

    if (!extraTurn && this.winner === null) {
      this.currentTurn = (this.currentTurn + 1) % this.numPlayers;
    }

    return {
      valid: true,
      move: moveRecord,
      captured,
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
      this.rollDice(m.playerIndex, m.dice);
      this.moveToken(m.tokenIndex, m.playerIndex);
    }

    return { success: true, state: this.getState() };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LudoGame,
    LUDO_COLORS,
    LUDO_NAMES,
    START_SQUARES,
    SAFE_SQUARES
  };
}
