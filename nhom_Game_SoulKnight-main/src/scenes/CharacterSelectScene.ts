import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "../data/characters";
import { CHARACTER_SPRITES } from "../data/creatureSprites";
import { createPanel } from "../ui/panel";
import { COLOR, bodyStyle, titleStyle } from "../ui/textStyles";

const ORDER: CharacterId[] = ["knight", "samurai", "healer", "mage"];
const PORTRAIT_SCALE = 3.5;

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super("CharacterSelectScene");
  }

  create(): void {
    this.cameras.main.fadeIn(220, 10, 10, 14);

    this.add.text(this.scale.width / 2, 50, "DUNGEON SOUL", titleStyle(28, COLOR.accent)).setOrigin(0.5);
    this.add.text(this.scale.width / 2, 96, "Choose Your Character", bodyStyle(18)).setOrigin(0.5);

    const cardWidth = 200;
    const cardHeight = 320;
    const gap = 24;
    const totalWidth = cardWidth * ORDER.length + gap * (ORDER.length - 1);
    const startX = this.scale.width / 2 - totalWidth / 2 + cardWidth / 2;
    const y = 380;

    ORDER.forEach((id, i) => {
      const x = startX + i * (cardWidth + gap);
      this.buildCard(x, y, cardWidth, cardHeight, id, i + 1);
    });

    const kb = this.input.keyboard!;
    kb.on("keydown-ONE", () => this.select("knight"));
    kb.on("keydown-TWO", () => this.select("samurai"));
    kb.on("keydown-THREE", () => this.select("healer"));
    kb.on("keydown-FOUR", () => this.select("mage"));
  }

  private buildCard(x: number, y: number, w: number, h: number, id: CharacterId, keyNum: number): void {
    const def = CHARACTERS[id];

    const panel = createPanel(this, x, y, w, h, { borderColor: 0x4fd1c5, depth: 1 });
    const hitArea = this.add
      .rectangle(x, y, w, h, 0xffffff, 0.0001)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);
    hitArea.on("pointerdown", () => this.select(id));
    hitArea.on("pointerover", () => panel.bg.setStrokeStyle(3, 0xffd700));
    hitArea.on("pointerout", () => panel.bg.setStrokeStyle(2, 0x4fd1c5));

    const portraitY = y - h / 2 + 64;
    const sprite = this.add
      .sprite(x, portraitY, CHARACTER_SPRITES[id].idle.key)
      .setScale(PORTRAIT_SCALE)
      .setDepth(2);
    sprite.play(CHARACTER_SPRITES[id].idle.key);

    const lines = [
      `[${keyNum}] ${def.name}`,
      def.role,
      "",
      `HP: ${def.hp}`,
      `Damage: ${def.damage}`,
      `Speed: ${def.speed}`,
      `Defense: ${this.defenseLabel(def.defenseReduction)}`,
      "",
      `Skill: ${def.skillName}`,
      `Cooldown: ${(def.skillCooldownMs / 1000).toFixed(0)}s`,
    ];

    this.add
      .text(x, y - h / 2 + 118, lines.join("\n"), { ...bodyStyle(14), align: "center", lineSpacing: 6 })
      .setOrigin(0.5, 0)
      .setDepth(2);
  }

  private defenseLabel(reduction: number): string {
    if (reduction >= 0.3) return "High";
    if (reduction >= 0.15) return "Medium";
    return "Low";
  }

  private select(id: CharacterId): void {
    this.cameras.main.fadeOut(180, 10, 10, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("GameScene", { characterId: id, floor: 1, stage: 1 });
    });
  }
}
