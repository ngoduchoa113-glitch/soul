export interface DecorAsset {
  key: string;
  path: string;
  /** Uniform display size in px — purely visual clutter, no physics body. */
  size: number;
}

const UNDEAD = "/assets/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately";
const CURSED = "/assets/craftpix-net-958568-free-cursed-land-top-down-pixel-art-tileset/PNG/Objects_separetely";

/** Non-colliding ground clutter scattered in combat rooms for atmosphere. */
export const DECOR_ASSETS: DecorAsset[] = [
  { key: "decor-grave-1", path: `${UNDEAD}/Grave_shadow1_1.png`, size: 28 },
  { key: "decor-grave-2", path: `${UNDEAD}/Grave_shadow1_5.png`, size: 28 },
  { key: "decor-skulls", path: `${UNDEAD}/Pile_sculls_shadow1.png`, size: 36 },
  { key: "decor-crystal", path: `${UNDEAD}/Crystal_shadow2_1.png`, size: 30 },
  { key: "decor-thorns", path: `${UNDEAD}/Thorn_plant_shadow1_1.png`, size: 40 },
  { key: "decor-bones", path: `${CURSED}/Bones_shadow1_1.png`, size: 34 },
  { key: "decor-eye-plant", path: `${CURSED}/Eye_plant_shadow1_1.png`, size: 26 },
  { key: "decor-pustules", path: `${CURSED}/Pustules_shadow1_1.png`, size: 26 },
  { key: "decor-veins", path: `${CURSED}/Veins_shadow1_1.png`, size: 44 },
];

export interface ObstacleAsset {
  key: string;
  path: string;
  /** Display width/height in px (1 tile = 32px). */
  width: number;
  height: number;
}

/** Small (1-tile) blocking props — combined into little multi-cell formations, see Room.placeObstacleCluster. */
export const OBSTACLE_CLUSTER_ASSETS: ObstacleAsset[] = [
  { key: "obstacle-rock", path: `${UNDEAD}/Rock_shadow1_1.png`, width: 32, height: 32 },
  { key: "obstacle-ruins", path: `${UNDEAD}/Ruin_shadow1_1.png`, width: 36, height: 36 },
];

/** Large standalone props (trees) — placed as a single 2x2 or ~1x2-tile sprite, noticeably bigger than the 1-tile rocks/ruins. */
export const OBSTACLE_TREE_ASSETS: ObstacleAsset[] = [
  { key: "obstacle-tree-big", path: `${UNDEAD}/Dead_tree_shadow1_1.png`, width: 64, height: 64 },
  { key: "obstacle-tree-tall", path: `${UNDEAD}/Dead_tree_shadow1_2.png`, width: 40, height: 64 },
];
