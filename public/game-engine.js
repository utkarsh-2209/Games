/**
 * Ultimate Tic-Tac-Toe (9x9) Core Game Engine
 */

(function (root) {
  'use strict';

  const WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
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
      this.boards = Array.from({ length: 9 }, () => Array(9).fill(null));
      this.macroBoard = Array(9).fill(null);
      this.localWinningLines = {};
      this.activeBoard = -1;
      this.currentTurn = 'X';
      this.winner = null;
      this.macroWinningLine = null;
      this.moveHistory = [];
      this.startedAt = Date.now();
    }

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

    getValidBoards() {
      if (this.winner) return [];
      if (this.activeBoard !== -1 && this.macroBoard[this.activeBoard] === null) {
        return [this.activeBoard];
      }
      const valid = [];
      for (let i = 0; i < 9; i++) {
        if (this.macroBoard[i] === null && !is3x3Full(this.boards[i])) {
          valid.push(i);
        }
      }
      return valid;
    }

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

    makeMove(boardIndex, cellIndex, player = this.currentTurn) {
      const check = this.isValidMove(boardIndex, cellIndex, player);
      if (!check.valid) return check;

      this.boards[boardIndex][cellIndex] = player;

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

      const localWin = check3x3Win(this.boards[boardIndex]);
      if (localWin) {
        this.macroBoard[boardIndex] = localWin.winner;
        this.localWinningLines[boardIndex] = localWin.line;
        moveRecord.wonBoard = localWin.winner;
      } else if (is3x3Full(this.boards[boardIndex])) {
        this.macroBoard[boardIndex] = 'T';
        moveRecord.wonBoard = 'T';
      }

      const macroWin = check3x3Win(this.macroBoard);
      if (macroWin) {
        this.winner = macroWin.winner;
        this.macroWinningLine = macroWin.line;
        this.activeBoard = -1;
        moveRecord.wonGame = macroWin.winner;
        return { valid: true, state: this.getState() };
      }

      const allDecided = this.macroBoard.every(b => b !== null);
      if (allDecided) {
        const xWins = this.macroBoard.filter(b => b === 'X').length;
        const oWins = this.macroBoard.filter(b => b === 'O').length;
        if (xWins > oWins) this.winner = 'X';
        else if (oWins > xWins) this.winner = 'O';
        else this.winner = 'T';
        this.activeBoard = -1;
        moveRecord.wonGame = this.winner;
        return { valid: true, state: this.getState() };
      }

      const targetBoard = cellIndex;
      if (this.macroBoard[targetBoard] !== null || is3x3Full(this.boards[targetBoard])) {
        this.activeBoard = -1;
      } else {
        this.activeBoard = targetBoard;
      }

      this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
      return { valid: true, state: this.getState() };
    }

    undo(steps = 1) {
      if (this.moveHistory.length === 0) {
        return { success: false, reason: 'No moves to undo' };
      }

      const targetLength = Math.max(0, this.moveHistory.length - steps);
      const movesToReplay = this.moveHistory.slice(0, targetLength);

      this.reset();
      for (const m of movesToReplay) {
        this.makeMove(m.boardIndex, m.cellIndex, m.player);
      }

      return { success: true, state: this.getState() };
    }
  }

  // Export to window in browser
  root.UltimateTTT = UltimateTTT;
  root.WINNING_LINES = WINNING_LINES;
  root.BOARD_NAMES = BOARD_NAMES;
  root.check3x3Win = check3x3Win;
  root.is3x3Full = is3x3Full;

  // Export to Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      UltimateTTT,
      WINNING_LINES,
      BOARD_NAMES,
      check3x3Win,
      is3x3Full
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
