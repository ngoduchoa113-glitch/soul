import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "../data/characters";

const ORDER: CharacterId[] = ["knight", "samurai", "healer", "mage"];

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super("CharacterSelectScene");
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 60, "DUNGEON SOUL", { fontSize: "36px", color: "#4fd1c5", fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, 108, "Choose Your Character", { fontSize: "18px", color: "#ffffff" })
      .setOrigin(0.5);

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

    const bg = this.add
      .rectangle(x, y, w, h, 0x1c1c26, 0.9)
      .setStrokeStyle(2, 0x4fd1c5)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.select(id));
    bg.on("pointerover", () => bg.setStrokeStyle(3, 0xffd700));
    bg.on("pointerout", () => bg.setStrokeStyle(2, 0x4fd1c5));

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
      .text(x, y - h / 2 + 16, lines.join("\n"), {
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
  }

  private defenseLabel(reduction: number): string {
    if (reduction >= 0.3) return "High";
    if (reduction >= 0.15) return "Medium";
    return "Low";
  }

  private select(id: CharacterId): void {
    this.scene.start("GameScene", { characterId: id, floor: 1, stage: 1 });
  }
}
