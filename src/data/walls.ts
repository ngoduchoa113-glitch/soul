import type { Direction } from "../dungeon/Room";

export interface WallAsset {
  key: string;
  path: string;
}

const WALLS = "/assets/walls_2d_assets";

/**
 * Direction-aligned wall strip art — each image's brick band sits flush against one edge of its
 * square canvas (top/bottom/left/right) so it can be tiled along a wall run with the band lined up
 * on the actual boundary. Keyed by the same Direction used for room sides/doors: the wall a player
 * sees on their right is the room's "east" side, painted with wall_right.png, and so on.
 */
export const WALL_ASSETS: Record<Direction, WallAsset> = {
  north: { key: "wall-art-north", path: `${WALLS}/wall_top.png` },
  south: { key: "wall-art-south", path: `${WALLS}/wall_bottom.png` },
  west: { key: "wall-art-west", path: `${WALLS}/wall_left.png` },
  east: { key: "wall-art-east", path: `${WALLS}/wall_right.png` },
};
