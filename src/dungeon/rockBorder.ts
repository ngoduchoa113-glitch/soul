import Phaser from "phaser";
import { ROCK_ASSETS } from "../data/rocks";

/** Same tier as scattered ground decor (Room.scatterDecor) — above the floor, below pickups/entities. */
const ROCK_BORDER_DEPTH = 1;

/** How far a rock is allowed to drift from the wall cell it's anchored to, so the border doesn't look like a perfectly straight row of stamps. */
const JITTER = 5;

const ROCK_KEYS = ROCK_ASSETS.map((rock) => rock.key);

/**
 * Drops one randomly-picked rock-clump image centered on an invisible 32px wall/collision cell
 * (called alongside each cell Room.buildWalls / Dungeon.createConnection build) — purely visual,
 * no physics body of its own. The source images are much bigger than one 32px cell, so consecutive
 * cells' rocks overlap and read as one continuous jagged ridge instead of a chain of small blobs
 * with gaps between them.
 *
 * The source art is drawn as a horizontal ridge (tall jagged spikes reading left-to-right) — that's
 * correct as-is for a west<->east running wall (`vertical: false`, north/south room walls and
 * horizontal-corridor flanks), but a north<->south running wall (`vertical: true`, west/east room
 * walls and vertical-corridor flanks) needs it rotated 90deg so the ridge runs along the wall
 * instead of sideways across it.
 */
export function paintRockCell(scene: Phaser.Scene, x: number, y: number, vertical: boolean): void {
  if (ROCK_KEYS.length === 0) return;
  const key = Phaser.Math.RND.pick(ROCK_KEYS);
  const jx = Phaser.Math.RND.between(-JITTER, JITTER);
  const jy = Phaser.Math.RND.between(-JITTER, JITTER);
  const image = scene.add.image(x + jx, y + jy, key).setDepth(ROCK_BORDER_DEPTH);
  if (vertical) image.setAngle(90);
}
