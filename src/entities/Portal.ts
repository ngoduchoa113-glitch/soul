import Phaser from "phaser";

export type PortalKind = "gate" | "trophy";

/**
 * Interactable prop for a stage's exit: a "gate" advances to the next stage,
 * a "trophy" (final stage only) returns to the main menu.
 */
export class Portal extends Phaser.GameObjects.Sprite {
  kind: PortalKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PortalKind) {
    super(scene, x, y, "gate");
    scene.add.existing(this);
    this.kind = kind;
    this.setDepth(6);
    this.setTint(kind === "trophy" ? 0xffd700 : 0x22d3ee);
  }
}
