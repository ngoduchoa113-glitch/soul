import Phaser from "phaser";
import { createPanel, type Panel } from "./panel";
import { COLOR, bodyStyle, titleStyle } from "./textStyles";

const PANEL_WIDTH = 400;
const ROW_HEIGHT = 34;
const TITLE_AREA = 60;
const BOTTOM_PAD = 24;

/**
 * A centered choice list (stage-upgrade picks, shop) — options render as individual rows so each
 * reads as a distinct pick, not a wall of text. `container` is GameScene's screen-fixed UI layer
 * (see Hud's constructor doc for why — plain scrollFactor(0) isn't enough once the world camera
 * is zoomed).
 */
export class ChoiceMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cx: number;
  private cy: number;
  private panel: Panel;
  private titleText: Phaser.GameObjects.Text;
  private rowBands: Phaser.GameObjects.Rectangle[] = [];
  private rowTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.container = container;
    this.cx = scene.scale.width / 2;
    this.cy = scene.scale.height / 2;

    this.panel = createPanel(scene, this.cx, this.cy, PANEL_WIDTH, TITLE_AREA + ROW_HEIGHT * 3 + BOTTOM_PAD, {
      depth: 300,
    });
    for (const r of this.panel.all) r.setVisible(false);
    container.add(this.panel.all);

    this.titleText = scene.add.text(this.cx, 0, "", titleStyle(15, COLOR.gold)).setOrigin(0.5, 0.5).setDepth(302).setVisible(false);
    container.add(this.titleText);
  }

  show(title: string, lines: string[]): void {
    this.clearRows();

    const height = TITLE_AREA + ROW_HEIGHT * lines.length + BOTTOM_PAD;
    this.panel.bg.setSize(PANEL_WIDTH, height).setVisible(true);
    this.panel.inset.setSize(PANEL_WIDTH - 8, height - 8).setVisible(true);

    const top = this.cy - height / 2;
    this.titleText.setText(title).setPosition(this.cx, top + 18).setVisible(true);

    const rowsTop = top + TITLE_AREA;
    lines.forEach((line, i) => {
      const rowY = rowsTop + i * ROW_HEIGHT + ROW_HEIGHT / 2;
      const band = this.scene.add
        .rectangle(this.cx, rowY, PANEL_WIDTH - 24, ROW_HEIGHT - 4, 0xffffff, i % 2 === 0 ? 0 : 0.035)
        .setDepth(301);
      const text = this.scene.add.text(this.cx, rowY, line, bodyStyle(15)).setOrigin(0.5).setDepth(302);
      this.container.add([band, text]);
      this.rowBands.push(band);
      this.rowTexts.push(text);
    });
  }

  hide(): void {
    this.titleText.setVisible(false);
    for (const r of this.panel.all) r.setVisible(false);
    this.clearRows();
  }

  get visible(): boolean {
    return this.panel.bg.visible;
  }

  private clearRows(): void {
    for (const b of this.rowBands) b.destroy();
    for (const t of this.rowTexts) t.destroy();
    this.rowBands = [];
    this.rowTexts = [];
  }
}
