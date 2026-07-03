# Space Cargo Runner

**Space Cargo Runner** is a retro-futuristic arcade runner built with React, Phaser, Zustand, Socket.io, Express, Prisma, and Neon PostgreSQL. Jump in as a guest pilot, dodge hazards, collect cargo, trigger power-ups, upgrade your ship, and chase the leaderboard.

[Play on GitHub Pages](https://krrish41.github.io/space-cargo-runner/)

## Current Gameplay

- Fast lateral ship controls with keyboard, pointer, and touch input.
- First-run tutorial brief plus a detailed in-game manual.
- Gradual difficulty progression with increasing speed and denser obstacle pressure.
- Obstacle variety: asteroids, mines, and fast debris.
- Collectible variety: cargo, data caches, and fuel cells.
- Power-ups: Shield, Magnet, Double Score, and Slow Motion.
- Improved HUD with hull, fuel, pilot rank, distance, score, cargo count, time survived, and active power-up timer.
- Pause/resume plus sound and music toggles.
- Animated parallax starfield and dust streak background.
- Collision, cargo, fuel, and power-up visual effects with lightweight WebAudio feedback.
- Rich Game Over report with final score, best score, distance, time, cargo, credits, and achievement unlocks.
- Records screen with achievements and missions.
- Hangar screen with unlockable ship skins.
- Leaderboard and live comms feed when the backend is available.

## Playability on GitHub Pages

The frontend is a static Vite build and is deployed from `apps/frontend/dist` through GitHub Actions. The Vite base path is set to `/space-cargo-runner/`, so assets resolve correctly on:

```text
https://krrish41.github.io/space-cargo-runner/
```

The game remains playable even if the hosted backend is unavailable. In that case it falls back to an offline pilot profile and mock leaderboard data. Online persistence, wallet binding, upgrades, leaderboard updates, and live comms require the backend URL configured by `VITE_BACKEND_URL`.

## Repository Layout

```text
apps/frontend      React + Vite UI, Phaser game scene, Zustand store
apps/backend       Express + Socket.io API, Prisma persistence
packages/shared    Shared TypeScript types
docs               Architecture, game design, and product writeup
.github/workflows  GitHub Pages deployment workflow
```

## Local Development

Install dependencies from the monorepo root:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:frontend
```

The local frontend opens at:

```text
http://localhost:5173/space-cargo-runner/
```

Run the backend separately when you want persistence and leaderboard features:

```bash
cd apps/backend
npm run dev
```

Create `apps/backend/.env` first:

```env
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
```

Initialize Prisma:

```bash
cd apps/backend
npx prisma db push
```

## Build and Preview

Build the GitHub Pages frontend from the root:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview:frontend
```

The GitHub Actions workflow uses:

```bash
npm ci
npm run build --workspace frontend
```

and deploys `apps/frontend/dist`.

## Backend API

- `POST /api/auth`: create or restore a guest/user profile.
- `POST /api/wallet/bind`: bind a wallet address to the current profile.
- `POST /api/user/rename`: rename a pilot.
- `GET /api/leaderboard`: fetch top pilots.
- `GET /api/feed`: fetch recent live comms history when available.
- `POST /api/ship/upgrade`: upgrade shield or fuel capacity.
- Socket event `submitScore`: submit a completed run.
- Socket event `scoreUpdated`: receive live leaderboard/comms updates.

## Web3 Notes

Wallet connection is optional. Guest mode is the default path and is enough to play immediately. Wallet binding can make a profile portable when the backend is available.

SecureChain network details used by the wallet flow:

```text
Network Name: SCAI Mainnet
RPC URL: https://mainnet-rpc.scai.network
Chain ID: 34
Currency Symbol: SCAI
Block Explorer: https://explorer.securechain.ai
```

## Verification

Recent verification for this release:

- Frontend production build passes.
- Touched frontend files pass focused ESLint with no errors.
- Browser smoke test confirmed menu, start run, HUD, pause, Records, Hangar, and canvas rendering.

Full frontend lint still reports existing wallet/modal/context lint debt unrelated to the gameplay and deployment changes.
