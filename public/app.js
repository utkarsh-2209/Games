/**
 * Multi-Game Hub Client Application:
 * 1. Ultimate Tic-Tac-Toe 9x9
 * 2. Snakes & Ladders (10x10)
 * 3. Ludo (15x15)
 * Universal Undo Approval System, Procedural Audio & AI Bots
 */

(function () {
  'use strict';

  // ==========================================
  // SAFE ENGINE & CONSTANT REFERENCES
  // ==========================================
  const UltimateTTT = window.UltimateTTT;
  const SnakesGame = window.SnakesGame;
  const LudoGame = window.LudoGame;

  const SNAKES_MAP = window.SNAKES || {
    17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78
  };
  const LADDERS_MAP = window.LADDERS || {
    4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91
  };
  const TTT_BOARD_NAMES = window.BOARD_NAMES || [
    'Top-Left',   'Top-Center',   'Top-Right',
    'Mid-Left',   'Center',       'Mid-Right',
    'Bottom-Left','Bottom-Center','Bottom-Right'
  ];

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  let activeGame = 'ttt9x9'; // 'ttt9x9' | 'ludo' | 'snakes'
  let currentMode = 'local'; // 'local' default for immediate responsiveness, or 'online' / 'ai'
  let aiDifficulty = 'medium';

  // Game Engine Instances
  let tttGame = new UltimateTTT();
  let snakesGame = new SnakesGame(2);
  let ludoGame = new LudoGame(2, 4);

  // Online Multiplayer State
  let ws = null;
  let roomId = null;
  let playerToken = sessionStorage.getItem('hub_player_token') || null;
  let myOnlineRole = null; // '1' | '2' | 'spectator'
  let onlineRoomData = null;
  let undoCountdownInterval = null;

  const sound = window.soundFx || {
    init: () => {},
    toggleMute: () => false,
    playMove: () => {},
    playDiceRoll: () => {},
    playLadder: () => {},
    playSnake: () => {},
    playCapture: () => {},
    playBoardWin: () => {},
    playGameWin: () => {},
    playUndoRequest: () => {},
    playUndoAccepted: () => {},
    playUndoRejected: () => {}
  };

  const DICE_ICONS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  // ==========================================
  // DOM ELEMENT REFERENCES
  // ==========================================
  const headerTitle = document.getElementById('headerTitle');
  const headerSubtitle = document.getElementById('headerSubtitle');
  const boardContainer = document.getElementById('boardContainer');
  const snakesContainer = document.getElementById('snakesContainer');
  const snakesGrid = document.getElementById('snakesGrid');
  const snakesSvg = document.getElementById('snakesSvg');
  const ludoContainer = document.getElementById('ludoContainer');

  const dicePanel = document.getElementById('dicePanel');
  const diceBox = document.getElementById('diceBox');
  const rollDiceBtn = document.getElementById('rollDiceBtn');
  const diceResultLabel = document.getElementById('diceResultLabel');

  const turnInstruction = document.getElementById('turnInstruction');
  const turnInstructionText = document.getElementById('turnInstructionText');
  const turnInstructionIcon = document.getElementById('turnInstructionIcon');

  const playerXCard = document.getElementById('playerXCard');
  const playerOCard = document.getElementById('playerOCard');
  const player1Badge = document.getElementById('player1Badge');
  const player2Badge = document.getElementById('player2Badge');
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

  const onlineLobbyPanel = document.getElementById('onlineLobbyPanel');
  const activeRoomBar = document.getElementById('activeRoomBar');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const currentRoomCode = document.getElementById('currentRoomCode');
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  const spectatorCount = document.getElementById('spectatorCount');
  const aiBar = document.getElementById('aiBar');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const historyList = document.getElementById('historyList');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const emoteBtns = document.querySelectorAll('.emote-btn');
  const rulesContent = document.getElementById('rulesContent');
  const rulesModal = document.getElementById('rulesModal');
  const rulesModalTitle = document.getElementById('rulesModalTitle');
  const rulesModalBody = document.getElementById('rulesModalBody');
  const closeRulesBtn = document.getElementById('closeRulesBtn');

  const incomingUndoModal = document.getElementById('incomingUndoModal');
  const waitingUndoModal = document.getElementById('waitingUndoModal');
  const gameOverModal = document.getElementById('gameOverModal');
  const acceptUndoBtn = document.getElementById('acceptUndoBtn');
  const rejectUndoBtn = document.getElementById('rejectUndoBtn');
  const cancelUndoBtn = document.getElementById('cancelUndoBtn');
  const undoMoveDetails = document.getElementById('undoMoveDetails');
  const undoSecondsRemaining = document.getElementById('undoSecondsRemaining');
  const undoCountdownFill = document.getElementById('undoCountdownFill');
  const undoModalSubtitle = document.getElementById('undoModalSubtitle');
  const rematchBtn = document.getElementById('rematchBtn');
  const closeGameOverBtn = document.getElementById('closeGameOverBtn');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverSubtitle = document.getElementById('gameOverSubtitle');
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    try {
      createTTTBoardDOM();
      createSnakesBoardDOM();
      createLudoBoardDOM();

      setupEventListeners();
      checkURLParams();
      setMode(currentMode);
      switchGame(activeGame);
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  // ==========================================
  // BOARD DOM BUILDERS
  // ==========================================
  function createTTTBoardDOM() {
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
        cell.addEventListener('click', () => handleTTTCellClick(b, c));
        miniBoard.appendChild(cell);
      }
      boardContainer.appendChild(miniBoard);
    }
  }

  function createSnakesBoardDOM() {
    snakesGrid.innerHTML = '';
    const rows = [];
    for (let r = 9; r >= 0; r--) {
      const rowTiles = [];
      const start = r * 10 + 1;
      const end = start + 9;
      if (r % 2 === 1) {
        for (let n = end; n >= start; n--) rowTiles.push(n);
      } else {
        for (let n = start; n <= end; n--) rowTiles.push(n);
      }
      rows.push(rowTiles);
    }

    const flatOrder = rows.flat();
    for (const num of flatOrder) {
      const tile = document.createElement('div');
      tile.className = 'snake-tile';
      tile.dataset.tile = num;

      const numLabel = document.createElement('span');
      numLabel.className = 'tile-number';
      numLabel.textContent = num;
      tile.appendChild(numLabel);

      if (SNAKES_MAP[num]) {
        const icon = document.createElement('span');
        icon.className = 'tile-icon';
        icon.textContent = '🐍';
        icon.title = `Snake down to ${SNAKES_MAP[num]}`;
        tile.appendChild(icon);
      } else if (LADDERS_MAP[num]) {
        const icon = document.createElement('span');
        icon.className = 'tile-icon';
        icon.textContent = '🪜';
        icon.title = `Ladder up to ${LADDERS_MAP[num]}`;
        tile.appendChild(icon);
      }

      snakesGrid.appendChild(tile);
    }

    drawSnakesAndLaddersSVG();
  }

  function drawSnakesAndLaddersSVG() {
    const rectGrid = snakesGrid.getBoundingClientRect();
    if (!rectGrid.width || !rectGrid.height) return;

    snakesSvg.innerHTML = '';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="snakeGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff3366" />
        <stop offset="100%" stop-color="#f59e0b" />
      </linearGradient>
      <linearGradient id="ladderGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00e5ff" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
    `;
    snakesSvg.appendChild(defs);

    for (const [startStr, end] of Object.entries(LADDERS_MAP)) {
      drawLineBetweenTiles(Number(startStr), end, 'ladder');
    }
    for (const [headStr, tail] of Object.entries(SNAKES_MAP)) {
      drawLineBetweenTiles(Number(headStr), tail, 'snake');
    }
  }

  function drawLineBetweenTiles(tileA, tileB, type) {
    const elA = snakesGrid.querySelector(`[data-tile="${tileA}"]`);
    const elB = snakesGrid.querySelector(`[data-tile="${tileB}"]`);
    if (!elA || !elB) return;

    const rectGrid = snakesGrid.getBoundingClientRect();
    if (!rectGrid.width || !rectGrid.height) return;

    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();

    const x1 = ((rectA.left + rectA.width / 2) - rectGrid.left) / rectGrid.width * 100;
    const y1 = ((rectA.top + rectA.height / 2) - rectGrid.top) / rectGrid.height * 100;
    const x2 = ((rectB.left + rectB.width / 2) - rectGrid.left) / rectGrid.width * 100;
    const y2 = ((rectB.top + rectB.height / 2) - rectGrid.top) / rectGrid.height * 100;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', `${x1}%`);
    line.setAttribute('y1', `${y1}%`);
    line.setAttribute('x2', `${x2}%`);
    line.setAttribute('y2', `${y2}%`);

    if (type === 'ladder') {
      line.setAttribute('stroke', 'url(#ladderGrad)');
      line.setAttribute('stroke-width', '4');
      line.setAttribute('stroke-dasharray', '3,3');
      line.setAttribute('opacity', '0.85');
    } else {
      line.setAttribute('stroke', 'url(#snakeGrad)');
      line.setAttribute('stroke-width', '5');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.85');
    }
    snakesSvg.appendChild(line);
  }

  function createLudoBoardDOM() {
    ludoContainer.innerHTML = '';

    const yardRed = document.createElement('div');
    yardRed.className = 'ludo-yard yard-red';
    for (let i = 0; i < 4; i++) {
      const token = document.createElement('div');
      token.className = 'ludo-token token-red';
      token.dataset.player = '0';
      token.dataset.token = i;
      token.textContent = i + 1;
      token.addEventListener('click', () => handleLudoTokenClick(0, i));
      yardRed.appendChild(token);
    }
    ludoContainer.appendChild(yardRed);

    const yardGreen = document.createElement('div');
    yardGreen.className = 'ludo-yard yard-green';
    for (let i = 0; i < 4; i++) {
      const token = document.createElement('div');
      token.className = 'ludo-token token-green';
      token.dataset.player = '1';
      token.dataset.token = i;
      token.textContent = i + 1;
      token.addEventListener('click', () => handleLudoTokenClick(1, i));
      yardGreen.appendChild(token);
    }
    ludoContainer.appendChild(yardGreen);

    const yardBlue = document.createElement('div');
    yardBlue.className = 'ludo-yard yard-blue';
    for (let i = 0; i < 4; i++) {
      const token = document.createElement('div');
      token.className = 'ludo-token token-blue';
      token.dataset.player = '3';
      token.dataset.token = i;
      token.textContent = i + 1;
      token.addEventListener('click', () => handleLudoTokenClick(3, i));
      yardBlue.appendChild(token);
    }
    ludoContainer.appendChild(yardBlue);

    const yardYellow = document.createElement('div');
    yardYellow.className = 'ludo-yard yard-yellow';
    for (let i = 0; i < 4; i++) {
      const token = document.createElement('div');
      token.className = 'ludo-token token-yellow';
      token.dataset.player = '2';
      token.dataset.token = i;
      token.textContent = i + 1;
      token.addEventListener('click', () => handleLudoTokenClick(2, i));
      yardYellow.appendChild(token);
    }
    ludoContainer.appendChild(yardYellow);

    const centerGoal = document.createElement('div');
    centerGoal.className = 'ludo-center-goal';
    centerGoal.textContent = '🏆';
    ludoContainer.appendChild(centerGoal);

    // 15x15 standard track squares
    for (let r = 1; r <= 15; r++) {
      for (let c = 1; c <= 15; c++) {
        if ((r <= 6 && c <= 6) || (r <= 6 && c >= 10) ||
            (r >= 10 && c <= 6) || (r >= 10 && c >= 10) ||
            (r >= 7 && r <= 9 && c >= 7 && c <= 9)) {
          continue;
        }

        const cell = document.createElement('div');
        cell.className = 'ludo-cell';
        cell.style.gridRow = r;
        cell.style.gridColumn = c;
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (c >= 2 && c <= 6 && r === 8) cell.classList.add('ludo-home-red');
        if (r >= 2 && r <= 6 && c === 8) cell.classList.add('ludo-home-green');
        if (c >= 10 && c <= 14 && r === 8) cell.classList.add('ludo-home-yellow');
        if (r >= 10 && r <= 14 && c === 8) cell.classList.add('ludo-home-blue');

        if ((r === 7 && c === 2) || (r === 2 && c === 9) || (r === 9 && c === 14) || (r === 14 && c === 7)) {
          cell.classList.add('ludo-star');
        }

        ludoContainer.appendChild(cell);
      }
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    // Game Hub navigation buttons
    document.querySelectorAll('.game-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        switchGame(game);
      });
    });

    // Play Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setMode(mode);
      });
    });

    // AI Difficulty
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

    // Rules button
    rulesBtn.addEventListener('click', () => {
      renderRulesModalContent();
      rulesModal.classList.add('open');
    });
    closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('open'));

    // Restart / New Game
    newGameBtn.addEventListener('click', () => {
      if (currentMode === 'online') {
        if (!roomId) {
          showToast('Click Create New Room to start an online game', 'gold');
        } else {
          sendWsMessage({ type: 'REQUEST_REMATCH' });
          showToast('Rematch request sent to opponent', 'gold');
        }
      } else {
        restartCurrentGame();
      }
    });

    // Undo button
    undoBtn.addEventListener('click', handleUndoClick);

    // Resign button
    resignBtn.addEventListener('click', () => {
      if (confirm('Restart and forfeit current match?')) {
        restartCurrentGame();
      }
    });

    // Dice Roll button
    rollDiceBtn.addEventListener('click', handleDiceRoll);
    diceBox.addEventListener('click', handleDiceRoll);

    // Online Lobby
    createRoomBtn.addEventListener('click', createNewRoom);
    joinRoomBtn.addEventListener('click', () => {
      const code = roomCodeInput.value.trim().toUpperCase();
      if (code) joinRoom(code);
      else showToast('Please enter room code', 'danger');
    });
    roomCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (code) joinRoom(code);
      }
    });

    copyInviteBtn.addEventListener('click', () => {
      if (!roomId) return;
      const url = `${window.location.origin}${window.location.pathname}?game=${activeGame}&room=${roomId}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Invite link copied!', 'success');
      }).catch(() => {
        prompt('Copy link:', url);
      });
    });

    // Undo Modal Actions
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

    rematchBtn.addEventListener('click', () => {
      gameOverModal.classList.remove('open');
      if (currentMode === 'online' && roomId) {
        sendWsMessage({ type: 'REQUEST_REMATCH' });
      } else {
        restartCurrentGame();
      }
    });

    closeGameOverBtn.addEventListener('click', () => gameOverModal.classList.remove('open'));

    // Tabs
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

    // Emotes
    emoteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emote = btn.dataset.emote;
        if (currentMode === 'online' && roomId) {
          sendWsMessage({ type: 'SEND_CHAT', text: emote });
        } else {
          appendChatMessage('You', '1', emote);
        }
      });
    });

    // Chat
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      if (currentMode === 'online' && roomId) {
        sendWsMessage({ type: 'SEND_CHAT', text });
      } else {
        appendChatMessage('Player', '1', text);
      }
      chatInput.value = '';
    });

    window.addEventListener('resize', () => {
      if (activeGame === 'snakes') drawSnakesAndLaddersSVG();
    });
  }

  function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    const roomParam = params.get('room');

    if (gameParam && ['ttt9x9', 'ludo', 'snakes'].includes(gameParam)) {
      activeGame = gameParam;
    }
    if (roomParam) {
      setMode('online');
      joinRoom(roomParam.toUpperCase());
    }
  }

  // ==========================================
  // GAME SWITCHER
  // ==========================================
  function switchGame(gameType) {
    activeGame = gameType;

    document.querySelectorAll('.game-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.game === gameType);
    });

    boardContainer.style.display = (gameType === 'ttt9x9') ? 'grid' : 'none';
    snakesContainer.style.display = (gameType === 'snakes') ? 'flex' : 'none';
    ludoContainer.style.display = (gameType === 'ludo') ? 'grid' : 'none';

    dicePanel.style.display = (gameType === 'snakes' || gameType === 'ludo') ? 'flex' : 'none';
    aiBar.style.display = (currentMode === 'ai' && gameType === 'ttt9x9') ? 'flex' : 'none';

    if (gameType === 'ttt9x9') {
      headerTitle.textContent = 'ULTIMATE 9×9';
      headerSubtitle.textContent = 'Tic-Tac-Toe';
      player1Badge.textContent = 'X';
      player2Badge.textContent = 'O';
      renderTTTGameState(tttGame.getState());
      renderHistory(tttGame.moveHistory);
    } else if (gameType === 'snakes') {
      headerTitle.textContent = 'SNAKES & LADDERS';
      headerSubtitle.textContent = 'Classic 100 Squares';
      player1Badge.textContent = '🔴';
      player2Badge.textContent = '🔵';
      setTimeout(drawSnakesAndLaddersSVG, 80);
      renderSnakesGameState(snakesGame.getState());
      renderHistory(snakesGame.moveHistory);
    } else if (gameType === 'ludo') {
      headerTitle.textContent = 'LUDO CHAMPION';
      headerSubtitle.textContent = '15×15 Track Battle';
      player1Badge.textContent = '🔴';
      player2Badge.textContent = '🟢';
      renderLudoGameState(ludoGame.getState());
      renderHistory(ludoGame.moveHistory);
    }

    renderRulesTabContent();
    updateUndoButton();
  }

  function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'online') {
      undoBtnText.textContent = 'Request Undo';
      if (!roomId) {
        onlineLobbyPanel.style.display = 'flex';
        activeRoomBar.style.display = 'none';
      } else {
        onlineLobbyPanel.style.display = 'none';
        activeRoomBar.style.display = 'flex';
      }
      initWebSocket();
    } else {
      onlineLobbyPanel.style.display = 'none';
      activeRoomBar.style.display = 'none';
      undoBtnText.textContent = 'Undo Turn';
      restartCurrentGame();
    }

    aiBar.style.display = (currentMode === 'ai' && activeGame === 'ttt9x9') ? 'flex' : 'none';
  }

  function restartCurrentGame() {
    if (activeGame === 'ttt9x9') {
      tttGame.reset();
      renderTTTGameState(tttGame.getState());
      renderHistory(tttGame.moveHistory);
    } else if (activeGame === 'snakes') {
      snakesGame.reset();
      renderSnakesGameState(snakesGame.getState());
      renderHistory(snakesGame.moveHistory);
    } else if (activeGame === 'ludo') {
      ludoGame.reset();
      renderLudoGameState(ludoGame.getState());
      renderHistory(ludoGame.moveHistory);
    }
    updateUndoButton();
    showToast('Game board reset', 'gold');
  }

  // ==========================================
  // WEBSOCKET MULTIPLAYER PROTOCOL
  // ==========================================
  function initWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (roomId) joinRoom(roomId);
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
      setTimeout(() => {
        if (currentMode === 'online') initWebSocket();
      }, 2000);
    };
  }

  function sendWsMessage(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function createNewRoom() {
    fetch('/api/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: activeGame })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.roomId) {
          joinRoom(data.roomId);
        }
      });
  }

  function joinRoom(code) {
    roomId = code;
    currentRoomCode.textContent = roomId;

    const newUrl = `${window.location.pathname}?game=${activeGame}&room=${roomId}`;
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
      playerName: playerToken ? (sessionStorage.getItem('hub_player_name') || 'Player') : 'Player',
      playerToken,
      preferredGameType: activeGame
    });
  }

  function handleServerMessage(msg) {
    const { type } = msg;

    switch (type) {
      case 'JOINED_SUCCESS': {
        playerToken = msg.token;
        myOnlineRole = msg.role;
        sessionStorage.setItem('hub_player_token', playerToken);
        if (msg.gameType && msg.gameType !== activeGame) {
          switchGame(msg.gameType);
        }
        showToast(`Joined as ${myOnlineRole === 'spectator' ? 'Spectator' : 'Player ' + myOnlineRole}`, 'success');
        updateUndoButton();
        break;
      }

      case 'ROOM_UPDATE': {
        onlineRoomData = msg.room;
        if (onlineRoomData.gameType && onlineRoomData.gameType !== activeGame) {
          switchGame(onlineRoomData.gameType);
        }
        updateRoomUI(onlineRoomData);
        break;
      }

      case 'MOVE_PLAYED': {
        sound.playMove(msg.move.player);
        renderTTTGameState(msg.gameState);
        renderHistory([msg.move], true);
        updateUndoButton();
        break;
      }

      case 'SNAKES_MOVE': {
        sound.playDiceRoll();
        animateDiceValue(msg.move.dice);
        if (msg.move.event === 'ladder') sound.playLadder();
        else if (msg.move.event === 'snake') sound.playSnake();
        renderSnakesGameState(msg.gameState);
        renderHistory([msg.move], true);
        updateUndoButton();
        break;
      }

      case 'LUDO_ROLLED': {
        sound.playDiceRoll();
        animateDiceValue(msg.dice);
        renderLudoGameState(msg.gameState);
        break;
      }

      case 'LUDO_MOVED': {
        if (msg.captured) sound.playCapture();
        else sound.playMove(msg.move.playerIndex);
        renderLudoGameState(msg.gameState);
        renderHistory([msg.move], true);
        updateUndoButton();
        break;
      }

      case 'GAME_OVER': {
        sound.playGameWin();
        showGameOverModal(msg.winner);
        break;
      }

      case 'UNDO_REQUEST_SENT': {
        waitingUndoModal.classList.add('open');
        break;
      }

      case 'UNDO_REQUEST_RECEIVED': {
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
          showToast(msg.message || 'Undo accepted! Turn rolled back.', 'success');
          if (activeGame === 'ttt9x9') renderTTTGameState(msg.gameState);
          else if (activeGame === 'snakes') renderSnakesGameState(msg.gameState);
          else if (activeGame === 'ludo') renderLudoGameState(msg.gameState);
        } else {
          sound.playUndoRejected();
          showToast(msg.message || 'Undo request declined.', 'danger');
        }
        updateUndoButton();
        break;
      }

      case 'REMATCH_ACCEPTED': {
        showToast('Rematch started! New game is live.', 'success');
        gameOverModal.classList.remove('open');
        restartCurrentGame();
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

    if (room.player1) {
      playerXName.textContent = room.player1.name + (myOnlineRole === '1' ? ' (You)' : '');
      playerXStatus.innerHTML = room.player1.connected ? '<span class="status-dot"></span> Online' : '<span class="status-dot offline"></span> Away';
    }
    if (room.player2) {
      playerOName.textContent = room.player2.name + (myOnlineRole === '2' ? ' (You)' : '');
      playerOStatus.innerHTML = room.player2.connected ? '<span class="status-dot"></span> Online' : '<span class="status-dot offline"></span> Away';
    }

    if (room.gameType === 'ttt9x9') renderTTTGameState(room.gameState);
    else if (room.gameType === 'snakes') renderSnakesGameState(room.gameState);
    else if (room.gameType === 'ludo') renderLudoGameState(room.gameState);

    updateUndoButton();
  }

  function openIncomingUndoModal(msg) {
    const { requesterRole, requesterName, details, expiresIn } = msg;
    undoModalSubtitle.textContent = `${requesterName} (Player ${requesterRole}) requested to take back their last turn.`;
    undoMoveDetails.textContent = details || 'Last Turn';

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
  // GAME 1: ULTIMATE TIC-TAC-TOE HANDLERS
  // ==========================================
  function handleTTTCellClick(boardIndex, cellIndex) {
    sound.init();

    if (currentMode === 'online') {
      if (!roomId) {
        showToast("Click '➕ Create New Room' or switch to 'Pass & Play' to play now!", 'gold');
        return;
      }
      if (myOnlineRole !== '1' && myOnlineRole !== '2') return;
      sendWsMessage({ type: 'MAKE_MOVE', boardIndex, cellIndex });
    } else if (currentMode === 'ai') {
      if (tttGame.currentTurn !== 'X') return;
      const res = tttGame.makeMove(boardIndex, cellIndex, 'X');
      if (!res.valid) return showToast(res.reason, 'danger');

      sound.playMove('X');
      renderTTTGameState(res.state);
      renderHistory(tttGame.moveHistory);
      updateUndoButton();

      if (res.state.winner) {
        sound.playGameWin();
        showGameOverModal(res.state.winner);
        return;
      }

      setTimeout(() => {
        if (tttGame.winner || currentMode !== 'ai') return;
        const aiMove = (window.UltimateAI && window.UltimateAI.getAIMove) 
          ? window.UltimateAI.getAIMove(tttGame, aiDifficulty, 'O')
          : null;
        if (aiMove) {
          const aiRes = tttGame.makeMove(aiMove.boardIndex, aiMove.cellIndex, 'O');
          if (aiRes.valid) {
            sound.playMove('O');
            renderTTTGameState(aiRes.state);
            renderHistory(tttGame.moveHistory);
            updateUndoButton();
            if (aiRes.state.winner) {
              sound.playGameWin();
              showGameOverModal(aiRes.state.winner);
            }
          }
        }
      }, 400);
    } else { // Local Pass & Play
      const p = tttGame.currentTurn;
      const res = tttGame.makeMove(boardIndex, cellIndex, p);
      if (!res.valid) return showToast(res.reason, 'danger');

      sound.playMove(p);
      renderTTTGameState(res.state);
      renderHistory(tttGame.moveHistory);
      updateUndoButton();

      if (res.state.winner) {
        sound.playGameWin();
        showGameOverModal(res.state.winner);
      }
    }
  }

  function renderTTTGameState(state) {
    if (!state) return;
    const { boards, macroBoard, activeBoard, currentTurn, winner, validBoards } = state;

    playerXCard.classList.toggle('active-turn', currentTurn === 'X' && !winner);
    playerOCard.classList.toggle('active-turn', currentTurn === 'O' && !winner);

    if (winner) {
      turnInstructionIcon.textContent = '🏆';
      turnInstructionText.textContent = winner === 'T' ? "Grand Draw!" : `Player ${winner} has Won!`;
    } else if (activeBoard === -1) {
      turnInstructionIcon.textContent = '🌟';
      turnInstructionText.textContent = `${currentTurn}'s Turn — Free Move! Play anywhere open.`;
    } else {
      turnInstructionIcon.textContent = '🎯';
      turnInstructionText.textContent = `${currentTurn}'s Turn — Play in: ${TTT_BOARD_NAMES[activeBoard]} Board`;
    }

    for (let b = 0; b < 9; b++) {
      const miniEl = boardContainer.children[b];
      if (!miniEl) continue;

      const isDecided = macroBoard[b] !== null;
      const isValid = validBoards && validBoards.includes(b);

      miniEl.classList.toggle('active-target', isValid && !winner);
      miniEl.classList.toggle('inactive-board', !isValid && !isDecided && !winner);

      let overlay = miniEl.querySelector('.board-won-overlay');
      if (isDecided) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'board-won-overlay';
          miniEl.appendChild(overlay);
        }
        overlay.className = `board-won-overlay won-${macroBoard[b].toLowerCase()}`;
        overlay.textContent = macroBoard[b];
      } else if (overlay) {
        overlay.remove();
      }

      for (let c = 0; c < 9; c++) {
        const cellEl = miniEl.children[c];
        if (!cellEl) continue;

        const val = boards[b][c];
        cellEl.className = 'cell';
        cellEl.textContent = val || '';
        if (val === 'X') cellEl.classList.add('cell-x');
        if (val === 'O') cellEl.classList.add('cell-o');

        if (!winner && isValid && val === null) {
          cellEl.classList.add('clickable');
          cellEl.setAttribute('data-preview', currentTurn);
        } else {
          cellEl.removeAttribute('data-preview');
        }
      }
    }
  }

  // ==========================================
  // GAME 2: SNAKES & LADDERS HANDLERS
  // ==========================================
  function handleDiceRoll() {
    sound.init();

    if (activeGame === 'snakes') {
      if (currentMode === 'online') {
        if (!roomId) {
          showToast("Click '➕ Create New Room' or switch to 'Pass & Play' to play now!", 'gold');
          return;
        }
        sendWsMessage({ type: 'ROLL_SNAKES' });
      } else if (currentMode === 'ai') {
        if (snakesGame.currentTurn !== 0) return;
        const res = snakesGame.rollAndMove(0);
        executeSnakesLocalStep(res);

        if (!res.extraTurn && res.state.winner === null) {
          setTimeout(() => {
            if (snakesGame.winner !== null) return;
            const botRes = snakesGame.rollAndMove(1);
            executeSnakesLocalStep(botRes);
          }, 800);
        }
      } else { // Local Pass & Play
        const res = snakesGame.rollAndMove(snakesGame.currentTurn);
        executeSnakesLocalStep(res);
      }
    } else if (activeGame === 'ludo') {
      if (currentMode === 'online') {
        if (!roomId) {
          showToast("Click '➕ Create New Room' or switch to 'Pass & Play' to play now!", 'gold');
          return;
        }
        sendWsMessage({ type: 'ROLL_LUDO' });
      } else if (currentMode === 'ai') {
        if (ludoGame.currentTurn !== 0) return;
        const res = ludoGame.rollDice(0);
        executeLudoRollStep(res);

        if (res.validTokens && res.validTokens.length === 1) {
          setTimeout(() => handleLudoTokenClick(0, res.validTokens[0]), 300);
        }
      } else { // Local Pass & Play
        const res = ludoGame.rollDice(ludoGame.currentTurn);
        executeLudoRollStep(res);
      }
    }
  }

  function executeSnakesLocalStep(res) {
    if (!res.valid) return;
    sound.playDiceRoll();
    animateDiceValue(res.move.dice);
    if (res.move.event === 'ladder') sound.playLadder();
    else if (res.move.event === 'snake') sound.playSnake();

    renderSnakesGameState(res.state);
    renderHistory(snakesGame.moveHistory);
    updateUndoButton();

    if (res.state.winner !== null) {
      sound.playGameWin();
      showGameOverModal(`Player ${res.state.winner + 1}`);
    }
  }

  function renderSnakesGameState(state) {
    if (!state) return;
    const { positions, currentTurn, lastDice, winner } = state;

    playerXCard.classList.toggle('active-turn', currentTurn === 0 && winner === null);
    playerOCard.classList.toggle('active-turn', currentTurn === 1 && winner === null);

    if (winner !== null) {
      turnInstructionIcon.textContent = '🏆';
      turnInstructionText.textContent = `Player ${winner + 1} reached square 100! Victory!`;
    } else {
      turnInstructionIcon.textContent = '🎲';
      turnInstructionText.textContent = `Player ${currentTurn + 1}'s Turn — Roll the Dice!`;
    }

    if (lastDice) {
      diceResultLabel.textContent = `Rolled: ${lastDice} ${DICE_ICONS[lastDice - 1]}`;
    }

    snakesContainer.querySelectorAll('.player-token-snakes').forEach(t => t.remove());

    positions.forEach((pos, idx) => {
      if (pos === 0) return;
      const tileEl = snakesGrid.querySelector(`[data-tile="${pos}"]`);
      if (tileEl) {
        const token = document.createElement('div');
        token.className = 'player-token-snakes';
        token.style.background = idx === 0 ? 'var(--color-red)' : 'var(--color-blue)';
        token.textContent = idx + 1;
        tileEl.appendChild(token);
      }
    });
  }

  // ==========================================
  // GAME 3: LUDO HANDLERS
  // ==========================================
  function executeLudoRollStep(res) {
    if (!res.valid) return;
    sound.playDiceRoll();
    animateDiceValue(res.dice);
    renderLudoGameState(res.state);
  }

  function handleLudoTokenClick(playerIndex, tokenIndex) {
    sound.init();

    if (currentMode === 'online') {
      if (!roomId) {
        showToast("Click '➕ Create New Room' or switch to 'Pass & Play' to play now!", 'gold');
        return;
      }
      sendWsMessage({ type: 'MOVE_LUDO_TOKEN', tokenIndex });
    } else if (currentMode === 'ai') {
      if (ludoGame.currentTurn !== 0) return;
      const res = ludoGame.moveToken(tokenIndex, 0);
      if (!res.valid) return;

      if (res.captured) sound.playCapture();
      else sound.playMove(0);

      renderLudoGameState(res.state);
      renderHistory(ludoGame.moveHistory);
      updateUndoButton();

      if (res.state.winner !== null) {
        sound.playGameWin();
        showGameOverModal('Player 1');
        return;
      }

      if (!res.extraTurn) {
        setTimeout(triggerLudoBotTurn, 700);
      }
    } else { // Local Pass & Play
      const res = ludoGame.moveToken(tokenIndex, ludoGame.currentTurn);
      if (!res.valid) return;

      if (res.captured) sound.playCapture();
      else sound.playMove(ludoGame.currentTurn);

      renderLudoGameState(res.state);
      renderHistory(ludoGame.moveHistory);
      updateUndoButton();

      if (res.state.winner !== null) {
        sound.playGameWin();
        showGameOverModal(`Player ${res.state.winner + 1}`);
      }
    }
  }

  function triggerLudoBotTurn() {
    if (ludoGame.winner !== null || currentMode !== 'ai') return;
    const roll = ludoGame.rollDice(1);
    executeLudoRollStep(roll);

    if (roll.validTokens && roll.validTokens.length > 0) {
      setTimeout(() => {
        const chosenToken = roll.validTokens[0];
        const moveRes = ludoGame.moveToken(chosenToken, 1);
        if (moveRes.valid) {
          if (moveRes.captured) sound.playCapture();
          else sound.playMove(1);
          renderLudoGameState(moveRes.state);
          renderHistory(ludoGame.moveHistory);
          updateUndoButton();

          if (moveRes.extraTurn) {
            setTimeout(triggerLudoBotTurn, 700);
          }
        }
      }, 500);
    }
  }

  function renderLudoGameState(state) {
    if (!state) return;
    const { currentTurn, lastDice, diceRolled, validTokens, winner } = state;

    playerXCard.classList.toggle('active-turn', currentTurn === 0 && winner === null);
    playerOCard.classList.toggle('active-turn', currentTurn === 1 && winner === null);

    if (winner !== null) {
      turnInstructionIcon.textContent = '🏆';
      turnInstructionText.textContent = `Player ${winner + 1} has reached the Goal! Victory!`;
    } else if (diceRolled) {
      turnInstructionIcon.textContent = '👆';
      turnInstructionText.textContent = `Rolled ${lastDice}! Pick a highlighted token to move.`;
    } else {
      turnInstructionIcon.textContent = '🎲';
      turnInstructionText.textContent = `Player ${currentTurn + 1}'s Turn — Roll the Dice!`;
    }

    if (lastDice) {
      diceResultLabel.textContent = `Rolled: ${lastDice} ${DICE_ICONS[lastDice - 1]}`;
    }

    ludoContainer.querySelectorAll('.ludo-token').forEach(t => t.classList.remove('pulse-move'));
    if (diceRolled && validTokens && validTokens.length > 0) {
      validTokens.forEach(tIdx => {
        const el = ludoContainer.querySelector(`.ludo-token[data-player="${currentTurn}"][data-token="${tIdx}"]`);
        if (el) el.classList.add('pulse-move');
      });
    }
  }

  function animateDiceValue(val) {
    diceBox.classList.add('rolling');
    setTimeout(() => {
      diceBox.textContent = DICE_ICONS[val - 1] || '🎲';
      diceBox.classList.remove('rolling');
    }, 250);
  }

  // ==========================================
  // UNIVERSAL UNDO BUTTON HANDLER
  // ==========================================
  function handleUndoClick() {
    sound.init();

    if (currentMode === 'online') {
      if (!roomId) {
        showToast("Not in a room", 'danger');
        return;
      }
      sendWsMessage({ type: 'REQUEST_UNDO' });
    } else {
      if (activeGame === 'ttt9x9') {
        const steps = (currentMode === 'ai' && tttGame.moveHistory.length >= 2) ? 2 : 1;
        tttGame.undo(steps);
        renderTTTGameState(tttGame.getState());
        renderHistory(tttGame.moveHistory);
      } else if (activeGame === 'snakes') {
        const steps = (currentMode === 'ai' && snakesGame.moveHistory.length >= 2) ? 2 : 1;
        snakesGame.undo(steps);
        renderSnakesGameState(snakesGame.getState());
        renderHistory(snakesGame.moveHistory);
      } else if (activeGame === 'ludo') {
        const steps = (currentMode === 'ai' && ludoGame.moveHistory.length >= 2) ? 2 : 1;
        ludoGame.undo(steps);
        renderLudoGameState(ludoGame.getState());
        renderHistory(ludoGame.moveHistory);
      }
      sound.playUndoAccepted();
      updateUndoButton();
      showToast('Turn undone! Replay your choice.', 'success');
    }
  }

  function updateUndoButton() {
    let hasMoves = false;
    if (activeGame === 'ttt9x9') hasMoves = tttGame.moveHistory.length > 0;
    else if (activeGame === 'snakes') hasMoves = snakesGame.moveHistory.length > 0;
    else if (activeGame === 'ludo') hasMoves = ludoGame.moveHistory.length > 0;

    if (currentMode === 'online') {
      const isPlayer = myOnlineRole === '1' || myOnlineRole === '2';
      undoBtn.disabled = !isPlayer || !hasMoves;
      undoBtnText.textContent = 'Request Undo';
    } else {
      undoBtn.disabled = !hasMoves;
      undoBtnText.textContent = 'Undo Turn';
    }
  }

  // ==========================================
  // MOVE HISTORY & CHAT
  // ==========================================
  function renderHistory(moves, appendOnly = false) {
    if (!appendOnly) {
      historyList.innerHTML = '';
      if (moves.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 30px; font-size: 0.85rem;">No moves yet. Make the first move!</div>`;
        return;
      }
    }

    if (!moves || moves.length === 0) return;
    const emptyNotice = historyList.querySelector('div[style*="text-align: center"]');
    if (emptyNotice) emptyNotice.remove();

    for (const m of moves) {
      const item = document.createElement('div');
      item.className = 'history-item';
      let text = '';
      if (activeGame === 'ttt9x9') {
        text = `<strong>${m.boardName}</strong> → ${m.cellName}`;
      } else if (activeGame === 'snakes') {
        text = `Rolled <strong>${m.dice}</strong> (Tile ${m.from} → ${m.to})${m.event ? ` [${m.event.toUpperCase()}!]` : ''}`;
      } else if (activeGame === 'ludo') {
        text = `Token ${m.tokenIndex + 1} with roll <strong>${m.dice}</strong>${m.captured ? ' [CAPTURED!]' : ''}`;
      }

      item.innerHTML = `
        <span class="history-num">#${m.moveNumber}</span>
        <span class="history-player">${m.player || (m.playerIndex !== undefined ? `P${m.playerIndex + 1}` : '')}</span>
        <div class="history-details">${text}</div>
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
      <div class="chat-meta" style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-dim); margin-bottom:2px;">
        <strong>${sender}</strong>
        <span>${time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div>${escapeHTML(text)}</div>
    `;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showGameOverModal(winner) {
    gameOverTitle.textContent = `${winner} Wins!`;
    gameOverSubtitle.textContent = 'Congratulations on victory!';
    gameOverModal.classList.add('open');
  }

  function renderRulesTabContent() {
    if (!rulesContent) return;
    if (activeGame === 'ttt9x9') {
      rulesContent.innerHTML = `
        <h3 style="color:#fff; margin-bottom:8px;">Ultimate 9×9 Rules</h3>
        <p style="margin-bottom:8px;">9 mini-boards inside a 3×3 grid. Whichever <em>micro cell</em> you select directs your opponent to that <em>macro mini-board</em>.</p>
        <p style="margin-bottom:8px;"><strong>Free Move:</strong> If sent to a board already won or full, you can play in any open board.</p>
        <p><strong>Goal:</strong> Win 3 mini-boards in a row to win the game!</p>
      `;
    } else if (activeGame === 'snakes') {
      rulesContent.innerHTML = `
        <h3 style="color:#fff; margin-bottom:8px;">Snakes & Ladders Rules</h3>
        <p style="margin-bottom:8px;">Roll the dice and advance across tiles 1 to 100.</p>
        <p style="margin-bottom:8px;"><strong>Ladders (🪜):</strong> Land on the base to climb up quickly!</p>
        <p style="margin-bottom:8px;"><strong>Snakes (🐍):</strong> Avoid the head, or you slide down to its tail.</p>
        <p><strong>Extra Turn:</strong> Rolling a 6 gives another roll. Exact roll needed to hit 100!</p>
      `;
    } else if (activeGame === 'ludo') {
      rulesContent.innerHTML = `
        <h3 style="color:#fff; margin-bottom:8px;">Ludo Rules</h3>
        <p style="margin-bottom:8px;">Roll a <strong>6</strong> to release a token from your yard onto the track.</p>
        <p style="margin-bottom:8px;"><strong>Capturing:</strong> Landing on an opponent token on non-safe squares sends it back to their yard and gives you a bonus roll!</p>
        <p><strong>Goal:</strong> Guide your tokens into the central home triangle to win.</p>
      `;
    }
  }

  function renderRulesModalContent() {
    rulesModalTitle.textContent = `How to Play: ${activeGame === 'ttt9x9' ? 'Ultimate Tic-Tac-Toe' : activeGame === 'snakes' ? 'Snakes & Ladders' : 'Ludo'}`;
    renderRulesTabContent();
    rulesModalBody.innerHTML = rulesContent.innerHTML;
  }

  function showToast(message, type = 'gold') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'danger' ? '✕' : 'ℹ'}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
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

  window.addEventListener('DOMContentLoaded', init);
})();
