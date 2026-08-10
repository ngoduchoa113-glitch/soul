import Phaser from "phaser";
import { generateStageLayout, type RoomLayout, type StageEdge, type StageKind } from "./DungeonLayout";
import { Room, type EnemyCallbacks, type Direction } from "./Room";
import { Door, GAP_INDICES } from "./Door";
import type { Chest } from "../entities/Chest";
import type { ShopStand } from "../entities/ShopStand";
import type { Portal } from "../entities/Portal";
import type { EntityVfx } from "../entities/Boss";

const TILE = 32;

function directionBetween(from: RoomLayout, to: RoomLayout): Direction {
  if (to.col > from.col) return "east";
  if (to.col < from.col) return "west";
  if (to.row > from.row) return "south";
  return "north";
}

export class Dungeon {
  readonly rooms: Room[];
  readonly collidables: Phaser.Physics.Arcade.StaticGroup;
  readonly enemies: Phaser.Physics.Arcade.Group;
  readonly worldWidth: number;
  readonly worldHeight: number;

  constructor(
    scene: Phaser.Scene,
    seed: string,
    kind: StageKind,
    enemyCallbacks: EnemyCallbacks,
    onBossCleared: () => void,
    vfx?: EntityVfx,
  ) {
    const layout = generateStageLayout(seed, kind);

    this.collidables = scene.physics.add.staticGroup();
    this.enemies = scene.physics.add.group({ runChildUpdate: false });

    this.worldWidth = Math.max(...layout.rooms.map((r) => r.rect.x + r.rect.width));
    this.worldHeight = Math.max(...layout.rooms.map((r) => r.rect.y + r.rect.height));

    const openSidesByIndex = new Map<number, Set<Direction>>();
    for (const room of layout.rooms) openSidesByIndex.set(room.index, new Set());
    for (const edge of layout.edges) {
      const a = layout.rooms[edge.a];
      const b = layout.rooms[edge.b];
      openSidesByIndex.get(a.index)!.add(directionBetween(a, b));
      openSidesByIndex.get(b.index)!.add(directionBetween(b, a));
    }

    this.rooms = layout.rooms.map(
      (roomLayout) =>
        new Room(
          scene,
          roomLayout,
          this.collidables,
          this.enemies,
          openSidesByIndex.get(roomLayout.index)!,
          enemyCallbacks,
          onBossCleared,
          vfx,
        ),
    );

    const doorsByIndex = new Map<number, Partial<Record<Direction, Door>>>();
    for (const room of layout.rooms) doorsByIndex.set(room.index, {});
    for (const edge of layout.edges) {
      this.createConnection(scene, edge, layout.rooms, doorsByIndex);
    }

    for (const room of layout.rooms) {
      this.rooms[room.index].setDoors(doorsByIndex.get(room.index) ?? {});
    }
  }

  /**
   * Builds the corridor strip between two connected rooms (floor + flanking
   * walls, same "floor"/"wall" textures Room.ts uses) and places the shared
   * Door at the corridor's midpoint instead of directly on a room wall.
   */
  private createConnection(
    scene: Phaser.Scene,
    edge: StageEdge,
    rooms: RoomLayout[],
    doorsByIndex: Map<number, Partial<Record<Direction, Door>>>,
  ): void {
    const a = rooms[edge.a];
    const b = rooms[edge.b];
    const gapStart = GAP_INDICES[0] * TILE;
    const gapEnd = (GAP_INDICES[GAP_INDICES.length - 1] + 1) * TILE;

    if (edge.axis === "h") {
      const east = a.col > b.col ? a : b;
      const west = east === a ? b : a;
      const x0 = west.rect.x + west.rect.width;
      const x1 = east.rect.x;
      const originY = east.rect.y;
      const y0 = originY + gapStart;
      const y1 = originY + gapEnd;

      this.buildCorridorFloor(scene, x0, y0, x1 - x0, y1 - y0);
      for (let c = 0; c < (x1 - x0) / TILE; c++) {
        const cx = x0 + c * TILE + TILE / 2;
        this.collidables.create(cx, y0 - TILE / 2, "wall");
        this.collidables.create(cx, y1 + TILE / 2, "wall");
      }

      const door = new Door(this.collidables, (x0 + x1) / 2, "h", originY);
      doorsByIndex.get(west.index)!.east = door;
      doorsByIndex.get(east.index)!.west = door;
    } else {
      const south = a.row > b.row ? a : b;
      const north = south === a ? b : a;
      const y0 = north.rect.y + north.rect.height;
      const y1 = south.rect.y;
      const originX = south.rect.x;
      const x0 = originX + gapStart;
      const x1 = originX + gapEnd;

      this.buildCorridorFloor(scene, x0, y0, x1 - x0, y1 - y0);
      for (let r = 0; r < (y1 - y0) / TILE; r++) {
        const cy = y0 + r * TILE + TILE / 2;
        this.collidables.create(x0 - TILE / 2, cy, "wall");
        this.collidables.create(x1 + TILE / 2, cy, "wall");
      }

      const door = new Door(this.collidables, (y0 + y1) / 2, "v", originX);
      doorsByIndex.get(north.index)!.south = door;
      doorsByIndex.get(south.index)!.north = door;
    }
  }

  private buildCorridorFloor(scene: Phaser.Scene, x: number, y: number, width: number, height: number): void {
    scene.add.tileSprite(x, y, width, height, "floor").setOrigin(0, 0).setDepth(0);
  }

  getSpawnPoint(): { x: number; y: number } {
    return { x: this.rooms[0].centerX, y: this.rooms[0].centerY };
  }

  getNearestChest(x: number, y: number): Chest | undefined {
    let nearest: Chest | undefined;
    let nearestDist = Infinity;

    for (const room of this.rooms) {
      const chest = room.getChest();
      if (!chest || chest.opened) continue;
      const dist = Phaser.Math.Distance.Between(x, y, chest.x, chest.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = chest;
      }
    }

    return nearest;
  }

  getNearestShopStand(x: number, y: number): ShopStand | undefined {
    let nearest: ShopStand | undefined;
    let nearestDist = Infinity;

    for (const room of this.rooms) {
      const stand = room.getShopStand();
      if (!stand) continue;
      const dist = Phaser.Math.Distance.Between(x, y, stand.x, stand.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = stand;
      }
    }

    return nearest;
  }

  getNearestPortal(x: number, y: number): Portal | undefined {
    let nearest: Portal | undefined;
    let nearestDist = Infinity;

    for (const room of this.rooms) {
      const portal = room.getPortal();
      if (!portal) continue;
      const dist = Phaser.Math.Distance.Between(x, y, portal.x, portal.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = portal;
      }
    }

    return nearest;
  }

  update(player: Phaser.Physics.Arcade.Sprite): void {
    for (const room of this.rooms) {
      room.update(player);
    }
  }
}
