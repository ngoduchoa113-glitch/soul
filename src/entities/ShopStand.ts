import Phaser from "phaser";

export type ShopEffect = "weapon" | "maxHp" | "heal";

export interface ShopItem {
  label: string;
  cost: number;
  effect: ShopEffect;
  purchased: boolean;
}

export class ShopStand extends Phaser.GameObjects.Sprite {
  items: ShopItem[];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "shop");
    scene.add.existing(this);
    this.setDepth(6);

    this.items = [
      { label: "Shotgun", cost: 80, effect: "weapon", purchased: false },
      { label: "+20 Max HP", cost: 100, effect: "maxHp", purchased: false },
      { label: "Full Heal", cost: 150, effect: "heal", purchased: false },
    ];
  }
}
