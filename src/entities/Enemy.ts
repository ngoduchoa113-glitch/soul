import Phaser from "phaser";
import type { EnemyAIState, EnemyStats } from "../data/types";
import type { EnemyDef } from "../data/enemies";
import type { Combatant } from "./Combatant";
import type { EntityVfx } from "./Boss";

export class Enemy extends Phaser.Physics.Arcade.Sprite implements Combatant {
  def: EnemyDef;
  stats: EnemyStats;
  aiState: EnemyAIState = "IDLE";
  roomIndex?: number;

  private lastAttackAt = 0;
  private fuseStartedAt = 0;
  private fuseFlared = false;
  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private vfx?: EntityVfx;
  private onAttackPlayer?: (damage: number) => void;
  private onFireProjectile?: (x: number, y: number, angle: number, damage: number, speed: number) => void;
  private onDeath?: (enemy: Enemy) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, vfx?: EntityVfx) {
    super(scene, x, y, `enemy-${def.id}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.def = def;
    this.vfx = vfx;
    this.stats = { hp: def.hp, maxHp: def.hp, speed: def.speed, damage: def.damage };

    this.setCircle(14);
    this.setDepth(9);

    this.healthBarBg = scene.add.rectangle(x, y - 24, 28, 4, 0x000000).setDepth(12);
    this.healthBarFill = scene.add.rectangle(x, y - 24, 28, 4, 0x4ade80).setDepth(13);
  }

  setCallbacks(opts: {
    onAttackPlayer?: (damage: number) => void;
    onFireProjectile?: (x: number, y: number, angle: number, damage: number, speed: number) => void;
    onDeath?: (enemy: Enemy) => void;
  }): void {
    this.onAttackPlayer = opts.onAttackPlayer;
    this.onFireProjectile = opts.onFireProjectile;
    this.onDeath = opts.onDeath;
  }

  update(time: number, target: Phaser.Physics.Arcade.Sprite | null): void {
    this.updateHealthBar();

    if (!this.active) return;

    const dist = target ? Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) : Infinity;

    switch (this.def.behavior) {
      case "melee":
        this.meleeUpdate(time, target, dist);
        break;
      case "ranged":
        this.rangedUpdate(time, target, dist);
        break;
      case "bomber":
        this.bomberUpdate(time, target, dist);
        break;
    }
  }

  private meleeUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (dist <= this.def.detectRadius) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target || dist > this.def.detectRadius * 1.5) {
          this.aiState = "IDLE";
          this.setVelocity(0, 0);
          break;
        }
        if (dist <= this.def.attackRadius) {
          this.aiState = "ATTACK";
          this.setVelocity(0, 0);
          break;
        }
        this.moveToward(target);
        break;

      case "ATTACK":
        if (!target) {
          this.aiState = "IDLE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          this.onAttackPlayer?.(this.stats.damage);
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = dist <= this.def.attackRadius ? "ATTACK" : "CHASE";
        }
        break;
    }
  }

  private rangedUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    const band = this.def.preferredRange;

    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (dist <= this.def.detectRadius) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target || dist > this.def.detectRadius * 1.5) {
          this.aiState = "IDLE";
          this.setVelocity(0, 0);
          break;
        }
        if (dist > band + 20) {
          this.moveToward(target);
        } else if (dist < band - 20) {
          this.moveAway(target);
        } else {
          this.setVelocity(0, 0);
          this.aiState = "ATTACK";
        }
        break;

      case "ATTACK":
        if (!target) {
          this.aiState = "IDLE";
          break;
        }
        if (dist > band + 40 || dist < band - 40) {
          this.aiState = "CHASE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
          this.onFireProjectile?.(this.x, this.y, angle, this.def.damage, this.def.projectileSpeed);
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = dist <= band + 40 && dist >= band - 40 ? "ATTACK" : "CHASE";
        }
        break;
    }
  }

  private bomberUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (dist <= this.def.detectRadius) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
          this.aiState = "IDLE";
          this.setVelocity(0, 0);
          break;
        }
        if (dist <= this.def.attackRadius) {
          this.aiState = "ATTACK";
          this.fuseStartedAt = time;
          this.fuseFlared = false;
          this.setVelocity(0, 0);
          this.setTint(0xffff00);
          this.vfx?.fx.hitSpark(this.x, this.y, 0xffff00);
          break;
        }
        this.moveToward(target);
        break;

      case "ATTACK": {
        const fuseElapsed = time - this.fuseStartedAt;
        if (!this.fuseFlared && fuseElapsed >= this.def.fuseMs * 0.6) {
          this.fuseFlared = true;
          this.vfx?.fx.hitSpark(this.x, this.y, 0xffaa00);
        }
        if (fuseElapsed >= this.def.fuseMs) {
          this.explode(target);
        }
        break;
      }
    }
  }

  private explode(target: Phaser.Physics.Arcade.Sprite | null): void {
    this.vfx?.fx.explosion(this.x, this.y, this.def.explodeRadius);
    this.vfx?.sfx.playHit();
    if (target) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (dist <= this.def.explodeRadius) {
        this.onAttackPlayer?.(this.stats.damage);
      }
    }
    this.die();
  }

  private moveToward(target: Phaser.Physics.Arcade.Sprite): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.scene.physics.velocityFromRotation(angle, this.stats.speed, this.body!.velocity);
    this.setRotation(angle);
  }

  private moveAway(target: Phaser.Physics.Arcade.Sprite): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) + Math.PI;
    this.scene.physics.velocityFromRotation(angle, this.stats.speed, this.body!.velocity);
  }

  private updateHealthBar(): void {
    this.healthBarBg.setPosition(this.x, this.y - 24);
    this.healthBarFill.setPosition(this.x, this.y - 24);
    const frac = Phaser.Math.Clamp(this.stats.hp / this.stats.maxHp, 0, 1);
    this.healthBarFill.setSize(28 * frac, 4);
    this.healthBarFill.x = this.x - (28 * (1 - frac)) / 2;
  }

  takeDamage(amount: number): void {
    if (!this.active) return;
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.clearTint();
    });

    if (this.stats.hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    if (!this.active) return;
    this.onDeath?.(this);
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    this.destroy();
  }
}
