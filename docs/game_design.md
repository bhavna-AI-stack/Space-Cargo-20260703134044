# Game Design Document

## Concept

Space Cargo Runner is an endless space-courier survival game. The player pilots a cargo ship through an increasingly dangerous flight lane, collecting resources and power-ups while dodging hazards. The fantasy is quick, readable arcade action wrapped in a neon cockpit interface.

## Player Goals

- Survive as long as possible.
- Collect cargo and data caches.
- Maintain fuel.
- Avoid damage.
- Use power-ups at the right time.
- Beat the previous best score.
- Unlock achievements and ship skins.
- Climb the leaderboard when the backend is online.

## Controls

- Left/right arrow keys steer the ship.
- Pointer and touch input steer by screen side.
- `P` or `Space` toggles pause.
- On-screen buttons control pause, sound, and music.

## Core Loop

1. Launch from the menu.
2. Read the HUD: hull, fuel, score, cargo, time, distance, and power-up status.
3. Dodge hazards while collecting resources.
4. The game gradually increases speed and spawn pressure.
5. Power-ups create temporary survival windows or score opportunities.
6. A run ends when hull or fuel reaches zero.
7. The Game Over screen reports run stats and unlocks.
8. The player returns to upgrades, Records, Hangar, leaderboard, or restarts.

## Difficulty Progression

Difficulty scales through:

- Increasing base world speed.
- Shorter spawn intervals over time.
- Additional pressure spawns later in a run.
- More hazard variety as the run continues.

The early game gives new players time to learn the lane movement. The mid-game introduces faster debris and mines. The late game increases pressure through denser and faster object patterns.

## Objects

### Hazards

- **Asteroid:** baseline obstacle and damage source.
- **Mine:** heavier damage, slower drift, high threat.
- **Debris:** faster and lighter, creates quick reaction tests.

### Collectibles

- **Cargo:** main credit and cargo-count collectible.
- **Data Cache:** higher-value cargo variant.
- **Fuel Cell:** replenishes fuel and extends a run.

### Power-Ups

- **Shield:** absorbs collisions.
- **Magnet:** pulls nearby collectibles.
- **Double Score:** doubles cargo/data rewards.
- **Slow Motion:** slows world movement temporarily.

## Scoring

Final Score is built from:

- Distance.
- Credits collected.
- Cargo secured.
- Time survived.

The score model rewards both survival and active collection.

## HUD

The HUD prioritizes readability during fast motion:

- Hull Integrity bar.
- Fuel Core Dissipation bar.
- Pilot Rank XP bar.
- Distance.
- Credits.
- Score.
- Time survived.
- Cargo count.
- Active power-up timer.
- Pause/sound/music controls.

## Game Over

The Game Over screen is a performance recap:

- Final Score.
- Best Score.
- Distance.
- Time.
- Cargo.
- Credits.
- New achievement unlocks.

## Meta Progression

### Upgrades

- Deflector Shields increase max hull.
- Plasma Fuel Core increases max fuel.

### Achievements

- First Haul: collect first cargo.
- Void Sprinter: reach 500m.
- Cargo Chain: collect 10 cargo in one run.
- Cold Nerves: survive 60 seconds.

### Missions

Missions give visible targets:

- Run 750m.
- Secure 12 cargo.
- Survive 90 seconds.

### Hangar

Ship skins create lightweight replay goals:

- Standard Courier: default.
- Pulse Runner: reach 500m.
- Aureate Hauler: collect 10 cargo in one run.

## Audio and Visual Feedback

The game uses:

- Camera shake and flash on collision.
- Floating text for pickups and hazards.
- Particle bursts for impacts and collection.
- WebAudio tones for cargo, fuel, power-ups, and collisions.
- Ambient low-frequency music toggle.
- Animated star and dust background for motion depth.

## Deployment Design

The game is designed to be playable from GitHub Pages as a static app. Backend features enhance persistence and multiplayer feel, but core gameplay does not depend on them.
