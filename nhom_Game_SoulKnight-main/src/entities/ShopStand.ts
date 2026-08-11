import Phaser from "phaser";
import { ALL_WEAPON_IDS, getWeaponVariant, type WeaponDef } from "../data/weapons";

export type ShopEffect = "weapon" | "maxHp" | "heal" | "energy";

export interface ShopItem {
  label: string;
  cost: number;
  effect: ShopEffect;
  purchased: boolean;
  /** Only set for effect "weapon" — the exact def rolled for this stand, so purchase matches what's shown. */
  weaponDef?: WeaponDef;
}

/** How many distinct random weapons a shop stand offers alongside its fixed stat items. */
const WEAPON_OFFER_COUNT = 2;
const RARE_CHANCE = 0.25;

export class ShopStand extends Phaser.GameObjects.Sprite {
  items: ShopItem[];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "shop");
    scene.add.existing(this);
    this.setDepth(6);

    const weaponIds = Phaser.Utils.Array.Shuffle([...ALL_WEAPON_IDS]).slice(0, WEAPON_OFFER_COUNT);

    this.items = [
      ...weaponIds.map((id) => this.rollWeaponItem(id)),
      { label: "+20 Max HP", cost: 100, effect: "maxHp", purchased: false },
      { label: "Full Heal", cost: 150, effect: "heal", purchased: false },
      { label: "Refill Energy", cost: 60, effect: "energy", purchased: false },
    ];
  }

  private rollWeaponItem(id: string): ShopItem {
    const rarity = Math.random() < RARE_CHANCE ? "rare" : "common";
    const def = getWeaponVariant(id, rarity);
    const cost = rarity === "rare" ? Phaser.Math.Between(160, 220) : Phaser.Math.Between(70, 110);
    const label = rarity === "rare" ? `${def.name} ★` : def.name;
    return { label, cost, effect: "weapon", purchased: false, weaponDef: def };
  }
}
