import Phaser from "phaser";

const TILE = 32;
export const GAP_INDICES = [7, 8, 9];

/**
 * Owns just the passable gap carved into the wall shared by two adjacent rooms —
 * the rest of that boundary wall is permanent and built once by the neighboring Rooms
 * (see Room.buildWalls, which leaves exactly these gap tiles unbuilt on an open side).
 */
export class Door {
  private tiles: Phaser.Physics.Arcade.Sprite[] = [];
  private locked = false;

  /**
   * axis "h": boundary is a shared vertical (X) line between an east/west pair —
   * gap tiles run along Y, starting at `origin` (the shared room row's world Y).
   * axis "v": boundary is a shared horizontal (Y) line between a north/south pair —
   * gap tiles run along X, starting at `origin` (the shared room column's world X).
   */
  constructor(group: Phaser.Physics.Arcade.StaticGroup, boundaryCoord: number, axis: "h" | "v", origin: number) {
    for (const i of GAP_INDICES) {
      const along = origin + i * TILE + TILE / 2;
      const x = axis === "h" ? boundaryCoord : along;
      const y = axis === "h" ? along : boundaryCoord;
      const tile = group.create(x, y, "door") as Phaser.Physics.Arcade.Sprite;
      this.tiles.push(tile);
    }
    // Doors start passable — per mục 17, a room only locks its doors once the
    // player has actually entered and it activates, not before.
    this.open();
  }

  close(): void {
    this.locked = true;
    for (const tile of this.tiles) {
      tile.setVisible(true);
      (tile.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    }
  }

  open(): void {
    this.locked = false;
    for (const tile of this.tiles) {
      tile.setVisible(false);
      (tile.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}
