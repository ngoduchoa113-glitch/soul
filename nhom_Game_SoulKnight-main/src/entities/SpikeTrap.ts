import Phaser from "phaser";

/** Minimum time between damage ticks for the same target standing on the same trap. */
const HIT_COOLDOWN_MS = 600;

/**
 * A walkable hazard — nothing blocks movement over it (unlike a wall/obstacle), but anything
 * standing on it takes periodic damage. Player and enemies are tracked independently so one
 * doesn't reset the other's cooldown.
 */
export class SpikeTrap extends Phaser.Physics.Arcade.Sprite {
  damage = 8;
  private lastHitAt = new Map<object, number>();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "spike-trap");
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body — never moves, but overlap still works fine against it
    this.setCircle(11, 3, 3);
    this.setDepth(2);
  }

  canDamage(time: number, target: object): boolean {
    const last = this.lastHitAt.get(target) ?? -Infinity;
    if (time - last < HIT_COOLDOWN_MS) return false;
    this.lastHitAt.set(target, time);
    return true;
  }
}
