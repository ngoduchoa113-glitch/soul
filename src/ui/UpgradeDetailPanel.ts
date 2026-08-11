import Phaser from "phaser";
import { createPanel } from "./panel";
import { COLOR, bodyStyle, labelStyle, titleStyle } from "./textStyles";
import { RARITY_COLOR_HEX, RARITY_LABEL, type UpgradeDef, type UpgradeEffectPreview } from "../data/upgrades";

export const DETAIL_WIDTH = 610;
export const DETAIL_HEIGHT = 172;

const SLIDE_OFFSET = 16;

/**
 * The hover-detail readout below the 3 upgrade cards: full name, long description, the exact
 * stat this pick changes (previous → new, read live off the player), and flavor text. Fades and
 * slides in on first show, then just swaps its text in place while the player hovers card to card.
 */
export class UpgradeDetailPanel {
  readonly container: Phaser.GameObjects.Container;

  private scene: Phaser.Scene;
  private baseY: number;
  private shown = false;
  private tween?: Phaser.Tweens.Tween;

  private rarityText: Phaser.GameObjects.Text;
  private nameText: Phaser.GameObjects.Text;
  private detailText: Phaser.GameObjects.Text;
  private statLabelText: Phaser.GameObjects.Text;
  private statValueText: Phaser.GameObjects.Text;
  private flavorText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.baseY = y;

    const panel = createPanel(scene, 0, 0, DETAIL_WIDTH, DETAIL_HEIGHT, { fillColor: 0x0a0a10, fillAlpha: 0.95 });

    this.rarityText = scene.add.text(DETAIL_WIDTH / 2 - 16, -DETAIL_HEIGHT / 2 + 16, "", labelStyle(12)).setOrigin(1, 0.5);

    this.nameText = scene.add
      .text(-DETAIL_WIDTH / 2 + 16, -DETAIL_HEIGHT / 2 + 16, "", titleStyle(14, COLOR.gold))
      .setOrigin(0, 0.5);

    this.detailText = scene.add
      .text(-DETAIL_WIDTH / 2 + 16, -DETAIL_HEIGHT / 2 + 42, "", {
        ...bodyStyle(16, COLOR.text),
        wordWrap: { width: DETAIL_WIDTH - 32, useAdvancedWrap: true },
        lineSpacing: 2,
      })
      .setOrigin(0, 0);

    this.statLabelText = scene.add
      .text(-DETAIL_WIDTH / 2 + 16, DETAIL_HEIGHT / 2 - 34, "", labelStyle(12))
      .setOrigin(0, 0.5);

    this.statValueText = scene.add
      .text(-DETAIL_WIDTH / 2 + 16, DETAIL_HEIGHT / 2 - 14, "", bodyStyle(17, COLOR.accent))
      .setOrigin(0, 0.5);

    this.flavorText = scene.add
      .text(DETAIL_WIDTH / 2 - 16, DETAIL_HEIGHT / 2 - 20, "", {
        ...bodyStyle(15, COLOR.dim),
        fontStyle: "italic",
        align: "right",
        wordWrap: { width: DETAIL_WIDTH * 0.5, useAdvancedWrap: true },
      })
      .setOrigin(1, 0.5);

    this.container = scene.add.container(x, y + SLIDE_OFFSET, [
      ...panel.all,
      this.rarityText,
      this.nameText,
      this.detailText,
      this.statLabelText,
      this.statValueText,
      this.flavorText,
    ]);
    this.container.setAlpha(0);
  }

  /** Fills in one upgrade's info and fades/slides the panel in (or just swaps text if already visible). */
  show(def: UpgradeDef, preview: UpgradeEffectPreview): void {
    this.rarityText.setText(RARITY_LABEL[def.rarity]).setColor(RARITY_COLOR_HEX[def.rarity]);
    this.nameText.setText(def.name.toUpperCase());
    this.detailText.setText(def.detail);
    this.statLabelText.setText(preview.statLabel.toUpperCase());
    this.statValueText.setText(`${preview.before}  →  ${preview.after}`);
    this.flavorText.setText(def.flavor);

    this.tween?.stop();
    if (this.shown) {
      this.container.setAlpha(1).setY(this.baseY);
      return;
    }
    this.shown = true;
    this.tween = this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: this.baseY,
      duration: 160,
      ease: "Sine.Out",
    });
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.tween?.stop();
    this.tween = this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.baseY + SLIDE_OFFSET,
      duration: 140,
      ease: "Sine.In",
    });
  }

  destroy(): void {
    this.tween?.stop();
    this.container.destroy();
  }
}
