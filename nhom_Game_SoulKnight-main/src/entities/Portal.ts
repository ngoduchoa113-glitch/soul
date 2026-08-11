import Phaser from "phaser";

export type PortalKind = "gate" | "trophy";

/**
 * Interactable prop for a stage's exit: a "gate" advances to the next stage,
 * a "trophy" (final stage only) returns to the main menu.
 */
export class Portal extends Phaser.GameObjects.Sprite {
  kind: PortalKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PortalKind) {
    super(scene, x, y, "portal");
    scene.add.existing(this);
    this.kind = kind;
    this.setDepth(6);
    this.setScale(4);
    // The trophy portal (run's final reward) gets a solid gold recolor so it reads as
    // distinct from a regular stage gate — a multiply tint would just muddy the purple/cyan art.
    if (kind === "trophy") this.setTintFill(0xffd700);
    this.play("portal-spin");
  }
}
