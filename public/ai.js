/**
 * AI Bot for Ultimate Tic-Tac-Toe
 * Supports 3 difficulty levels: 'easy', 'medium', 'hard'
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./game-engine.js'));
  } else {
    root.UltimateAI = factory(root);
  }
})(typeof self !== 'undefined' ? self : this, function (engine) {
  const { WINNING_LINES, check3x3Win, is3x3Full } = engine;

  // Board importance weights (Center is highest, corners next, edges lowest)
  const BOARD_WEIGHTS = [3, 2, 3, 2, 5, 2, 3, 2, 3];
  const CELL_WEIGHTS  = [3, 2, 3, 2, 4, 2, 3, 2, 3];

  function getAllPossibleMoves(game) {
    const validBoards = game.getValidBoards();
    const moves = [];
    for (const b of validBoards) {
      for (let c = 0; c < 9; c++) {
        if (game.boards[b][c] === null) {
          moves.push({ boardIndex: b, cellIndex: c });
        }
      }
    }
    return moves;
  }

  function getAIMove(game, difficulty = 'medium', aiPlayer = 'O') {
    const moves = getAllPossibleMoves(game);
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const opponent = aiPlayer === 'X' ? 'O' : 'X';

    // 1. Can AI immediately win the entire MACRO game with one move?
    for (const move of moves) {
      const bClone = [...game.boards[move.boardIndex]];
      bClone[move.cellIndex] = aiPlayer;
      const win = check3x3Win(bClone);
      if (win) {
        const macroClone = [...game.macroBoard];
        macroClone[move.boardIndex] = aiPlayer;
        if (check3x3Win(macroClone)) {
          return move; // Winning the whole game!
        }
      }
    }

    // 2. Can Opponent win the MACRO game if they get this board? Block them!
    for (const move of moves) {
      const bClone = [...game.boards[move.boardIndex]];
      bClone[move.cellIndex] = opponent;
      const oppWin = check3x3Win(bClone);
      if (oppWin) {
        const macroClone = [...game.macroBoard];
        macroClone[move.boardIndex] = opponent;
        if (check3x3Win(macroClone)) {
          return move; // Must block opponent from winning macro game!
        }
      }
    }

    // 3. Can AI win the local board?
    const boardWinningMoves = [];
    for (const move of moves) {
      const bClone = [...game.boards[move.boardIndex]];
      bClone[move.cellIndex] = aiPlayer;
      if (check3x3Win(bClone)) {
        boardWinningMoves.push(move);
      }
    }

    if (difficulty === 'medium' && boardWinningMoves.length > 0) {
      // Pick best board winning move that doesn't hand opponent a free win
      return pickSafestMove(game, boardWinningMoves, opponent);
    }

    // 4. Block opponent from winning the local board
    const blockWinningMoves = [];
    for (const move of moves) {
      const bClone = [...game.boards[move.boardIndex]];
      bClone[move.cellIndex] = opponent;
      if (check3x3Win(bClone)) {
        blockWinningMoves.push(move);
      }
    }

    if (blockWinningMoves.length > 0) {
      return blockWinningMoves[Math.floor(Math.random() * blockWinningMoves.length)];
    }

    if (difficulty === 'medium') {
      // Pick safest random move
      return pickSafestMove(game, moves, opponent);
    }

    // 5. HARD DIFFICULTY: Heuristic scoring evaluation
    let bestScore = -Infinity;
    let bestMove = moves[0];

    for (const move of moves) {
      let score = evaluateMove(game, move, aiPlayer, opponent);
      // Small jitter so AI doesn't play identically every single time
      score += Math.random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  function pickSafestMove(game, candidateMoves, opponent) {
    // Avoid sending opponent to a board where they can win immediately
    const safeMoves = candidateMoves.filter(m => {
      const targetBoard = m.cellIndex;
      // If target board is already full/won, opponent gets wildcard (not ideal)
      if (game.macroBoard[targetBoard] !== null) return false;
      // Check if opponent can immediately win that board
      const targetCells = game.boards[targetBoard];
      for (let c = 0; c < 9; c++) {
        if (targetCells[c] === null) {
          const test = [...targetCells];
          test[c] = opponent;
          if (check3x3Win(test)) return false; // Opponent would win that board!
        }
      }
      return true;
    });

    if (safeMoves.length > 0) {
      return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }
    return candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
  }

  function evaluateMove(game, move, aiPlayer, opponent) {
    const { boardIndex, cellIndex } = move;
    let score = 0;

    // Weight of the board and cell position
    score += BOARD_WEIGHTS[boardIndex] * 2;
    score += CELL_WEIGHTS[cellIndex];

    const localCells = [...game.boards[boardIndex]];
    localCells[cellIndex] = aiPlayer;

    // Check if this move wins the local board
    if (check3x3Win(localCells)) {
      score += 50 * BOARD_WEIGHTS[boardIndex];
    } else {
      // Count 2-in-a-rows created
      for (const [a, b, c] of WINNING_LINES) {
        const line = [localCells[a], localCells[b], localCells[c]];
        const aiCount = line.filter(v => v === aiPlayer).length;
        const emptyCount = line.filter(v => v === null).length;
        if (aiCount === 2 && emptyCount === 1) {
          score += 6; // Threat created
        }
      }
    }

    // Evaluate where this move sends the opponent!
    const targetBoard = cellIndex;
    if (game.macroBoard[targetBoard] !== null || is3x3Full(game.boards[targetBoard])) {
      // Sent opponent to a finished board -> Opponent gets a FREE MOVE anywhere!
      score -= 30;
    } else {
      const oppBoard = game.boards[targetBoard];
      // Does opponent have a winning move on that target board?
      for (let c = 0; c < 9; c++) {
        if (oppBoard[c] === null) {
          const test = [...oppBoard];
          test[c] = opponent;
          if (check3x3Win(test)) {
            score -= 35; // Danger!
            break;
          }
        }
      }
    }

    return score;
  }

  return {
    getAIMove,
    getAllPossibleMoves
  };
});
