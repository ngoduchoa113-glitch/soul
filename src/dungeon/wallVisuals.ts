import Phaser from "phaser";
import { WALL_ASSETS } from "../data/walls";
import type { Direction } from "./Room";
import { GAP_INDICES } from "./Door";

/** Same tier as scattered ground decor (Room.scatterDecor) — above the floor, below pickups/entities. */
const WALL_VISUAL_DEPTH = 1;

const STRIP_KEYS: Record<Direction, string> = {
  north: "wall-strip-north",
  south: "wall-strip-south",
  west: "wall-strip-west",
  east: "wall-strip-east",
};

/** Visible thickness (px) of each cropped strip — populated by prepareWallStrips before any wall is painted. */
const stripThickness: Partial<Record<Direction, number>> = {};

/**
 * Finds the tight bounding box of non-transparent pixels in a canvas. The raw wall_top/bottom/
 * left/right art is an 80x80 canvas with the actual brick band inset from the edges (e.g. wall_left's
 * brick column only spans rows 16-63 of the 80-tall canvas) — tiling the raw 80x80 image directly
 * repeats that inset as a periodic gap. Cropping to this box first gives a texture that's *all*
 * content, so tiling it has no seams.
 */
function opaqueBounds(ctx: CanvasRenderingContext2D, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

/**
 * Crops each loaded wall_top/bottom/left/right image down to just its opaque brick band and
 * registers the result under STRIP_KEYS — call once from a scene's `create()` (after BootScene's
 * preload has loaded WALL_ASSETS), before any Room/Dungeon wall is painted. See opaqueBounds for why
 * the raw art can't be tiled as-is.
 */
export function prepareWallStrips(scene: Phaser.Scene): void {
  for (const direction of Object.keys(WALL_ASSETS) as Direction[]) {
    const source = scene.textures.get(WALL_ASSETS[direction].key).getSourceImage() as HTMLImageElement;

    const probe = document.createElement("canvas");
    probe.width = source.width;
    probe.height = source.height;
    const probeCtx = probe.getContext("2d")!;
    probeCtx.drawImage(source, 0, 0);
    const { sx, sy, sw, sh } = opaqueBounds(probeCtx, source.width, source.height);

    const canvasTexture = scene.textures.createCanvas(STRIP_KEYS[direction], sw, sh);
    if (!canvasTexture) continue;
    const ctx = canvasTexture.context;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    canvasTexture.refresh();

    stripThickness[direction] = direction === "north" || direction === "south" ? sh : sw;
  }
}

/**
 * Draws one continuous wall strip along a room/corridor edge using the correctly-oriented, cropped
 * aligned art (see prepareWallStrips) for `direction` — a single tileSprite instead of per-cell
 * stamps. Collision stays on the invisible 32px cells built alongside this (Room.buildWalls /
 * Dungeon.createConnection); this is visual only.
 *
 * `runStart`/`runLength` run along the wall (x for north/south, y for west/east); `boundary` is the
 * world coordinate of the wall's *inner* edge — the side facing the floor (rect.y+TILE for a room's
 * north wall, rect.y+height-TILE for south, etc; y0/y1/x0/x1 for a corridor flank). The art's brick
 * band sits flush against that edge and extends outward (away from the floor) by its own thickness.
 * It must be the inner edge, not the outer one: a room's floor backstops the whole 32px collision
 * cell either way, but a corridor flank only has floor on the inner side — flushing to the outer
 * edge there left a floor-less (black) sliver between the brick and the corridor floor.
 */
export function paintWallStrip(scene: Phaser.Scene, direction: Direction, runStart: number, runLength: number, boundary: number): void {
  if (runLength <= 0) return;
  const key = STRIP_KEYS[direction];
  const thickness = stripThickness[direction] ?? 0;
  let x: number;
  let y: number;
  let w: number;
  let h: number;

  switch (direction) {
    case "north":
      x = runStart;
      y = boundary - thickness;
      w = runLength;
      h = thickness;
      break;
    case "south":
      x = runStart;
      y = boundary;
      w = runLength;
      h = thickness;
      break;
    case "west":
      x = boundary - thickness;
      y = runStart;
      w = thickness;
      h = runLength;
      break;
    case "east":
      x = boundary;
      y = runStart;
      w = thickness;
      h = runLength;
      break;
  }

  scene.add.tileSprite(x, y, w, h, key).setOrigin(0, 0).setDepth(WALL_VISUAL_DEPTH);
}

/**
 * Splits a wall side's cell range [0, totalCells) into contiguous runs, cutting out the door gap
 * (GAP_INDICES) when the side is open to a neighbor — mirrors the per-cell skip in Room.buildWalls
 * so the visual strip never covers a doorway.
 */
export function wallRuns(totalCells: number, isOpen: boolean): [number, number][] {
  if (!isOpen) return [[0, totalCells]];
  const gapStart = GAP_INDICES[0];
  const gapEnd = GAP_INDICES[GAP_INDICES.length - 1] + 1;
  const runs: [number, number][] = [];
  if (gapStart > 0) runs.push([0, gapStart]);
  if (gapEnd < totalCells) runs.push([gapEnd, totalCells]);
  return runs;
}
