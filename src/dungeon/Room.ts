import Phaser from "phaser";
import type { RoomState } from "../data/types";
import type { RoomLayout } from "./DungeonLayout";
import { Door, GAP_INDICES } from "./Door";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { Chest } from "../entities/Chest";
import { ShopStand } from "../entities/ShopStand";
import { Portal } from "../entities/Portal";
import { ENEMIES, scaleEnemyDef, type EnemyDef } from "../data/enemies";
import { BOSS_DEFS } from "../data/boss";
import type { Combatant } from "../entities/Combatant";
import type { EntityVfx } from "../entities/Boss";

const TILE = 32;

export type Direction = "north" | "south" | "east" | "west";

export interface EnemyCallbacks {
  onAttackPlayer: (damage: number) => void;
  onFireProjectile: (x: number, y: number, angle: number, damage: number, speed: number) => void;
  onBossPhaseChanged?: (phase: number) => void;
  onDeath?: (entity: Enemy | Boss) => void;
}

export class Room {
  readonly index: number;
  readonly type: RoomLayout["type"];
  readonly rect: RoomLayout["rect"];
  state: RoomState;

  private geomRect: Phaser.Geom.Rectangle;
  private doors: Partial<Record<Direction, Door>> = {};
  private chest?: Chest;
  private shopStand?: ShopStand;
  private portal?: Portal;

  private scene: Phaser.Scene;
  private enemiesGroup: Phaser.Physics.Arcade.Group;
  private enemyCallbacks: EnemyCallbacks;
  private onBossCleared: () => void;
  private vfx?: EntityVfx;

  constructor(
    scene: Phaser.Scene,
    layout: RoomLayout,
    wallsGroup: Phaser.Physics.Arcade.StaticGroup,
    enemiesGroup: Phaser.Physics.Arcade.Group,
    openSides: Set<Direction>,
    enemyCallbacks: EnemyCallbacks,
    onBossCleared: () => void,
    vfx?: EntityVfx,
  ) {
    this.scene = scene;
    this.enemiesGroup = enemiesGroup;
    this.enemyCallbacks = enemyCallbacks;
    this.onBossCleared = onBossCleared;
    this.vfx = vfx;

    this.index = layout.index;
    this.type = layout.type;
    this.rect = layout.rect;
    this.state = this.type === "shop" || this.type === "rest" || this.type === "trophy" ? "CLEARED" : "LOCKED";
    this.geomRect = new Phaser.Geom.Rectangle(this.rect.x, this.rect.y, this.rect.width, this.rect.height);

    this.buildFloor();
    this.buildWalls(wallsGroup, openSides);

    if (this.type === "shop") {
      this.shopStand = new ShopStand(scene, this.centerX, this.centerY);
    } else if (this.type === "trophy") {
      this.portal = new Portal(scene, this.centerX, this.centerY, "trophy");
    }
  }

  setDoors(doors: Partial<Record<Direction, Door>>): void {
    this.doors = doors;
    if (this.state === "CLEARED") {
      for (const door of Object.values(this.doors)) door?.open();
    }
  }

  get centerX(): number {
    return this.rect.x + this.rect.width / 2;
  }

  get centerY(): number {
    return this.rect.y + this.rect.height / 2;
  }

  getChest(): Chest | undefined {
    return this.chest;
  }

  getShopStand(): ShopStand | undefined {
    return this.shopStand;
  }

  getPortal(): Portal | undefined {
    return this.portal;
  }

  update(player: Phaser.Physics.Arcade.Sprite): void {
    if (this.state === "LOCKED") {
      if (Phaser.Geom.Rectangle.Contains(this.geomRect, player.x, player.y)) {
        this.activate();
      }
      return;
    }

    if (this.state === "ACTIVE") {
      const alive = this.enemiesGroup
        .getChildren()
        .some((child) => (child as unknown as Combatant).active && (child as unknown as Combatant).roomIndex === this.index);
      if (!alive) {
        this.clear();
      }
    }
  }

  private activate(): void {
    this.state = "ACTIVE";
    for (const door of Object.values(this.doors)) door?.close();
    this.spawnEnemies();
  }

  private clear(): void {
    this.state = "CLEARED";
    for (const door of Object.values(this.doors)) door?.open();

    if (this.type === "normal" || this.type === "elite") {
      this.chest = new Chest(this.scene, this.centerX, this.centerY, this.type === "elite" ? "elite" : "normal");
    } else if (this.type === "gate") {
      this.portal = new Portal(this.scene, this.centerX, this.centerY, "gate");
    } else if (this.type === "boss") {
      this.onBossCleared();
    }
  }

  private spawnEnemies(): void {
    if (this.type === "boss") {
      this.spawnBoss();
      return;
    }

    const isElite = this.type === "elite";
    const count = isElite ? 2 : Phaser.Math.RND.between(2, 3);
    const pool = Object.values(ENEMIES);

    for (let i = 0; i < count; i++) {
      const baseDef = Phaser.Math.RND.pick(pool);
      const def = isElite ? scaleEnemyDef(baseDef, 1.6, 1.3) : baseDef;
      const margin = 80;
      const x = Phaser.Math.RND.between(this.rect.x + margin, this.rect.x + this.rect.width - margin);
      const y = Phaser.Math.RND.between(this.rect.y + margin, this.rect.y + this.rect.height - margin);
      this.spawnEnemy(def, x, y);
    }
  }

  private spawnEnemy(def: EnemyDef, x: number, y: number, scale = 1): void {
    const enemy = new Enemy(this.scene, x, y, def, this.vfx);
    enemy.roomIndex = this.index;
    if (scale !== 1) enemy.setScale(scale);
    enemy.setCallbacks({
      onAttackPlayer: this.enemyCallbacks.onAttackPlayer,
      onFireProjectile: this.enemyCallbacks.onFireProjectile,
      onDeath: this.enemyCallbacks.onDeath,
    });
    this.enemiesGroup.add(enemy);
  }

  private spawnBoss(): void {
    const boss = new Boss(this.scene, this.centerX, this.centerY, BOSS_DEFS.guardian, this.vfx);
    boss.roomIndex = this.index;
    boss.setCallbacks({
      onAttackPlayer: this.enemyCallbacks.onAttackPlayer,
      onFireProjectile: this.enemyCallbacks.onFireProjectile,
      onPhaseChanged: this.enemyCallbacks.onBossPhaseChanged,
      onDeath: this.enemyCallbacks.onDeath,
      onSummon: (count) => {
        const pool = Object.values(ENEMIES);
        const margin = 80;
        for (let i = 0; i < count; i++) {
          const def = Phaser.Math.RND.pick(pool);
          const x = Phaser.Math.RND.between(this.rect.x + margin, this.rect.x + this.rect.width - margin);
          const y = Phaser.Math.RND.between(this.rect.y + margin, this.rect.y + this.rect.height - margin);
          this.spawnEnemy(def, x, y);
        }
      },
    });
    this.enemiesGroup.add(boss);
  }

  private buildFloor(): void {
    this.scene.add
      .tileSprite(this.rect.x, this.rect.y, this.rect.width, this.rect.height, "floor")
      .setOrigin(0, 0)
      .setDepth(0);
  }

  /**
   * Builds a full solid perimeter by default. On a side that's open to a
   * neighbor, the 3 gap-index tiles are skipped — the matching Door (built by
   * Dungeon at the same coordinates/GAP_INDICES) owns those tiles instead.
   */
  private buildWalls(group: Phaser.Physics.Arcade.StaticGroup, openSides: Set<Direction>): void {
    const cols = this.rect.width / TILE;
    const rows = this.rect.height / TILE;
    const gapSet = new Set(GAP_INDICES);

    for (let c = 0; c < cols; c++) {
      if (!(openSides.has("north") && gapSet.has(c))) {
        group.create(this.rect.x + c * TILE + TILE / 2, this.rect.y + TILE / 2, "wall");
      }
      if (!(openSides.has("south") && gapSet.has(c))) {
        group.create(this.rect.x + c * TILE + TILE / 2, this.rect.y + this.rect.height - TILE / 2, "wall");
      }
    }

    for (let r = 0; r < rows; r++) {
      if (!(openSides.has("west") && gapSet.has(r))) {
        group.create(this.rect.x + TILE / 2, this.rect.y + r * TILE + TILE / 2, "wall");
      }
      if (!(openSides.has("east") && gapSet.has(r))) {
        group.create(this.rect.x + this.rect.width - TILE / 2, this.rect.y + r * TILE + TILE / 2, "wall");
      }
    }
  }
}
