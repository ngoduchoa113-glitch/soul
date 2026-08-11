import Phaser from "phaser";
import { WEAPONS } from "../data/weapons";
import { DECOR_ASSETS, OBSTACLE_CLUSTER_ASSETS, OBSTACLE_TREE_ASSETS } from "../data/decor";
import { WEAPON_ART_OVERRIDES, WEAPON_ICON_SHAPES, type WeaponIconShape } from "../data/weaponIcons";
import { UPGRADE_ICON_SHAPES, type UpgradeIconShape } from "../data/upgradeIcons";
import { FLOOR_TILE_ASSETS } from "../data/floorTiles";
import { ROCK_ASSETS } from "../data/rocks";
import { ALL_CREATURE_SPRITE_SHEETS } from "../data/creatureSprites";
import { WALL_KEYS, generateBeveledTile, generateFloorSupertileFromArt, generateWallTile } from "./tileTextures";

/**
 * Loads real art (characters, monsters, obstacles, decor) and builds animations for it, plus
 * generates simple placeholder textures at runtime (colored shapes) for anything without art yet.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.spritesheet("portal", "/assets/portal.png", { frameWidth: 32, frameHeight: 44 });
    for (const obstacle of [...OBSTACLE_CLUSTER_ASSETS, ...OBSTACLE_TREE_ASSETS]) this.load.image(obstacle.key, obstacle.path);
    for (const decor of DECOR_ASSETS) this.load.image(decor.key, decor.path);
    for (const sheet of ALL_CREATURE_SPRITE_SHEETS) {
      this.load.spritesheet(sheet.key, sheet.path, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    }
    for (const tile of FLOOR_TILE_ASSETS) this.load.image(tile.key, tile.path);
    for (const rock of ROCK_ASSETS) this.load.image(rock.key, rock.path);

    this.createCircleTexture("projectile", 5, 0xf6e05e);
    WALL_KEYS.forEach((key, i) => generateWallTile(this, key, 4000 + i * 97));
    generateBeveledTile(this, "chest", 24, 20, 0xd4a017, 0xffe27a, 0x8a5a0a);
    generateBeveledTile(this, "door", 32, 32, 0x8a5a2b, 0xb07a42, 0x4a2e14);
    generateBeveledTile(this, "shop", 28, 28, 0x3b82f6, 0x7db1ff, 0x1e4fa3);
    this.createCircleTexture("spark", 6, 0xffffff);
    this.createShardTexture("particle-shard");
    this.createFlashTexture("particle-flash");
    this.createCircleTexture("energy", 8, 0x60a5fa);
    this.createCircleTexture("coin", 7, 0xf6d365);
    this.createCircleTexture("hp-orb", 8, 0xe25555);
    this.createSpikeTrapTexture("spike-trap");
    this.createCrateTexture("tnt-crate", 0xb45309, 0xef4444);
    this.createCrateTexture("poison-barrel", 0x14532d, 0x4ade80);

    for (const art of Object.values(WEAPON_ART_OVERRIDES)) this.load.image(art.loadKey, art.path);

    Object.keys(WEAPONS).forEach((id) => {
      if (WEAPON_ART_OVERRIDES[id]) return;
      const icon = WEAPON_ICON_SHAPES[id] ?? { shape: "gun", color: 0xffffff };
      this.createWeaponIcon(`weapon-icon-${id}`, icon.shape, icon.color);
    });

    Object.entries(UPGRADE_ICON_SHAPES).forEach(([id, icon]) => {
      this.createUpgradeIcon(`upgrade-icon-${id}`, icon.shape, icon.color);
    });
  }

  create(): void {
    this.anims.create({
      key: "portal-spin",
      frames: this.anims.generateFrameNumbers("portal", { start: 0, end: 15 }),
      frameRate: 14,
      repeat: -1,
    });

    for (const sheet of ALL_CREATURE_SPRITE_SHEETS) {
      this.anims.create({
        key: sheet.key,
        frames: this.anims.generateFrameNumbers(sheet.key, { start: 0, end: sheet.frameCount - 1 }),
        frameRate: sheet.frameRate,
        repeat: sheet.loop ? -1 : 0,
      });
    }

    for (const [id, art] of Object.entries(WEAPON_ART_OVERRIDES)) {
      this.bakeArtIcon(`weapon-icon-${id}`, art.loadKey);
    }
    generateFloorSupertileFromArt(
      this,
      "floor",
      FLOOR_TILE_ASSETS.map((tile) => tile.key),
    );

    this.scene.start("MainMenuScene");
  }

  /** Scales a loaded pixel-art image to fit the standard 28x28 icon size (contain, centered) and bakes it into the `weapon-icon-<id>` texture — keeps real art interchangeable with the procedural icons for every consumer (pickup, hand, HUD). */
  private bakeArtIcon(key: string, sourceKey: string, size = 28): void {
    const source = this.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
    const scale = Math.min(size / source.width, size / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    const canvasTexture = this.textures.createCanvas(key, size, size);
    if (!canvasTexture) return;
    const ctx = canvasTexture.context;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, (size - dw) / 2, (size - dh) / 2, dw, dh);
    canvasTexture.refresh();
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

  /** A thin sliver/lens shape — hit-impact fragments (Fx.hitSpark), rotated per-particle to point along its flight direction so hits read as debris, not a recolored dot. */
  private createShardTexture(key: string): void {
    const w = 10;
    const h = 4;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(0, h / 2, w * 0.4, 0, w * 0.4, h);
    g.fillTriangle(w * 0.4, 0, w, h / 2, w * 0.4, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  /** A 4-point star/cross — muzzle flashes (Fx.muzzleFlash), reads as a bright "bang" rather than a soft dot. */
  private createFlashTexture(key: string): void {
    const size = 16;
    const c = size / 2;
    const armHalf = 2;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(c, 0, c - armHalf, c, c + armHalf, c);
    g.fillTriangle(c, size, c - armHalf, c, c + armHalf, c);
    g.fillTriangle(0, c, c, c - armHalf, c, c + armHalf);
    g.fillTriangle(size, c, c, c - armHalf, c, c + armHalf);
    g.fillCircle(c, c, 2.5);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Draws a small distinct icon per weapon (ground pickup sprite, HUD) — shape + accent color, no real art. */
  private createWeaponIcon(key: string, shape: WeaponIconShape, color: number): void {
    const size = 28;
    const cx = size / 2;
    const cy = size / 2;
    const g = this.make.graphics({ x: 0, y: 0 });

    switch (shape) {
      case "gun":
        g.fillStyle(0x2a2a35, 1);
        g.fillRect(4, cy - 4, 20, 8);
        g.fillStyle(color, 1);
        g.fillRect(4, cy - 3, 15, 6);
        g.fillRect(6, cy + 4, 6, 8);
        break;
      case "beam":
        g.fillStyle(0x2a2a35, 1);
        g.fillRect(3, cy - 4, 22, 8);
        g.fillStyle(color, 1);
        g.fillRect(3, cy - 1.5, 22, 3);
        break;
      case "boomerang":
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 10, cy + 9, cx - 2, cy - 9, cx + 2, cy - 5);
        g.fillTriangle(cx + 10, cy + 9, cx + 2, cy - 9, cx - 2, cy - 5);
        break;
      case "bomb":
        g.fillStyle(0x1c1c26, 1);
        g.fillCircle(cx, cy + 3, 10);
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy + 3, 8);
        g.lineStyle(2, 0xffe08a, 1);
        g.lineBetween(cx + 4, cy - 4, cx + 9, cy - 10);
        break;
      case "flask":
        g.fillStyle(color, 0.9);
        g.fillTriangle(cx - 8, cy + 11, cx + 8, cy + 11, cx, cy - 7);
        g.fillStyle(0xffffff, 0.5);
        g.fillRect(cx - 3, cy - 12, 6, 5);
        break;
      case "staff":
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(cx - 2, cy - 2, 4, 16);
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy - 9, 6);
        break;
      case "blade":
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(cx - 2, cy + 4, 4, 10);
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 4, cy + 4, cx + 4, cy + 4, cx, cy - 12);
        break;
      case "hammer":
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(cx - 2, cy - 2, 4, 14);
        g.fillStyle(color, 1);
        g.fillRect(cx - 9, cy - 12, 18, 10);
        break;
    }

    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Draws a small distinct icon per upgrade (upgrade cards, detail panel) — shape + accent color, no real art, same convention as createWeaponIcon but a size up since it's the card's focal point. */
  private createUpgradeIcon(key: string, shape: UpgradeIconShape, color: number): void {
    const size = 32;
    const cx = size / 2;
    const cy = size / 2;
    const g = this.make.graphics({ x: 0, y: 0 });

    switch (shape) {
      case "heart":
        g.fillStyle(color, 1);
        g.fillCircle(cx - 5, cy - 4, 6);
        g.fillCircle(cx + 5, cy - 4, 6);
        g.fillTriangle(cx - 10, cy - 2, cx + 10, cy - 2, cx, cy + 11);
        break;
      case "shield":
        g.fillStyle(0x2a2a35, 1);
        g.fillPoints(
          [
            { x: cx, y: cy - 13 },
            { x: cx + 10, y: cy - 8 },
            { x: cx + 10, y: cy + 4 },
            { x: cx, y: cy + 14 },
            { x: cx - 10, y: cy + 4 },
            { x: cx - 10, y: cy - 8 },
          ],
          true,
        );
        g.fillStyle(color, 1);
        g.fillPoints(
          [
            { x: cx, y: cy - 10 },
            { x: cx + 7, y: cy - 6 },
            { x: cx + 7, y: cy + 3 },
            { x: cx, y: cy + 11 },
            { x: cx - 7, y: cy + 3 },
            { x: cx - 7, y: cy - 6 },
          ],
          true,
        );
        break;
      case "droplet":
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 6, cy + 2, cx + 6, cy + 2, cx, cy - 12);
        g.fillCircle(cx, cy + 3, 7);
        break;
      case "boltOrb":
        g.fillStyle(0x1c2a4a, 1);
        g.fillCircle(cx, cy, 12);
        g.fillStyle(color, 0.85);
        g.fillCircle(cx, cy, 10);
        g.fillStyle(0xffe98a, 1);
        g.fillPoints(
          [
            { x: cx + 2, y: cy - 9 },
            { x: cx - 4, y: cy + 1 },
            { x: cx - 1, y: cy + 1 },
            { x: cx - 3, y: cy + 9 },
            { x: cx + 5, y: cy - 1 },
            { x: cx + 1, y: cy - 1 },
          ],
          true,
        );
        break;
      case "target":
        g.lineStyle(3, color, 1);
        g.strokeCircle(cx, cy, 11);
        g.lineStyle(2, color, 1);
        g.strokeCircle(cx, cy, 6);
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy, 2);
        break;
      case "clock":
        g.fillStyle(0x2a2a35, 1);
        g.fillCircle(cx, cy, 12);
        g.lineStyle(2, color, 1);
        g.strokeCircle(cx, cy, 12);
        g.lineBetween(cx, cy, cx, cy - 7);
        g.lineBetween(cx, cy, cx + 5, cy + 3);
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy, 1.5);
        break;
      case "spiral": {
        g.lineStyle(3, color, 1);
        g.beginPath();
        g.arc(cx, cy, 9, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(230), false);
        g.strokePath();
        const endAngle = Phaser.Math.DegToRad(230);
        const ex = cx + 9 * Math.cos(endAngle);
        const ey = cy + 9 * Math.sin(endAngle);
        g.fillStyle(color, 1);
        g.save();
        g.translateCanvas(ex, ey);
        g.rotateCanvas(endAngle);
        g.fillTriangle(-4, -3, 4, 0, -4, 3);
        g.restore();
        break;
      }
      case "pierceArrow":
        g.fillStyle(0x4a4a58, 1);
        g.fillCircle(cx - 7, cy, 4);
        g.fillCircle(cx + 2, cy, 4);
        g.fillCircle(cx + 9, cy, 3);
        g.lineStyle(3, color, 1);
        g.lineBetween(cx - 13, cy, cx + 11, cy);
        g.fillStyle(color, 1);
        g.fillTriangle(cx + 8, cy - 4, cx + 8, cy + 4, cx + 15, cy);
        break;
      case "burst":
        g.fillStyle(0x2a2a35, 1);
        g.fillRect(cx - 12, cy - 3, 8, 6);
        g.fillStyle(color, 1);
        for (const [dx, dy] of [
          [6, -8],
          [10, -3],
          [11, 2],
          [8, 7],
          [4, 10],
        ]) {
          g.fillCircle(cx + dx, cy + dy, 2.2);
        }
        break;
      case "flame":
        g.fillStyle(0xb91c1c, 1);
        g.fillTriangle(cx, cy - 13, cx - 7, cy + 11, cx + 7, cy + 11);
        g.fillStyle(color, 1);
        g.fillTriangle(cx, cy - 7, cx - 4, cy + 10, cx + 4, cy + 10);
        g.fillStyle(0xffe08a, 1);
        g.fillTriangle(cx, cy - 1, cx - 2, cy + 9, cx + 2, cy + 9);
        break;
      case "splitBullets":
        g.fillStyle(0x2a2a35, 1);
        g.fillRect(cx - 3, cy + 3, 7, 6);
        g.fillStyle(color, 1);
        for (const deg of [-18, 18]) {
          g.save();
          g.translateCanvas(cx, cy + 3);
          g.rotateCanvas(Phaser.Math.DegToRad(deg));
          g.fillTriangle(-3, 0, 3, 0, 0, -15);
          g.restore();
        }
        break;
      case "skull":
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy - 2, 9);
        g.fillRect(cx - 6, cy + 3, 12, 6);
        g.fillStyle(0x1c1c26, 1);
        g.fillCircle(cx - 4, cy - 3, 2.2);
        g.fillCircle(cx + 4, cy - 3, 2.2);
        g.fillRect(cx - 5, cy + 5, 2, 3);
        g.fillRect(cx - 1, cy + 5, 2, 3);
        g.fillRect(cx + 3, cy + 5, 2, 3);
        break;
      case "gleamBlade":
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(cx - 2, cy + 5, 4, 9);
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 5, cy + 5, cx + 5, cy + 5, cx, cy - 13);
        g.lineStyle(1, 0xffffff, 0.75);
        g.lineBetween(cx - 6, cy - 2, cx + 7, cy - 6);
        break;
      case "wideBlade":
        g.lineStyle(1, color, 0.35);
        g.beginPath();
        g.arc(cx, cy + 1, 14, Phaser.Math.DegToRad(-75), Phaser.Math.DegToRad(75));
        g.strokePath();
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(cx - 2, cy + 4, 4, 10);
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 7, cy + 4, cx + 7, cy + 4, cx, cy - 11);
        break;
      case "battery":
        g.fillStyle(0x2a2a35, 1);
        g.fillRect(cx - 9, cy - 7, 18, 14);
        g.fillRect(cx + 9, cy - 3, 3, 6);
        g.fillStyle(color, 1);
        g.fillRect(cx - 7, cy - 5, 13, 10);
        break;
      case "orb":
        g.fillStyle(0x1c2a4a, 1);
        g.fillCircle(cx, cy, 11);
        g.fillStyle(color, 0.9);
        g.fillCircle(cx, cy, 9);
        g.fillStyle(0xffffff, 0.55);
        g.fillCircle(cx - 3, cy - 3, 3);
        break;
      case "hourglass":
        g.fillStyle(0x2a2a35, 1);
        g.fillRect(cx - 8, cy - 12, 16, 3);
        g.fillRect(cx - 8, cy + 9, 16, 3);
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 7, cy - 9, cx + 7, cy - 9, cx, cy);
        g.fillTriangle(cx - 7, cy + 9, cx + 7, cy + 9, cx, cy);
        break;
      case "tag":
        g.fillStyle(color, 1);
        g.fillPoints(
          [
            { x: cx - 10, y: cy - 2 },
            { x: cx - 1, y: cy - 11 },
            { x: cx + 11, y: cy - 11 },
            { x: cx + 11, y: cy + 1 },
            { x: cx - 1, y: cy + 10 },
          ],
          true,
        );
        g.fillStyle(0x1c1c26, 1);
        g.fillCircle(cx + 6, cy - 7, 2);
        break;
      case "bladeShield":
        g.fillStyle(0x2a3a42, 0.9);
        g.fillPoints(
          [
            { x: cx + 3, y: cy - 11 },
            { x: cx + 11, y: cy - 7 },
            { x: cx + 11, y: cy + 3 },
            { x: cx + 3, y: cy + 12 },
            { x: cx - 5, y: cy + 3 },
            { x: cx - 5, y: cy - 7 },
          ],
          true,
        );
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(cx - 9, cy + 3, 4, 9);
        g.fillStyle(color, 1);
        g.fillTriangle(cx - 12, cy + 3, cx - 2, cy + 3, cx - 7, cy - 11);
        g.lineStyle(1, 0xffffff, 0.5);
        g.lineBetween(cx - 10, cy - 2, cx - 4, cy - 6);
        break;
    }

    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Dark tile with a row of pale spike triangles — walkable hazard, distinct from solid obstacles. */
  private createSpikeTrapTexture(key: string): void {
    const size = 28;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x2a2a35, 1);
    g.fillRect(0, 0, size, size);
    g.fillStyle(0xd1d5db, 1);
    for (let i = 0; i < 3; i++) {
      const cx = 5 + i * 8;
      g.fillTriangle(cx, size - 4, cx + 6, size - 4, cx + 3, 4);
    }
    g.lineStyle(1, 0x000000, 0.4);
    g.strokeRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** A crate with a diagonal cross accent — used for TNT (red) and poison barrels (green). */
  private createCrateTexture(key: string, color: number, accent: number): void {
    const size = 28;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, size, size);
    g.lineStyle(2, accent, 1);
    g.strokeRect(3, 3, size - 6, size - 6);
    g.lineBetween(4, 4, size - 4, size - 4);
    g.lineBetween(size - 4, 4, 4, size - 4);
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
