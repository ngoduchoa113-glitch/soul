import Phaser from "phaser";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#111111");

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 60, "DUNGEON SOUL", {
        fontSize: "48px",
        color: "#4fd1c5",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const startText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, "Press any key or click to start a run", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.once("keydown", () => this.start());
    this.input.once("pointerdown", () => this.start());
  }

  private start(): void {
    this.scene.start("CharacterSelectScene");
  }
}
