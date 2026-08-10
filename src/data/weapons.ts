export type WeaponCategory = "ranged" | "melee";

export interface WeaponDef {
  id: string;
  name: string;
  type: string;
  category: WeaponCategory;
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
    damage: 15,
    fireRateMs: 220,
    energyCost: 4,
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
    damage: 10,
    fireRateMs: 750,
    energyCost: 14,
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
    damage: 12,
    fireRateMs: 100,
    energyCost: 3,
    spreadDeg: 8,
    projectileSpeed: 650,
    range: 500,
    pellets: 1,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
  energySword: {
    id: "energySword",
    name: "Energy Sword",
    type: "melee",
    category: "melee",
    damage: 35,
    fireRateMs: 400,
    energyCost: 0,
    spreadDeg: 0,
    projectileSpeed: 0,
    range: 55,
    pellets: 1,
    criticalChance: 0,
    criticalDamage: 0,
    rarity: "common",
  },
};

export function createWeaponInstance(id: string): WeaponInstance {
  const def = WEAPONS[id];
  return createWeaponInstanceFromDef(def);
}

export function createWeaponInstanceFromDef(def: WeaponDef): WeaponInstance {
  return { def, lastShotAt: 0 };
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
