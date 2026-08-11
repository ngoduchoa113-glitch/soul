export type EnemyBehavior =
  | "melee"
  | "ranged"
  | "bomber"
  | "tank"
  | "fast"
  | "aoeCaster"
  | "summoner"
  | "teleporter"
  | "healer"
  | "buffer"
  | "turret";

/** Ranged bullet shape. "fast"/"slow" are just projectileSpeed tuning — no special-case firing code needed. */
export type ProjectilePattern = "standard" | "fast" | "slow" | "piercing" | "bouncing" | "homing" | "multi";

export type ElementType = "fire" | "poison" | "ice" | "shock";

export interface EnemyDef {
  id: string;
  name: string;
  behavior: EnemyBehavior;
  hp: number;
  speed: number;
  damage: number;
  attackRadius: number;
  attackCooldownMs: number;
  projectileSpeed: number;
  preferredRange: number;
  fuseMs: number;
  explodeRadius: number;

  /** Tank: flat fraction (0-1) of incoming damage ignored, same idea as the player's defenseReduction. */
  defenseReduction?: number;

  /** Ranged: bullet shape. Defaults to "standard". */
  projectilePattern?: ProjectilePattern;
  /** Ranged "multi": pellets fired per volley. */
  pelletCount?: number;
  /** Ranged (on-hit) / aoeCaster (in-zone): status element. */
  element?: ElementType;
  dotDamage?: number;
  dotTickMs?: number;
  dotDurationMs?: number;

  /** aoeCaster: the zone it casts at the player's position. */
  zoneRadius?: number;
  zoneDurationMs?: number;
  zoneTelegraphMs?: number;

  /** Fast: dash gap-closer, used once in range of a stalled chase. */
  dashSpeed?: number;
  dashCooldownMs?: number;
  dashTelegraphMs?: number;
  dashRangeMin?: number;

  /** Summoner: periodically calls in reinforcements. */
  summonCount?: number;
  summonCooldownMs?: number;
  summonRadius?: number;

  /** Teleporter: blinks next to the player and strikes on landing. */
  teleportCooldownMs?: number;
  teleportTelegraphMs?: number;
  teleportRange?: number;

  /** Healer: mends the most wounded ally in range. */
  healAmount?: number;
  healCooldownMs?: number;
  healRadius?: number;

  /** Buffer: pulses a temporary buff onto nearby allies. */
  buffRadius?: number;
  buffDurationMs?: number;
  buffCooldownMs?: number;
  buffDamageMult?: number;
  buffSpeedMult?: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  melee: {
    id: "melee",
    name: "Melee",
    behavior: "melee",
    hp: 40,
    speed: 110,
    damage: 10,
    attackRadius: 32,
    attackCooldownMs: 900,
    projectileSpeed: 0,
    preferredRange: 0,
    fuseMs: 0,
    explodeRadius: 0,
  },
  ranged: {
    id: "ranged",
    name: "Ranged",
    behavior: "ranged",
    hp: 30,
    speed: 90,
    damage: 8,
    attackRadius: 0,
    attackCooldownMs: 1200,
    projectileSpeed: 350,
    preferredRange: 180,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "standard",
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    behavior: "bomber",
    hp: 25,
    speed: 140,
    damage: 30,
    attackRadius: 40,
    attackCooldownMs: 0,
    projectileSpeed: 0,
    preferredRange: 0,
    fuseMs: 900,
    explodeRadius: 70,
  },

  rangedSniper: {
    id: "rangedSniper",
    name: "Sniper",
    behavior: "ranged",
    hp: 26,
    speed: 80,
    damage: 16,
    attackRadius: 0,
    attackCooldownMs: 1700,
    projectileSpeed: 620,
    preferredRange: 260,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "fast",
  },
  rangedBurst: {
    id: "rangedBurst",
    name: "Gunner",
    behavior: "ranged",
    hp: 32,
    speed: 95,
    damage: 6,
    attackRadius: 0,
    attackCooldownMs: 1400,
    projectileSpeed: 380,
    preferredRange: 170,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "multi",
    pelletCount: 4,
  },
  rangedBouncer: {
    id: "rangedBouncer",
    name: "Ricochet",
    behavior: "ranged",
    hp: 28,
    speed: 90,
    damage: 9,
    attackRadius: 0,
    attackCooldownMs: 1300,
    projectileSpeed: 320,
    preferredRange: 190,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "bouncing",
  },
  rangedHomer: {
    id: "rangedHomer",
    name: "Seeker",
    behavior: "ranged",
    hp: 24,
    speed: 85,
    damage: 7,
    attackRadius: 0,
    attackCooldownMs: 1500,
    projectileSpeed: 260,
    preferredRange: 200,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "homing",
  },
  rangedPoison: {
    id: "rangedPoison",
    name: "Blighter",
    behavior: "ranged",
    hp: 26,
    speed: 85,
    damage: 5,
    attackRadius: 0,
    attackCooldownMs: 1400,
    projectileSpeed: 300,
    preferredRange: 180,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "standard",
    element: "poison",
    dotDamage: 3,
    dotTickMs: 600,
    dotDurationMs: 2400,
  },

  tank: {
    id: "tank",
    name: "Tank",
    behavior: "tank",
    hp: 140,
    speed: 60,
    damage: 16,
    attackRadius: 38,
    attackCooldownMs: 1100,
    projectileSpeed: 0,
    preferredRange: 0,
    fuseMs: 0,
    explodeRadius: 0,
    defenseReduction: 0.35,
  },

  fast: {
    id: "fast",
    name: "Fast",
    behavior: "fast",
    hp: 22,
    speed: 190,
    damage: 12,
    attackRadius: 28,
    attackCooldownMs: 700,
    projectileSpeed: 0,
    preferredRange: 0,
    fuseMs: 0,
    explodeRadius: 0,
    dashSpeed: 620,
    dashCooldownMs: 2600,
    dashTelegraphMs: 220,
    dashRangeMin: 90,
  },

  aoeFire: {
    id: "aoeFire",
    name: "Cinder Caster",
    behavior: "aoeCaster",
    hp: 30,
    speed: 85,
    damage: 4,
    attackRadius: 0,
    attackCooldownMs: 2600,
    projectileSpeed: 0,
    preferredRange: 220,
    fuseMs: 0,
    explodeRadius: 0,
    element: "fire",
    zoneRadius: 75,
    zoneDurationMs: 3000,
    zoneTelegraphMs: 550,
    dotDamage: 6,
    dotTickMs: 400,
    dotDurationMs: 2400,
  },
  aoeIce: {
    id: "aoeIce",
    name: "Frost Caster",
    behavior: "aoeCaster",
    hp: 30,
    speed: 85,
    damage: 3,
    attackRadius: 0,
    attackCooldownMs: 2800,
    projectileSpeed: 0,
    preferredRange: 220,
    fuseMs: 0,
    explodeRadius: 0,
    element: "ice",
    zoneRadius: 80,
    zoneDurationMs: 2600,
    zoneTelegraphMs: 550,
    dotDamage: 3,
    dotTickMs: 500,
    dotDurationMs: 2000,
  },
  aoeShock: {
    id: "aoeShock",
    name: "Storm Caster",
    behavior: "aoeCaster",
    hp: 28,
    speed: 90,
    damage: 4,
    attackRadius: 0,
    attackCooldownMs: 3000,
    projectileSpeed: 0,
    preferredRange: 210,
    fuseMs: 0,
    explodeRadius: 0,
    element: "shock",
    zoneRadius: 70,
    zoneDurationMs: 1600,
    zoneTelegraphMs: 450,
    dotDamage: 8,
    dotTickMs: 400,
    dotDurationMs: 1200,
  },

  summoner: {
    id: "summoner",
    name: "Summoner",
    behavior: "summoner",
    hp: 34,
    speed: 75,
    damage: 4,
    attackRadius: 0,
    attackCooldownMs: 0,
    projectileSpeed: 0,
    preferredRange: 240,
    fuseMs: 0,
    explodeRadius: 0,
    summonCount: 2,
    summonCooldownMs: 6000,
    summonRadius: 70,
  },

  teleporter: {
    id: "teleporter",
    name: "Stalker",
    behavior: "teleporter",
    hp: 32,
    speed: 100,
    damage: 14,
    attackRadius: 34,
    attackCooldownMs: 900,
    projectileSpeed: 0,
    preferredRange: 0,
    fuseMs: 0,
    explodeRadius: 0,
    teleportCooldownMs: 3200,
    teleportTelegraphMs: 350,
    teleportRange: 260,
  },

  healer: {
    id: "healer",
    name: "Healer",
    behavior: "healer",
    hp: 30,
    speed: 90,
    damage: 0,
    attackRadius: 0,
    attackCooldownMs: 0,
    projectileSpeed: 0,
    preferredRange: 230,
    fuseMs: 0,
    explodeRadius: 0,
    healAmount: 18,
    healCooldownMs: 3500,
    healRadius: 160,
  },

  buffer: {
    id: "buffer",
    name: "Warlord",
    behavior: "buffer",
    hp: 34,
    speed: 90,
    damage: 0,
    attackRadius: 0,
    attackCooldownMs: 0,
    projectileSpeed: 0,
    preferredRange: 220,
    fuseMs: 0,
    explodeRadius: 0,
    buffRadius: 150,
    buffDurationMs: 4000,
    buffCooldownMs: 6000,
    buffDamageMult: 1.3,
    buffSpeedMult: 1.25,
  },

  turret: {
    id: "turret",
    name: "Turret",
    behavior: "turret",
    hp: 45,
    speed: 0,
    damage: 10,
    attackRadius: 0,
    attackCooldownMs: 1100,
    projectileSpeed: 340,
    preferredRange: 220,
    fuseMs: 0,
    explodeRadius: 0,
    projectilePattern: "standard",
  },
};

/** Regular room spawns roll from every def, including summoner. Things summoners/bosses call in as reinforcements roll from this narrower pool instead, so a summoned summoner can't chain-spawn indefinitely. */
export const SUMMONABLE_ENEMIES: EnemyDef[] = Object.values(ENEMIES).filter((def) => def.behavior !== "summoner");

export function scaleEnemyDef(def: EnemyDef, hpMult: number, dmgMult: number): EnemyDef {
  return {
    ...def,
    hp: Math.round(def.hp * hpMult),
    damage: Math.round(def.damage * dmgMult),
  };
}

/** Shared color per status element — used for zone/bullet tint and VFX (Enemy.ts, GameScene.ts). */
export function elementColor(element?: ElementType): number {
  switch (element) {
    case "fire":
      return 0xff6b35;
    case "poison":
      return 0x4ade80;
    case "ice":
      return 0x7dd3fc;
    case "shock":
      return 0xfacc15;
    default:
      return 0xffffff;
  }
}
