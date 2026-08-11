import Phaser from "phaser";

/** Dropped by dead enemies/bosses; auto-collected on player overlap (see GameScene). */
export class CoinPickup extends Phaser.Physics.Arcade.Sprite {
  amount: number;

  constructor(scene: Phaser.Scene, x: number, y: number, amount: number) {
    super(scene, x, y, "coin");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.amount = amount;
    this.setCircle(7);
    this.setDepth(6);
  }
}
