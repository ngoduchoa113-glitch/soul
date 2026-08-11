import Phaser from "phaser";

/**
 * TNT crate — a solid obstacle that blocks movement like a wall, but detonates when a player
 * shot lands on it, damaging everything (player included) in `explodeRadius`. Nearby crates
 * chain-react off each other's blast (see GameScene.triggerExplosiveCrate).
 */
export class ExplosiveCrate extends Phaser.Physics.Arcade.Sprite {
  damage = 26;
  explodeRadius = 90;
  triggered = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tnt-crate");
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(3);
  }
}
