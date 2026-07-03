# Space Cargo Runner - Game Documentation

## Overview

Space Cargo Runner is an endless arcade survival game with a neon cockpit interface. The player pilots a cargo ship through a dangerous space lane, collecting valuable cargo while managing hull integrity, fuel, speed, hazards, and temporary power-ups.

Live game:

```text
https://krrish41.github.io/space-cargo-runner/
```

The GitHub Pages build is playable as a static site. If the hosted backend is unavailable, the frontend falls back to an offline pilot and mock leaderboard data so the core game remains accessible.

## Core Loop

1. Start a run from the cockpit dashboard.
2. Steer left and right with arrow keys, pointer, or touch input.
3. Collect cargo, data caches, fuel, and power-ups.
4. Dodge asteroids, mines, and debris.
5. Survive as long as possible while score, distance, cargo, and time climb.
6. Review the Game Over report, unlock achievements/skins, and start again.

## Controls

- `Left Arrow`: move left.
- `Right Arrow`: move right.
- Pointer/touch left side: move left.
- Pointer/touch right side: move right.
- `P` or `Space`: pause/resume.
- On-screen pause, sound, and music buttons are available during play.

## Hazards

- **Asteroid:** Standard obstacle, moderate damage.
- **Mine:** Heavier hazard with stronger damage and a slower drift.
- **Debris:** Faster moving hazard with lighter damage and more lateral drift.

The game gradually increases speed and spawn pressure over time, with extra pressure spawns appearing deeper into a run.

## Collectibles

- **Cargo:** Grants credits and cargo progress.
- **Data Cache:** Higher-value collectible variant.
- **Fuel Cell:** Restores fuel and extends the run.

## Power-Ups

- **Shield:** Absorbs collisions for a short duration.
- **Magnet:** Pulls nearby cargo, fuel, and power-ups toward the ship.
- **Double Score:** Doubles cargo/data credit rewards while active.
- **Slow Motion:** Temporarily slows world speed.

The HUD displays the active power-up and remaining time.

## Scoring and Run Stats

The run score combines:

- Distance traveled.
- Credits collected.
- Cargo secured.
- Time survived.

The Game Over screen reports:

- Final Score.
- Best Score.
- Distance.
- Time Survived.
- Cargo.
- Credits.
- Newly unlocked achievements.

Best score, settings, achievements, and skins are persisted locally. Backend-connected profiles can also submit score events to the live leaderboard.

## Progression

### Upgrades

The Ship Upgrades screen currently supports:

- **Deflector Shields:** increases maximum hull integrity.
- **Plasma Fuel Core:** increases maximum fuel capacity.

### Records

The Records screen includes achievements and mission progress:

- First cargo secured.
- 500m run.
- 10 cargo in one run.
- 60 second survival.
- Mission targets for distance, cargo, and survival time.

### Hangar

The Hangar contains unlockable skins:

- Standard Courier: unlocked by default.
- Pulse Runner: unlocked by reaching 500m.
- Aureate Hauler: unlocked by collecting 10 cargo in one run.

## Technical Architecture

- **Phaser:** canvas rendering, physics, collision, spawning, effects, and audio cues.
- **React:** cockpit UI, menus, panels, HUD, wallet modal, and player controls.
- **Zustand:** shared state bridge between Phaser and React.
- **Socket.io:** live score submission and global comms feed.
- **Express:** REST API for auth, wallet binding, rename, upgrades, leaderboard, and feed.
- **Prisma + Neon PostgreSQL:** persistent users, ships, upgrades, and sessions.
- **Vite:** frontend bundling with `base: "/space-cargo-runner/"` for GitHub Pages.

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml`.

The workflow:

1. Runs on pushes to `main`.
2. Installs dependencies with `npm ci`.
3. Builds the frontend workspace.
4. Uploads `apps/frontend/dist`.
5. Deploys through GitHub Pages.

The deployed frontend uses:

```env
VITE_BACKEND_URL=https://space-cargo-backend.onrender.com
```

## Local Development

Install from the root:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:frontend
```

Run the backend:

```bash
cd apps/backend
npm run dev
```

Build the Pages frontend:

```bash
npm run build
```
