import Phaser from "phaser";
import { weaponIconKey, type WeaponDef } from "../data/weapons";

/** Grace period before a freshly dropped weapon can be picked back up — avoids an instant swap-loop if the player stands still on top of it. */
const PICKUP_GRACE_MS = 400;

/** A weapon lying on the ground — dropped when the player picks up a new one, or swapped in on overlap (see GameScene). */
export class WeaponPickup extends Phaser.Physics.Arcade.Sprite {
  def: WeaponDef;
  private collectableAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, def: WeaponDef) {
    super(scene, x, y, weaponIconKey(def));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.def = def;
    this.collectableAt = scene.time.now + PICKUP_GRACE_MS;
    this.setCircle(14);
    this.setDepth(6);
  }

  get collectable(): boolean {
    return this.scene.time.now >= this.collectableAt;
  }
}
