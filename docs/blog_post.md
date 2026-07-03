# Building Space Cargo Runner: Arcade Feel, Static Hosting, Optional Persistence

Space Cargo Runner started as a simple idea: make a space runner that feels good immediately, then layer in persistence, leaderboards, wallet identity, and replay goals without making the player wait at a login screen.

The current version is built around one rule: the game must be playable from GitHub Pages even when every network feature is offline.

## Phaser Handles the Moment-to-Moment Game

React is great for cockpit panels, menus, HUDs, and modal flows. Phaser is better for the actual game loop. Space Cargo Runner uses Phaser for movement, collision, spawning, particles, camera feedback, and audio cues.

The game scene now has a small arcade director:

- Speed rises over time.
- Spawn intervals shrink over time.
- Extra pressure spawns appear later in a run.
- Asteroids, mines, and debris create different dodge patterns.
- Cargo, data caches, fuel, and power-ups compete for the player's attention.

This keeps the first 20 seconds approachable while letting later runs get tense.

## Zustand Bridges Phaser and React

The shared Zustand store is the clean boundary between canvas gameplay and React UI.

Phaser updates the store when something important happens:

- Hull damage.
- Fuel drain.
- Cargo collection.
- Power-up activation.
- Distance and time updates.
- Game over and run summary.

React subscribes to that state for the HUD, pause panel, Records screen, Hangar, and Game Over report. The UI stays reactive without React trying to render every game frame.

## GitHub Pages Is a First-Class Target

The frontend is a static Vite app. The important deployment detail is the Vite base path:

```ts
base: '/space-cargo-runner/'
```

That lets GitHub Pages serve assets from:

```text
https://krrish41.github.io/space-cargo-runner/
```

GitHub Actions builds `apps/frontend/dist` and deploys it with the Pages artifact action. The workflow also injects the hosted backend URL for online features.

## Offline Fallback Keeps the Game Playable

The backend powers identity, upgrades, leaderboard persistence, and live comms. But the player should never be blocked by a sleeping server. If API calls fail, the frontend creates an offline pilot and uses fallback leaderboard data.

Local browser storage keeps:

- Best score.
- Tutorial state.
- Audio settings.
- Achievements.
- Skin unlocks.
- Selected skin.

That means the GitHub Pages version still works as an arcade game even before the backend wakes up.

## The Meta Layer Adds Replay Value

The new progression layer is intentionally lightweight:

- A richer Game Over screen gives players a reason to retry.
- Achievements reward milestones.
- Missions point players toward clear goals.
- Hangar skins make mastery visible.
- Ship upgrades improve fuel and hull capacity when backend persistence is available.

The goal is not to bury the runner under menus. The goal is to make every run leave a trace.

## What Changed in the Polish Pass

The recent pass added:

- First-time tutorial brief.
- Better manual instructions.
- Difficulty progression.
- More obstacle and collectible variety.
- Shield, Magnet, Double Score, and Slow Motion.
- Improved HUD visibility.
- Pause/resume.
- Sound and music toggles.
- Better collision and collection effects.
- Animated parallax background.
- Game Over run summary.
- Achievements, missions, unlockable skins, and Records/Hangar screens.
- GitHub Pages deployment hardening.

## Closing

Space Cargo Runner is now more than a prototype loop. It is a static-hostable arcade game with optional online persistence: quick to play, readable in motion, and ready for GitHub Pages.
