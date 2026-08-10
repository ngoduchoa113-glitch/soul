import Phaser from "phaser";

const LIFETIME_MS = 1200;
const TRAIL_INTERVAL_MS = 40;

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number;
  private spawnedAt: number;
  private lastTrailAt = 0;
  private onTrailTick?: (x: number, y: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, damage: number, onTrailTick?: (x: number, y: number) => void) {
    super(scene, x, y, "projectile");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this.spawnedAt = scene.time.now;
    this.onTrailTick = onTrailTick;
    this.lastTrailAt = this.spawnedAt;
    this.setDepth(5);
    this.setCircle(5);
  }

  /**
   * Must be called after the projectile is added to its physics Group —
   * Arcade Group.add() resets a body's velocity to the group defaults (0,0),
   * so setting velocity before that point gets silently discarded.
   */
  launch(angle: number, speed: number): void {
    this.scene.physics.velocityFromRotation(angle, speed, this.body!.velocity);
    this.setRotation(angle);
  }

  update(time: number): void {
    if (time - this.spawnedAt > LIFETIME_MS) {
      this.destroy();
      return;
    }
    if (this.onTrailTick && time - this.lastTrailAt >= TRAIL_INTERVAL_MS) {
      this.lastTrailAt = time;
      this.onTrailTick(this.x, this.y);
    }
  }
}
