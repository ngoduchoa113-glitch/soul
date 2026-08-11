export type UpgradeId =
  | "maxHp"
  | "emergencyShield"
  | "lifeHarvest"
  | "energyHarvest"
  | "accuracyBuff"
  | "fireRateBuff"
  | "bounceBuff"
  | "pierceBuff"
  | "shotgunBuff"
  | "laserBuff"
  | "splitShot"
  | "critBuff"
  | "piercingCrit"
  | "meleeRangeBuff"
  | "maxEnergy"
  | "energyOrbBuff"
  | "cooldownBuff"
  | "onSale"
  | "meleeReflect";

export interface UpgradeDef {
  id: UpgradeId;
  icon: string;
  name: string;
  description: string;
}

// Every power is a one-time pick — once chosen it's crossed off the pool for the rest of the
// run and never offered again, so each of the 3 options at a stage transition is a real choice.
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  maxHp: { id: "maxHp", icon: "❤️", name: "Max HP", description: "+25 max HP" },
  emergencyShield: {
    id: "emergencyShield",
    icon: "💥",
    name: "Emergency Shield",
    description: "Negate a near-death or heavy hit; recharges over time",
  },
  lifeHarvest: { id: "lifeHarvest", icon: "🩸", name: "Life Harvest", description: "Enemies may drop an HP orb" },
  energyHarvest: { id: "energyHarvest", icon: "⚡", name: "Energy Harvest", description: "Enemies drop more Energy orbs" },
  accuracyBuff: { id: "accuracyBuff", icon: "🎯", name: "Accuracy Buff", description: "Tighter spread + more critical chance" },
  fireRateBuff: { id: "fireRateBuff", icon: "⚡", name: "Fire Rate Buff", description: "+15% attack speed" },
  bounceBuff: { id: "bounceBuff", icon: "🌀", name: "Bounce Buff", description: "Bullets bounce off a wall once" },
  pierceBuff: { id: "pierceBuff", icon: "🧲", name: "Pierce Buff", description: "Bullets pierce one more enemy" },
  shotgunBuff: {
    id: "shotgunBuff",
    icon: "💥",
    name: "Shotgun Buff",
    description: "+1 pellet to every multi-shot weapon or skill",
  },
  laserBuff: { id: "laserBuff", icon: "🔥", name: "Laser Buff", description: "Wider, more damaging laser beams" },
  splitShot: { id: "splitShot", icon: "🔫", name: "Split Shot", description: "Chance to fire an extra bullet" },
  critBuff: { id: "critBuff", icon: "💀", name: "Crit Buff", description: "+8% critical chance" },
  piercingCrit: { id: "piercingCrit", icon: "⚔️", name: "Piercing Crit", description: "Critical hits pierce through enemies" },
  meleeRangeBuff: { id: "meleeRangeBuff", icon: "⚔️", name: "Melee Range Buff", description: "+15% melee & unarmed range" },
  maxEnergy: { id: "maxEnergy", icon: "🔋", name: "Max Energy", description: "+20 max energy" },
  energyOrbBuff: { id: "energyOrbBuff", icon: "💙", name: "Energy Orb Buff", description: "Energy orbs restore more energy" },
  cooldownBuff: { id: "cooldownBuff", icon: "⏱️", name: "Cooldown Buff", description: "-12% skill cooldown" },
  onSale: { id: "onSale", icon: "🏷️", name: "On Sale", description: "-15% shop prices" },
  meleeReflect: {
    id: "meleeReflect",
    icon: "⚔️",
    name: "Melee Reflect",
    description: "Chance to reflect enemy bullets while a melee weapon is in hand",
  },
};

export const ALL_UPGRADE_IDS: UpgradeId[] = Object.keys(UPGRADES) as UpgradeId[];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Rolls up to `count` distinct upgrade choices, excluding anything already picked this run. */
export function pickRandomUpgradeOptions(counts: Partial<Record<UpgradeId, number>>, count: number): UpgradeId[] {
  const pool = ALL_UPGRADE_IDS.filter((id) => (counts[id] ?? 0) === 0);
  return shuffle(pool).slice(0, count);
}
