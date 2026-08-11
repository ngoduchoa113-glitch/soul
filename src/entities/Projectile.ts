import Phaser from "phaser";

const LIFETIME_MS = 1200;
const TRAIL_INTERVAL_MS = 40;

export interface HomingConfig {
  speed: number;
  /** Max angle change per second (radians) — keeps the curve gradual instead of snapping onto the target. */
  turnRateRadPerSec: number;
  /** Re-queried every frame (from the projectile's current position) so it can retarget if its mark dies. */
  acquireTarget: (fromX: number, fromY: number) => { x: number; y: number } | null;
}

export interface BoomerangConfig {
  /** Distance from the spawn point before the projectile flips into its return leg. */
  outDistance: number;
  returnSpeed: number;
  /** Re-queried every frame during the return leg so it chases the player's current position. */
  getReturnPoint: () => { x: number; y: number };
}

export interface ProjectileExtraOptions {
  /**
   * How many enemies this projectile can hit before it's destroyed on contact.
   * 0 (default) = destroyed on the first hit. `Infinity` = never destroyed by enemy
   * contact at all (boomerang's out/return legs handle their own re-hit tracking).
   */
  pierceCharges?: number;
  /** How many times this projectile bounces off walls instead of being destroyed on contact. */
  bounces?: number;
  boomerang?: BoomerangConfig;
  /** Fired once, right before the projectile is destroyed — on impact (enemy/wall) or on natural expiry. */
  onImpact?: (x: number, y: number) => void;
}

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number;
  pierceCharges: number;
  bouncesRemaining: number;
  onImpact?: (x: number, y: number) => void;
  private spawnedAt: number;
  private spawnX: number;
  private spawnY: number;
  private lastTrailAt = 0;
  private lastUpdateAt: number;
  private onTrailTick?: (x: number, y: number) => void;
  private homing?: HomingConfig;
  private boomerang?: BoomerangConfig;
  private boomerangPhase: "out" | "return" = "out";
  private hitTargets = new Set<object>();
  private lastWallCollisionAt = -Infinity;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    damage: number,
    onTrailTick?: (x: number, y: number) => void,
    homing?: HomingConfig,
    extra?: ProjectileExtraOptions,
  ) {
    super(scene, x, y, "projectile");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this.spawnedAt = scene.time.now;
    this.spawnX = x;
    this.spawnY = y;
    this.lastUpdateAt = this.spawnedAt;
    this.onTrailTick = onTrailTick;
    this.homing = homing;
    this.boomerang = extra?.boomerang;
    this.pierceCharges = extra?.pierceCharges ?? (extra?.boomerang ? Infinity : 0);
    this.bouncesRemaining = extra?.bounces ?? 0;
    this.onImpact = extra?.onImpact;
    this.lastTrailAt = this.spawnedAt;
    this.setDepth(5);
    this.setCircle(5);
  }

  /**
   * Must be called after the projectile is added to its physics Group —
   * Arcade Group.add() resets a body's velocity (and bounce) to the group defaults,
   * so setting either before that point gets silently discarded.
   */
  launch(angle: number, speed: number): void {
    this.scene.physics.velocityFromRotation(angle, speed, this.body!.velocity);
    this.setRotation(angle);
    // Only matters when bouncesRemaining > 0 (the wall collider skips destroy() in that
    // case) — Arcade reflects velocity on collision automatically once bounce is set.
    this.setBounce(1);
  }

  /** Tracks per-target hits for piercing projectiles; true the first time `target` is hit on the current leg. */
  registerHit(target: object): boolean {
    if (this.hitTargets.has(target)) return false;
    this.hitTargets.add(target);
    return true;
  }

  /**
   * A wall is built from many TILE-sized static bodies, so a single real collision can fire
   * the collider callback more than once in the same physics step (e.g. clipping two tiles at
   * once at a corner). Debounce so a bounce only ever consumes one charge per genuine hit.
   */
  canHandleWallCollision(time: number): boolean {
    if (time - this.lastWallCollisionAt < 50) return false;
    this.lastWallCollisionAt = time;
    return true;
  }

  update(time: number): void {
    if (time - this.spawnedAt > LIFETIME_MS) {
      this.onImpact?.(this.x, this.y);
      this.destroy();
      return;
    }

    if (this.boomerang) {
      this.updateBoomerang();
      if (!this.active) return;
    } else if (this.homing) {
      const dt = Math.max(0, time - this.lastUpdateAt) / 1000;
      const target = this.homing.acquireTarget(this.x, this.y);
      if (target) {
        const desiredAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        const currentAngle = this.body!.velocity.angle();
        const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, desiredAngle, this.homing.turnRateRadPerSec * dt);
        this.scene.physics.velocityFromRotation(newAngle, this.homing.speed, this.body!.velocity);
        this.setRotation(newAngle);
      }
    }
    this.lastUpdateAt = time;

    if (this.onTrailTick && time - this.lastTrailAt >= TRAIL_INTERVAL_MS) {
      this.lastTrailAt = time;
      this.onTrailTick(this.x, this.y);
    }
  }

  private updateBoomerang(): void {
    const boomerang = this.boomerang!;
    if (this.boomerangPhase === "out") {
      const traveled = Phaser.Math.Distance.Between(this.spawnX, this.spawnY, this.x, this.y);
      if (traveled >= boomerang.outDistance) {
        this.boomerangPhase = "return";
        this.hitTargets.clear();
      }
      return;
    }

    const returnPoint = boomerang.getReturnPoint();
    const angle = Phaser.Math.Angle.Between(this.x, this.y, returnPoint.x, returnPoint.y);
    this.scene.physics.velocityFromRotation(angle, boomerang.returnSpeed, this.body!.velocity);
    this.setRotation(angle);
    if (Phaser.Math.Distance.Between(this.x, this.y, returnPoint.x, returnPoint.y) < 24) {
      this.destroy();
    }
  }
}
