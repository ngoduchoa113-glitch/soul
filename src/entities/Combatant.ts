import Phaser from "phaser";

export interface Combatant {
  active: boolean;
  x: number;
  y: number;
  roomIndex?: number;
  update(time: number, target: Phaser.Physics.Arcade.Sprite | null): void;
  takeDamage(amount: number): void;
}
