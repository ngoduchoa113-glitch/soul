import type { UpgradeId } from "./upgrades";

export type UpgradeIconShape =
  | "heart"
  | "shield"
  | "droplet"
  | "boltOrb"
  | "target"
  | "clock"
  | "spiral"
  | "pierceArrow"
  | "burst"
  | "flame"
  | "splitBullets"
  | "skull"
  | "gleamBlade"
  | "wideBlade"
  | "battery"
  | "orb"
  | "hourglass"
  | "tag"
  | "bladeShield";

/** Icon shape + accent color per upgrade id — drawn procedurally in BootScene, same convention as WEAPON_ICON_SHAPES. */
export const UPGRADE_ICON_SHAPES: Record<UpgradeId, { shape: UpgradeIconShape; color: number }> = {
  maxHp: { shape: "heart", color: 0xe25555 },
  emergencyShield: { shape: "shield", color: 0x60a5fa },
  lifeHarvest: { shape: "droplet", color: 0xef4444 },
  energyHarvest: { shape: "boltOrb", color: 0x60a5fa },
  accuracyBuff: { shape: "target", color: 0xf6e05e },
  fireRateBuff: { shape: "clock", color: 0xfb923c },
  bounceBuff: { shape: "spiral", color: 0x38bdf8 },
  pierceBuff: { shape: "pierceArrow", color: 0xa78bfa },
  shotgunBuff: { shape: "burst", color: 0xfb923c },
  laserBuff: { shape: "flame", color: 0xff4d6d },
  splitShot: { shape: "splitBullets", color: 0xf6e05e },
  critBuff: { shape: "skull", color: 0xd1d5db },
  piercingCrit: { shape: "gleamBlade", color: 0x4fd1c5 },
  meleeRangeBuff: { shape: "wideBlade", color: 0xe5e7eb },
  maxEnergy: { shape: "battery", color: 0x60a5fa },
  energyOrbBuff: { shape: "orb", color: 0x60a5fa },
  cooldownBuff: { shape: "hourglass", color: 0xa78bfa },
  onSale: { shape: "tag", color: 0xffd700 },
  meleeReflect: { shape: "bladeShield", color: 0x4fd1c5 },
};
