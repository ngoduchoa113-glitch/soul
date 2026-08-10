import Phaser from "phaser";

export class Hud {
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private energyFill: Phaser.GameObjects.Rectangle;
  private energyLabel: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private coinsText: Phaser.GameObjects.Text;
  private skillText: Phaser.GameObjects.Text;
  private stageText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private flashText: Phaser.GameObjects.Text;
  private flashHideEvent?: Phaser.Time.TimerEvent;
  private bossBg: Phaser.GameObjects.Rectangle;
  private bossFill: Phaser.GameObjects.Rectangle;
  private bossLabel: Phaser.GameObjects.Text;

  private readonly barWidth = 200;
  private readonly barHeight = 18;
  private readonly x = 20;
  private readonly y = 20;
  private readonly bossBarWidth = 360;

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    scene.add
      .rectangle(this.x, this.y, this.barWidth, this.barHeight, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.fill = scene.add
      .rectangle(this.x + 2, this.y + 2, this.barWidth - 4, this.barHeight - 4, 0xe25555)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.label = scene.add
      .text(this.x, this.y - 18, "HP", { fontSize: "14px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(101);

    const energyBarY = this.y + this.barHeight + 4;
    const energyBarHeight = 14;

    scene.add
      .rectangle(this.x, energyBarY, this.barWidth, energyBarHeight, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.energyFill = scene.add
      .rectangle(this.x + 2, energyBarY + 2, this.barWidth - 4, energyBarHeight - 4, 0x60a5fa)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.energyLabel = scene.add
      .text(this.x + 4, energyBarY + 1, "", { fontSize: "11px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(102);

    const afterBarsY = energyBarY + energyBarHeight + 6;

    this.weaponText = scene.add
      .text(this.x, afterBarsY, "", { fontSize: "14px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(101);

    this.coinsText = scene.add
      .text(this.x, afterBarsY + 22, "Coins: 0", { fontSize: "14px", color: "#ffd700" })
      .setScrollFactor(0)
      .setDepth(101);

    this.skillText = scene.add
      .text(this.x, afterBarsY + 44, "", { fontSize: "14px", color: "#4fd1c5" })
      .setScrollFactor(0)
      .setDepth(101);

    this.stageText = scene.add
      .text(this.x, afterBarsY + 66, "", { fontSize: "13px", color: "#ffd700" })
      .setScrollFactor(0)
      .setDepth(101);

    this.statusText = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2, "", {
        fontSize: "32px",
        color: "#ff4444",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.flashText = scene.add
      .text(scene.scale.width / 2, 100, "", {
        fontSize: "22px",
        color: "#ffaa00",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    const bossX = scene.scale.width / 2 - this.bossBarWidth / 2;
    const bossY = 16;

    this.bossBg = scene.add
      .rectangle(bossX, bossY, this.bossBarWidth, 14, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.bossFill = scene.add
      .rectangle(bossX + 2, bossY + 2, this.bossBarWidth - 4, 10, 0xef4444)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.bossLabel = scene.add
      .text(scene.scale.width / 2, bossY - 16, "", { fontSize: "13px", color: "#ffffff" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  setHp(hp: number, maxHp: number): void {
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.fill.setSize((this.barWidth - 4) * frac, this.barHeight - 4);
    this.label.setText(`HP ${Math.ceil(hp)}/${maxHp}`);
  }

  setWeapon(name: string): void {
    this.weaponText.setText(name);
  }

  setEnergy(energy: number, maxEnergy: number): void {
    const frac = Phaser.Math.Clamp(energy / maxEnergy, 0, 1);
    this.energyFill.setSize((this.barWidth - 4) * frac, 10);
    this.energyLabel.setText(`Energy ${Math.ceil(energy)}/${maxEnergy}`);
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
    this.bossFill.setSize((this.bossBarWidth - 4) * frac, 10);
    this.bossLabel.setText(`${name} ${Math.ceil(hp)}/${maxHp}`);
    this.bossBg.setVisible(true);
    this.bossFill.setVisible(true);
    this.bossLabel.setVisible(true);
  }

  hideBossHp(): void {
    this.bossBg.setVisible(false);
    this.bossFill.setVisible(false);
    this.bossLabel.setVisible(false);
  }

  showDeath(): void {
    this.showBanner("YOU DIED", "#ff4444");
  }

  private showBanner(text: string, color: string): void {
    this.statusText.setColor(color).setText(text).setVisible(true);
  }
}
