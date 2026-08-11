import type { WeaponDef } from "./weapons";

export type WeaponIconShape = "gun" | "beam" | "boomerang" | "bomb" | "flask" | "staff" | "blade" | "hammer";

/** Icon shape + accent color per weapon id — placeholder art, swap for real sprites later. Shared by BootScene (draws the texture) and Player (orients it in-hand). */
export const WEAPON_ICON_SHAPES: Record<string, { shape: WeaponIconShape; color: number }> = {
  pistol: { shape: "gun", color: 0xf6e05e },
  shotgun: { shape: "gun", color: 0xfb923c },
  assaultRifle: { shape: "gun", color: 0x60d3ff },
  laserGun: { shape: "beam", color: 0xff4d6d },
  boomerang: { shape: "boomerang", color: 0x38bdf8 },
  bomb: { shape: "bomb", color: 0xff9f43 },
  poisonFlask: { shape: "flask", color: 0x4ade80 },
  fireBottle: { shape: "flask", color: 0xff6b35 },
  staffShockwave: { shape: "staff", color: 0xa78bfa },
  staffHoming: { shape: "staff", color: 0x60d3ff },
  energySword: { shape: "blade", color: 0x4fd1c5 },
  spear: { shape: "blade", color: 0xe5e7eb },
  hammer: { shape: "hammer", color: 0xd97706 },
};

/** Shapes drawn pointing "up" (business end at the top) in their icon texture, rather than "right". */
const UPWARD_SHAPES: ReadonlySet<WeaponIconShape> = new Set(["flask", "staff", "blade", "hammer"]);

/**
 * Extra rotation (radians) needed so the weapon-in-hand sprite's business end faces the aim
 * direction. Icons drawn pointing right (guns, beams) need none; icons drawn pointing up
 * (staves, blades, flasks) need a quarter turn.
 */
export function weaponHoldRotationOffset(def: WeaponDef): number {
  const shape = WEAPON_ICON_SHAPES[def.id]?.shape ?? "gun";
  return UPWARD_SHAPES.has(shape) ? Math.PI / 2 : 0;
}
