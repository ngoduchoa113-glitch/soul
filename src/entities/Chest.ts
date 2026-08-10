import Phaser from "phaser";
import type { RoomType } from "../data/types";
import { getWeaponVariant, type WeaponDef } from "../data/weapons";

const RANGED_WEAPON_IDS = ["pistol", "shotgun", "assaultRifle"];

export type ChestReward =
  | { kind: "coin"; amount: number }
  | { kind: "weapon"; def: WeaponDef }
  | { kind: "health"; amount: number }
  | { kind: "upgrade" };

interface RollTable {
  coinChance: number;
  weaponChance: number;
  healthChance: number;
  coinRange: [number, number];
  rareChance: number;
}

const ROLL_TABLES: Record<"normal" | "elite", RollTable> = {
  normal: { coinChance: 0.45, weaponChance: 0.2, healthChance: 0.15, coinRange: [10, 20], rareChance: 0.2 },
  elite: { coinChance: 0.25, weaponChance: 0.3, healthChance: 0.15, coinRange: [30, 50], rareChance: 0.6 },
};

export class Chest extends Phaser.GameObjects.Sprite {
  opened = false;
  private roomType: RoomType;

  constructor(scene: Phaser.Scene, x: number, y: number, roomType: RoomType) {
    super(scene, x, y, "chest");
    scene.add.existing(this);
    this.roomType = roomType;
    this.setDepth(6);
  }

  open(): ChestReward | null {
    if (this.opened) return null;
    this.opened = true;
    this.setTint(0x888888);

    const table = ROLL_TABLES[this.roomType === "elite" ? "elite" : "normal"];
    const roll = Math.random();

    if (roll < table.coinChance) {
      return { kind: "coin", amount: Phaser.Math.Between(table.coinRange[0], table.coinRange[1]) };
    }
    if (roll < table.coinChance + table.weaponChance) {
      const id = Phaser.Math.RND.pick(RANGED_WEAPON_IDS);
      const rarity = Math.random() < table.rareChance ? "rare" : "common";
      return { kind: "weapon", def: getWeaponVariant(id, rarity) };
    }
    if (roll < table.coinChance + table.weaponChance + table.healthChance) {
      return { kind: "health", amount: Phaser.Math.Between(20, 35) };
    }
    return { kind: "upgrade" };
  }
}
