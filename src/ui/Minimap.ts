import Phaser from "phaser";
import type { Room } from "../dungeon/Room";

const PANEL_W = 160;
const PANEL_H = 90;
const MARGIN = 12;

const STATE_COLORS: Record<string, number> = {
  LOCKED: 0x2a2a36,
  ACTIVE: 0xf6e05e,
  CLEARING: 0xf6e05e,
  CLEARED: 0x4ade80,
};

export class Minimap {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(50);
  }

  update(rooms: Room[], player: { x: number; y: number }): void {
    this.graphics.clear();
    if (rooms.length === 0) return;

    const last = rooms[rooms.length - 1];
    const totalWidth = last.rect.x + last.rect.width;
    const scale = PANEL_W / totalWidth;
    const originX = this.scene.scale.width - PANEL_W - MARGIN;
    const originY = MARGIN;

    this.graphics.fillStyle(0x000000, 0.5);
    this.graphics.fillRect(originX - 4, originY - 4, PANEL_W + 8, PANEL_H + 8);

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
        this.graphics.lineStyle(1.5, 0x3b82f6, 1);
        this.graphics.strokeRect(rx, ry, rw, rh);
      }
    }

    const px = originX + player.x * scale;
    const py = originY + player.y * scale;
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(px, py, 3);
  }
}
