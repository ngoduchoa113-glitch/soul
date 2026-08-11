import Phaser from "phaser";
import { ROCK_ASSETS } from "../data/rocks";

/** Same tier as scattered ground decor (Room.scatterDecor) — above the floor, below pickups/entities. */
const ROCK_BORDER_DEPTH = 1;

/** How far a rock is allowed to drift from the wall cell it's anchored to, so the border doesn't look like a perfectly straight row of stamps. */
const JITTER = 5;

interface RockCandidate {
  key: string;
  w: number;
  h: number;
}

let widePool: RockCandidate[] | null = null;
let tallPool: RockCandidate[] | null = null;

function ensurePools(scene: Phaser.Scene): void {
  if (widePool && tallPool) return;
  const all = ROCK_ASSETS.map(({ key }) => {
    const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    return { key, w: source.width, h: source.height };
  });
  widePool = all.filter((rock) => rock.w >= rock.h);
  tallPool = all.filter((rock) => rock.h > rock.w);
}

/**
 * Drops one randomly-picked rock-clump image centered on an invisible 32px wall/collision cell
 * (called alongside each cell Room.buildWalls / Dungeon.createConnection build) — purely visual,
 * no physics body of its own. `horizontal` picks wide-aspect rocks for a west<->east running wall
 * and tall-aspect ones for a north<->south wall. The source images are much bigger than one 32px
 * cell, so consecutive cells' rocks overlap and read as one continuous jagged ridge instead of a
 * chain of small blobs with gaps between them.
 */
export function paintRockCell(scene: Phaser.Scene, x: number, y: number, horizontal: boolean): void {
  ensurePools(scene);
  const pool = horizontal ? widePool! : tallPool!;
  if (pool.length === 0) return;
  const rock = Phaser.Math.RND.pick(pool);
  const jx = Phaser.Math.RND.between(-JITTER, JITTER);
  const jy = Phaser.Math.RND.between(-JITTER, JITTER);
  scene.add.image(x + jx, y + jy, rock.key).setDepth(ROCK_BORDER_DEPTH);
}
