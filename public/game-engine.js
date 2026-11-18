/**
 * Ultimate Tic-Tac-Toe (9x9) Core Game Engine
 * 
 * Macro Board: 3x3 grid of 9 mini-boards (indices 0..8)
 * Micro Board: 3x3 grid of 9 cells (indices 0..8)
 * 
 * Layout of 9 boards (and 9 cells within each board):
 * [0: Top-Left]   [1: Top-Center]   [2: Top-Right]
 * [3: Mid-Left]   [4: Center]       [5: Mid-Right]
 * [6: Bot-Left]   [7: Bot-Center]   [8: Bot-Right]
 */

const WINNING_LINES = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // cols
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6]
];

const BOARD_NAMES = [
  'Top-Left',   'Top-Center',   'Top-Right',
  'Mid-Left',   'Center',       'Mid-Right',
  'Bottom-Left','Bottom-Center','Bottom-Right'
];

function check3x3Win(cells) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] !== 'T' && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { winner: cells[a], line };
    }
  }
  return null;
}

function is3x3Full(cells) {
  return cells.every(c => c !== null);
}

class UltimateTTT {
  constructor() {
    this.reset();
  }

  reset() {
    // 9 mini-boards, each with 9 cells initialized to null
    this.boards = Array.from({ length: 9 }, () => Array(9).fill(null));
    // Status of each mini-board: null (in progress), 'X', 'O', or 'T' (tie)
    this.macroBoard = Array(9).fill(null);
    // Line indices that won each mini-board: { [boardIndex]: [a, b, c] }
    this.localWinningLines = {};
    // Active board index (0..8) or -1 for wildcard (free move in any uncompleted board)
    this.activeBoard = -1;
    // Current player: 'X' or 'O'
    this.currentTurn = 'X';
    // Macro game winner: null, 'X', 'O', or 'T'
    this.winner = null;
    this.macroWinningLine = null;
    // History stack of moves for full state reconstruction and undo
    this.moveHistory = [];
    this.startedAt = Date.now();
  }

  /**
   * Return a clean serializable snapshot of the current game state
   */
  getState() {
    return {
      boards: this.boards.map(b => [...b]),
      macroBoard: [...this.macroBoard],
      localWinningLines: { ...this.localWinningLines },
      activeBoard: this.activeBoard,
      currentTurn: this.currentTurn,
      winner: this.winner,
      macroWinningLine: this.macroWinningLine,
      moveCount: this.moveHistory.length,
      lastMove: this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null,
      validBoards: this.getValidBoards()
    };
  }

  /**
   * Returns list of board indices (0..8) where moves are currently allowed
   */
  getValidBoards() {
    if (this.winner) return [];
    if (this.activeBoard !== -1 && this.macroBoard[this.activeBoard] === null) {
      return [this.activeBoard];
    }
    // Wildcard: any board that is not yet decided (won or tied)
    const valid = [];
    for (let i = 0; i < 9; i++) {
      if (this.macroBoard[i] === null && !is3x3Full(this.boards[i])) {
        valid.push(i);
      }
    }
    return valid;
  }

  /**
   * Validate if a move is legal
   */
  isValidMove(boardIndex, cellIndex, player) {
    if (this.winner) return { valid: false, reason: 'Game has already ended' };
    if (player && player !== this.currentTurn) {
      return { valid: false, reason: `It is ${this.currentTurn}'s turn` };
    }
    if (boardIndex < 0 || boardIndex > 8 || cellIndex < 0 || cellIndex > 8) {
      return { valid: false, reason: 'Invalid board or cell index' };
    }
    if (this.macroBoard[boardIndex] !== null) {
      return { valid: false, reason: 'This mini-board is already completed' };
    }
    const validBoards = this.getValidBoards();
    if (!validBoards.includes(boardIndex)) {
      return { valid: false, reason: `Move must be played in ${BOARD_NAMES[this.activeBoard] || 'an active board'}` };
    }
    if (this.boards[boardIndex][cellIndex] !== null) {
      return { valid: false, reason: 'Cell is already occupied' };
    }
    return { valid: true };
  }

  /**
   * Execute a move
   */
  makeMove(boardIndex, cellIndex, player = this.currentTurn) {
    const check = this.isValidMove(boardIndex, cellIndex, player);
    if (!check.valid) return check;

    // Apply move
    this.boards[boardIndex][cellIndex] = player;

    // Record in history before state modifications
    const moveRecord = {
      moveNumber: this.moveHistory.length + 1,
      boardIndex,
      cellIndex,
      boardName: BOARD_NAMES[boardIndex],
      cellName: BOARD_NAMES[cellIndex],
      player,
      timestamp: Date.now()
    };
    this.moveHistory.push(moveRecord);

    // Check if mini-board is won
    const localWin = check3x3Win(this.boards[boardIndex]);
    if (localWin) {
      this.macroBoard[boardIndex] = localWin.winner;
      this.localWinningLines[boardIndex] = localWin.line;
      moveRecord.wonBoard = localWin.winner;
    } else if (is3x3Full(this.boards[boardIndex])) {
      this.macroBoard[boardIndex] = 'T'; // Tie
      moveRecord.wonBoard = 'T';
    }

    // Check if macro game is won
    const macroWin = check3x3Win(this.macroBoard);
    if (macroWin) {
      this.winner = macroWin.winner;
      this.macroWinningLine = macroWin.line;
      this.activeBoard = -1;
      moveRecord.wonGame = macroWin.winner;
      return { valid: true, state: this.getState() };
    }

    // Check macro tie (all mini-boards decided or all full)
    const allDecided = this.macroBoard.every(b => b !== null);
    if (allDecided) {
      // Count boards won
      const xWins = this.macroBoard.filter(b => b === 'X').length;
      const oWins = this.macroBoard.filter(b => b === 'O').length;
      if (xWins > oWins) {
        this.winner = 'X';
      } else if (oWins > xWins) {
        this.winner = 'O';
      } else {
        this.winner = 'T';
      }
      this.activeBoard = -1;
      moveRecord.wonGame = this.winner;
      return { valid: true, state: this.getState() };
    }

    // Determine next active board:
    // The cellIndex of the current move dictates the next mini-board!
    const targetBoard = cellIndex;
    if (this.macroBoard[targetBoard] !== null || is3x3Full(this.boards[targetBoard])) {
      // Target board is already completed or full: next player gets a Free Move / Wildcard!
      this.activeBoard = -1;
    } else {
      this.activeBoard = targetBoard;
    }

    // Switch turn
    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';

    return { valid: true, state: this.getState() };
  }

  /**
   * Undo the last move (or rollback n moves)
   * Safely recalculates complete deterministic state from the pruned move history.
   */
  undo(steps = 1) {
    if (this.moveHistory.length === 0) {
      return { success: false, reason: 'No moves to undo' };
    }

    const targetLength = Math.max(0, this.moveHistory.length - steps);
    const movesToReplay = this.moveHistory.slice(0, targetLength);

    // Reset board
    this.reset();

    // Replay moves up to target
    for (const m of movesToReplay) {
      this.makeMove(m.boardIndex, m.cellIndex, m.player);
    }

    return { success: true, state: this.getState() };
  }
}

// Support both Node.js (CommonJS) and browser ES modules / scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UltimateTTT,
    WINNING_LINES,
    BOARD_NAMES,
    check3x3Win,
    is3x3Full
  };
}
