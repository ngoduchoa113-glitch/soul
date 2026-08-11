import Phaser from "phaser";
import { COLOR, COLOR_NUM, bodyStyle, labelStyle, titleStyle } from "./textStyles";
import { createPanel, type Panel } from "./panel";

/** A stat bar: dark recessed trough (with a hard 1px light/dark bevel, no gradients) + colored fill. */
interface Bar {
  fill: Phaser.GameObjects.Rectangle;
  /** Trough + bevel hairlines — decorative parts that move as a unit with `fill` for show/hide. */
  parts: Phaser.GameObjects.Rectangle[];
  width: number;
  height: number;
}

export class Hud {
  private hpBar: Bar;
  private hpLabel: Phaser.GameObjects.Text;
  private energyBar: Bar;
  private energyLabel: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private activeWeaponIcon: Phaser.GameObjects.Image;
  private reserveWeaponIcon: Phaser.GameObjects.Image;
  private coinsText: Phaser.GameObjects.Text;
  private skillText: Phaser.GameObjects.Text;
  private stageText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private flashText: Phaser.GameObjects.Text;
  private flashHideEvent?: Phaser.Time.TimerEvent;
  private bossBar: Bar;
  private bossLabel: Phaser.GameObjects.Text;
  private bossFrame: Phaser.GameObjects.Rectangle;
  private deathPanel: Panel;
  private deathStatsText: Phaser.GameObjects.Text;
  private deathMenuButton: Phaser.GameObjects.Text;
  private deathShown = false;

  private readonly barWidth = 200;
  private readonly barHeight = 18;
  private readonly x = 20;
  private readonly y = 20;
  private readonly bossBarWidth = 360;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  /**
   * `container` is GameScene's screen-fixed UI layer (see GameScene.uiContainer) — it's
   * repositioned/rescaled every frame to counteract the zoomed world camera's scroll and zoom, so
   * everything added here stays glued to the same screen position and size regardless of where the
   * camera is looking. Nothing in this class uses scrollFactor(0) — that only cancels camera
   * *scroll*, not *zoom*, so on its own it isn't enough once the world camera is zoomed.
   */
  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.container = container;

    this.hpLabel = this.addText(this.x, this.y - 15, "HP", labelStyle(11)).setDepth(101);
    this.hpBar = this.buildBar(this.x, this.y, this.barWidth, this.barHeight, COLOR_NUM.hp);

    const energyBarY = this.y + this.barHeight + 12;
    const energyBarHeight = 14;
    this.energyLabel = this.addText(this.x, energyBarY - 15, "ENERGY", labelStyle(11)).setDepth(101);
    this.energyBar = this.buildBar(this.x, energyBarY, this.barWidth, energyBarHeight, COLOR_NUM.energy);

    const afterBarsY = energyBarY + energyBarHeight + 16;

    this.addText(this.x, afterBarsY - 15, "WEAPON", labelStyle(11)).setDepth(101);

    this.activeWeaponIcon = scene.add.image(this.x + 14, afterBarsY + 12, "spark").setDisplaySize(28, 28).setDepth(101);
    this.container.add(this.activeWeaponIcon);

    this.reserveWeaponIcon = scene.add
      .image(this.x + 14, afterBarsY + 44, "spark")
      .setDisplaySize(20, 20)
      .setAlpha(0.6)
      .setDepth(101);
    this.container.add(this.reserveWeaponIcon);

    this.weaponText = this.addText(this.x + 34, afterBarsY, "", { ...bodyStyle(14), lineSpacing: 10 }).setDepth(101);

    this.coinsText = this.addText(this.x, afterBarsY + 68, "Coins: 0", bodyStyle(14, COLOR.gold)).setDepth(101);
    this.skillText = this.addText(this.x, afterBarsY + 90, "", bodyStyle(14, COLOR.accent)).setDepth(101);
    this.stageText = this.addText(this.x, afterBarsY + 112, "", bodyStyle(13, COLOR.gold)).setDepth(101);

    const deathCx = scene.scale.width / 2;
    const deathCy = scene.scale.height / 2;
    this.deathPanel = createPanel(scene, deathCx, deathCy, 320, 200, { depth: 300 });
    for (const r of this.deathPanel.all) r.setVisible(false);
    this.container.add(this.deathPanel.all);

    this.statusText = this.addText(deathCx, deathCy - 70, "", titleStyle(24, COLOR.danger))
      .setOrigin(0.5)
      .setDepth(301)
      .setVisible(false);

    this.deathStatsText = this.addText(deathCx, deathCy - 15, "", { ...bodyStyle(16), align: "center" })
      .setOrigin(0.5)
      .setDepth(301)
      .setVisible(false);

    this.deathMenuButton = this.addText(deathCx, deathCy + 60, "Return to Main Menu", bodyStyle(18, COLOR.accent))
      .setOrigin(0.5)
      .setDepth(301)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.flashText = this.addText(scene.scale.width / 2, 100, "", titleStyle(16, COLOR.gold))
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);

    const bossX = scene.scale.width / 2 - this.bossBarWidth / 2;
    const bossY = 16;

    this.bossFrame = scene.add
      .rectangle(bossX - 1, bossY - 1, this.bossBarWidth + 2, 14 + 2)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x000000, 0.7)
      .setDepth(99)
      .setVisible(false);
    this.container.add(this.bossFrame);

    this.bossBar = this.buildBar(bossX, bossY, this.bossBarWidth, 14, 0xef4444);
    this.setBarVisible(this.bossBar, false);

    this.bossLabel = this.addText(scene.scale.width / 2, bossY - 16, "", labelStyle(13, COLOR.text))
      .setOrigin(0.5, 0)
      .setDepth(101)
      .setVisible(false);
  }

  private addText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const obj = this.scene.add.text(x, y, text, style);
    this.container.add(obj);
    return obj;
  }

  /**
   * A dark recessed trough (fixed-size background + a hard-edged 1px light-top/dark-bottom bevel,
   * baked once — no gradients) with a colored fill inset inside it that resizes on value changes.
   */
  private buildBar(x: number, y: number, w: number, h: number, fillColor: number): Bar {
    const trough = this.scene.add.rectangle(x, y, w, h, 0x14141c).setOrigin(0, 0).setStrokeStyle(1, 0x3a3a4a).setDepth(100);
    // Hard-edged bevel: a darker hairline along the top, a lighter one along the bottom — reads as
    // "recessed into the panel" without any gradient/blur.
    const bevelTop = this.scene.add.rectangle(x, y, w, 1, 0x000000, 0.5).setOrigin(0, 0).setDepth(100);
    const bevelBottom = this.scene.add.rectangle(x, y + h - 1, w, 1, 0xffffff, 0.08).setOrigin(0, 0).setDepth(100);
    const fill = this.scene.add.rectangle(x + 2, y + 2, w - 4, h - 4, fillColor).setOrigin(0, 0).setDepth(101);

    this.container.add([trough, bevelTop, bevelBottom, fill]);
    return { fill, parts: [trough, bevelTop, bevelBottom], width: w - 4, height: h - 4 };
  }

  private setBarVisible(bar: Bar, visible: boolean): void {
    bar.fill.setVisible(visible);
    for (const part of bar.parts) part.setVisible(visible);
  }

  setHp(hp: number, maxHp: number): void {
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.hpBar.fill.setSize(this.hpBar.width * frac, this.hpBar.height);
    this.hpLabel.setText(`HP ${Math.ceil(hp)}/${maxHp}`);
  }

  setWeapon(activeName: string, activeIconKey: string, reserveName: string, reserveIconKey: string): void {
    this.weaponText.setText(`${activeName}\n(${reserveName})`);
    this.activeWeaponIcon.setTexture(activeIconKey);
    this.reserveWeaponIcon.setTexture(reserveIconKey);
  }

  setEnergy(energy: number, maxEnergy: number): void {
    const frac = Phaser.Math.Clamp(energy / maxEnergy, 0, 1);
    this.energyBar.fill.setSize(this.energyBar.width * frac, this.energyBar.height);
    this.energyLabel.setText(`ENERGY ${Math.ceil(energy)}/${maxEnergy}`);
  }

  setCoins(coins: number): void {
    this.coinsText.setText(`Coins: ${coins}`);
  }

  setStage(floor: number, stage: number): void {
    const label = stage === 6 ? `Floor ${floor} — Trophy` : `Floor ${floor}-${stage}`;
    this.stageText.setText(label);
  }

  setSkill(name: string, remainingMs: number, ready: boolean): void {
    if (ready) {
      this.skillText.setText(`Skill: ${name} — READY`);
    } else {
      this.skillText.setText(`Skill: ${name} (${(remainingMs / 1000).toFixed(1)}s)`);
    }
  }

  flashMessage(text: string): void {
    this.flashHideEvent?.remove();
    this.flashText.setText(text).setVisible(true);
    this.flashHideEvent = this.scene.time.delayedCall(1600, () => {
      this.flashText.setVisible(false);
    });
  }

  setBossHp(hp: number, maxHp: number, name = "BOSS"): void {
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.bossBar.fill.setSize(this.bossBar.width * frac, this.bossBar.height);
    this.bossLabel.setText(`${name} ${Math.ceil(hp)}/${maxHp}`);
    this.bossFrame.setVisible(true);
    this.setBarVisible(this.bossBar, true);
    this.bossLabel.setVisible(true);
  }

  hideBossHp(): void {
    this.bossFrame.setVisible(false);
    this.setBarVisible(this.bossBar, false);
    this.bossLabel.setVisible(false);
  }

  /** Shows the death screen once (further calls while already dead are no-ops) — kill count, the floor/stage reached, and a button back to the main menu. */
  showDeath(killCount: number, floor: number, stage: number, onReturnToMenu: () => void): void {
    if (this.deathShown) return;
    this.deathShown = true;

    for (const r of this.deathPanel.all) r.setVisible(true);
    this.statusText.setColor(COLOR.danger).setText("YOU DIED").setVisible(true);
    this.deathStatsText.setText(`Enemies Slain: ${killCount}\nReached: Floor ${floor} - Stage ${stage}`).setVisible(true);
    this.deathMenuButton.setVisible(true).on("pointerdown", onReturnToMenu);
  }
}
