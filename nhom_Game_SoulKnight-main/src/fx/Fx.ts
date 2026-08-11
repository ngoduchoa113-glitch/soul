import Phaser from "phaser";

export class Fx {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  muzzleFlash(x: number, y: number, angle: number): void {
    const img = this.scene.add
      .image(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, "particle-flash")
      .setRotation(angle)
      .setTint(0xfff4b0)
      .setScale(1.4)
      .setDepth(15)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: img,
      scale: 0.2,
      alpha: 0,
      duration: 90,
      onComplete: () => img.destroy(),
    });
  }

  trailDot(x: number, y: number, color = 0xffffff): void {
    const dot = this.scene.add.image(x, y, "spark").setTint(color).setScale(0.4).setAlpha(0.5).setDepth(4);
    this.scene.tweens.add({
      targets: dot,
      alpha: 0,
      scale: 0.1,
      duration: 180,
      onComplete: () => dot.destroy(),
    });
  }

  /** Small debris fragments flying outward — each shard is rotated to face its own flight direction, so a hit reads as scattering chips, not a recolored dot burst. */
  hitSpark(x: number, y: number, color = 0xffffff): void {
    for (let i = 0; i < 5; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(10, 22);
      const dot = this.scene.add
        .image(x, y, "particle-shard")
        .setRotation(angle)
        .setTint(color)
        .setScale(Phaser.Math.FloatBetween(0.9, 1.3))
        .setDepth(14);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.1,
        duration: 160,
        onComplete: () => dot.destroy(),
      });
    }
  }

  damageFlash(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (sprite.active) sprite.clearTint();
    });
  }

  deathPoof(x: number, y: number, color = 0xffffff): void {
    const poof = this.scene.add.image(x, y, "spark").setTint(color).setScale(2.2).setAlpha(0.8).setDepth(14);
    this.scene.tweens.add({
      targets: poof,
      scale: 4,
      alpha: 0,
      duration: 220,
      onComplete: () => poof.destroy(),
    });
    this.hitSpark(x, y, color);
  }

  explosion(x: number, y: number, radius: number, color = 0xff9f43, strokeColor = 0xffe08a): void {
    const ring = this.scene.add
      .circle(x, y, 10, color, 0.45)
      .setStrokeStyle(2, strokeColor, 0.8)
      .setDepth(14)
      .setScale(0.2);
    this.scene.tweens.add({
      targets: ring,
      scale: Math.max(0.5, radius / 10),
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    this.hitSpark(x, y, strokeColor);
  }

  laserBeam(x1: number, y1: number, x2: number, y2: number, color = 0xff4d6d, width = 4): void {
    const g = this.scene.add.graphics().setDepth(13);
    g.lineStyle(width, color, 0.9);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokePath();
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 120,
      onComplete: () => g.destroy(),
    });
  }

  screenShake(intensity: number, durationMs: number): void {
    this.scene.cameras.main.shake(durationMs, intensity);
  }
}
