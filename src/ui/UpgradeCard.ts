import Phaser from "phaser";
import { createPanel } from "./panel";
import { COLOR, bodyStyle, labelStyle, titleStyle } from "./textStyles";
import { RARITY_COLOR, RARITY_COLOR_HEX, RARITY_LABEL, type UpgradeDef } from "../data/upgrades";

export const CARD_WIDTH = 190;
export const CARD_HEIGHT = 252;

const HOVER_SCALE = 1.05;
const SELECTED_BORDER = 0xffd700;

export interface UpgradeCardCallbacks {
  onHover: (def: UpgradeDef) => void;
  onLeave: () => void;
  onSelect: (def: UpgradeDef) => void;
}

/**
 * One upgrade choice: icon, name, short description, and a compact stat badge inside a beveled
 * pixel-art panel whose border color reads the upgrade's rarity. Hover scales/brightens it and
 * fires onHover/onLeave (info only — it does not select); a click fires onSelect.
 */
export class UpgradeCard {
  readonly container: Phaser.GameObjects.Container;
  readonly def: UpgradeDef;

  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Rectangle;
  private rarityText: Phaser.GameObjects.Text;
  private locked = false;
  private selected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: UpgradeDef, callbacks: UpgradeCardCallbacks) {
    this.scene = scene;
    this.def = def;

    const rarityColor = RARITY_COLOR[def.rarity];
    const panel = createPanel(scene, 0, 0, CARD_WIDTH, CARD_HEIGHT, {
      fillColor: 0x14141c,
      borderColor: rarityColor,
    });
    this.bg = panel.bg;
    this.bg.setStrokeStyle(2, rarityColor, 1);

    this.rarityText = scene.add
      .text(0, -CARD_HEIGHT / 2 + 14, RARITY_LABEL[def.rarity], labelStyle(11, RARITY_COLOR_HEX[def.rarity]))
      .setOrigin(0.5);

    const iconKey = `upgrade-icon-${def.id}`;
    const icon = scene.add.image(0, -CARD_HEIGHT / 2 + 62, iconKey).setDisplaySize(56, 56);

    const nameText = scene.add
      .text(0, -CARD_HEIGHT / 2 + 106, def.name.toUpperCase(), {
        ...titleStyle(12, COLOR.text),
        align: "center",
        wordWrap: { width: CARD_WIDTH - 28, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    const descText = scene.add
      .text(0, -CARD_HEIGHT / 2 + 148, def.description, {
        ...bodyStyle(14, COLOR.dim),
        align: "center",
        wordWrap: { width: CARD_WIDTH - 28, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    const statY = CARD_HEIGHT / 2 - 32;
    const statBadge = scene.add.rectangle(0, statY, CARD_WIDTH - 32, 34, 0x000000, 0.25).setStrokeStyle(1, rarityColor, 0.6);
    const statText = scene.add
      .text(0, statY, `${def.statValue}  ${def.statLabel}`, { ...bodyStyle(15, COLOR.gold), align: "center" })
      .setOrigin(0.5);

    this.container = scene.add.container(x, y, [
      ...panel.all,
      this.rarityText,
      icon,
      nameText,
      descText,
      statBadge,
      statText,
    ]);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on("pointerover", () => {
      if (this.locked) return;
      this.setHovered(true);
      callbacks.onHover(def);
    });
    this.bg.on("pointerout", () => {
      if (this.locked) return;
      this.setHovered(false);
      callbacks.onLeave();
    });
    this.bg.on("pointerdown", () => {
      if (this.locked) return;
      callbacks.onSelect(def);
    });
  }

  private setHovered(hovered: boolean): void {
    if (this.selected) return;
    this.scene.tweens.add({
      targets: this.container,
      scale: hovered ? HOVER_SCALE : 1,
      duration: 140,
      ease: "Sine.Out",
    });
    this.bg.setStrokeStyle(hovered ? 3 : 2, RARITY_COLOR[this.def.rarity], 1);
  }

  /** Resets hover visuals without a pointerout event — used when the pointer leaves the game canvas entirely. */
  resetHover(): void {
    this.setHovered(false);
  }

  /** Marks this card as the confirmed pick — gold border, no further hover/scale changes. */
  setSelected(): void {
    this.selected = true;
    this.locked = true;
    this.bg.disableInteractive();
    this.bg.setStrokeStyle(3, SELECTED_BORDER, 1);
    this.scene.tweens.add({ targets: this.container, scale: HOVER_SCALE, duration: 120, ease: "Sine.Out" });
  }

  /** Marks this card as passed-over once a sibling was picked — dims it and stops taking input. */
  setDimmed(): void {
    this.locked = true;
    this.bg.disableInteractive();
    this.scene.tweens.add({ targets: this.container, alpha: 0.4, scale: 1, duration: 160 });
  }

  /** Confirmation flourish on the selected card: a quick bright pulse, then `onComplete`. */
  playConfirm(onComplete: () => void): void {
    const flash = this.scene.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0xffffff, 0.55);
    this.container.add(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 380,
      onComplete: () => flash.destroy(),
    });
    this.scene.tweens.add({
      targets: this.container,
      scale: HOVER_SCALE * 1.08,
      duration: 160,
      yoyo: true,
      ease: "Sine.InOut",
      onComplete,
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
