# Tank Battle — 坦克动荡2-style

A single-page, top-down tank-battle arena game played in the browser: one-hit
kills, bullets that bounce off indestructible walls (and can ricochet back into
their own shooter), a human player with two control schemes, and AI
**AutoPlayers** that dodge incoming fire first and shoot second.

Built with **TypeScript + Vite** and rendered with **Canvas 2D** — every tank,
wall, and bullet is drawn procedurally, so there are **no image assets** and the
whole game is a static site that runs anywhere.

## ▶️ Play it

| | |
| --- | --- |
| **Live demo** | [**tank-game-2gm.pages.dev**](https://tank-game-2gm.pages.dev) |


## ✨ Features

- **Two game modes**
  - **Player vs AutoPlayers** — you against a chosen number of AI tanks.
  - **AutoPlayers vs AutoPlayers** — an AI-only free-for-all you can sit back and watch.
- **Two control schemes**
  - **Classic (Robot Centered)** — tank-relative: drive forward/back, turn, fire.
  - **Modern (Field Centered)** — screen-relative WASD movement with mouse aiming.
- **Procedural arenas** — walls are thin segments along a grid (a maze of wall
  lines, not filled blocks); every cell interior is walkable. Board width and
  height are independent (5–20 cells each).
- **Fair Generation** — an (experimental) toggle that mirrors the maze
  left-to-right so both sides get identical terrain.
- **One-hit combat with ricochets** — bullets reflect off walls (up to 8 bounces
  / 5 s lifetime) and are identical for everyone, so a deflected shot can kill
  the tank that fired it.
- **Directional hitboxes** — each tank's body is an ellipse aligned to its
  facing, so turning presents a narrower profile: the core "turn to dodge"
  mechanic.
- **Smart AI** — AutoPlayers simulate forward, reverse, braking, and turning
  routes against multiple incoming bullets and ricochets. They account for
  walls, turning time, and directional hitboxes, favor stable escapes, and can
  return fire while evading. They also navigate with BFS and reverse out of
  corners when stuck. Each has its own aim "personality".
- **Fit-to-screen scaling** — the whole world (map + tanks) shrinks together to
  fit the viewport and refits automatically when you resize the window.
- **Fixed-timestep simulation** — a 120 Hz physics step with a deterministic
  seeded random generator keeps matches stable and reproducible.

## 🎮 Controls

| Control Mode            | Movement                     | Aim / Fire                        |
| ----------------------- | ---------------------------- | --------------------------------- |
| Classic (Robot Centered) | **W**/**S** drive, **A**/**D** turn | **Space** to fire          |
| Modern (Field Centered)  | **WASD** move (field axes)   | Mouse aims, **Click** / **Space** fires |

- **P** or **Esc** pauses / resumes.
- **Space** fires in both modes.

## 🕹️ How to play

1. Pick a **Game Mode** (Player vs AutoPlayers, AI-only free-for-all, or a First-to-x run).
2. Set the **AI count**, then either set **board width/height** (5–20 each) or
   tick **Random Size** to let the game pick a fitting size; choose the
   **Faster Movement** multiplier (1× / 1.25× / 1.5× / 1.75× / 2× — speeds up
   tanks and bullets).
3. Choose a **Control Mode** (PvE only) and optionally enable
   **Fair Generation**.
4. Hit **START** and be the **last tank standing**.

### Rules

- The board is `width × height` cells, each 5–20, with independent sizes (or
  randomized when **Random Size** is ticked).
- **Walls** are thin line segments along the grid — indestructible, and bullets
  reflect off them (max 8 bounces / 5 s).
- Every **cell** is at least 4× a tank's width and 2× its length; if the whole
  board won't fit the screen, the map and tanks shrink together to fit (and
  refit on resize).
- Tank movement starts at 1.25× base speed; the **Faster Movement** slider adds
  another ×1 … ×2 in five levels (1, 1.25, 1.5, 1.75, 2), applied to tanks
  *and* bullets. AutoPlayers dodge with extra-aggressive turning.
- **One hit destroys a tank.** Bullets are identical for everyone and can kill
  any tank — including the one that fired them (a brief muzzle grace prevents
  unavoidable point-blank suicides, but ricochet self-kills still count).
- **Last tank standing wins.**

## 🚀 Run locally

Requires [Node.js](https://nodejs.org/) (18+).

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Production build + preview:

```bash
npm run build      # type-checks, then emits dist/
npm run preview    # serves dist/ locally
```

The `dist/` folder is a plain static site — serve it with any static host
(`npx serve dist`, `python3 -m http.server -d dist`, …).

## 🛠️ Development

```bash
npm run typecheck  # tsc --noEmit
npm run test:ai    # focused AI behavior regression tests
npm run smoke      # headless logic tests (no browser needed)
npm run ui-smoke   # DOM smoke test (jsdom)
npm run build      # tsc + vite build
```

### Architecture

```
src/
├── main.ts            bootstrap + input + main loop
├── config.ts          tunables & color palette
├── types.ts           shared types
├── style.css          cream, olive, sage, and burnt-orange UI
├── math/
│   ├── Vec2.ts        vector math + angle helpers
│   └── geometry.ts    segment/AABB + rotated-rectangle tests
├── core/
│   ├── Board.ts       W×H grid, asymmetric/fair walls, BFS pathfinding, spawns
│   ├── Collision.ts   bullet reflection, tank sliding, rotation clamp, ellipse hitbox
│   ├── Game.ts        fixed-timestep state machine, win condition
│   └── metrics.ts     fit-to-screen scaling
├── entities/
│   ├── Tank.ts        shared tank base (move, rotate, shoot)
│   ├── Bullet.ts      uniform bullet with bounces + lifetime
│   ├── Player.ts      classic/modern human controls
│   └── AutoPlayer.ts  AI tank wrapper
├── ai/
│   ├── Controller.ts  AutoPlayer brain (dodge → shoot → wander)
│   └── EvasionPlanner.ts  Future movement, crossfire avoidance, shared bullet prediction
├── render/
│   └── Renderer.ts    Canvas 2D drawing (no assets)
└── ui/
    ├── StartScreen.ts settings form
    ├── HUD.ts         alive count, pause/restart
    └── EndScreen.ts   win/lose screen
scripts/
├── ai-regression.ts   deterministic AI behavior and avoidance scenarios
├── smoke.ts           headless logic tests
└── ui-smoke.ts        DOM smoke test (jsdom)
```

The AI's decision loop runs at 30 Hz and prioritizes: **dodge incoming bullets →
shoot the nearest visible enemy → wander/reposition**, with a BFS pathfinder for
navigating around walls it can't see through.
