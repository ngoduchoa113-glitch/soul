import Phaser from "phaser";
import type { RoomType } from "../data/types";
import { ALL_WEAPON_IDS, getWeaponVariant, type WeaponDef } from "../data/weapons";

export type ChestReward =
  | { kind: "coin"; amount: number }
  | { kind: "weapon"; def: WeaponDef }
  | { kind: "health"; amount: number };

interface RollTable {
  coinChance: number;
  weaponChance: number;
  coinRange: [number, number];
  rareChance: number;
}

// Whatever's left after coin/weapon chances is health — between-stage power picks replaced
// the old chest "upgrade" outcome, so there's no third branch to reserve room for anymore.
const ROLL_TABLES: Record<"normal" | "elite", RollTable> = {
  normal: { coinChance: 0.45, weaponChance: 0.2, coinRange: [10, 20], rareChance: 0.2 },
  elite: { coinChance: 0.25, weaponChance: 0.3, coinRange: [30, 50], rareChance: 0.6 },
};

export class Chest extends Phaser.GameObjects.Sprite {
  opened = false;
  private roomType: RoomType;

  constructor(scene: Phaser.Scene, x: number, y: number, roomType: RoomType) {
    super(scene, x, y, "chest-closed");
    scene.add.existing(this);
    this.roomType = roomType;
    this.setDepth(6);
    this.setDisplaySize(32, 32);
  }

  /** Called only from GameScene.updateChestAutoOpen, which gates this on the player actually touching the chest (CHEST_TOUCH_RADIUS) — never on proximity alone. */
  open(): ChestReward | null {
    if (this.opened) return null;
    this.opened = true;
    this.setTexture("chest-open");

    const table = ROLL_TABLES[this.roomType === "elite" ? "elite" : "normal"];
    const roll = Math.random();

    if (roll < table.coinChance) {
      return { kind: "coin", amount: Phaser.Math.Between(table.coinRange[0], table.coinRange[1]) };
    }
    if (roll < table.coinChance + table.weaponChance) {
      const id = Phaser.Math.RND.pick(ALL_WEAPON_IDS);
      const rarity = Math.random() < table.rareChance ? "rare" : "common";
      return { kind: "weapon", def: getWeaponVariant(id, rarity) };
    }
    return { kind: "health", amount: Phaser.Math.Between(20, 35) };
  }
}
