import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";

/**
 * First scene in the boot chain. Textures are generated synchronously in
 * BootScene (nothing to show real load progress for), so this scene's job is
 * to be the user-gesture that unlocks the Web Audio AudioContext before
 * gameplay needs it — browsers refuse to start audio without one.
 */
export class LoadingScene extends Phaser.Scene {
  private sfx = new Sfx();
  private started = false;

  constructor() {
    super("LoadingScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#111111");

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 20, "DUNGEON SOUL", {
        fontSize: "40px",
        color: "#4fd1c5",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 30, "Press any key or click to start", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.once("keydown", () => this.begin());
    this.input.once("pointerdown", () => this.begin());
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.sfx.resume();
    this.scene.start("BootScene");
  }
}
