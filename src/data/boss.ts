export type BossPattern = "normal" | "dash" | "projectile" | "aoe" | "summon" | "barrage" | "spiral" | "blink";

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
  /** "barrage" — a single instantaneous full-circle ring of bullets. */
  barrageCount: number;
  /** "spiral" — several barrage-style rings fired in quick succession, each rotated further, sweeping the whole room. */
  spiralBursts: number;
  spiralBurstIntervalMs: number;
  spiralProjectilesPerBurst: number;
  spiralRotationDeg: number;
  /** "blink" — briefly vanishes, reappears near the player, then fires a barrage on landing. */
  blinkTelegraphMs: number;
  blinkDistance: number;
}

export const BOSS_DEFS: Record<string, BossDef> = {
  guardian: {
    id: "guardian",
    name: "Dungeon Guardian",
    hp: 5500,
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
    patternCooldownMs: 1200,
    barrageCount: 16,
    spiralBursts: 5,
    spiralBurstIntervalMs: 260,
    spiralProjectilesPerBurst: 10,
    spiralRotationDeg: 24,
    blinkTelegraphMs: 300,
    blinkDistance: 180,
  },
  sentinel: {
    id: "sentinel",
    name: "Arcane Sentinel",
    hp: 4200,
    damage: 16,
    speed: 130,
    detectRadius: 420,
    meleeRange: 45,
    dashSpeed: 420,
    dashTelegraphMs: 300,
    dashDurationMs: 320,
    projectileCount: 5,
    projectileSpeed: 420,
    aoeRadius: 100,
    aoeTelegraphMs: 650,
    summonCount: 3,
    patternCooldownMs: 1000,
    barrageCount: 20,
    spiralBursts: 7,
    spiralBurstIntervalMs: 220,
    spiralProjectilesPerBurst: 12,
    spiralRotationDeg: 18,
    blinkTelegraphMs: 260,
    blinkDistance: 220,
  },
};

export function pickRandomBossDef(): BossDef {
  const defs = Object.values(BOSS_DEFS);
  return defs[Math.floor(Math.random() * defs.length)];
}
