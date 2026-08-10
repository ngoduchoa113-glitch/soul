export type CharacterId = "knight" | "samurai" | "healer" | "mage";
export type SkillId = "dashSlash" | "fireNova" | "healPulse";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  role: string;
  hp: number;
  damage: number;
  speed: number;
  defenseReduction: number;
  maxEnergy: number;
  skillId: SkillId;
  skillName: string;
  skillCooldownMs: number;

  // Knight/Samurai — Dash Slash (Shield Charge / Iaijutsu Strike)
  dashSpeed?: number;
  dashDurationMs?: number;
  dashHitRadius?: number;

  // Knight — Shield Charge defense buff
  shieldBonus?: number;
  shieldDurationMs?: number;

  // Mage — Fire Nova
  novaRadius?: number;

  // Healer — Heal Pulse
  healAmount?: number;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  knight: {
    id: "knight",
    name: "Knight",
    role: "Tank / Melee",
    hp: 150,
    damage: 20,
    speed: 180,
    defenseReduction: 0.3,
    maxEnergy: 100,
    skillId: "dashSlash",
    skillName: "Shield Charge",
    skillCooldownMs: 8000,
    dashSpeed: 600,
    dashDurationMs: 260,
    dashHitRadius: 55,
    shieldBonus: 0.25,
    shieldDurationMs: 2500,
  },
  samurai: {
    id: "samurai",
    name: "Samurai",
    role: "Melee DPS / Burst",
    hp: 90,
    damage: 32,
    speed: 210,
    defenseReduction: 0.05,
    maxEnergy: 100,
    skillId: "dashSlash",
    skillName: "Iaijutsu Strike",
    skillCooldownMs: 5500,
    dashSpeed: 850,
    dashDurationMs: 140,
    dashHitRadius: 30,
  },
  mage: {
    id: "mage",
    name: "Mage",
    role: "Area Damage / Crowd Control",
    hp: 80,
    damage: 35,
    speed: 175,
    defenseReduction: 0,
    maxEnergy: 100,
    skillId: "fireNova",
    skillName: "Fire Nova",
    skillCooldownMs: 12000,
    novaRadius: 130,
  },
  healer: {
    id: "healer",
    name: "Healer",
    role: "Support",
    hp: 110,
    damage: 15,
    speed: 190,
    defenseReduction: 0.15,
    maxEnergy: 100,
    skillId: "healPulse",
    skillName: "Heal Pulse",
    skillCooldownMs: 15000,
    healAmount: 40,
  },
};
