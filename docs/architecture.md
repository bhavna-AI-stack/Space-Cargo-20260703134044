# System Architecture

Space Cargo Runner uses a decoupled Web2.5 architecture: a static, GitHub Pages-compatible frontend for instant play, plus an optional hosted backend for persistence, wallet identity, live comms, upgrades, and leaderboard data.

## Runtime Overview

```text
React cockpit UI
       |
       v
Zustand shared game store <----> Phaser arcade scene
       |
       v
REST + Socket.io client
       |
       v
Express + Socket.io backend
       |
       v
Prisma ORM + Neon PostgreSQL
```

## Frontend

The frontend lives in `apps/frontend`.

- **React:** renders the cockpit UI, menus, HUD, pause screen, Records, Hangar, leaderboard, wallet modal, and upgrade screens.
- **Phaser:** owns the 60 FPS game loop, canvas rendering, physics collisions, spawning, difficulty progression, power-ups, visual effects, and lightweight WebAudio cues.
- **Zustand:** bridges Phaser and React. Phaser writes telemetry such as health, fuel, score, distance, active power-up, and run completion into the store. React subscribes to those values without driving the canvas loop.
- **Vite:** builds a static artifact with `base: "/space-cargo-runner/"`, which is required for GitHub Pages asset paths.

## Static Playability

The frontend is intentionally playable without a backend. If API calls fail, the app creates an offline pilot locally and uses fallback leaderboard/live-feed data. This keeps GitHub Pages playable even when the hosted API is sleeping or unavailable.

Local-only state includes:

- Best score.
- First-run tutorial dismissal.
- Sound/music settings.
- Achievements.
- Skin unlocks.
- Selected ship skin.

## Game Scene

`MainScene` owns the core arcade behavior:

- Parallax starfield and dust streak background.
- Gradual speed and spawn-pressure scaling.
- Obstacles: asteroids, mines, debris.
- Collectibles: cargo, data caches, fuel cells.
- Power-ups: Shield, Magnet, Double Score, Slow Motion.
- Collision and collection feedback.
- Pause/resume lifecycle.
- Run end synchronization into Zustand.

`Preloader` loads static image assets and generates lightweight procedural textures for runtime-only objects such as mines, debris, data caches, power-ups, and dust streaks.

## Backend

The backend lives in `apps/backend`.

- **Express:** REST routes for auth, wallet binding, user rename, ship upgrades, leaderboard, feed, and score sync.
- **Socket.io:** receives `submitScore` and broadcasts `scoreUpdated`.
- **Prisma:** database access layer.
- **Neon PostgreSQL:** persistent data store.

### Primary REST Routes

- `POST /api/auth`
- `POST /api/wallet/bind`
- `POST /api/user/rename`
- `POST /api/ship/upgrade`
- `GET /api/leaderboard`
- `GET /api/feed`

### Socket Events

- `submitScore`: client sends completed run stats.
- `scoreUpdated`: backend broadcasts the updated profile to connected clients.

## Data Model

### User

Stores pilot identity, wallet binding, username, credits, XP, and high score.

### Ship

Stores upgrade levels, including shield and fuel levels used by the frontend.

### GameSession

Stores completed run snapshots: distance/score, cargo collected, coins earned, XP earned, and timestamp.

## Deployment

GitHub Pages deployment is defined in `.github/workflows/deploy.yml`.

The workflow:

1. Checks out the repository.
2. Configures GitHub Pages.
3. Installs with `npm ci`.
4. Builds with `npm run build --workspace frontend`.
5. Uploads `apps/frontend/dist`.
6. Deploys to the `github-pages` environment.

The workflow sets:

```env
VITE_BACKEND_URL=https://space-cargo-backend.onrender.com
```

## Operational Notes

- Pages source should be configured as **GitHub Actions** in repository settings.
- The hosted backend must allow CORS from GitHub Pages.
- If the backend is unavailable, gameplay still works through the offline fallback path.
- Full frontend lint currently includes pre-existing wallet modal/context lint debt. Touched gameplay and deployment files pass focused lint checks.
