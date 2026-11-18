# Ultimate Tic-Tac-Toe 9×9 (Real-Time Multiplayer with Interactive Undo)

A modern, real-time multiplayer web application for playing **Ultimate Tic-Tac-Toe (9×9 grid)** with a built-in **Interactive Undo Approval Protocol**, Web Audio API sound synthesis, and smart AI opponent.

![Ultimate Tic-Tac-Toe 9x9 Preview](https://img.shields.io/badge/Status-Live%20Ready-00E5FF?style=for-the-badge) ![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20external%20npm%20pkgs-10B981?style=for-the-badge) ![Node Version](https://img.shields.io/badge/Node-v18%2B-F59E0B?style=for-the-badge)

---

## 🌟 Highlights & Features

- 🌐 **Real-Time Online Multiplayer**:
  - Instant room creation with 6-character room codes (e.g. `X9K842`).
  - **1-Click Shareable Invite Link** (`http://localhost:3000/?room=CODE`).
  - Native RFC 6455 WebSocket bidirectional synchronization with zero lag.
  - Spectator support for 3+ people joining the room.
  - Session resilience (reconnects seamlessly if browser tab is refreshed).
- ↩️ **Interactive Undo System (Accept / Reject Protocol)**:
  - When **Player 1** clicks **"Request Undo"**, **Player 2** receives a prominent real-time dialog modal with alert audio.
  - Opponent sees the exact move details (Move number, Board, and Cell) with a **25-second countdown timer**.
  - Opponent can click **[✓ Accept Undo]** or **[✕ Decline]**.
  - If accepted, the server deterministically rolls back the board state, switches turn back, and syncs both players with reverse audio feedback.
  - If rejected or timed out, the requester receives immediate toast feedback and the game continues.
- 🤖 **Play vs AI (Single Player)**:
  - 3 Difficulty levels: **Easy**, **Medium**, and **Hard (Minimax / Heuristic Evaluation)**.
  - Instant one-click Undo button.
- 👥 **Local Pass & Play**:
  - Play on the same screen or tablet with instant move rollback.
- 🎨 **Futuristic Neon Cyberpunk Aesthetic**:
  - Glowing active board highlight with animated pulsing border.
  - Dimming on inactive boards so players always know where to play.
  - Ghost hover previews on valid cells (`X` or `O`).
  - Giant translucent watermarks on completed mini-boards.
  - Last-move indicator badge.
- 🔊 **Synthesized Web Audio API**:
  - Zero external MP3/WAV files needed!
  - High-tech move placement clicks, local board win triads, game-winning victory fanfare, alert pings, and rewind sounds.
- 💬 **Live Room Chat & Quick Reaction Emotes**:
  - Send messages or quick reaction emotes (`👋`, `🔥`, `😮`, `🤔`, `🧠`, `👏`, `💀`, `🏆`).
- 📜 **Full Move History Log**:
  - Chronological notation tracking every turn, board position, and conquered boards.

---

## 🎮 Rules of Ultimate Tic-Tac-Toe

Ultimate Tic-Tac-Toe consists of a **3×3 macro-board**, where each square contains a **3×3 mini-board** (totaling 81 cells).

1. **The Directing Rule**:
   - Each move takes place inside one mini-board.
   - The cell position selected within that mini-board **dictates which mini-board the next player must play in**.
   - *Example: Placing your mark in the top-right cell of any mini-board forces your opponent to play somewhere in the top-right mini-board.*
2. **Wildcard / Free Move**:
   - If a player is directed to a mini-board that has already been won or is full/tied, that player receives a **Free Move** and can play in **any open mini-board**.
3. **Winning a Mini-Board**:
   - Getting 3-in-a-row inside a mini-board wins that mini-board for your symbol (`X` or `O`).
4. **Winning the Macro Game**:
   - The first player to win **3 mini-boards in a row** (horizontal, vertical, or diagonal) on the macro-board wins the entire match!

---

## 🚀 Quick Start (Zero npm install needed!)

The server is built with standard Node.js built-ins (`http`, `crypto`, `fs`, `path`). There are **zero external dependencies** required to install!

```bash
# 1. Start the server
node server.js
```

Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

### Playing Online with a Friend:
1. Player 1 opens `http://localhost:3000` and clicks **"➕ Create New Room"**.
2. Player 1 clicks **"📋 Copy Link"** and sends it to Player 2 (or shares the room code).
3. Player 2 opens the link and automatically enters as Player 2 (`O`).
4. Play in real-time! Test the Undo feature by clicking **"Request Undo"** during the game.

---

## 🧪 Testing

Run the included automated unit and integration tests:

```bash
# Run unit tests
npm test

# Run real-time WebSocket E2E integration test
node test/test-integration.js
```

---

## 📁 Project Structure

```
├── server.js              # Pure Node.js HTTP + RFC 6455 WebSocket + Room State Server
├── package.json           # Project manifest & npm scripts
├── public/
│   ├── index.html         # Semantic HTML layout with Modals & Sidebar
│   ├── style.css          # Modern neon glassmorphism CSS & animations
│   ├── app.js             # Client controller, WebSocket sync & Undo handlers
│   ├── game-engine.js     # Deterministic Ultimate TTT rules & undo stack
│   ├── ai.js              # AI bot heuristics & minimax decision tree
│   └── audio.js           # Web Audio API procedural sound synthesizer
└── test/
    ├── test-game.js       # Core engine rules & undo unit tests
    └── test-integration.js# Multi-client real-time WebSocket E2E test
```

## 📜 License
MIT
