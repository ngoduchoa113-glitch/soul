import Phaser from "phaser";

/** Dropped by dead enemies when Life Harvest is owned; auto-collected on player overlap (see GameScene). */
export class HpPickup extends Phaser.Physics.Arcade.Sprite {
  amount: number;

  constructor(scene: Phaser.Scene, x: number, y: number, amount: number) {
    super(scene, x, y, "hp-orb");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.amount = amount;
    this.setCircle(8);
    this.setDepth(6);
  }
}
