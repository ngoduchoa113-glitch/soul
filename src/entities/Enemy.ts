import Phaser from "phaser";
import type { EnemyAIState, EnemyStats } from "../data/types";
import { elementColor, type EnemyDef } from "../data/enemies";
import type { Combatant } from "./Combatant";
import type { EntityVfx } from "./Boss";
import { enemyAnimSet, type CreatureAnimSet } from "../data/creatureSprites";

const HITBOX_RADIUS = 14;

export class Enemy extends Phaser.Physics.Arcade.Sprite implements Combatant {
  def: EnemyDef;
  stats: EnemyStats;
  aiState: EnemyAIState = "IDLE";
  roomIndex?: number;
  /** See Combatant.alive doc — false from the instant HP hits 0, independent of Phaser's `active` (kept true so the death animation still plays). */
  alive = true;

  private lastAttackAt = 0;
  private fuseStartedAt = 0;
  private fuseFlared = false;
  /** Shared timer for any behavior's telegraph/wind-up phase (fast dash, aoeCaster cast, teleporter blink). */
  private telegraphStartedAt = 0;
  private dashDamageDealt = false;
  private dashEndsAt = 0;
  private telegraphX = 0;
  private telegraphY = 0;
  private zoneTelegraphGfx?: Phaser.GameObjects.Arc;

  /** Temporary stat multipliers from an allied Buffer's pulse. */
  private buffDamageMult = 1;
  private buffSpeedMult = 1;
  private buffExpiresAt = -Infinity;

  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private vfx?: EntityVfx;
  private creatureAnims: CreatureAnimSet;
  private onAttackPlayer?: (damage: number) => void;
  private onFireProjectilePattern?: (x: number, y: number, angle: number, def: EnemyDef) => void;
  private onCastZone?: (x: number, y: number, def: EnemyDef) => void;
  private onSummon?: (x: number, y: number, count: number, radius: number) => void;
  private onHealAlly?: (healer: Enemy, radius: number, amount: number) => void;
  private onBuffAllies?: (buffer: Enemy, def: EnemyDef) => void;
  private onDeath?: (enemy: Enemy) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, vfx?: EntityVfx, isElite = false) {
    const creatureAnims = enemyAnimSet(def, isElite);
    super(scene, x, y, creatureAnims.idle.key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.def = def;
    this.vfx = vfx;
    this.creatureAnims = creatureAnims;
    this.stats = { hp: def.hp, maxHp: def.hp, speed: def.speed, damage: def.damage };

    const { frameWidth, frameHeight } = creatureAnims.idle;
    this.setCircle(HITBOX_RADIUS, (frameWidth - HITBOX_RADIUS * 2) / 2, (frameHeight - HITBOX_RADIUS * 2) / 2);
    this.setDepth(9);
    this.play(creatureAnims.idle.key);
    // Every behavior has its own dedicated art now — elite gets a size bump on top of whatever
    // base scale the art needs (e.g. the skeleton sheet is drawn at a much higher native res
    // than this game's other creature sheets, so its own `scale` brings it back down first).
    const baseScale = creatureAnims.scale ?? 1;
    this.setScale(isElite ? baseScale * 1.15 : baseScale);

    this.healthBarBg = scene.add.rectangle(x, y - 24, 28, 4, 0x000000).setDepth(12);
    this.healthBarFill = scene.add.rectangle(x, y - 24, 28, 4, 0x4ade80).setDepth(13);
  }

  setCallbacks(opts: {
    onAttackPlayer?: (damage: number) => void;
    onFireProjectilePattern?: (x: number, y: number, angle: number, def: EnemyDef) => void;
    onCastZone?: (x: number, y: number, def: EnemyDef) => void;
    onSummon?: (x: number, y: number, count: number, radius: number) => void;
    onHealAlly?: (healer: Enemy, radius: number, amount: number) => void;
    onBuffAllies?: (buffer: Enemy, def: EnemyDef) => void;
    onDeath?: (enemy: Enemy) => void;
  }): void {
    this.onAttackPlayer = opts.onAttackPlayer;
    this.onFireProjectilePattern = opts.onFireProjectilePattern;
    this.onCastZone = opts.onCastZone;
    this.onSummon = opts.onSummon;
    this.onHealAlly = opts.onHealAlly;
    this.onBuffAllies = opts.onBuffAllies;
    this.onDeath = opts.onDeath;
  }

  private get effectiveSpeed(): number {
    return this.stats.speed * (this.scene.time.now < this.buffExpiresAt ? this.buffSpeedMult : 1);
  }

  private get effectiveDamage(): number {
    return this.stats.damage * (this.scene.time.now < this.buffExpiresAt ? this.buffDamageMult : 1);
  }

  /** Called by an allied Buffer's pulse. */
  applyBuff(damageMult: number, speedMult: number, durationMs: number): void {
    this.buffDamageMult = damageMult;
    this.buffSpeedMult = speedMult;
    this.buffExpiresAt = this.scene.time.now + durationMs;
  }

  /** Called by an allied Healer. */
  heal(amount: number): void {
    if (!this.active) return;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  update(time: number, target: Phaser.Physics.Arcade.Sprite | null): void {
    // Dying — still playing its death animation (stays `active` for that; see Combatant.alive
    // doc). Health bars are already destroyed at this point, and there's no AI left to run.
    if (!this.active || !this.alive) return;
    this.updateHealthBar();

    const dist = target ? Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) : Infinity;

    switch (this.def.behavior) {
      case "melee":
      case "tank":
        this.meleeUpdate(time, target, dist);
        break;
      case "ranged":
        this.rangedUpdate(time, target, dist);
        break;
      case "bomber":
        this.bomberUpdate(time, target, dist);
        break;
      case "fast":
        this.fastUpdate(time, target, dist);
        break;
      case "aoeCaster":
        this.aoeCasterUpdate(time, target, dist);
        break;
      case "summoner":
        this.summonerUpdate(time, target, dist);
        break;
      case "teleporter":
        this.teleporterUpdate(time, target, dist);
        break;
      case "healer":
        this.healerUpdate(time, target, dist);
        break;
      case "buffer":
        this.bufferUpdate(time, target, dist);
        break;
      case "turret":
        this.turretUpdate(time, target, dist);
        break;
    }
  }

  private meleeUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
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
        if (dist > this.def.attackRadius) {
          this.aiState = "CHASE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          this.onAttackPlayer?.(this.effectiveDamage);
          this.playAttackAnim();
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = dist <= this.def.attackRadius ? "ATTACK" : "CHASE";
        }
        break;

      default:
        this.aiState = "IDLE";
    }
  }

  /** Plays a one-shot attack swing on top of the idle loop, for creature sets that have one (see CreatureAnimSet.attack) — a no-op otherwise, so this is safe to call from any behavior. */
  private playAttackAnim(): void {
    const attackAnim = this.creatureAnims.attack;
    if (!attackAnim) return;
    this.play(attackAnim.key);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.alive) this.play(this.creatureAnims.idle.key);
    });
  }

  private rangedUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    const band = this.def.preferredRange;

    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
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
          this.onFireProjectilePattern?.(this.x, this.y, angle, this.def);
          this.playAttackAnim();
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = dist <= band + 40 && dist >= band - 40 ? "ATTACK" : "CHASE";
        }
        break;

      default:
        this.aiState = "IDLE";
    }
  }

  private bomberUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
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

      default:
        this.aiState = "IDLE";
    }
  }

  /** Fast: chases normally, but once in dash range it winds up briefly then bursts toward the player, dealing contact damage. */
  private fastUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
          this.aiState = "IDLE";
          this.setVelocity(0, 0);
          break;
        }
        if (dist <= this.def.attackRadius) {
          this.aiState = "ATTACK";
          this.setVelocity(0, 0);
          break;
        }
        if (dist >= (this.def.dashRangeMin ?? 90) && time - this.lastAttackAt >= (this.def.dashCooldownMs ?? 2600)) {
          this.aiState = "TELEGRAPH";
          this.telegraphStartedAt = time;
          this.setVelocity(0, 0);
          this.setTint(0xffffff);
          break;
        }
        this.moveToward(target);
        break;

      case "TELEGRAPH":
        if (time - this.telegraphStartedAt >= (this.def.dashTelegraphMs ?? 220)) {
          this.clearTint();
          if (target) {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
            this.scene.physics.velocityFromRotation(angle, this.def.dashSpeed ?? this.effectiveSpeed * 3, this.body!.velocity);
            this.setFlipX(Math.cos(angle) < 0);
          }
          this.dashDamageDealt = false;
          this.dashEndsAt = time + 260;
          this.aiState = "EXECUTING";
        }
        break;

      case "EXECUTING":
        if (!this.dashDamageDealt && target && dist <= this.def.attackRadius) {
          this.onAttackPlayer?.(this.effectiveDamage);
          this.dashDamageDealt = true;
        }
        if (time >= this.dashEndsAt) {
          this.setVelocity(0, 0);
          this.lastAttackAt = time;
          this.aiState = "COOLDOWN";
        }
        break;

      case "ATTACK":
        if (!target) {
          this.aiState = "IDLE";
          break;
        }
        if (dist > this.def.attackRadius) {
          this.aiState = "CHASE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          this.onAttackPlayer?.(this.effectiveDamage);
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = target && dist <= this.def.attackRadius ? "ATTACK" : "CHASE";
        }
        break;
    }
  }

  /** aoeCaster: holds range like a ranged enemy, but casts a telegraphed damage zone at the player's position instead of firing a bullet. */
  private aoeCasterUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    const band = this.def.preferredRange;

    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
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
        if (dist > band + 60) {
          this.aiState = "CHASE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          this.telegraphStartedAt = time;
          this.telegraphX = target.x;
          this.telegraphY = target.y;
          const color = elementColor(this.def.element);
          this.zoneTelegraphGfx = this.scene.add
            .circle(this.telegraphX, this.telegraphY, this.def.zoneRadius ?? 70, color, 0.2)
            .setStrokeStyle(2, color, 0.9)
            .setDepth(4);
          this.vfx?.fx.hitSpark(this.telegraphX, this.telegraphY, color);
          this.aiState = "TELEGRAPH";
        }
        break;

      case "TELEGRAPH":
        if (time - this.telegraphStartedAt >= (this.def.zoneTelegraphMs ?? 500)) {
          this.zoneTelegraphGfx?.destroy();
          this.zoneTelegraphGfx = undefined;
          this.onCastZone?.(this.telegraphX, this.telegraphY, this.def);
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = "ATTACK";
        }
        break;

      default:
        this.aiState = "IDLE";
    }
  }

  /** Summoner: holds range and periodically calls in reinforcements near itself. */
  private summonerUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    const band = this.def.preferredRange;

    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
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
        }
        if (time - this.lastAttackAt >= (this.def.summonCooldownMs ?? 6000)) {
          this.lastAttackAt = time;
          this.onSummon?.(this.x, this.y, this.def.summonCount ?? 2, this.def.summonRadius ?? 70);
          this.vfx?.fx.hitSpark(this.x, this.y, 0xb366ff);
        }
        break;

      default:
        this.aiState = "IDLE";
    }
  }

  /** Teleporter: closes distance slowly, then blinks in next to the player for a melee strike once its cooldown is up. */
  private teleporterUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
          this.aiState = "IDLE";
          this.setVelocity(0, 0);
          break;
        }
        if (dist <= this.def.attackRadius) {
          this.aiState = "ATTACK";
          this.setVelocity(0, 0);
          break;
        }
        if (time - this.lastAttackAt >= (this.def.teleportCooldownMs ?? 3200)) {
          this.aiState = "TELEGRAPH";
          this.telegraphStartedAt = time;
          this.setAlpha(0.4);
          this.setVelocity(0, 0);
          break;
        }
        this.moveToward(target);
        break;

      case "TELEGRAPH":
        if (time - this.telegraphStartedAt >= (this.def.teleportTelegraphMs ?? 350)) {
          if (target) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const landDist = this.def.attackRadius > 0 ? this.def.attackRadius * 0.7 : 30;
            const nx = target.x + Math.cos(angle) * landDist;
            const ny = target.y + Math.sin(angle) * landDist;
            this.x = nx;
            this.y = ny;
            this.body!.reset(nx, ny);
          }
          this.setAlpha(1);
          this.vfx?.fx.hitSpark(this.x, this.y, 0xa78bfa);
          this.aiState = "ATTACK";
        }
        break;

      case "ATTACK":
        if (!target) {
          this.aiState = "IDLE";
          break;
        }
        if (dist > this.def.attackRadius) {
          this.aiState = "CHASE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          this.onAttackPlayer?.(this.effectiveDamage);
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

  /** Healer: holds range from the player and periodically mends the most wounded nearby ally. */
  private healerUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    const band = this.def.preferredRange;

    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
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
        }
        if (time - this.lastAttackAt >= (this.def.healCooldownMs ?? 3500)) {
          this.lastAttackAt = time;
          this.onHealAlly?.(this, this.def.healRadius ?? 160, this.def.healAmount ?? 18);
        }
        break;

      default:
        this.aiState = "IDLE";
    }
  }

  /** Buffer: holds range from the player and periodically pulses a damage/speed buff onto nearby allies. */
  private bufferUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    const band = this.def.preferredRange;

    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        this.setVelocity(0, 0);
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
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
        }
        if (time - this.lastAttackAt >= (this.def.buffCooldownMs ?? 6000)) {
          this.lastAttackAt = time;
          this.onBuffAllies?.(this, this.def);
          this.vfx?.fx.hitSpark(this.x, this.y, 0xf59e0b);
        }
        break;

      default:
        this.aiState = "IDLE";
    }
  }

  /** Turret: never moves — just fires at the player when they're within range. */
  private turretUpdate(time: number, target: Phaser.Physics.Arcade.Sprite | null, dist: number): void {
    switch (this.aiState) {
      case "IDLE":
      case "DETECT":
        if (target) this.aiState = "CHASE";
        break;

      case "CHASE":
        if (!target) {
          this.aiState = "IDLE";
          break;
        }
        if (dist <= this.def.preferredRange) this.aiState = "ATTACK";
        break;

      case "ATTACK":
        if (!target) {
          this.aiState = "IDLE";
          break;
        }
        if (dist > this.def.preferredRange) {
          this.aiState = "CHASE";
          break;
        }
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.lastAttackAt = time;
          const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
          this.onFireProjectilePattern?.(this.x, this.y, angle, this.def);
          this.playAttackAnim();
          this.aiState = "COOLDOWN";
        }
        break;

      case "COOLDOWN":
        if (time - this.lastAttackAt >= this.def.attackCooldownMs) {
          this.aiState = dist <= this.def.preferredRange ? "ATTACK" : "CHASE";
        }
        break;
    }
  }

  private explode(target: Phaser.Physics.Arcade.Sprite | null): void {
    this.vfx?.fx.explosion(this.x, this.y, this.def.explodeRadius);
    this.vfx?.sfx.playHit();
    if (target) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (dist <= this.def.explodeRadius) {
        this.onAttackPlayer?.(this.effectiveDamage);
      }
    }
    this.die();
  }

  private moveToward(target: Phaser.Physics.Arcade.Sprite): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.scene.physics.velocityFromRotation(angle, this.effectiveSpeed, this.body!.velocity);
    this.setFlipX(Math.cos(angle) < 0);
  }

  private moveAway(target: Phaser.Physics.Arcade.Sprite): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) + Math.PI;
    this.scene.physics.velocityFromRotation(angle, this.effectiveSpeed, this.body!.velocity);
    this.setFlipX(Math.cos(angle) < 0);
  }

  private updateHealthBar(): void {
    this.healthBarBg.setPosition(this.x, this.y - 24);
    this.healthBarFill.setPosition(this.x, this.y - 24);
    const frac = Phaser.Math.Clamp(this.stats.hp / this.stats.maxHp, 0, 1);
    this.healthBarFill.setSize(28 * frac, 4);
    this.healthBarFill.x = this.x - (28 * (1 - frac)) / 2;
  }

  takeDamage(amount: number): void {
    if (!this.active || !this.alive) return;
    const reduced = amount * (1 - (this.def.defenseReduction ?? 0));
    this.stats.hp = Math.max(0, this.stats.hp - reduced);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active && this.alive) this.clearTint();
    });

    if (this.stats.hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.onDeath?.(this);
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    this.zoneTelegraphGfx?.destroy();
    this.setVelocity(0, 0);
    // Disable the physics body only (no more collisions/movement) — leave `active` alone (Phaser
    // stops advancing animations on inactive GameObjects, so it has to stay true for the death
    // animation to actually play; see Combatant.alive doc for the full explanation).
    this.disableBody(false, false);
    this.clearTint();
    this.setAlpha(1);
    this.play(this.creatureAnims.death.key);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.destroy());
  }
}
