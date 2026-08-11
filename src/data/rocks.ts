export interface RockAsset {
  key: string;
  path: string;
}

const ROCKS = "/assets/rocks_2d_assets";

/**
 * Rock-clump cutouts (transparent background) used to paint an overlapping decorative border
 * along wall boundaries — see dungeon/rockBorder.ts. Collision stays on the invisible 32px wall
 * grid built alongside them (Room.buildWalls / Dungeon.createConnection); these are visual only.
 */
export const ROCK_ASSETS: RockAsset[] = [
  { key: "rock-a03", path: `${ROCKS}/rock_A03.png` },
  { key: "rock-a04", path: `${ROCKS}/rock_A04.png` },
];
