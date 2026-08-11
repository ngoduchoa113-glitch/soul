import type Phaser from "phaser";

/** Chunky display font for short titles/banners (loaded via Google Fonts link in index.html). */
export const FONT_DISPLAY = '"Press Start 2P", monospace';
/** Compact pixel font for everything else — body text, labels, stat blocks. */
export const FONT_BODY = '"VT323", monospace';

export const COLOR = {
  text: "#f4f1ea",
  dim: "#9a95a8",
  accent: "#4fd1c5",
  gold: "#ffd700",
  danger: "#ff5a5a",
  hp: "#e25555",
  energy: "#60a5fa",
} as const;

/** Same palette as `COLOR`, as 0xRRGGBB numbers — for Rectangle fills/strokes and sprite tints, which Phaser takes as numbers rather than CSS color strings. */
export const COLOR_NUM = {
  text: 0xf4f1ea,
  dim: 0x9a95a8,
  accent: 0x4fd1c5,
  gold: 0xffd700,
  danger: 0xff5a5a,
  hp: 0xe25555,
  energy: 0x60a5fa,
} as const;

/**
 * Text objects rendered under a zoomed camera (GameScene's HUD/menus, see CAMERA_ZOOM in
 * GameScene.ts) need a higher backing resolution or they rasterize at their small logical font
 * size and then get blown up blurry by the zoom. Screens with an unzoomed camera (menus outside
 * a run) don't need this, but setting it everywhere is harmless.
 */
const RESOLUTION = 3;

function style(overrides: Phaser.Types.GameObjects.Text.TextStyle): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_BODY, color: COLOR.text, resolution: RESOLUTION, ...overrides };
}

/** Screen/section titles — "DUNGEON SOUL", "PAUSED", "Choose a Power". Always FONT_DISPLAY. */
export function titleStyle(fontSize: number, color: string = COLOR.text): Phaser.Types.GameObjects.Text.TextStyle {
  return style({ fontFamily: FONT_DISPLAY, fontSize: `${fontSize}px`, color });
}

/** Regular readable text — stat blocks, dialogue, controls list. */
export function bodyStyle(fontSize: number, color: string = COLOR.text): Phaser.Types.GameObjects.Text.TextStyle {
  return style({ fontSize: `${fontSize}px`, color });
}

/** Small caption/label text — bar labels, hints. */
export function labelStyle(fontSize: number, color: string = COLOR.dim): Phaser.Types.GameObjects.Text.TextStyle {
  return style({ fontSize: `${fontSize}px`, color });
}
