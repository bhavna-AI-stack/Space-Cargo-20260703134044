import Phaser from 'phaser';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    // Load high-fidelity generated game assets
    this.load.image('ship', `${import.meta.env.BASE_URL}assets/ship.png`);
    this.load.image('asteroid', `${import.meta.env.BASE_URL}assets/asteroid.png`);
    this.load.image('cargo', `${import.meta.env.BASE_URL}assets/cargo.png`);
    this.load.image('fuel', `${import.meta.env.BASE_URL}assets/fuel.png`);

    // Keep the stars as generated graphics since they are just dots
    const starGraphics = this.add.graphics();
    starGraphics.fillStyle(0xffffff, 1);
    starGraphics.fillCircle(2, 2, 2);
    starGraphics.generateTexture('star', 4, 4);
    starGraphics.destroy();

    const dustGraphics = this.add.graphics();
    dustGraphics.fillStyle(0x5de8ff, 0.7);
    dustGraphics.fillRect(0, 0, 2, 18);
    dustGraphics.generateTexture('dust-streak', 2, 18);
    dustGraphics.destroy();

    const mineGraphics = this.add.graphics();
    mineGraphics.fillStyle(0x1f0d18, 1);
    mineGraphics.lineStyle(3, 0xff3366, 1);
    mineGraphics.fillCircle(24, 24, 17);
    mineGraphics.strokeCircle(24, 24, 17);
    mineGraphics.lineBetween(24, 1, 24, 47);
    mineGraphics.lineBetween(1, 24, 47, 24);
    mineGraphics.lineBetween(8, 8, 40, 40);
    mineGraphics.lineBetween(40, 8, 8, 40);
    mineGraphics.generateTexture('mine', 48, 48);
    mineGraphics.destroy();

    const debrisGraphics = this.add.graphics();
    debrisGraphics.fillStyle(0x8aa0bd, 1);
    debrisGraphics.lineStyle(2, 0xffffff, 0.5);
    debrisGraphics.fillTriangle(6, 42, 42, 8, 34, 44);
    debrisGraphics.strokeTriangle(6, 42, 42, 8, 34, 44);
    debrisGraphics.generateTexture('debris', 48, 48);
    debrisGraphics.destroy();

    const dataGraphics = this.add.graphics();
    dataGraphics.fillStyle(0x05080c, 1);
    dataGraphics.lineStyle(3, 0x00ffcc, 1);
    dataGraphics.fillRoundedRect(6, 8, 36, 32, 5);
    dataGraphics.strokeRoundedRect(6, 8, 36, 32, 5);
    dataGraphics.fillStyle(0x00ffcc, 1);
    dataGraphics.fillRect(14, 16, 20, 3);
    dataGraphics.fillRect(14, 24, 14, 3);
    dataGraphics.fillRect(14, 32, 18, 3);
    dataGraphics.generateTexture('data-cache', 48, 48);
    dataGraphics.destroy();

    const powerGraphics = this.add.graphics();
    const powerTextures = [
      { key: 'power-shield', color: 0x63ff8f },
      { key: 'power-magnet', color: 0xff4fd8 },
      { key: 'power-double', color: 0xffd166 },
      { key: 'power-slow', color: 0x73c2ff }
    ];

    powerTextures.forEach(({ key, color }) => {
      powerGraphics.clear();
      powerGraphics.fillStyle(0x05080c, 0.95);
      powerGraphics.lineStyle(3, color, 1);
      powerGraphics.fillCircle(24, 24, 20);
      powerGraphics.strokeCircle(24, 24, 20);
      powerGraphics.fillStyle(color, 1);
      powerGraphics.fillCircle(24, 24, 6);
      powerGraphics.generateTexture(key, 48, 48);
    });
    powerGraphics.destroy();
  }

  create() {
    this.scene.start('MainScene');
  }
}
