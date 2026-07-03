# Space Cargo Runner Frontend

React + Vite frontend for Space Cargo Runner.

## Tech

- React for cockpit UI and menus.
- Phaser for the canvas game scene.
- Zustand for shared game state.
- Socket.io client for live score events.
- Wagmi/Viem for optional wallet identity.
- Vite for static builds.

## Development

From the repository root:

```bash
npm run dev:frontend
```

From this folder:

```bash
npm run dev
```

Local URL:

```text
http://localhost:5173/space-cargo-runner/
```

## Build

From the repository root:

```bash
npm run build
```

From this folder:

```bash
npm run build
```

## GitHub Pages

The Vite config sets:

```ts
base: '/space-cargo-runner/'
```

This is required so images, JS, and CSS resolve correctly on:

```text
https://krrish41.github.io/space-cargo-runner/
```

The GitHub Pages workflow deploys `apps/frontend/dist`.

## Backend URL

For production Pages builds, the deploy workflow sets:

```env
VITE_BACKEND_URL=https://space-cargo-backend.onrender.com
```

For local development, the frontend defaults to:

```text
http://localhost:3001
```

The game remains playable without the backend by falling back to an offline pilot profile.
