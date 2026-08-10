import Phaser from "phaser";

/**
 * Generates simple placeholder textures at runtime (colored shapes) instead of
 * loading image assets, so no external/copied artwork is needed for Phase 1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.createCircleTexture("player", 16, 0x4fd1c5);
    this.createCircleTexture("enemy-melee", 14, 0xe25555);
    this.createCircleTexture("enemy-ranged", 13, 0xb366ff);
    this.createCircleTexture("enemy-bomber", 15, 0xff9f43);
    this.createCircleTexture("projectile", 5, 0xf6e05e);
    this.createRectTexture("wall", 32, 32, 0x3a3a4a);
    this.createRectTexture("floor", 32, 32, 0x1c1c26);
    this.createRectTexture("chest", 24, 20, 0xd4a017);
    this.createRectTexture("door", 32, 32, 0x8a5a2b);
    this.createRectTexture("shop", 28, 28, 0x3b82f6);
    this.createCircleTexture("boss", 30, 0x7f1d1d);
    this.createCircleTexture("spark", 6, 0xffffff);
    this.createRectTexture("gate", 30, 30, 0x22d3ee);
    this.createCircleTexture("energy", 8, 0x60a5fa);
  }

  create(): void {
    this.scene.start("MainMenuScene");
  }

  private createCircleTexture(key: string, radius: number, color: number): void {
    const size = radius * 2;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(radius, radius, radius - 1);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private createRectTexture(key: string, w: number, h: number, color: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(1, 0x000000, 0.25);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
