export interface RockAsset {
  key: string;
  path: string;
}

const ROCKS = "/assets/rocks_2d_assets";

/**
 * Irregular jagged rock-clump cutouts (transparent background, wildly varying native size) used
 * to paint an overlapping decorative border along wall boundaries — see dungeon/rockBorder.ts.
 * Collision stays on the invisible 32px wall grid built alongside them (Room.buildWalls /
 * Dungeon.createConnection); these are visual only, so their native size is what's rendered.
 */
export const ROCK_ASSETS: RockAsset[] = [
  { key: "rock-a01", path: `${ROCKS}/rock_A01.png` },
  { key: "rock-a03", path: `${ROCKS}/rock_A03.png` },
  { key: "rock-a05", path: `${ROCKS}/rock_A05.png` },
  { key: "rock-a06", path: `${ROCKS}/rock_A06.png` },
  { key: "rock-a07", path: `${ROCKS}/rock_A07.png` },
  { key: "rock-a08", path: `${ROCKS}/rock_A08.png` },
  { key: "rock-a09", path: `${ROCKS}/rock_A09.png` },
  { key: "rock-a12", path: `${ROCKS}/rock_A12.png` },
  { key: "rock-a13", path: `${ROCKS}/rock_A13.png` },
  { key: "rock-a14", path: `${ROCKS}/rock_A14.png` },
  { key: "rock-a18", path: `${ROCKS}/rock_A18.png` },
  { key: "rock-a19", path: `${ROCKS}/rock_A19.png` },
  { key: "rock-a25", path: `${ROCKS}/rock_A25.png` },
  { key: "rock-b01", path: `${ROCKS}/rock_B01.png` },
  { key: "rock-b04", path: `${ROCKS}/rock_B04.png` },
  { key: "rock-b13", path: `${ROCKS}/rock_B13.png` },
];
