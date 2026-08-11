import type { RoomType } from "../data/types";

const TILE = 32;

/**
 * Room dimensions are randomized per room within these bounds (see randomRoomSize), but every
 * room is still anchored to its grid cell's top-left corner (col*COL_PITCH, row*ROW_PITCH) rather
 * than centered — that's what keeps door alignment correct without extra bookkeeping: any two
 * rooms sharing a column always share the same rect.x, and any two sharing a row always share the
 * same rect.y, which is exactly what Dungeon.ts's corridor/door placement assumes. The pitch is
 * sized to the max room dimension so the largest possible room never eats into the corridor gap.
 */
const MIN_ROOM_WIDTH = 640;
const MAX_ROOM_WIDTH = 960;
const MIN_ROOM_HEIGHT = 480;
const MAX_ROOM_HEIGHT = 704;
/** Length (in tiles) of the corridor strip Dungeon.ts builds between two connected rooms. */
export const CORRIDOR_LEN = 4;

const COL_PITCH = MAX_ROOM_WIDTH + CORRIDOR_LEN * TILE;
const ROW_PITCH = MAX_ROOM_HEIGHT + CORRIDOR_LEN * TILE;

export type StageKind = "regular" | "boss" | "trophy";

export interface RoomLayout {
  index: number;
  type: RoomType;
  col: number;
  row: number;
  rect: { x: number; y: number; width: number; height: number };
}

export interface StageEdge {
  a: number;
  b: number;
  /** "h": a/b are east/west neighbors, sharing a vertical boundary. "v": north/south, sharing a horizontal boundary. */
  axis: "h" | "v";
}

export interface StageLayout {
  rooms: RoomLayout[];
  edges: StageEdge[];
}

const FILLER_TYPE_POOL: RoomType[] = ["normal", "normal", "normal", "normal", "elite", "elite", "shop"];

const DIRECTIONS: { dc: number; dr: number; axis: "h" | "v" }[] = [
  { dc: 1, dr: 0, axis: "h" },
  { dc: -1, dr: 0, axis: "h" },
  { dc: 0, dr: 1, axis: "v" },
  { dc: 0, dr: -1, axis: "v" },
];

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cell {
  col: number;
  row: number;
  index: number;
}

/**
 * Random-walk graph generator: starting from the root cell, repeatedly picks an
 * existing cell + an open direction and grows a new neighbor there until the
 * target room count is reached. Always produces a tree (no cycles), so there is
 * always at least one leaf other than the root to designate as the exit gate.
 */
function generateGraph(random: () => number, roomCount: number): { cells: Cell[]; edges: StageEdge[] } {
  const cellMap = new Map<string, Cell>();
  const cells: Cell[] = [];
  const edges: StageEdge[] = [];
  const key = (c: number, r: number) => `${c},${r}`;

  const root: Cell = { col: 0, row: 0, index: 0 };
  cells.push(root);
  cellMap.set(key(0, 0), root);

  let guard = 0;
  while (cells.length < roomCount && guard < roomCount * 40) {
    guard++;
    const from = cells[Math.floor(random() * cells.length)];
    const dir = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
    const nc = from.col + dir.dc;
    const nr = from.row + dir.dr;
    const k = key(nc, nr);
    if (cellMap.has(k)) continue;

    const cell: Cell = { col: nc, row: nr, index: cells.length };
    cells.push(cell);
    cellMap.set(k, cell);
    edges.push({ a: from.index, b: cell.index, axis: dir.axis });
  }

  return { cells, edges };
}

function pickGateIndex(cells: Cell[], edges: StageEdge[]): number {
  const adjacency = new Map<number, number[]>();
  for (const cell of cells) adjacency.set(cell.index, []);
  for (const edge of edges) {
    adjacency.get(edge.a)!.push(edge.b);
    adjacency.get(edge.b)!.push(edge.a);
  }

  const distances = new Map<number, number>([[0, 0]]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const dist = distances.get(current)!;
    for (const next of adjacency.get(current)!) {
      if (distances.has(next)) continue;
      distances.set(next, dist + 1);
      queue.push(next);
    }
  }

  const leaves = cells.filter((c) => c.index !== 0 && adjacency.get(c.index)!.length === 1);
  const pool = leaves.length > 0 ? leaves : cells.filter((c) => c.index !== 0);
  pool.sort((a, b) => (distances.get(b.index) ?? 0) - (distances.get(a.index) ?? 0));
  return pool[0].index;
}

function randomRoomSize(random: () => number): { width: number; height: number } {
  const widthTiles = Math.round((MIN_ROOM_WIDTH + random() * (MAX_ROOM_WIDTH - MIN_ROOM_WIDTH)) / TILE);
  const heightTiles = Math.round((MIN_ROOM_HEIGHT + random() * (MAX_ROOM_HEIGHT - MIN_ROOM_HEIGHT)) / TILE);
  return { width: widthTiles * TILE, height: heightTiles * TILE };
}

function toRoomLayouts(cells: Cell[], types: RoomType[], random: () => number, maxSizeTypes: Set<RoomType> = new Set()): RoomLayout[] {
  const minCol = Math.min(...cells.map((c) => c.col));
  const minRow = Math.min(...cells.map((c) => c.row));

  return cells.map((cell, i) => {
    const col = cell.col - minCol;
    const row = cell.row - minRow;
    const size = maxSizeTypes.has(types[i]) ? { width: MAX_ROOM_WIDTH, height: MAX_ROOM_HEIGHT } : randomRoomSize(random);
    return {
      index: i,
      type: types[i],
      col,
      row,
      rect: { x: col * COL_PITCH, y: row * ROW_PITCH, width: size.width, height: size.height },
    };
  });
}

/**
 * A "regular" stage (X.1-X.4) is a branching mini-map: room 0 is always a safe
 * rest room, one distant leaf room is the exit gate, the rest are randomly typed
 * (mostly monster rooms) — the player only has to clear whatever's on their path
 * to the gate, not every room.
 *
 * A "boss" stage (X.5) is just a rest room directly connected to one boss room.
 * A "trophy" stage is a single standalone room (the run's final reward).
 */
export function generateStageLayout(seed: string, kind: StageKind): StageLayout {
  const random = mulberry32(hashSeed(seed));

  if (kind === "trophy") {
    return {
      rooms: [{ index: 0, type: "trophy", col: 0, row: 0, rect: { x: 0, y: 0, width: MAX_ROOM_WIDTH, height: MAX_ROOM_HEIGHT } }],
      edges: [],
    };
  }

  if (kind === "boss") {
    const cells: Cell[] = [
      { col: 0, row: 0, index: 0 },
      { col: 1, row: 0, index: 1 },
    ];
    const edges: StageEdge[] = [{ a: 0, b: 1, axis: "h" }];
    // Boss rooms always get the max arena size — dense bullet patterns need the room to dodge in.
    return { rooms: toRoomLayouts(cells, ["rest", "boss"], random, new Set<RoomType>(["boss"])), edges };
  }

  const roomCount = 6 + Math.floor(random() * 4);
  const { cells, edges } = generateGraph(random, roomCount);
  const gateIndex = pickGateIndex(cells, edges);

  const types: RoomType[] = cells.map((cell) => {
    if (cell.index === 0) return "rest";
    if (cell.index === gateIndex) return "gate";
    return FILLER_TYPE_POOL[Math.floor(random() * FILLER_TYPE_POOL.length)];
  });

  return { rooms: toRoomLayouts(cells, types, random), edges };
}
