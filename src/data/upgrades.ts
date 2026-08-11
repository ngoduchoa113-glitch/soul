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

export type UpgradeRarity = "common" | "rare" | "epic";

/** Display label + color per rarity tier — shared by the card border, rarity chip, and detail panel. */
export const RARITY_LABEL: Record<UpgradeRarity, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
};

export const RARITY_COLOR: Record<UpgradeRarity, number> = {
  common: 0x9ca3af,
  rare: 0x60a5fa,
  epic: 0xc084fc,
};

export const RARITY_COLOR_HEX: Record<UpgradeRarity, string> = {
  common: "#9ca3af",
  rare: "#60a5fa",
  epic: "#c084fc",
};

export interface UpgradeDef {
  id: UpgradeId;
  /** Emoji fallback — unused by the card UI (which draws a procedural icon texture) but kept as a plain-text stand-in for anywhere upgrades are logged as text. */
  icon: string;
  name: string;
  /** Short line shown directly on the card. */
  description: string;
  /** Longer explanation shown in the hover detail panel. */
  detail: string;
  /** Italic flavor line, detail panel only. */
  flavor: string;
  rarity: UpgradeRarity;
  /** Stat name paired with the live before → after values computed by Player.previewUpgradeEffect. */
  statLabel: string;
  /** Compact "+25"-style value printed on the card itself. */
  statValue: string;
}

// Every power is a one-time pick — once chosen it's crossed off the pool for the rest of the
// run and never offered again, so each of the 3 options at a stage transition is a real choice.
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  maxHp: {
    id: "maxHp",
    icon: "❤️",
    name: "Max HP",
    description: "+25 max HP",
    detail: "Permanently increases your maximum health pool, letting you survive bigger hits and outlast longer fights.",
    flavor: '"A stronger heart beats through more scars."',
    rarity: "common",
    statLabel: "Max HP",
    statValue: "+25",
  },
  emergencyShield: {
    id: "emergencyShield",
    icon: "💥",
    name: "Emergency Shield",
    description: "Negate a near-death or heavy hit; recharges over time",
    detail:
      "Grants a shield charge that automatically blocks the next hit that would drop you to critical health or land unusually hard. Recharges passively after use.",
    flavor: '"Even the boldest knight needs a second chance."',
    rarity: "epic",
    statLabel: "Shield Charges",
    statValue: "+1",
  },
  lifeHarvest: {
    id: "lifeHarvest",
    icon: "🩸",
    name: "Life Harvest",
    description: "Enemies may drop an HP orb",
    detail: "Every fallen enemy has a chance to leave behind a healing orb, letting you sustain through longer fights.",
    flavor: '"Their strength becomes your resolve."',
    rarity: "rare",
    statLabel: "HP Orb Chance",
    statValue: "+15%",
  },
  energyHarvest: {
    id: "energyHarvest",
    icon: "⚡",
    name: "Energy Harvest",
    description: "Enemies drop more Energy orbs",
    detail: "Increases both the chance and potency of Energy orb drops from slain enemies, keeping your skill meter topped up.",
    flavor: '"Death feeds the flame of magic."',
    rarity: "rare",
    statLabel: "Energy Orb Chance",
    statValue: "+15%",
  },
  accuracyBuff: {
    id: "accuracyBuff",
    icon: "🎯",
    name: "Accuracy Buff",
    description: "Tighter spread + more critical chance",
    detail: "Narrows your weapon's bullet spread for more consistent hits and raises your critical strike chance.",
    flavor: '"Breathe. Aim. One shot, one kill."',
    rarity: "rare",
    statLabel: "Bullet Spread",
    statValue: "-20%",
  },
  fireRateBuff: {
    id: "fireRateBuff",
    icon: "⚡",
    name: "Fire Rate Buff",
    description: "+15% attack speed",
    detail: "Permanently increases the fire rate of every weapon you wield.",
    flavor: '"Speed is its own kind of power."',
    rarity: "common",
    statLabel: "Attack Speed",
    statValue: "+15%",
  },
  bounceBuff: {
    id: "bounceBuff",
    icon: "🌀",
    name: "Bounce Buff",
    description: "Bullets bounce off a wall once",
    detail: "Your projectiles ricochet off the first wall they strike, letting you hit targets around corners or down a hallway twice.",
    flavor: '"Nothing here goes to waste — not even a missed shot."',
    rarity: "rare",
    statLabel: "Wall Bounces",
    statValue: "+1",
  },
  pierceBuff: {
    id: "pierceBuff",
    icon: "🧲",
    name: "Pierce Buff",
    description: "Bullets pierce one more enemy",
    detail: "Your projectiles punch through one additional enemy before losing momentum, rewarding good positioning against groups.",
    flavor: '"Why stop at one, when a line of them awaits?"',
    rarity: "rare",
    statLabel: "Pierce Count",
    statValue: "+1",
  },
  shotgunBuff: {
    id: "shotgunBuff",
    icon: "💥",
    name: "Shotgun Buff",
    description: "+1 pellet to every multi-shot weapon or skill",
    detail: "Adds an extra pellet to every weapon and skill that already fires multiple projectiles at once.",
    flavor: '"More lead in the air means more bodies on the ground."',
    rarity: "rare",
    statLabel: "Bonus Pellets",
    statValue: "+1",
  },
  laserBuff: {
    id: "laserBuff",
    icon: "🔥",
    name: "Laser Buff",
    description: "Wider, more damaging laser beams",
    detail: "Widens the hitbox of every laser beam you fire and increases the damage they deal.",
    flavor: '"Light given enough fury becomes a blade."',
    rarity: "rare",
    statLabel: "Laser Width",
    statValue: "+30%",
  },
  splitShot: {
    id: "splitShot",
    icon: "🔫",
    name: "Split Shot",
    description: "Chance to fire an extra bullet",
    detail: "Each shot has a chance to split into an additional bullet, fired alongside the original for free extra damage.",
    flavor: '"One trigger pull, two promises kept."',
    rarity: "epic",
    statLabel: "Split Chance",
    statValue: "+20%",
  },
  critBuff: {
    id: "critBuff",
    icon: "💀",
    name: "Crit Buff",
    description: "+8% critical chance",
    detail: "Permanently increases your chance to land a critical hit for bonus damage.",
    flavor: '"Some blows are meant to end the fight."',
    rarity: "rare",
    statLabel: "Crit Chance",
    statValue: "+8%",
  },
  piercingCrit: {
    id: "piercingCrit",
    icon: "⚔️",
    name: "Piercing Crit",
    description: "Critical hits pierce through enemies",
    detail: "Any critical hit punches clean through its target and keeps traveling, chaining into whatever stands behind it.",
    flavor: '"A killing blow shouldn\'t stop at just one."',
    rarity: "epic",
    statLabel: "Piercing Crits",
    statValue: "Unlock",
  },
  meleeRangeBuff: {
    id: "meleeRangeBuff",
    icon: "⚔️",
    name: "Melee Range Buff",
    description: "+15% melee & unarmed range",
    detail: "Extends the reach of your melee weapons and unarmed strikes, letting you tag enemies before they close the distance.",
    flavor: '"An extra inch of steel is an extra second of life."',
    rarity: "common",
    statLabel: "Melee Range",
    statValue: "+15%",
  },
  maxEnergy: {
    id: "maxEnergy",
    icon: "🔋",
    name: "Max Energy",
    description: "+20 max energy",
    detail: "Permanently raises your maximum Energy pool, letting you cast skills more often before running dry.",
    flavor: '"A deeper well never runs dry mid-fight."',
    rarity: "common",
    statLabel: "Max Energy",
    statValue: "+20",
  },
  energyOrbBuff: {
    id: "energyOrbBuff",
    icon: "💙",
    name: "Energy Orb Buff",
    description: "Energy orbs restore more energy",
    detail: "Every Energy orb you collect restores a larger share of your Energy pool.",
    flavor: '"Waste not a single spark."',
    rarity: "common",
    statLabel: "Orb Value",
    statValue: "+25%",
  },
  cooldownBuff: {
    id: "cooldownBuff",
    icon: "⏱️",
    name: "Cooldown Buff",
    description: "-12% skill cooldown",
    detail: "Reduces the cooldown on your class skill, letting you unleash it more often over the course of a run.",
    flavor: '"Time bends for those who refuse to wait."',
    rarity: "common",
    statLabel: "Skill Cooldown",
    statValue: "-12%",
  },
  onSale: {
    id: "onSale",
    icon: "🏷️",
    name: "On Sale",
    description: "-15% shop prices",
    detail: "Every item in dungeon shops costs less for the rest of the run, stretching your coin purse further.",
    flavor: '"Everything has a price — yours is just a little lower."',
    rarity: "common",
    statLabel: "Shop Prices",
    statValue: "-15%",
  },
  meleeReflect: {
    id: "meleeReflect",
    icon: "⚔️",
    name: "Melee Reflect",
    description: "Chance to reflect enemy bullets while a melee weapon is in hand",
    detail: "While wielding a melee weapon, incoming enemy projectiles have a chance to be deflected back at their source instead of hitting you.",
    flavor: '"Steel remembers every insult — and returns it."',
    rarity: "epic",
    statLabel: "Reflect Chance",
    statValue: "+25%",
  },
};

/** Live "previous value → new value" for one upgrade, computed by Player.previewUpgradeEffect against its current stats. */
export interface UpgradeEffectPreview {
  statLabel: string;
  before: string;
  after: string;
}

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
