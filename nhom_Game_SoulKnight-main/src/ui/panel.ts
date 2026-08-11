import Phaser from "phaser";

export interface PanelOptions {
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  depth?: number;
  scrollFactor?: number;
}

export interface Panel {
  bg: Phaser.GameObjects.Rectangle;
  inset: Phaser.GameObjects.Rectangle;
  all: Phaser.GameObjects.Rectangle[];
}

/**
 * The beveled pixel-art box used by every menu/card in the game: a dark fill, a solid 1-2px outer
 * border, and a fainter 1px inset line just inside it (hard edges only — no gradients/blur, kept
 * consistent with the dungeon tile textures). `x, y` is the box's center, matching how every
 * existing panel in the codebase was already positioned.
 */
export function createPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: PanelOptions = {}): Panel {
  const fillColor = opts.fillColor ?? 0x0e0e14;
  const fillAlpha = opts.fillAlpha ?? 0.9;
  const borderColor = opts.borderColor ?? 0x3a3a4a;
  const depth = opts.depth ?? 100;

  const bg = scene.add.rectangle(x, y, w, h, fillColor, fillAlpha).setStrokeStyle(2, borderColor, 1).setDepth(depth);
  const inset = scene.add.rectangle(x, y, w - 8, h - 8).setStrokeStyle(1, 0xffffff, 0.06).setDepth(depth + 1);

  if (opts.scrollFactor !== undefined) {
    bg.setScrollFactor(opts.scrollFactor);
    inset.setScrollFactor(opts.scrollFactor);
  }

  return { bg, inset, all: [bg, inset] };
}
