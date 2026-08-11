export type WeaponCategory = "ranged" | "melee";

/**
 * How the weapon actually resolves damage, layered on top of `category`:
 * - standard: normal projectile (ranged) or arc swing (melee)
 * - laser: instant hitscan beam that pierces every enemy along the line
 * - boomerang: pierces enemies, flies out to `range` then returns to the player
 * - homing: projectile that curves toward the nearest enemy
 * - shockwave: AoE burst centered on the caster (ranged staff or melee hammer slam)
 * - explosive: projectile detonates in `explodeRadius` on impact or expiry
 * - poison / fire: projectile leaves a damage-over-time zone on impact or expiry
 */
export type WeaponBehavior = "standard" | "laser" | "boomerang" | "homing" | "shockwave" | "explosive" | "poison" | "fire";

export interface WeaponDef {
  id: string;
  name: string;
  type: string;
  category: WeaponCategory;
  behavior: WeaponBehavior;
  damage: number;
  fireRateMs: number;
  energyCost: number;
  spreadDeg: number;
  projectileSpeed: number;
  range: number;
  pellets: number;
  criticalChance: number;
  criticalDamage: number;
  rarity: "common" | "rare";
  /** Melee "standard" swing arc, in degrees. Defaults to 100 when omitted. */
  arcDeg?: number;
  /** Blast/burst radius for shockwave, explosive, poison and fire behaviors. */
  explodeRadius?: number;
  /** Per-tick damage for poison/fire damage-over-time zones. */
  dotDamage?: number;
  dotTickMs?: number;
  dotDurationMs?: number;
  /** Turn rate for homing projectiles, in degrees/second. */
  homingTurnRateDegPerSec?: number;
}

export interface WeaponInstance {
  def: WeaponDef;
  lastShotAt: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: {
    id: "pistol",
    name: "Pistol",
    type: "pistol",
    category: "ranged",
    behavior: "standard",
    damage: 15,
    fireRateMs: 220,
    energyCost: 2,
    spreadDeg: 3,
    projectileSpeed: 600,
    range: 400,
    pellets: 1,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    type: "shotgun",
    category: "ranged",
    behavior: "standard",
    damage: 10,
    fireRateMs: 750,
    energyCost: 8,
    spreadDeg: 24,
    projectileSpeed: 550,
    range: 300,
    pellets: 6,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  assaultRifle: {
    id: "assaultRifle",
    name: "Assault Rifle",
    type: "assaultRifle",
    category: "ranged",
    behavior: "standard",
    damage: 12,
    fireRateMs: 100,
    energyCost: 2,
    spreadDeg: 8,
    projectileSpeed: 650,
    range: 500,
    pellets: 1,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  laserGun: {
    id: "laserGun",
    name: "Laser Gun",
    type: "laserGun",
    category: "ranged",
    behavior: "laser",
    damage: 9,
    fireRateMs: 90,
    energyCost: 2,
    spreadDeg: 0,
    projectileSpeed: 900,
    range: 420,
    pellets: 1,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  boomerang: {
    id: "boomerang",
    name: "Boomerang",
    type: "boomerang",
    category: "ranged",
    behavior: "boomerang",
    damage: 16,
    fireRateMs: 520,
    energyCost: 6,
    spreadDeg: 0,
    projectileSpeed: 480,
    range: 260,
    pellets: 1,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  bomb: {
    id: "bomb",
    name: "Bomb Launcher",
    type: "bomb",
    category: "ranged",
    behavior: "explosive",
    damage: 22,
    fireRateMs: 900,
    energyCost: 12,
    spreadDeg: 2,
    projectileSpeed: 380,
    range: 500,
    pellets: 1,
    explodeRadius: 85,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  poisonFlask: {
    id: "poisonFlask",
    name: "Poison Flask",
    type: "poisonFlask",
    category: "ranged",
    behavior: "poison",
    damage: 6,
    fireRateMs: 850,
    energyCost: 10,
    spreadDeg: 3,
    projectileSpeed: 360,
    range: 450,
    pellets: 1,
    explodeRadius: 70,
    dotDamage: 4,
    dotTickMs: 500,
    dotDurationMs: 3000,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  fireBottle: {
    id: "fireBottle",
    name: "Fire Bottle",
    type: "fireBottle",
    category: "ranged",
    behavior: "fire",
    damage: 8,
    fireRateMs: 850,
    energyCost: 10,
    spreadDeg: 3,
    projectileSpeed: 380,
    range: 420,
    pellets: 1,
    explodeRadius: 60,
    dotDamage: 6,
    dotTickMs: 400,
    dotDurationMs: 2400,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  staffShockwave: {
    id: "staffShockwave",
    name: "Staff of Tremors",
    type: "staffShockwave",
    category: "ranged",
    behavior: "shockwave",
    damage: 24,
    fireRateMs: 750,
    energyCost: 14,
    spreadDeg: 0,
    projectileSpeed: 0,
    range: 150,
    pellets: 1,
    explodeRadius: 150,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  staffHoming: {
    id: "staffHoming",
    name: "Staff of Seeking",
    type: "staffHoming",
    category: "ranged",
    behavior: "homing",
    damage: 13,
    fireRateMs: 360,
    energyCost: 7,
    spreadDeg: 0,
    projectileSpeed: 420,
    range: 500,
    pellets: 1,
    homingTurnRateDegPerSec: 260,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  energySword: {
    id: "energySword",
    name: "Energy Sword",
    type: "melee",
    category: "melee",
    behavior: "standard",
    damage: 35,
    fireRateMs: 400,
    energyCost: 0,
    spreadDeg: 0,
    projectileSpeed: 0,
    range: 55,
    pellets: 1,
    arcDeg: 100,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  spear: {
    id: "spear",
    name: "Spear",
    type: "spear",
    category: "melee",
    behavior: "standard",
    damage: 24,
    fireRateMs: 420,
    energyCost: 0,
    spreadDeg: 0,
    projectileSpeed: 0,
    range: 90,
    pellets: 1,
    arcDeg: 36,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  hammer: {
    id: "hammer",
    name: "War Hammer",
    type: "hammer",
    category: "melee",
    behavior: "shockwave",
    damage: 42,
    fireRateMs: 900,
    energyCost: 0,
    spreadDeg: 0,
    projectileSpeed: 0,
    range: 85,
    pellets: 1,
    explodeRadius: 85,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
};

export const ALL_WEAPON_IDS: string[] = Object.keys(WEAPONS);

export function createWeaponInstance(id: string): WeaponInstance {
  const def = WEAPONS[id];
  return createWeaponInstanceFromDef(def);
}

export function createWeaponInstanceFromDef(def: WeaponDef): WeaponInstance {
  return { def, lastShotAt: 0 };
}

/** Placeholder-art texture key for this weapon's icon (ground pickup sprite, HUD) — generated in BootScene. */
export function weaponIconKey(def: WeaponDef): string {
  return `weapon-icon-${def.id}`;
}

export function getWeaponVariant(id: string, rarity: "common" | "rare"): WeaponDef {
  const base = WEAPONS[id];
  if (rarity === "common") {
    return { ...base };
  }
  return {
    ...base,
    rarity: "rare",
    damage: Math.round(base.damage * 1.25),
    energyCost: Math.max(1, Math.round(base.energyCost * 0.85)),
  };
}
