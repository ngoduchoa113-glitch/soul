import Phaser from "phaser";

export interface Combatant {
  active: boolean;
  /**
   * False from the instant HP hits 0 — distinct from Phaser's `active`, which the entity keeps
   * true while its death animation plays (Phaser stops advancing animation frames on inactive
   * GameObjects, so `active` can't double as "still fighting" here). Room's "is anyone still up?"
   * check and damage-application loops use this, not `active`.
   */
  alive: boolean;
  x: number;
  y: number;
  roomIndex?: number;
  update(time: number, target: Phaser.Physics.Arcade.Sprite | null): void;
  takeDamage(amount: number): void;
}
