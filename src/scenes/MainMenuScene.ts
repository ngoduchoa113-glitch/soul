import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";
import { createPanel } from "../ui/panel";
import { COLOR, bodyStyle, labelStyle, titleStyle } from "../ui/textStyles";

const ACCENT = 0x4fd1c5;

/**
 * The game's title/splash screen — also the required first-gesture screen that unlocks the
 * Web Audio AudioContext (browsers block audio until a click/key happens), so this scene owns
 * that instead of a separate LoadingScene doing an almost-identical "tap to start" screen first.
 */
export class MainMenuScene extends Phaser.Scene {
  private sfx = new Sfx();
  private started = false;
  private iconButtons: Phaser.GameObjects.GameObject[] = [];
  private helpPanel!: Phaser.GameObjects.Container;
  private muteIcon!: Phaser.GameObjects.Text;
  private fullscreenIcon!: Phaser.GameObjects.Text;
  private fullscreenListenersBound = false;

  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.started = false;
    this.iconButtons = [];

    this.cameras.main.fadeIn(220, 10, 10, 14);
    this.buildBackground(w, h);
    this.buildTitle();
    this.buildNote(w);
    this.buildPrompt(w, h);
    this.buildSideButtons(h);
    this.buildHelpPanel(w, h);

    this.input.keyboard!.once("keydown", () => this.start());
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const hitIcon = this.input.hitTestPointer(pointer).some((obj) => this.iconButtons.includes(obj));
      if (hitIcon) return; // the icon's own handler already dealt with this click
      if (this.helpPanel.visible) {
        this.helpPanel.setVisible(false);
        return;
      }
      this.start();
    });
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    this.sfx.resume();
    this.cameras.main.fadeOut(180, 10, 10, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("CharacterSelectScene");
    });
  }

  private buildBackground(w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a12, 0x0a0a12, 0x15131f, 0x15131f, 1);
    bg.fillRect(0, 0, w, h);

    // Faint scattered dust for a bit of depth.
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const star = this.add.circle(x, y, Phaser.Math.FloatBetween(0.5, 1.4), 0xffffff, Phaser.Math.FloatBetween(0.06, 0.2));
      this.tweens.add({
        targets: star,
        alpha: 0,
        duration: Phaser.Math.Between(1500, 3500),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    const cx = w / 2;
    const cy = h * 0.56;

    // Soft teal glow the silhouette stands in.
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 8; i >= 1; i--) {
      glow.fillStyle(ACCENT, 0.035);
      glow.fillEllipse(cx, cy, i * 46, i * 70);
    }

    // A distant dungeon archway behind the figure.
    const arch = this.add.graphics();
    arch.fillStyle(0x1c1c2a, 0.9);
    arch.fillRoundedRect(cx - 90, cy - 170, 180, 260, { tl: 90, tr: 90, bl: 0, br: 0 });
    arch.fillStyle(0x0a0a12, 1);
    arch.fillRoundedRect(cx - 60, cy - 150, 120, 260, { tl: 60, tr: 60, bl: 0, br: 0 });

    // Simple hooded-figure silhouette standing in the glow.
    const figure = this.add.graphics();
    figure.fillStyle(0x050508, 1);
    figure.fillTriangle(cx - 30, cy + 90, cx + 30, cy + 90, cx, cy - 30);
    figure.fillEllipse(cx, cy - 46, 26, 30);
  }

  private buildTitle(): void {
    this.add.text(28, 22, "DUNGEON", titleStyle(22, COLOR.text));
    this.add.text(28, 54, "SOUL", titleStyle(22, COLOR.accent));
  }

  private buildNote(w: number): void {
    this.add
      .text(w - 20, 24, "No save yet — progress resets\nif you refresh the page.", {
        ...labelStyle(13),
        align: "right",
        lineSpacing: 4,
      })
      .setOrigin(1, 0);
  }

  private buildPrompt(w: number, h: number): void {
    const prompt = this.add.text(w / 2, h - 70, "Tap to start", bodyStyle(20)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
  }

  private buildSideButtons(h: number): void {
    const x = 36;
    this.muteIcon = this.buildIconButton(x, h / 2 - 60, Sfx.isMuted ? "🔇" : "🔊", () => {
      Sfx.setMuted(!Sfx.isMuted);
      this.muteIcon.setText(Sfx.isMuted ? "🔇" : "🔊");
    });
    this.buildIconButton(x, h / 2, "?", () => this.helpPanel.setVisible(!this.helpPanel.visible));
    this.fullscreenIcon = this.buildIconButton(x, h / 2 + 60, this.scale.isFullscreen ? "🗗" : "⛶", () => {
      this.scale.toggleFullscreen();
    });
    // The ScaleManager is global and outlives this scene's create() re-runs — bind its
    // fullscreen-state listeners only once (ever), not on every re-entry to this scene.
    if (!this.fullscreenListenersBound) {
      this.fullscreenListenersBound = true;
      this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => this.fullscreenIcon.setText("🗗"));
      this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => this.fullscreenIcon.setText("⛶"));
    }
  }

  private buildIconButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const size = 40;
    const bg = this.add
      .rectangle(x, y, size, size, 0x1c1c26, 0.85)
      .setStrokeStyle(1, 0x3a3a4a)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => bg.setFillStyle(0x2a2a38, 0.9));
    bg.on("pointerout", () => bg.setFillStyle(0x1c1c26, 0.85));
    bg.on("pointerdown", onClick);
    this.iconButtons.push(bg);

    return this.add.text(x, y, label, { fontSize: "18px" }).setOrigin(0.5);
  }

  private buildHelpPanel(w: number, h: number): void {
    const cx = w / 2;
    const cy = h / 2;
    const panel = createPanel(this, 0, 0, 420, 260, { borderColor: ACCENT });
    const title = this.add.text(0, -110, "Controls", titleStyle(16, COLOR.gold)).setOrigin(0.5);
    const lines = [
      "WASD — move",
      "Left click (hold) — attack",
      "Right click — character skill",
      "1 / 2 — switch weapon",
      "E — interact / pick up weapon",
      "Esc — pause",
      "F — toggle fullscreen",
      "Choose a power between stages",
    ];
    const body = this.add
      .text(0, -15, lines.join("\n"), { ...bodyStyle(15), align: "center", lineSpacing: 10 })
      .setOrigin(0.5, 0.5);
    const hint = this.add.text(0, 108, "(click anywhere to close)", labelStyle(12)).setOrigin(0.5);

    this.helpPanel = this.add.container(cx, cy, [...panel.all, title, body, hint]).setDepth(200).setVisible(false);
  }
}
