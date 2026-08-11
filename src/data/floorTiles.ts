export interface FloorTileAsset {
  key: string;
  path: string;
}

const FLOOR_TILES = "/assets/floor_tiles_2d_assets";

/** Seamless 16x16 stone floor variants — randomly picked per 32px cell when baking the floor supertile (see tileTextures.generateFloorSupertileFromArt). */
export const FLOOR_TILE_ASSETS: FloorTileAsset[] = [
  { key: "floor-tile-1", path: `${FLOOR_TILES}/floor_tile_01.png` },
  { key: "floor-tile-2", path: `${FLOOR_TILES}/floor_tile_02.png` },
  { key: "floor-tile-3", path: `${FLOOR_TILES}/floor_tile_03.png` },
  { key: "floor-tile-4", path: `${FLOOR_TILES}/floor_tile_04.png` },
  { key: "floor-tile-5", path: `${FLOOR_TILES}/floor_tile_05.png` },
  { key: "floor-tile-6", path: `${FLOOR_TILES}/floor_tile_06.png` },
  { key: "floor-tile-7", path: `${FLOOR_TILES}/floor_tile_07.png` },
];
