import Phaser from 'phaser';
import { useStore } from '../../store/useStore';

type PowerUpKind = 'Shield' | 'Magnet' | 'Double Score' | 'Slow Motion';
type EntityGroup = Phaser.Physics.Arcade.Group;
type ArcadeEntity = Phaser.Physics.Arcade.Sprite;
type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const POWER_UP_DURATIONS: Record<PowerUpKind, number> = {
  Shield: 9000,
  Magnet: 8000,
  'Double Score': 8500,
  'Slow Motion': 5500
};

export class MainScene extends Phaser.Scene {
  ship!: Phaser.Physics.Arcade.Sprite;
  stars!: Phaser.GameObjects.Group;
  dust!: Phaser.GameObjects.Group;
  obstacles!: EntityGroup;
  cargoGroup!: EntityGroup;
  fuelTanks!: EntityGroup;
  powerUps!: EntityGroup;
  cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  baseSpeed = 300;
  distance = 0;
  isPlaying = false;
  isPaused = false;
  isInvulnerable = false;
  fuelDrainTimer?: Phaser.Time.TimerEvent;
  spawnTimer = 0;
  lastDistanceUpdate = 0;
  elapsedMs = 0;
  runStartedAt = 0;
  powerUpEnds = new Map<PowerUpKind, number>();
  audioContext?: AudioContext;
  musicOsc?: OscillatorNode;
  musicGain?: GainNode;

  constructor() {
    super('MainScene');
  }

  create() {
    this.createBackground();
    this.createShip();

    this.obstacles = this.physics.add.group();
    this.cargoGroup = this.physics.add.group();
    this.fuelTanks = this.physics.add.group();
    this.powerUps = this.physics.add.group();

    this.physics.add.overlap(this.ship, this.obstacles, this.hitObstacle, undefined, this);
    this.physics.add.overlap(this.ship, this.cargoGroup, this.collectCargo, undefined, this);
    this.physics.add.overlap(this.ship, this.fuelTanks, this.handleFuelCollection, undefined, this);
    this.physics.add.overlap(this.ship, this.powerUps, this.collectPowerUp, undefined, this);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.keyboard?.on('keydown-P', () => this.togglePauseFromKeyboard());
    this.input.keyboard?.on('keydown-SPACE', () => this.togglePauseFromKeyboard());

    // Enable multi-touch for mobile (up to 3 pointers total: 1 mouse + 2 touches)
    this.input.addPointer(2);

    this.distance = 0;
  }

  createBackground() {
    const { width, height } = this.scale;

    this.stars = this.add.group({
      key: 'star',
      repeat: 240
    });

    this.stars.getChildren().forEach((child) => {
      const star = child as Phaser.GameObjects.Sprite;
      star.x = Phaser.Math.Between(0, width);
      star.y = Phaser.Math.Between(0, height);
      star.alpha = Phaser.Math.FloatBetween(0.25, 1);
      star.setScale(Phaser.Math.FloatBetween(0.45, 1.7));
      star.setData('depthSpeed', Phaser.Math.FloatBetween(0.35, 1.4));
    });

    this.dust = this.add.group({
      key: 'dust-streak',
      repeat: 35
    });

    this.dust.getChildren().forEach((child) => {
      const streak = child as Phaser.GameObjects.Sprite;
      streak.x = Phaser.Math.Between(0, width);
      streak.y = Phaser.Math.Between(0, height);
      streak.alpha = Phaser.Math.FloatBetween(0.08, 0.28);
      streak.setScale(Phaser.Math.FloatBetween(0.5, 1.4));
      streak.setData('depthSpeed', Phaser.Math.FloatBetween(1.2, 2.4));
      streak.setBlendMode(Phaser.BlendModes.ADD);
    });
  }

  createShip() {
    const { width, height } = this.scale;
    this.ship = this.physics.add.sprite(width / 2, height - 100, 'ship');
    this.ship.setScale(0.1);
    this.ship.setAngle(-90);
    this.ship.setBlendMode(Phaser.BlendModes.SCREEN);
    this.ship.setCollideWorldBounds(true);
    this.ship.body?.setSize(this.ship.width * 0.7, this.ship.height * 0.7);
    this.applySelectedSkin();
  }

  startGame() {
    this.isPlaying = true;
    this.isPaused = false;
    this.distance = 0;
    this.baseSpeed = 300;
    this.elapsedMs = 0;
    this.spawnTimer = 0;
    this.lastDistanceUpdate = 0;
    this.runStartedAt = this.time.now;
    this.powerUpEnds.clear();
    useStore.getState().setActivePowerUp(null);
    this.obstacles.clear(true, true);
    this.cargoGroup.clear(true, true);
    this.fuelTanks.clear(true, true);
    this.powerUps.clear(true, true);
    this.ship.setPosition(this.scale.width / 2, this.scale.height - 100);
    this.ship.alpha = 1;
    this.ship.setScale(0.1);
    this.ship.clearTint();
    this.applySelectedSkin();
    this.isInvulnerable = false;
    this.physics.resume();
    this.startMusic();

    if (this.fuelDrainTimer) this.fuelDrainTimer.destroy();
    this.fuelDrainTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const drain = 2 + Math.min(3, this.elapsedMs / 60000);
        useStore.getState().drainFuel(drain);
      }
    });
  }

  update(time: number, delta: number) {
    const state = useStore.getState();

    if (state.musicEnabled) this.startMusic();
    else this.stopMusic();

    if (state.gameState === 'PLAYING' && !this.isPlaying) {
      this.startGame();
    } else if (state.gameState === 'GAME_OVER' && this.isPlaying) {
      this.gameOver();
    }

    if (!['PLAYING', 'PAUSED', 'GAME_OVER'].includes(state.gameState) && this.isPlaying) {
      this.abortRun();
      return;
    }

    if (state.gameState === 'PAUSED' && this.isPlaying) {
      this.pauseWorld();
      return;
    }

    if (state.gameState === 'PLAYING' && this.isPaused) {
      this.resumeWorld();
    }

    if (!this.isPlaying || state.gameState !== 'PLAYING') return;

    this.elapsedMs = time - this.runStartedAt;
    this.updateDifficulty();
    this.updatePowerUps(time);

    const worldSpeed = this.getWorldSpeed();
    this.scrollBackground(delta, worldSpeed);
    this.moveEntities(delta, worldSpeed);
    this.pullWithMagnet(delta);
    this.handleSpawning(delta);
    this.handleShipControls();

    this.distance += (this.baseSpeed * delta) / 10000;

    if (!this.lastDistanceUpdate || time - this.lastDistanceUpdate > 100) {
      this.lastDistanceUpdate = time;
      useStore.getState().setDistance(Math.floor(this.distance));
      useStore.getState().setTimeSurvived(Math.floor(this.elapsedMs / 1000));
    }
  }

  updateDifficulty() {
    const seconds = this.elapsedMs / 1000;
    this.baseSpeed = 300 + Math.min(420, seconds * 4.6 + this.distance * 0.18);
  }

  updatePowerUps(time: number) {
    let strongest: { type: PowerUpKind; remainingMs: number } | null = null;

    this.powerUpEnds.forEach((endTime, type) => {
      const remainingMs = Math.max(0, endTime - time);
      if (remainingMs <= 0) {
        this.powerUpEnds.delete(type);
        return;
      }
      if (!strongest || remainingMs > strongest.remainingMs) {
        strongest = { type, remainingMs };
      }
    });

    this.isInvulnerable = this.powerUpEnds.has('Shield');
    if (this.powerUpEnds.has('Shield')) {
      this.ship.setTint(0x63ff8f);
    } else if (this.ship.tintTopLeft === 0x63ff8f) {
      this.ship.clearTint();
      this.applySelectedSkin();
    }

    useStore.getState().setActivePowerUp(strongest);
  }

  getWorldSpeed() {
    return this.powerUpEnds.has('Slow Motion') ? this.baseSpeed * 0.58 : this.baseSpeed;
  }

  scrollBackground(delta: number, worldSpeed: number) {
    this.stars.getChildren().forEach((child) => {
      const star = child as Phaser.GameObjects.Sprite;
      star.y += (worldSpeed * delta) / 1000 * star.getData('depthSpeed');
      star.alpha = Phaser.Math.Clamp(star.alpha + Math.sin((this.time.now + star.x) / 600) * 0.002, 0.2, 1);
      if (star.y > this.scale.height) {
        star.y = -6;
        star.x = Phaser.Math.Between(0, this.scale.width);
      }
    });

    this.dust.getChildren().forEach((child) => {
      const streak = child as Phaser.GameObjects.Sprite;
      streak.y += (worldSpeed * delta) / 1000 * streak.getData('depthSpeed');
      if (streak.y > this.scale.height + 25) {
        streak.y = -30;
        streak.x = Phaser.Math.Between(0, this.scale.width);
      }
    });
  }

  moveEntities(delta: number, worldSpeed: number) {
    [this.obstacles, this.cargoGroup, this.fuelTanks, this.powerUps].forEach(group => {
      group.getChildren().forEach((gameObject) => {
        const child = gameObject as ArcadeEntity;
        const speedMultiplier = Number(child.getData('speedMultiplier') ?? 1);
        const drift = Number(child.getData('drift') ?? 0);
        child.y += (worldSpeed * speedMultiplier * delta) / 1000;
        child.x += (drift * delta) / 1000;
        child.angle += Number(child.getData('spin') ?? 0) * delta / 1000;
        if (child.y > this.scale.height + 70 || child.x < -80 || child.x > this.scale.width + 80) {
          child.destroy();
        }
      });
    });
  }

  pullWithMagnet(delta: number) {
    if (!this.powerUpEnds.has('Magnet')) return;

    [this.cargoGroup, this.fuelTanks, this.powerUps].forEach(group => {
      group.getChildren().forEach((gameObject) => {
        const child = gameObject as ArcadeEntity;
        const distance = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, child.x, child.y);
        if (distance > 210) return;
        const pull = (1 - distance / 210) * delta * 0.012;
        child.x = Phaser.Math.Linear(child.x, this.ship.x, pull);
        child.y = Phaser.Math.Linear(child.y, this.ship.y, pull);
      });
    });
  }

  handleSpawning(delta: number) {
    const seconds = this.elapsedMs / 1000;
    const spawnInterval = Math.max(420, 1080 - seconds * 7 - this.distance * 0.1);

    this.spawnTimer += delta;
    if (this.spawnTimer <= spawnInterval) return;

    this.spawnTimer = 0;
    this.spawnEntity();

    const pressureChance = Phaser.Math.Clamp((seconds - 20) / 140, 0, 0.35);
    if (Math.random() < pressureChance) {
      this.time.delayedCall(130, () => this.spawnEntity(true));
    }
  }

  handleShipControls() {
    const skinHandling = useStore.getState().selectedSkinId === 'gold' ? 1.08 : 1;
    const velocity = 420 * skinHandling;

    let isTouchingLeft = false;
    let isTouchingRight = false;

    // Check all active pointers (mouse + touches)
    this.input.manager.pointers.forEach(pointer => {
      if (pointer.isDown) {
        if (pointer.x < this.scale.width / 2) {
          isTouchingLeft = true;
        } else {
          isTouchingRight = true;
        }
      }
    });

    if (this.cursors?.left.isDown || isTouchingLeft) {
      this.ship.setVelocityX(-velocity);
      this.ship.setAngle(-96);
    } else if (this.cursors?.right.isDown || isTouchingRight) {
      this.ship.setVelocityX(velocity);
      this.ship.setAngle(-84);
    } else {
      this.ship.setVelocityX(0);
      this.ship.setAngle(-90);
    }
  }

  spawnEntity(forceObstacle = false) {
    const x = Phaser.Math.Between(50, this.scale.width - 50);
    const seconds = this.elapsedMs / 1000;
    const obstacleChance = forceObstacle ? 1 : Phaser.Math.Clamp(0.48 + seconds / 260, 0.48, 0.72);
    const rand = Math.random();

    if (rand < obstacleChance) {
      this.spawnObstacle(x, seconds);
    } else if (rand < obstacleChance + 0.2) {
      this.spawnCargo(x);
    } else if (rand < obstacleChance + 0.33) {
      this.spawnFuel(x);
    } else {
      this.spawnPowerUp(x);
    }
  }

  spawnObstacle(x: number, seconds: number) {
    const roll = Math.random();
    let obstacle: Phaser.Physics.Arcade.Image | Phaser.Physics.Arcade.Sprite;

    if (seconds > 22 && roll < 0.24) {
      obstacle = this.obstacles.create(x, -50, 'mine');
      obstacle.setScale(0.95);
      obstacle.setData('damage', 35);
      obstacle.setData('kind', 'Mine');
      obstacle.setData('speedMultiplier', 0.86);
      obstacle.setData('drift', Phaser.Math.Between(-25, 25));
      obstacle.setData('spin', Phaser.Math.Between(-70, 70));
    } else if (seconds > 14 && roll < 0.48) {
      obstacle = this.obstacles.create(x, -50, 'debris');
      obstacle.setScale(0.9);
      obstacle.setData('damage', 18);
      obstacle.setData('kind', 'Debris');
      obstacle.setData('speedMultiplier', 1.25);
      obstacle.setData('drift', Phaser.Math.Between(-55, 55));
      obstacle.setData('spin', Phaser.Math.Between(120, 240));
    } else {
      obstacle = this.obstacles.create(x, -50, 'asteroid');
      obstacle.setScale(Phaser.Math.FloatBetween(0.09, 0.15));
      obstacle.setData('damage', 25);
      obstacle.setData('kind', 'Asteroid');
      obstacle.setData('speedMultiplier', Phaser.Math.FloatBetween(0.92, 1.08));
      obstacle.setData('drift', Phaser.Math.Between(-18, 18));
      obstacle.setData('spin', Phaser.Math.Between(-45, 45));
    }

    obstacle.setBlendMode(Phaser.BlendModes.SCREEN);
    obstacle.body?.setSize(obstacle.width * 0.65, obstacle.height * 0.65);
  }

  spawnCargo(x: number) {
    const isDataCache = Math.random() < 0.32;
    const cargo = this.cargoGroup.create(x, -50, isDataCache ? 'data-cache' : 'cargo');
    cargo.setScale(isDataCache ? 0.9 : 0.08);
    cargo.setBlendMode(Phaser.BlendModes.SCREEN);
    cargo.setData('score', isDataCache ? 18 : 10);
    cargo.setData('label', isDataCache ? 'DATA +18' : 'CARGO +10');
    cargo.setData('spin', isDataCache ? 20 : 45);
  }

  spawnFuel(x: number) {
    const fuel = this.fuelTanks.create(x, -50, 'fuel');
    fuel.setScale(0.08);
    fuel.setBlendMode(Phaser.BlendModes.SCREEN);
    fuel.body?.setSize(fuel.width * 0.8, fuel.height * 0.8);
    fuel.setData('spin', 35);
  }

  spawnPowerUp(x: number) {
    const options: { type: PowerUpKind; texture: string }[] = [
      { type: 'Shield', texture: 'power-shield' },
      { type: 'Magnet', texture: 'power-magnet' },
      { type: 'Double Score', texture: 'power-double' },
      { type: 'Slow Motion', texture: 'power-slow' }
    ];
    const option = Phaser.Utils.Array.GetRandom(options);
    const powerUp = this.powerUps.create(x, -50, option.texture);
    powerUp.setScale(0.95);
    powerUp.setBlendMode(Phaser.BlendModes.ADD);
    powerUp.setData('type', option.type);
    powerUp.setData('spin', 80);
  }

  hitObstacle(_shipObject: unknown, obstacleObject: unknown) {
    const obstacle = obstacleObject as ArcadeEntity;
    const kind = obstacle.getData('kind') || 'Obstacle';

    if (this.powerUpEnds.has('Shield')) {
      obstacle.destroy();
      this.showBurst(this.ship.x, this.ship.y, 0x63ff8f, 12);
      this.showFloatingText('SHIELD', this.ship.x, this.ship.y - 42, '#63ff8f');
      this.playTone(220, 0.08, 'triangle', 0.05);
      return;
    }

    if (this.isInvulnerable) return;

    obstacle.destroy();
    useStore.getState().damageShip(obstacle.getData('damage') || 25);
    this.cameras.main.shake(180, kind === 'Mine' ? 0.03 : 0.02);
    this.cameras.main.flash(120, 255, 30, 80);
    this.showBurst(this.ship.x, this.ship.y, 0xff3366, 18);
    this.showFloatingText(kind.toUpperCase(), this.ship.x, this.ship.y - 40, '#ff3366');
    this.playTone(80, 0.16, 'sawtooth', 0.07);

    this.isInvulnerable = true;
    this.ship.setTint(0xff3366);

    this.time.addEvent({
      delay: 100,
      repeat: 8,
      callback: () => {
        this.ship.alpha = this.ship.alpha === 1 ? 0.3 : 1;
      }
    });

    this.time.delayedCall(1000, () => {
      if (this.powerUpEnds.has('Shield')) return;
      this.isInvulnerable = false;
      this.ship.clearTint();
      this.applySelectedSkin();
      this.ship.alpha = 1;
    });
  }

  collectCargo(_shipObject: unknown, cargoObject: unknown) {
    const cargo = cargoObject as ArcadeEntity;
    const multiplier = this.powerUpEnds.has('Double Score') ? 2 : 1;
    const score = (cargo.getData('score') || 10) * multiplier;
    const label = multiplier > 1 ? `${cargo.getData('label') || 'CARGO'} x2` : cargo.getData('label') || 'CARGO +10';
    cargo.destroy();
    useStore.getState().addCoins(score);
    useStore.getState().incrementCargo();

    this.showBurst(this.ship.x, this.ship.y - 20, multiplier > 1 ? 0xffd166 : 0xff00ff, 12);
    this.showFloatingText(label, this.ship.x, this.ship.y - 45, multiplier > 1 ? '#ffd166' : '#ff00ff');
    this.playTone(multiplier > 1 ? 880 : 660, 0.08, 'sine', 0.05);
    this.ship.setTint(multiplier > 1 ? 0xffd166 : 0xffff00);
    this.time.delayedCall(100, () => {
      this.ship.clearTint();
      this.applySelectedSkin();
    });
  }

  handleFuelCollection(_shipObject: unknown, fuelPickupObject: unknown) {
    const fuelPickup = fuelPickupObject as ArcadeEntity;
    fuelPickup.destroy();
    useStore.getState().replenishFuel(30);
    this.cameras.main.flash(100, 0, 240, 255);
    this.showBurst(this.ship.x, this.ship.y - 20, 0x00aaff, 14);
    this.showFloatingText('FUEL +30', this.ship.x, this.ship.y - 45, '#00aaff');
    this.playTone(500, 0.1, 'triangle', 0.05);

    this.ship.setTint(0x00aaff);
    this.time.delayedCall(100, () => {
      this.ship.clearTint();
      this.applySelectedSkin();
    });
  }

  collectPowerUp(_shipObject: unknown, powerUpObject: unknown) {
    const powerUp = powerUpObject as ArcadeEntity;
    const type = powerUp.getData('type') as PowerUpKind;
    powerUp.destroy();
    this.powerUpEnds.set(type, this.time.now + POWER_UP_DURATIONS[type]);
    this.showBurst(this.ship.x, this.ship.y - 20, this.getPowerUpColor(type), 18);
    this.showFloatingText(type.toUpperCase(), this.ship.x, this.ship.y - 50, this.getPowerUpCssColor(type));
    this.playTone(type === 'Slow Motion' ? 320 : 720, 0.12, 'square', 0.045);
  }

  gameOver() {
    this.isPlaying = false;
    this.isPaused = false;
    this.time.removeAllEvents();
    this.stopMusic();
    useStore.getState().setActivePowerUp(null);

    const finalDistance = Math.floor(this.distance);
    const coinsCollected = useStore.getState().coinsCollected;

    useStore.getState().setDistance(finalDistance);
    useStore.getState().setTimeSurvived(Math.floor(this.elapsedMs / 1000));
    useStore.getState().syncRunResults(finalDistance, coinsCollected);
    useStore.getState().setGameState('GAME_OVER');
    this.physics.pause();

    this.cameras.main.shake(260, 0.035);
    this.showBurst(this.ship.x, this.ship.y, 0xff3366, 28);
    this.ship.setTint(0xff0000);
    this.ship.setScale(1.25);
    this.tweens.add({ targets: this.ship, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
  }

  abortRun() {
    this.isPlaying = false;
    this.isPaused = false;
    this.time.removeAllEvents();
    this.stopMusic();
    this.physics.resume();
    this.tweens.resumeAll();
    this.obstacles.clear(true, true);
    this.cargoGroup.clear(true, true);
    this.fuelTanks.clear(true, true);
    this.powerUps.clear(true, true);
    useStore.getState().setActivePowerUp(null);
    this.ship.setPosition(this.scale.width / 2, this.scale.height - 100);
    this.ship.setScale(0.1);
    this.ship.setAlpha(1);
    this.ship.clearTint();
    this.applySelectedSkin();
  }

  pauseWorld() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.physics.pause();
    this.tweens.pauseAll();
    if (this.fuelDrainTimer) this.fuelDrainTimer.paused = true;
    this.stopMusic();
  }

  resumeWorld() {
    this.isPaused = false;
    this.physics.resume();
    this.tweens.resumeAll();
    if (this.fuelDrainTimer) this.fuelDrainTimer.paused = false;
    this.startMusic();
  }

  togglePauseFromKeyboard() {
    const state = useStore.getState();
    if (state.gameState === 'PLAYING') state.setGameState('PAUSED');
    else if (state.gameState === 'PAUSED') state.setGameState('PLAYING');
  }

  applySelectedSkin() {
    const skin = useStore.getState().shipSkins.find((item) => item.id === useStore.getState().selectedSkinId);
    if (!skin || skin.id === 'standard') return;
    const color = Phaser.Display.Color.HexStringToColor(skin.color).color;
    this.ship.setTint(color);
  }

  showBurst(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.9);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-70, 70),
        y: y + Phaser.Math.Between(-70, 70),
        alpha: 0,
        scale: 0.15,
        duration: Phaser.Math.Between(260, 520),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  showFloatingText(text: string, x: number, y: number, color: string) {
    const label = this.add.text(x, y, text, {
      color,
      fontFamily: 'Orbitron, Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      stroke: '#020408',
      strokeThickness: 4
    }).setOrigin(0.5);
    label.setDepth(20);
    this.tweens.add({
      targets: label,
      y: y - 36,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy()
    });
  }

  getPowerUpColor(type: PowerUpKind) {
    if (type === 'Shield') return 0x63ff8f;
    if (type === 'Magnet') return 0xff4fd8;
    if (type === 'Double Score') return 0xffd166;
    return 0x73c2ff;
  }

  getPowerUpCssColor(type: PowerUpKind) {
    if (type === 'Shield') return '#63ff8f';
    if (type === 'Magnet') return '#ff4fd8';
    if (type === 'Double Score') return '#ffd166';
    return '#73c2ff';
  }

  playTone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    if (!useStore.getState().soundEnabled) return;
    const context = this.getAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  startMusic() {
    const state = useStore.getState();
    if (!state.musicEnabled || state.gameState !== 'PLAYING' || this.musicOsc) return;
    const context = this.getAudioContext();
    if (!context) return;

    this.musicOsc = context.createOscillator();
    this.musicGain = context.createGain();
    this.musicOsc.type = 'sawtooth';
    this.musicOsc.frequency.setValueAtTime(55, context.currentTime);
    this.musicGain.gain.setValueAtTime(0.018, context.currentTime);
    this.musicOsc.connect(this.musicGain);
    this.musicGain.connect(context.destination);
    this.musicOsc.start();
  }

  stopMusic() {
    if (!this.musicOsc) return;
    this.musicOsc.stop();
    this.musicOsc.disconnect();
    this.musicGain?.disconnect();
    this.musicOsc = undefined;
    this.musicGain = undefined;
  }

  getAudioContext() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
      if (!AudioContextClass) return undefined;
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }
}
