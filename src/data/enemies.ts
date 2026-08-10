export type EnemyBehavior = "melee" | "ranged" | "bomber";

export interface EnemyDef {
  id: string;
  name: string;
  behavior: EnemyBehavior;
  hp: number;
  speed: number;
  damage: number;
  detectRadius: number;
  attackRadius: number;
  attackCooldownMs: number;
  projectileSpeed: number;
  preferredRange: number;
  fuseMs: number;
  explodeRadius: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  melee: {
    id: "melee",
    name: "Melee",
    behavior: "melee",
    hp: 40,
    speed: 110,
    damage: 10,
    detectRadius: 220,
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
    detectRadius: 260,
    attackRadius: 0,
    attackCooldownMs: 1200,
    projectileSpeed: 350,
    preferredRange: 180,
    fuseMs: 0,
    explodeRadius: 0,
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    behavior: "bomber",
    hp: 25,
    speed: 140,
    damage: 30,
    detectRadius: 200,
    attackRadius: 40,
    attackCooldownMs: 0,
    projectileSpeed: 0,
    preferredRange: 0,
    fuseMs: 900,
    explodeRadius: 70,
  },
};

export function scaleEnemyDef(def: EnemyDef, hpMult: number, dmgMult: number): EnemyDef {
  return {
    ...def,
    hp: Math.round(def.hp * hpMult),
    damage: Math.round(def.damage * dmgMult),
  };
}
