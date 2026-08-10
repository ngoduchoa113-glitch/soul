import Phaser from "phaser";

export class ChoiceMenu {
  private bg: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private linesText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;

    this.bg = scene.add
      .rectangle(cx, cy, 360, 160, 0x000000, 0.75)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    this.titleText = scene.add
      .text(cx, cy - 60, "", { fontSize: "18px", color: "#ffd700", fontStyle: "bold" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(301)
      .setVisible(false);

    this.linesText = scene.add
      .text(cx, cy - 25, "", { fontSize: "16px", color: "#ffffff", align: "left", lineSpacing: 8 })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(301)
      .setVisible(false);
  }

  show(title: string, lines: string[]): void {
    this.titleText.setText(title);
    this.linesText.setText(lines.join("\n"));
    this.bg.setVisible(true);
    this.titleText.setVisible(true);
    this.linesText.setVisible(true);
  }

  hide(): void {
    this.bg.setVisible(false);
    this.titleText.setVisible(false);
    this.linesText.setVisible(false);
  }

  get visible(): boolean {
    return this.bg.visible;
  }
}
