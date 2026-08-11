export type CharacterId = "knight" | "samurai" | "healer" | "mage";
export type SkillId = "dashSlash" | "fireBarrage" | "healPulse" | "weaponBoost";

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

  // Samurai — Iaijutsu Strike: dash through enemies, damaging everything on the way
  dashSpeed?: number;
  dashDurationMs?: number;
  dashHitRadius?: number;

  // Mage — Fire Barrage
  fireBarrageCount?: number;

  // Healer — Heal Pulse
  healAmount?: number;

  // Knight — Weapon Overdrive: temporarily doubles attack speed and makes ranged weapons free to fire
  weaponBoostDurationMs?: number;
  weaponBoostMultiplier?: number;
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
    skillId: "weaponBoost",
    skillName: "Weapon Overdrive",
    skillCooldownMs: 10000,
    weaponBoostDurationMs: 6000,
    weaponBoostMultiplier: 2,
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
    skillId: "fireBarrage",
    skillName: "Fire Barrage",
    skillCooldownMs: 12000,
    fireBarrageCount: 10,
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
