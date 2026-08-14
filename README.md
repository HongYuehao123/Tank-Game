# Tank Battle — 坦克动荡2-style

A single-page top-down tank battle game: one-hit kills, bullets that bounce off
indestructible walls (and can kill their own shooter), a human player with two
control schemes, and AutoPlayer tanks that dodge bullets first and shoot second.

Built with TypeScript + Vite, rendered with Canvas 2D (no image assets).

## Run locally

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

## Deploy to Cloudflare Pages (manual)

1. Push this repo to GitHub/GitLab.
2. In Cloudflare Pages: **Create project → Connect to Git** → pick the repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Deploy. No server-side code is used, so Pages hosts it as-is.

## Controls

| Control Mode            | Movement               | Aim / Fire           |
| ----------------------- | ---------------------- | -------------------- |
| Classic (Robot Centered) | W/S drive, A/D turn    | Space to fire        |
| Modern (Field Centered)  | WASD move (field axes) | Mouse aims, Click/Space fires |

P / Esc pauses. Space also fires in both modes.

## Rules

- Board: width × height, each 5–20 cells, independent sizes (e.g. 5×20).
- **Walls are thin line segments along the grid** (a maze of wall lines, not
  filled blocks); every cell interior is walkable. Walls are indestructible and
  bullets reflect off them (max 8 bounces / 5 s).
- **Cell size** is at least 4× the tank's width and 2× its length; if the whole
  board wouldn't fit the screen, both the map and the tanks shrink together to
  fit (and refit automatically when you resize the window).
- Tank movement starts at 1.25× base speed; the start screen's **Faster
  Movement** slider adds another ×1 … ×2 in four levels (applies to all tanks).
  AutoPlayers dodge with extra-aggressive turning.
- One hit destroys a tank. Bullets are identical for everyone and can kill any
  tank — including the one that fired them.
- Last tank standing wins.

## Development

```bash
npm run typecheck  # tsc --noEmit
npm run smoke      # headless logic tests (no browser needed)
npm run build      # tsc + vite build
```

### Architecture

```
src/
├── main.ts            bootstrap + input + main loop
├── config.ts          tunables & palette
├── types.ts           shared types
├── math/              Vec2, geometry (segment/AABB, rotated rects)
├── core/
│   ├── Board.ts       W×H grid, asymmetric or fair(symmetric) walls, spawns
│   ├── Collision.ts   bullet reflection, tank sliding, rotation clamp, ellipse hitbox
│   └── Game.ts        fixed-timestep state machine, win condition
├── entities/          Tank, Bullet, Player (classic/modern), AutoPlayer
├── ai/Controller.ts   AutoPlayer brain (dodge → shoot → wander)
├── render/Renderer.ts canvas drawing
└── ui/                StartScreen, HUD, EndScreen
```
