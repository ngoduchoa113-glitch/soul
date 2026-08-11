import Phaser from "phaser";

const TILE = 32;

/**
 * Tiny deterministic PRNG (mulberry32) so a tile's speckle/crack placement is reproducible from
 * its seed instead of true `Math.random()` — lets each floor cell / wall variant look "randomly
 * weathered" without the pattern shifting if textures ever get regenerated.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOOR = {
  base: 0x1c1c26,
  darkSpeck: 0x101016,
  lightSpeck: 0x2a2a35,
  crack: 0x0c0c10,
};

/** Paints one seeded 32x32 floor cell at (ox, oy) — base fill + a handful of hard-edged 1px speckles and an occasional short crack. Kept sparse so it reads as texture, not noise. */
function paintFloorCell(g: Phaser.GameObjects.Graphics, ox: number, oy: number, seed: number): void {
  const rand = seededRandom(seed);
  g.fillStyle(FLOOR.base, 1);
  g.fillRect(ox, oy, TILE, TILE);

  const speckCount = 4 + Math.floor(rand() * 4); // 4-7, deliberately sparse
  for (let i = 0; i < speckCount; i++) {
    const px = ox + Math.floor(rand() * TILE);
    const py = oy + Math.floor(rand() * TILE);
    const light = rand() > 0.5;
    g.fillStyle(light ? FLOOR.lightSpeck : FLOOR.darkSpeck, light ? 0.5 : 0.55);
    g.fillRect(px, py, 1, 1);
  }

  if (rand() < 0.3) {
    const horizontal = rand() > 0.5;
    const len = 2 + Math.floor(rand() * 2);
    const cx = ox + 4 + Math.floor(rand() * (TILE - 8));
    const cy = oy + 4 + Math.floor(rand() * (TILE - 8));
    g.fillStyle(FLOOR.crack, 0.45);
    g.fillRect(cx, cy, horizontal ? len : 1, horizontal ? 1 : len);
  }

  // Hairline seam along two edges — hard-edged, reads as separate flagstones rather than one slab.
  g.fillStyle(0x000000, 0.08);
  g.fillRect(ox, oy, TILE, 1);
  g.fillRect(ox, oy, 1, TILE);
}

const SUPERTILE_CELLS = 8;
const SUPERTILE_SIZE = SUPERTILE_CELLS * TILE;

/**
 * Builds one big seamlessly-repeating "supertile" (8x8 grid of individually-seeded 32px cells)
 * and registers it under `key`. `Room.buildFloor`/`Dungeon.buildCorridorFloor` paint the dungeon
 * floor as a single `tileSprite` referencing one texture key — using a 256px supertile instead of
 * a 32px tile here means the repeat period is 8x larger, so the eye doesn't pick up on the tiling,
 * with zero changes needed to how the floor is placed.
 */
export function generateFloorSupertile(scene: Phaser.Scene, key: string, baseSeed = 1337): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  for (let row = 0; row < SUPERTILE_CELLS; row++) {
    for (let col = 0; col < SUPERTILE_CELLS; col++) {
      paintFloorCell(g, col * TILE, row * TILE, baseSeed + row * SUPERTILE_CELLS + col);
    }
  }
  g.generateTexture(key, SUPERTILE_SIZE, SUPERTILE_SIZE);
  g.destroy();
}

/** Wall texture variants — Room/Dungeon pick randomly from these per tile instead of always using one key, so a run of wall tiles doesn't look like the same stamp repeated. */
export const WALL_KEYS = ["wall-0", "wall-1", "wall-2"];

const WALL = {
  face: 0x3a3a4a,
  highlight: 0x4c4c5e,
  mortar: 0x2c2c38,
  shadowBand: 0x232330,
  baseLine: 0x121218,
};

/**
 * Draws one 32x32 wall tile with real depth cues — a lit top face, brick-course mortar lines, and
 * a darker shadow band along the bottom edge (where it meets the floor) — instead of a flat fill.
 * All hard-edged fillRects, no gradients. `seed` gives each variant its own speckle/joint layout
 * so walls placed side by side (Room.buildWalls picks randomly from the variant set) don't look
 * like the exact same tile stamped repeatedly.
 */
export function generateWallTile(scene: Phaser.Scene, key: string, seed: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rand = seededRandom(seed);

  g.fillStyle(WALL.face, 1);
  g.fillRect(0, 0, TILE, TILE);

  // Brick coursing: two mortar rows splitting the face into three courses, with offset vertical
  // joints per course (alternating like real brickwork) — hard 1px lines only.
  const courseHeight = Math.floor(TILE / 3);
  for (let row = 0; row < 3; row++) {
    const y = row * courseHeight;
    if (row > 0) {
      g.fillStyle(WALL.mortar, 0.6);
      g.fillRect(0, y, TILE, 1);
    }
    const jointOffset = row % 2 === 0 ? 0 : Math.floor(TILE / 4);
    for (let jx = jointOffset; jx < TILE; jx += Math.floor(TILE / 2)) {
      g.fillStyle(WALL.mortar, 0.45);
      g.fillRect(jx, y + 1, 1, courseHeight - 1);
    }
  }

  // Sparse per-tile speckle for weathering — same restrained density as the floor cells.
  const speckCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < speckCount; i++) {
    const px = Math.floor(rand() * TILE);
    const py = 2 + Math.floor(rand() * (TILE - 10));
    g.fillStyle(rand() > 0.5 ? WALL.highlight : WALL.mortar, 0.3);
    g.fillRect(px, py, 1, 1);
  }

  // Top edge: a crisp 1px highlight — the face catching light from above.
  g.fillStyle(WALL.highlight, 1);
  g.fillRect(0, 0, TILE, 1);

  // Bottom band: a darker strip reading as the wall's base/thickness where it meets the floor,
  // plus a near-black hairline right at the seam for a crisp transition.
  g.fillStyle(WALL.shadowBand, 1);
  g.fillRect(0, TILE - 6, TILE, 5);
  g.fillStyle(WALL.baseLine, 1);
  g.fillRect(0, TILE - 1, TILE, 1);

  g.generateTexture(key, TILE, TILE);
  g.destroy();
}

/** Small procedural variation + a hard-edged top highlight / bottom shadow, reusing the wall's bevel language — for door/shop/chest instead of a flat single-color fill. */
export function generateBeveledTile(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  baseColor: number,
  highlightColor: number,
  shadowColor: number,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(baseColor, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(highlightColor, 0.5);
  g.fillRect(0, 0, w, 1);
  g.fillStyle(shadowColor, 0.5);
  g.fillRect(0, h - 1, w, 1);
  g.lineStyle(1, 0x000000, 0.35);
  g.strokeRect(0, 0, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}
