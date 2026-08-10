export type BossPattern = "normal" | "dash" | "projectile" | "aoe" | "summon";

export interface BossDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  detectRadius: number;
  meleeRange: number;
  dashSpeed: number;
  dashTelegraphMs: number;
  dashDurationMs: number;
  projectileCount: number;
  projectileSpeed: number;
  aoeRadius: number;
  aoeTelegraphMs: number;
  summonCount: number;
  patternCooldownMs: number;
}

export const BOSS_DEFS: Record<string, BossDef> = {
  guardian: {
    id: "guardian",
    name: "Dungeon Guardian",
    hp: 500,
    damage: 20,
    speed: 100,
    detectRadius: 400,
    meleeRange: 55,
    dashSpeed: 480,
    dashTelegraphMs: 350,
    dashDurationMs: 400,
    projectileCount: 3,
    projectileSpeed: 380,
    aoeRadius: 90,
    aoeTelegraphMs: 700,
    summonCount: 2,
    patternCooldownMs: 1400,
  },
};
