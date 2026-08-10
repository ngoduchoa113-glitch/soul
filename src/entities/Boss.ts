import Phaser from "phaser";
import type { BossDef, BossPattern } from "../data/boss";
import type { Combatant } from "./Combatant";
import type { Fx } from "../fx/Fx";
import type { Sfx } from "../audio/Sfx";

export interface EntityVfx {
  fx: Fx;
  sfx: Sfx;
}

type BossState = "IDLE" | "CHASE" | "TELEGRAPH" | "EXECUTING" | "COOLDOWN";

const PHASE1_CYCLE: BossPattern[] = ["normal", "dash", "projectile"];
const PHASE2_CYCLE: BossPattern[] = ["normal", "dash", "projectile", "aoe", "summon"];
const PHASE2_SPEED_MULT = 1.3;
const PHASE2_DAMAGE_MULT = 1.3;
const PHASE2_COOLDOWN_DIVISOR = 1.4;

export class Boss extends Phaser.Physics.Arcade.Sprite implements Combatant {
  def: BossDef;
  hp: number;
  maxHp: number;
  phase: 1 | 2 = 1;
  roomIndex?: number;

  private mode: BossState = "IDLE";
  private currentPattern: BossPattern | null = null;
  private patternIndex = 0;
  private lastPatternAt = 0;
  private telegraphStartedAt = 0;
  private dashStartedAt = 0;
  private dashDamageDealt = false;
  private aoeTargetX = 0;
  private aoeTargetY = 0;
  private aoeTelegraph?: Phaser.GameObjects.Arc;
  private target: Phaser.Physics.Arcade.Sprite | null = null;

  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private vfx?: EntityVfx;

  private onAttackPlayer?: (damage: number) => void;
  private onFireProjectile?: (x: number, y: number, angle: number, damage: number, speed: number) => void;
  private onSummon?: (count: number) => void;
  private onPhaseChanged?: (phase: number) => void;
  private onDeath?: (boss: Boss) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, def: BossDef, vfx?: EntityVfx) {
    super(scene, x, y, "boss");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.def = def;
    this.vfx = vfx;
    this.hp = def.hp;
    this.maxHp = def.hp;

    this.setCircle(30);
    this.setDepth(9);

    this.healthBarBg = scene.add.rectangle(x, y - 50, 70, 6, 0x000000).setDepth(12);
    this.healthBarFill = scene.add.rectangle(x, y - 50, 70, 6, 0xef4444).setDepth(13);
  }

  setCallbacks(opts: {
    onAttackPlayer?: (damage: number) => void;
    onFireProjectile?: (x: number, y: number, angle: number, damage: number, speed: number) => void;
    onSummon?: (count: number) => void;
    onPhaseChanged?: (phase: number) => void;
    onDeath?: (boss: Boss) => void;
  }): void {
    this.onAttackPlayer = opts.onAttackPlayer;
    this.onFireProjectile = opts.onFireProjectile;
    this.onSummon = opts.onSummon;
    this.onPhaseChanged = opts.onPhaseChanged;
    this.onDeath = opts.onDeath;
  }

  private get effectiveSpeed(): number {
    return this.phase === 2 ? this.def.speed * PHASE2_SPEED_MULT : this.def.speed;
  }

  private get effectiveDamage(): number {
    return this.phase === 2 ? this.def.damage * PHASE2_DAMAGE_MULT : this.def.damage;
  }

  private get effectiveCooldownMs(): number {
    return this.phase === 2 ? this.def.patternCooldownMs / PHASE2_COOLDOWN_DIVISOR : this.def.patternCooldownMs;
  }

  update(time: number, target: Phaser.Physics.Arcade.Sprite | null): void {
    this.target = target;
    this.updateHealthBar();

    if (!this.active) return;

    this.checkPhaseTransition();

    const dist = target ? Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) : Infinity;

    switch (this.mode) {
      case "IDLE":
        this.setVelocity(0, 0);
        if (dist <= this.def.detectRadius) this.mode = "CHASE";
        break;

      case "CHASE": {
        if (!target) {
          this.mode = "IDLE";
          this.setVelocity(0, 0);
          break;
        }
        const engageRange = this.def.detectRadius * 0.5;
        if (dist <= engageRange) {
          this.setVelocity(0, 0);
          this.pickPattern();
        } else {
          this.moveToward(target);
        }
        break;
      }

      case "TELEGRAPH":
        this.updateTelegraph(time);
        break;

      case "EXECUTING":
        this.updateExecuting(time);
        break;

      case "COOLDOWN":
        if (time - this.lastPatternAt >= this.effectiveCooldownMs) {
          this.mode = "CHASE";
        }
        break;
    }
  }

  private checkPhaseTransition(): void {
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(150, () => {
        if (this.active) this.clearTint();
      });
      this.vfx?.fx.screenShake(0.01, 300);
      this.vfx?.sfx.playBossPhase();
      this.onPhaseChanged?.(2);
    }
  }

  private pickPattern(): void {
    const cycle = this.phase === 1 ? PHASE1_CYCLE : PHASE2_CYCLE;
    this.currentPattern = cycle[this.patternIndex % cycle.length];
    this.patternIndex++;
    this.beginPattern();
  }

  private beginPattern(): void {
    const time = this.scene.time.now;

    switch (this.currentPattern) {
      case "normal": {
        if (this.target) {
          const d = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
          if (d <= this.def.meleeRange) {
            this.onAttackPlayer?.(this.effectiveDamage);
            this.vfx?.fx.hitSpark(this.target.x, this.target.y, 0xef4444);
          }
        }
        this.vfx?.sfx.playBossAttack();
        this.enterCooldown(time);
        break;
      }

      case "dash":
        this.mode = "TELEGRAPH";
        this.telegraphStartedAt = time;
        this.setTint(0xffaa00);
        this.vfx?.sfx.playBossAttack();
        break;

      case "projectile": {
        if (this.target) {
          const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
          const spreadDeg = 20;
          const count = this.def.projectileCount;
          for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) - 0.5 : 0;
            const angle = baseAngle + Phaser.Math.DegToRad(t * spreadDeg);
            this.onFireProjectile?.(this.x, this.y, angle, this.effectiveDamage, this.def.projectileSpeed);
          }
        }
        this.vfx?.sfx.playBossAttack();
        this.enterCooldown(time);
        break;
      }

      case "aoe":
        this.mode = "TELEGRAPH";
        this.telegraphStartedAt = time;
        this.aoeTargetX = this.target ? this.target.x : this.x;
        this.aoeTargetY = this.target ? this.target.y : this.y;
        this.aoeTelegraph = this.scene.add
          .circle(this.aoeTargetX, this.aoeTargetY, this.def.aoeRadius, 0xff0000, 0.2)
          .setStrokeStyle(2, 0xff0000, 0.9)
          .setDepth(4);
        this.vfx?.sfx.playBossAttack();
        break;

      case "summon":
        this.onSummon?.(this.def.summonCount);
        this.vfx?.fx.hitSpark(this.x, this.y, 0xb366ff);
        this.vfx?.sfx.playBossAttack();
        this.enterCooldown(time);
        break;
    }
  }

  private updateTelegraph(time: number): void {
    if (this.currentPattern === "dash") {
      if (time - this.telegraphStartedAt >= this.def.dashTelegraphMs) {
        this.clearTint();
        this.vfx?.fx.hitSpark(this.x, this.y, 0xffaa00);
        const angle = this.target
          ? Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y)
          : this.rotation;
        this.scene.physics.velocityFromRotation(angle, this.def.dashSpeed, this.body!.velocity);
        this.setRotation(angle);
        this.dashStartedAt = time;
        this.dashDamageDealt = false;
        this.mode = "EXECUTING";
      }
    } else if (this.currentPattern === "aoe") {
      if (time - this.telegraphStartedAt >= this.def.aoeTelegraphMs) {
        if (this.target) {
          const d = Phaser.Math.Distance.Between(this.aoeTargetX, this.aoeTargetY, this.target.x, this.target.y);
          if (d <= this.def.aoeRadius) this.onAttackPlayer?.(this.effectiveDamage);
        }
        this.vfx?.fx.explosion(this.aoeTargetX, this.aoeTargetY, this.def.aoeRadius);
        this.aoeTelegraph?.destroy();
        this.aoeTelegraph = undefined;
        this.enterCooldown(time);
      }
    }
  }

  private updateExecuting(time: number): void {
    if (!this.dashDamageDealt && this.target) {
      const d = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (d <= this.def.meleeRange) {
        this.onAttackPlayer?.(this.effectiveDamage);
        this.vfx?.fx.hitSpark(this.target.x, this.target.y, 0xffaa00);
        this.dashDamageDealt = true;
      }
    }
    if (time - this.dashStartedAt >= this.def.dashDurationMs) {
      this.setVelocity(0, 0);
      this.enterCooldown(time);
    }
  }

  private enterCooldown(time: number): void {
    this.mode = "COOLDOWN";
    this.lastPatternAt = time;
    this.setVelocity(0, 0);
  }

  private moveToward(target: Phaser.Physics.Arcade.Sprite): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.scene.physics.velocityFromRotation(angle, this.effectiveSpeed, this.body!.velocity);
    this.setRotation(angle);
  }

  private updateHealthBar(): void {
    this.healthBarBg.setPosition(this.x, this.y - 50);
    this.healthBarFill.setPosition(this.x, this.y - 50);
    const frac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.healthBarFill.setSize(70 * frac, 6);
    this.healthBarFill.x = this.x - (70 * (1 - frac)) / 2;
  }

  takeDamage(amount: number): void {
    if (!this.active) return;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.clearTint();
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    if (!this.active) return;
    this.onDeath?.(this);
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    this.aoeTelegraph?.destroy();
    this.destroy();
  }
}
