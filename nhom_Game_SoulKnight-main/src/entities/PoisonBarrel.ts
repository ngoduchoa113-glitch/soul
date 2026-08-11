import Phaser from "phaser";

/**
 * A solid crate that ruptures into a lingering poison cloud when a player shot lands on it,
 * damaging player and enemies alike who linger in the cloud (see GameScene.triggerPoisonBarrel).
 */
export class PoisonBarrel extends Phaser.Physics.Arcade.Sprite {
  impactDamage = 8;
  tickDamage = 5;
  radius = 75;
  tickMs = 500;
  durationMs = 3000;
  triggered = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "poison-barrel");
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(3);
  }
}
