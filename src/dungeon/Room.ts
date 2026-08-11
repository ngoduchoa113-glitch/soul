import Phaser from "phaser";
import type { RoomState } from "../data/types";
import type { RoomLayout } from "./DungeonLayout";
import { Door, GAP_INDICES } from "./Door";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { Chest } from "../entities/Chest";
import { ShopStand } from "../entities/ShopStand";
import { Portal } from "../entities/Portal";
import { ENEMIES, SUMMONABLE_ENEMIES, scaleEnemyDef, type EnemyDef } from "../data/enemies";
import { pickRandomBossDef } from "../data/boss";
import { SpikeTrap } from "../entities/SpikeTrap";
import { ExplosiveCrate } from "../entities/ExplosiveCrate";
import { PoisonBarrel } from "../entities/PoisonBarrel";
import type { Combatant } from "../entities/Combatant";
import type { EntityVfx } from "../entities/Boss";
import { DECOR_ASSETS, OBSTACLE_CLUSTER_ASSETS, OBSTACLE_TREE_ASSETS, type ObstacleAsset } from "../data/decor";
import { WALL_KEYS } from "../scenes/tileTextures";
import { paintWallStrip, wallRuns } from "./wallVisuals";

const TILE = 32;

/** Obstacles keep this much clearance from the walls/doors and from the room center (chest/boss/shop spawn point). */
const OBSTACLE_WALL_MARGIN = 128;
const OBSTACLE_CENTER_CLEARANCE = 120;
const OBSTACLE_MIN_SPACING = 130;

/** Chance a scattered obstacle/decor pick anchors near one of the room's 4 corners instead of anywhere in the room — corners read as "deliberately placed clutter" rather than a uniform scatter. */
const CORNER_BIAS_CHANCE = 0.7;
/** How far a corner-anchored pick can drift from its corner, so a room's 4 corners don't all look like an identical stamp. */
const CORNER_JITTER = 70;

/**
 * Relative (grid-cell) offsets for small connected obstacle formations — a "pillar" roll places
 * one of these instead of a single floating tile, so rock/ruin obstacles read as deliberate
 * clusters rather than scattered dots. Cells are TILE apart so same-variant sprites sit flush.
 */
const CLUSTER_SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0]],
];

/**
 * Weighted roll for what a random obstacle slot in a normal/elite room becomes. Plain blocking
 * pillars stay the majority so hazards read as an occasional surprise, not a minefield.
 * Cumulative upper bounds: [0, 0.6) pillar, [0.6, 0.75) spike trap, [0.75, 0.88) TNT, [0.88, 1) poison.
 */
const PILLAR_ROLL_MAX = 0.6;
const SPIKE_TRAP_ROLL_MAX = 0.75;
const TNT_ROLL_MAX = 0.88;
/** Of the pillar rolls, how many become a single large tree instead of a rock/ruin cluster. */
const TREE_ROLL_CHANCE = 0.4;

/** Symmetric, deterministic pillar layout for boss rooms — same every time, unlike regular rooms' random scatter. */
const BOSS_OBSTACLE_OFFSETS = [
  { dx: -160, dy: -100 },
  { dx: 160, dy: -100 },
  { dx: -160, dy: 100 },
  { dx: 160, dy: 100 },
];

export type Direction = "north" | "south" | "east" | "west";

export interface EnemyCallbacks {
  onAttackPlayer: (damage: number) => void;
  /** Boss's simple projectile fan/ring attacks. */
  onFireProjectile: (x: number, y: number, angle: number, damage: number, speed: number) => void;
  /** Enemy ranged/turret — carries the full def so GameScene can pick the right bullet shape (pierce/bounce/homing/multi/element). */
  onFireProjectilePattern?: (x: number, y: number, angle: number, def: EnemyDef) => void;
  onCastZone?: (x: number, y: number, def: EnemyDef) => void;
  onHealAlly?: (healer: Enemy, radius: number, amount: number) => void;
  onBuffAllies?: (buffer: Enemy, def: EnemyDef) => void;
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
  private hazardsGroup: Phaser.Physics.Arcade.StaticGroup;
  private destructiblesGroup: Phaser.Physics.Arcade.StaticGroup;
  private enemyCallbacks: EnemyCallbacks;
  private onBossCleared: () => void;
  private vfx?: EntityVfx;

  constructor(
    scene: Phaser.Scene,
    layout: RoomLayout,
    wallsGroup: Phaser.Physics.Arcade.StaticGroup,
    enemiesGroup: Phaser.Physics.Arcade.Group,
    hazardsGroup: Phaser.Physics.Arcade.StaticGroup,
    destructiblesGroup: Phaser.Physics.Arcade.StaticGroup,
    openSides: Set<Direction>,
    enemyCallbacks: EnemyCallbacks,
    onBossCleared: () => void,
    vfx?: EntityVfx,
  ) {
    this.scene = scene;
    this.enemiesGroup = enemiesGroup;
    this.hazardsGroup = hazardsGroup;
    this.destructiblesGroup = destructiblesGroup;
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
    this.buildObstacles(wallsGroup);
    this.scatterDecor();

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
        .some((child) => (child as unknown as Combatant).alive && (child as unknown as Combatant).roomIndex === this.index);
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
    const count = isElite ? Phaser.Math.RND.between(3, 4) : Phaser.Math.RND.between(4, 6);
    const pool = Object.values(ENEMIES);

    for (let i = 0; i < count; i++) {
      const baseDef = Phaser.Math.RND.pick(pool);
      const def = isElite ? scaleEnemyDef(baseDef, 1.6, 1.3) : baseDef;
      const margin = 80;
      const x = Phaser.Math.RND.between(this.rect.x + margin, this.rect.x + this.rect.width - margin);
      const y = Phaser.Math.RND.between(this.rect.y + margin, this.rect.y + this.rect.height - margin);
      this.spawnEnemy(def, x, y, 1, isElite);
    }
  }

  private spawnEnemy(def: EnemyDef, x: number, y: number, scale = 1, isElite = false): void {
    const enemy = new Enemy(this.scene, x, y, def, this.vfx, isElite);
    enemy.roomIndex = this.index;
    if (scale !== 1) enemy.setScale(scale);
    enemy.setCallbacks({
      onAttackPlayer: this.enemyCallbacks.onAttackPlayer,
      onFireProjectilePattern: this.enemyCallbacks.onFireProjectilePattern,
      onCastZone: this.enemyCallbacks.onCastZone,
      onSummon: (x, y, count, radius) => this.spawnReinforcementsNear(x, y, count, radius),
      onHealAlly: this.enemyCallbacks.onHealAlly,
      onBuffAllies: this.enemyCallbacks.onBuffAllies,
      onDeath: this.enemyCallbacks.onDeath,
    });
    this.enemiesGroup.add(enemy);
  }

  /** Spawns `count` non-summoner enemies at random points in the room — Boss's "summon" pattern. */
  private spawnReinforcementsInRoom(count: number): void {
    const margin = 80;
    for (let i = 0; i < count; i++) {
      const def = Phaser.Math.RND.pick(SUMMONABLE_ENEMIES);
      const x = Phaser.Math.RND.between(this.rect.x + margin, this.rect.x + this.rect.width - margin);
      const y = Phaser.Math.RND.between(this.rect.y + margin, this.rect.y + this.rect.height - margin);
      this.spawnEnemy(def, x, y);
    }
  }

  /** Spawns `count` non-summoner enemies clustered near (x, y) — an Enemy Summoner's own summon pulse. */
  private spawnReinforcementsNear(x: number, y: number, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const def = Phaser.Math.RND.pick(SUMMONABLE_ENEMIES);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(radius * 0.4, radius);
      const sx = Phaser.Math.Clamp(x + Math.cos(angle) * dist, this.rect.x + 40, this.rect.x + this.rect.width - 40);
      const sy = Phaser.Math.Clamp(y + Math.sin(angle) * dist, this.rect.y + 40, this.rect.y + this.rect.height - 40);
      this.spawnEnemy(def, sx, sy);
    }
  }

  private spawnBoss(): void {
    const boss = new Boss(this.scene, this.centerX, this.centerY, pickRandomBossDef(), this.vfx);
    boss.roomIndex = this.index;
    boss.setCallbacks({
      onAttackPlayer: this.enemyCallbacks.onAttackPlayer,
      onFireProjectile: this.enemyCallbacks.onFireProjectile,
      onPhaseChanged: this.enemyCallbacks.onBossPhaseChanged,
      onDeath: this.enemyCallbacks.onDeath,
      onSummon: (count) => this.spawnReinforcementsInRoom(count),
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
   *
   * Each cell's collision sprite is invisible (the procedural wall texture stays only as the
   * physics body's shape) — the visible wall is the direction-matched aligned art (wall_top for
   * north, wall_bottom for south, wall_left for west, wall_right for east) painted as one
   * continuous strip per run by paintWallStrip, split around any door gap by wallRuns.
   */
  private buildWalls(group: Phaser.Physics.Arcade.StaticGroup, openSides: Set<Direction>): void {
    const cols = this.rect.width / TILE;
    const rows = this.rect.height / TILE;
    const gapSet = new Set(GAP_INDICES);

    for (let c = 0; c < cols; c++) {
      if (!(openSides.has("north") && gapSet.has(c))) {
        const x = this.rect.x + c * TILE + TILE / 2;
        const y = this.rect.y + TILE / 2;
        group.create(x, y, Phaser.Math.RND.pick(WALL_KEYS)).setVisible(false);
      }
      if (!(openSides.has("south") && gapSet.has(c))) {
        const x = this.rect.x + c * TILE + TILE / 2;
        const y = this.rect.y + this.rect.height - TILE / 2;
        group.create(x, y, Phaser.Math.RND.pick(WALL_KEYS)).setVisible(false);
      }
    }

    for (let r = 0; r < rows; r++) {
      if (!(openSides.has("west") && gapSet.has(r))) {
        const x = this.rect.x + TILE / 2;
        const y = this.rect.y + r * TILE + TILE / 2;
        group.create(x, y, Phaser.Math.RND.pick(WALL_KEYS)).setVisible(false);
      }
      if (!(openSides.has("east") && gapSet.has(r))) {
        const x = this.rect.x + this.rect.width - TILE / 2;
        const y = this.rect.y + r * TILE + TILE / 2;
        group.create(x, y, Phaser.Math.RND.pick(WALL_KEYS)).setVisible(false);
      }
    }

    for (const [start, end] of wallRuns(cols, openSides.has("north"))) {
      paintWallStrip(this.scene, "north", this.rect.x + start * TILE, (end - start) * TILE, this.rect.y + TILE);
    }
    for (const [start, end] of wallRuns(cols, openSides.has("south"))) {
      paintWallStrip(this.scene, "south", this.rect.x + start * TILE, (end - start) * TILE, this.rect.y + this.rect.height - TILE);
    }
    for (const [start, end] of wallRuns(rows, openSides.has("west"))) {
      paintWallStrip(this.scene, "west", this.rect.y + start * TILE, (end - start) * TILE, this.rect.x + TILE);
    }
    for (const [start, end] of wallRuns(rows, openSides.has("east"))) {
      paintWallStrip(this.scene, "east", this.rect.y + start * TILE, (end - start) * TILE, this.rect.x + this.rect.width - TILE);
    }
  }

  /**
   * Boss rooms get a fixed, symmetric pillar layout (same every run). Regular
   * combat rooms get a few randomly scattered obstacles; safe rooms (rest/shop/
   * trophy/gate) stay clear so the player can always navigate them freely.
   */
  private buildObstacles(group: Phaser.Physics.Arcade.StaticGroup): void {
    if (this.type === "boss") {
      for (const offset of BOSS_OBSTACLE_OFFSETS) {
        this.placeObstacleCell(this.centerX + offset.dx, this.centerY + offset.dy, group, OBSTACLE_CLUSTER_ASSETS[0]);
      }
      return;
    }

    if (this.type !== "normal" && this.type !== "elite") return;

    const count = this.type === "elite" ? 4 : Phaser.Math.RND.between(3, 5);
    const placed: { x: number; y: number }[] = [];
    let guard = 0;
    while (placed.length < count && guard < count * 20) {
      guard++;
      const { x, y } = this.randomCornerBiasedPoint(OBSTACLE_WALL_MARGIN);
      if (Phaser.Math.Distance.Between(x, y, this.centerX, this.centerY) < OBSTACLE_CENTER_CLEARANCE) continue;
      if (placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < OBSTACLE_MIN_SPACING)) continue;

      placed.push({ x, y });
      this.placeObstacle(x, y, group);
    }
  }

  private placeObstacle(x: number, y: number, group: Phaser.Physics.Arcade.StaticGroup): void {
    const roll = Math.random();
    if (roll < PILLAR_ROLL_MAX) {
      if (Math.random() < TREE_ROLL_CHANCE) {
        this.placeTreeObstacle(x, y, group);
      } else {
        this.placeObstacleCluster(x, y, group);
      }
    } else if (roll < SPIKE_TRAP_ROLL_MAX) {
      this.hazardsGroup.add(new SpikeTrap(this.scene, x, y));
    } else if (roll < TNT_ROLL_MAX) {
      this.destructiblesGroup.add(new ExplosiveCrate(this.scene, x, y));
    } else {
      this.destructiblesGroup.add(new PoisonBarrel(this.scene, x, y));
    }
  }

  /**
   * Places one of CLUSTER_SHAPES anchored at (x, y), all cells sharing the same rock/ruin
   * variant — a few tiles sitting flush read as a single connected formation instead of a lone
   * floating pillar. Cells are clamped away from the wall ring so a cluster can never poke into
   * (or past) it.
   */
  private placeObstacleCluster(x: number, y: number, group: Phaser.Physics.Arcade.StaticGroup): void {
    const asset = Phaser.Math.RND.pick(OBSTACLE_CLUSTER_ASSETS);
    const shape = Phaser.Math.RND.pick(CLUSTER_SHAPES);

    for (const [dx, dy] of shape) {
      const { x: cx, y: cy } = this.clampToRoom(x + dx * TILE, y + dy * TILE, asset.width / 2, asset.height / 2);
      this.placeObstacleCell(cx, cy, group, asset);
    }
  }

  /** Places a single large tree — noticeably bigger than a rock/ruin cell (2x2 or ~1x2 tiles), so rooms read as more varied. */
  private placeTreeObstacle(x: number, y: number, group: Phaser.Physics.Arcade.StaticGroup): void {
    const asset = Phaser.Math.RND.pick(OBSTACLE_TREE_ASSETS);
    const { x: cx, y: cy } = this.clampToRoom(x, y, asset.width / 2, asset.height / 2);
    this.placeObstacleCell(cx, cy, group, asset);
  }

  /** Clamps a point so a footprint of the given half-width/half-height never overlaps the room's wall ring. */
  private clampToRoom(x: number, y: number, halfWidth: number, halfHeight: number): { x: number; y: number } {
    const minX = this.rect.x + TILE + halfWidth;
    const maxX = this.rect.x + this.rect.width - TILE - halfWidth;
    const minY = this.rect.y + TILE + halfHeight;
    const maxY = this.rect.y + this.rect.height - TILE - halfHeight;
    return { x: Phaser.Math.Clamp(x, minX, maxX), y: Phaser.Math.Clamp(y, minY, maxY) };
  }

  /**
   * Rolls a point for scattered obstacle/decor placement, `margin` clear of every wall. Most rolls
   * (CORNER_BIAS_CHANCE) anchor near one of the room's 4 corners with some jitter so clutter reads
   * as deliberately piled into corners — matching how these props collect in a real room — instead
   * of an even scatter; the rest fall back to a uniform pick for variety in the middle of the room.
   */
  private randomCornerBiasedPoint(margin: number): { x: number; y: number } {
    const minX = this.rect.x + margin;
    const maxX = this.rect.x + this.rect.width - margin;
    const minY = this.rect.y + margin;
    const maxY = this.rect.y + this.rect.height - margin;

    if (Phaser.Math.RND.frac() < CORNER_BIAS_CHANCE) {
      const corner = Phaser.Math.RND.pick([
        { cx: minX, cy: minY },
        { cx: maxX, cy: minY },
        { cx: minX, cy: maxY },
        { cx: maxX, cy: maxY },
      ]);
      const x = Phaser.Math.Clamp(corner.cx + Phaser.Math.RND.between(-CORNER_JITTER, CORNER_JITTER), minX, maxX);
      const y = Phaser.Math.Clamp(corner.cy + Phaser.Math.RND.between(-CORNER_JITTER, CORNER_JITTER), minY, maxY);
      return { x, y };
    }

    return { x: Phaser.Math.RND.between(minX, maxX), y: Phaser.Math.RND.between(minY, maxY) };
  }

  /** Creates one obstacle sprite and resizes its static body to the asset's display size — the source art has transparent padding, so the raw texture bounds don't match the intended footprint. */
  private placeObstacleCell(x: number, y: number, group: Phaser.Physics.Arcade.StaticGroup, asset: ObstacleAsset): void {
    const obstacle = group.create(x, y, asset.key) as Phaser.Physics.Arcade.Sprite;
    obstacle.setDisplaySize(asset.width, asset.height);
    obstacle.refreshBody();
  }

  /**
   * Scatters a handful of non-colliding decorative props (graves, bones, crystals, etc.)
   * across combat rooms for atmosphere. Purely visual — no physics group involved — so
   * it can't affect movement, spawning, or collision logic.
   */
  private scatterDecor(): void {
    if (this.type !== "normal" && this.type !== "elite" && this.type !== "boss") return;

    const count = Phaser.Math.RND.between(6, 10);
    const margin = 64;
    for (let i = 0; i < count; i++) {
      const { x, y } = this.randomCornerBiasedPoint(margin);
      if (Phaser.Math.Distance.Between(x, y, this.centerX, this.centerY) < OBSTACLE_CENTER_CLEARANCE) continue;

      const asset = Phaser.Math.RND.pick(DECOR_ASSETS);
      this.scene.add.image(x, y, asset.key).setDisplaySize(asset.size, asset.size).setDepth(1);
    }
  }
}
