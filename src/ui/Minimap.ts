import Phaser from "phaser";
import type { Dungeon } from "../dungeon/Dungeon";

// A bit bigger than it needed to be pre-zoom — zooming the world in means less of the dungeon is
// visible at once, so the minimap carries more of the "where am I" load and reads better larger.
const PANEL_W = 200;
const PANEL_H = 116;
const MARGIN = 12;

const STATE_COLORS: Record<string, number> = {
  LOCKED: 0x2a2a36,
  ACTIVE: 0xf6e05e,
  CLEARING: 0xf6e05e,
  CLEARED: 0x4ade80,
};

const CORRIDOR_COLOR = 0x9ca3af;
const SHOP_COLOR = 0x3b82f6;
const GATE_COLOR = 0xa855f7;

/**
 * `container` is GameScene's screen-fixed UI layer (see Hud's constructor doc) — repositioned/
 * rescaled every frame to counteract the zoomed world camera, so this stays glued to the top-right
 * corner at a constant size regardless of camera scroll/zoom.
 */
export class Minimap {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(50);
    container.add(this.graphics);
  }

  update(dungeon: Dungeon, player: { x: number; y: number }): void {
    const rooms = dungeon.rooms;
    this.graphics.clear();
    if (rooms.length === 0) return;

    // Fit the whole layout (not just the last-added room) so nothing runs off the panel,
    // and scale both axes independently of each other so a tall layout can't overflow PANEL_H.
    const scale = Math.min(PANEL_W / dungeon.worldWidth, PANEL_H / dungeon.worldHeight);
    const originX = this.scene.scale.width - PANEL_W - MARGIN;
    const originY = MARGIN;

    const pad = 4;
    this.graphics.fillStyle(0x0e0e14, 0.75);
    this.graphics.fillRect(originX - pad, originY - pad, PANEL_W + pad * 2, PANEL_H + pad * 2);
    this.graphics.lineStyle(1, 0x3a3a4a, 1);
    this.graphics.strokeRect(originX - pad, originY - pad, PANEL_W + pad * 2, PANEL_H + pad * 2);

    this.graphics.lineStyle(2, CORRIDOR_COLOR, 0.6);
    for (const edge of dungeon.edges) {
      const a = rooms[edge.a];
      const b = rooms[edge.b];
      this.graphics.lineBetween(
        originX + (a.rect.x + a.rect.width / 2) * scale,
        originY + (a.rect.y + a.rect.height / 2) * scale,
        originX + (b.rect.x + b.rect.width / 2) * scale,
        originY + (b.rect.y + b.rect.height / 2) * scale,
      );
    }

    for (const room of rooms) {
      const rx = originX + room.rect.x * scale;
      const ry = originY + room.rect.y * scale;
      const rw = Math.max(2, room.rect.width * scale - 1);
      const rh = Math.max(2, room.rect.height * scale);

      const color = STATE_COLORS[room.state] ?? 0x2a2a36;
      this.graphics.fillStyle(color, room.state === "LOCKED" ? 0.5 : 0.9);
      this.graphics.fillRect(rx, ry, rw, rh);

      if (room.type === "boss") {
        this.graphics.lineStyle(1.5, 0xef4444, 1);
        this.graphics.strokeRect(rx, ry, rw, rh);
      } else if (room.type === "shop") {
        this.graphics.lineStyle(1.5, SHOP_COLOR, 1);
        this.graphics.strokeRect(rx, ry, rw, rh);
        this.drawShopIcon(rx + rw / 2, ry + rh / 2);
      } else if (room.type === "gate") {
        this.graphics.lineStyle(1.5, GATE_COLOR, 1);
        this.graphics.strokeRect(rx, ry, rw, rh);
        this.drawGateIcon(rx + rw / 2, ry + rh / 2);
      }
    }

    const px = originX + player.x * scale;
    const py = originY + player.y * scale;
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(px, py, 3);
  }

  /** Small coin-like marker so a shop room reads at a glance, distinct from its blue outline. */
  private drawShopIcon(cx: number, cy: number): void {
    this.graphics.fillStyle(0xfbbf24, 1);
    this.graphics.fillCircle(cx, cy, 2.5);
    this.graphics.lineStyle(1, 0x78350f, 1);
    this.graphics.strokeCircle(cx, cy, 2.5);
  }

  /** Small diamond marker for the next-stage portal room, distinct from the shop's dot. */
  private drawGateIcon(cx: number, cy: number): void {
    const r = 3;
    this.graphics.fillStyle(GATE_COLOR, 1);
    this.graphics.fillPoints(
      [
        new Phaser.Math.Vector2(cx, cy - r),
        new Phaser.Math.Vector2(cx + r, cy),
        new Phaser.Math.Vector2(cx, cy + r),
        new Phaser.Math.Vector2(cx - r, cy),
      ],
      true,
    );
  }
}
