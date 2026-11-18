# Multiplayer Board Game Hub: Ultimate 9×9, Ludo & Snakes and Ladders

A modern, real-time multiplayer board game arena featuring **Ultimate Tic-Tac-Toe 9×9**, **Ludo (15×15)**, and **Snakes & Ladders (100 squares)** with a real-time **Interactive Undo Approval Protocol**, Web Audio API sound synthesis, and AI bots.

![Game Hub Preview](https://img.shields.io/badge/Status-Live%20Ready-00E5FF?style=for-the-badge) ![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20external%20npm%20pkgs-10B981?style=for-the-badge) ![Games](https://img.shields.io/badge/Games-3%20Classic%20Games-F59E0B?style=for-the-badge)

---

## 🎮 Included Games

### 1. ⚔️ Ultimate Tic-Tac-Toe (9×9)
- **3×3 Macro Board of 9 Mini-Boards (81 cells)**.
- Whichever micro-cell a player marks directs the opponent to that specific mini-board!
- **Wildcard / Free Move**: If sent to an already completed/tied mini-board, the player can choose any open board.
- Conquer 3 mini-boards in a row to win the match.

### 2. 🎲 Ludo (15×15 Track)
- Authentic 15×15 Ludo board with 4 colored home yards (Red, Green, Yellow, Blue).
- **Interactive Tokens**: Tokens pulse with animated glow when valid to move.
- Rolling a **6** releases a token from the yard onto the track, or grants an extra roll.
- **Capturing**: Landing on an opponent's token on non-safe squares sends it back to their yard and grants a bonus turn!
- Safe Star ⭐ squares prevent capture.
- Guide all tokens into the central home triangle to win.

### 3. 🐍 Snakes & Ladders (100 Squares)
- Classic 10×10 numbered board (1 to 100 in snake boustrophedon order).
- **Ladders (🪜)**: Climb up to higher squares instantly.
- **Snakes (🐍)**: Slide down from the snake's head to its tail.
- 3D animated rolling dice with rattle sound effects.
- Reach square 100 to win.

---

## 🌟 Universal Real-Time Features

- 🌐 **Real-Time Online Multiplayer**:
  - Room creation with 6-character room codes (e.g. `X9K842`).
  - **1-Click Shareable Invite Link** (`?game=ludo&room=CODE`).
  - Native RFC 6455 WebSockets with zero lag and zero npm dependencies.
- ↩️ **Interactive Undo System (Accept / Reject Protocol)**:
  - Works across **all 3 games**!
  - When Player 1 clicks **"Request Undo"**, Player 2 receives a real-time alert dialog with countdown timer (25s) and action details.
  - Player 2 can **[✓ Accept Undo]** or **[✕ Decline]**.
  - If accepted, the server deterministically rolls back the turn and updates both screens.
- 🤖 **Play vs AI** (Single-Player Bot) & 👥 **Pass & Play** (Local same screen).
- 🔊 **Procedural Web Audio API Sound Effects** (zero audio files needed).
- 💬 **Live Room Chat & Emotes**.

---

## 🚀 How to Run Locally

```bash
# 1. Start the server (Zero npm install needed!)
node server.js
```

Open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Run Tests

```bash
npm test
node test/test-integration.js
```
