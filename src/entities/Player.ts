import Phaser from "phaser";
import type { PlayerState, PlayerStats } from "../data/types";
import { createWeaponInstance, createWeaponInstanceFromDef, type WeaponDef, type WeaponInstance } from "../data/weapons";
import { CHARACTERS, type CharacterDef, type CharacterId, type SkillId } from "../data/characters";

export interface WasdKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export interface HudWeaponInfo {
  name: string;
}

export interface HudSkillInfo {
  name: string;
  remainingMs: number;
  cooldownMs: number;
  ready: boolean;
}

export interface SkillPayload {
  x: number;
  y: number;
  angle: number;
}

export interface PlayerSnapshot {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  coins: number;
  upgrades: { damageMult: number; atkSpeedMult: number };
  weapons: [WeaponDef, WeaponDef];
  currentWeaponIndex: 0 | 1;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  characterDef: CharacterDef;
  stats: PlayerStats;
  playerState: PlayerState = "ALIVE";
  coins = 0;

  weapons: [WeaponInstance, WeaponInstance] = [
    createWeaponInstance("pistol"),
    createWeaponInstance("energySword"),
  ];
  currentWeaponIndex: 0 | 1 = 0;

  upgrades = { damageMult: 1, atkSpeedMult: 1 };

  private aimAngle = 0;
  private aimIndicator: Phaser.GameObjects.Image;
  private onHpChanged?: () => void;
  private onEnergyChanged?: () => void;
  private onFired?: (x: number, y: number, angle: number, weapon: WeaponDef) => void;
  private onMeleeAttack?: (x: number, y: number, angle: number, weapon: WeaponDef) => void;
  private onSkillUsed?: (kind: SkillId, payload: SkillPayload) => void;

  private lastSkillAt = 0;
  private dashActive = false;
  private dashEndsAt = 0;
  private skillDefenseBonus = 0;
  private skillDefenseBonusEndsAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, characterId: CharacterId) {
    super(scene, x, y, "player");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.characterDef = CHARACTERS[characterId];
    this.stats = {
      hp: this.characterDef.hp,
      maxHp: this.characterDef.hp,
      speed: this.characterDef.speed,
      damage: this.characterDef.damage,
      energy: this.characterDef.maxEnergy,
      maxEnergy: this.characterDef.maxEnergy,
    };

    this.setCircle(16);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.aimIndicator = scene.add.image(x, y, "projectile").setDepth(11);
  }

  get currentWeapon(): WeaponInstance {
    return this.weapons[this.currentWeaponIndex];
  }

  get isDashing(): boolean {
    return this.dashActive;
  }

  setCallbacks(opts: {
    onHpChanged?: () => void;
    onEnergyChanged?: () => void;
    onFired?: (x: number, y: number, angle: number, weapon: WeaponDef) => void;
    onMeleeAttack?: (x: number, y: number, angle: number, weapon: WeaponDef) => void;
    onSkillUsed?: (kind: SkillId, payload: SkillPayload) => void;
  }): void {
    this.onHpChanged = opts.onHpChanged;
    this.onEnergyChanged = opts.onEnergyChanged;
    this.onFired = opts.onFired;
    this.onMeleeAttack = opts.onMeleeAttack;
    this.onSkillUsed = opts.onSkillUsed;
  }

  update(_time: number, delta: number, keys: WasdKeys, aimWorldPoint: Phaser.Math.Vector2): void {
    this.updateSkillTimers(_time);

    if (this.playerState === "DEAD") {
      this.setVelocity(0, 0);
      return;
    }

    if (!this.dashActive) {
      this.handleMovement(keys);
    }
    this.handleAim(aimWorldPoint);
    void delta;
  }

  private updateSkillTimers(time: number): void {
    if (this.dashActive && time >= this.dashEndsAt) {
      this.dashActive = false;
    }
    if (this.skillDefenseBonusEndsAt && time >= this.skillDefenseBonusEndsAt) {
      this.skillDefenseBonus = 0;
      this.skillDefenseBonusEndsAt = 0;
    }
  }

  private handleMovement(keys: WasdKeys): void {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (keys.up.isDown) dir.y -= 1;
    if (keys.down.isDown) dir.y += 1;
    if (keys.left.isDown) dir.x -= 1;
    if (keys.right.isDown) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize().scale(this.stats.speed);
    }
    this.setVelocity(dir.x, dir.y);
  }

  private handleAim(aimWorldPoint: Phaser.Math.Vector2): void {
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, aimWorldPoint.x, aimWorldPoint.y);
    this.setRotation(this.aimAngle);

    const indicatorDistance = 22;
    this.aimIndicator.setPosition(
      this.x + Math.cos(this.aimAngle) * indicatorDistance,
      this.y + Math.sin(this.aimAngle) * indicatorDistance,
    );
  }

  switchWeapon(index: 0 | 1): void {
    if (this.playerState === "DEAD") return;
    this.currentWeaponIndex = index;
  }

  tryShoot(time: number): void {
    if (this.playerState === "DEAD") return;
    const slot = this.currentWeapon;
    const effectiveFireRateMs = slot.def.fireRateMs / this.upgrades.atkSpeedMult;
    if (time - slot.lastShotAt < effectiveFireRateMs) return;

    if (slot.def.category === "ranged") {
      if (this.stats.energy < slot.def.energyCost) return;
      this.stats.energy -= slot.def.energyCost;
      slot.lastShotAt = time;
      this.onEnergyChanged?.();
      this.onFired?.(this.x, this.y, this.aimAngle, slot.def);
    } else {
      slot.lastShotAt = time;
      this.onMeleeAttack?.(this.x, this.y, this.aimAngle, slot.def);
    }
  }

  trySkill(time: number): void {
    if (this.playerState === "DEAD") return;
    if (time - this.lastSkillAt < this.characterDef.skillCooldownMs) return;
    this.lastSkillAt = time;

    switch (this.characterDef.skillId) {
      case "dashSlash":
        this.dashActive = true;
        this.dashEndsAt = time + (this.characterDef.dashDurationMs ?? 250);
        this.scene.physics.velocityFromRotation(
          this.aimAngle,
          this.characterDef.dashSpeed ?? 600,
          this.body!.velocity,
        );
        if (this.characterDef.shieldBonus) {
          this.skillDefenseBonus = this.characterDef.shieldBonus;
          this.skillDefenseBonusEndsAt = time + (this.characterDef.shieldDurationMs ?? 2000);
        }
        this.onSkillUsed?.("dashSlash", { x: this.x, y: this.y, angle: this.aimAngle });
        break;

      case "fireNova":
        this.onSkillUsed?.("fireNova", { x: this.x, y: this.y, angle: this.aimAngle });
        break;

      case "healPulse":
        this.heal(this.characterDef.healAmount ?? 30);
        this.onSkillUsed?.("healPulse", { x: this.x, y: this.y, angle: this.aimAngle });
        break;
    }
  }

  getHudInfo(): HudWeaponInfo {
    return { name: this.currentWeapon.def.name };
  }

  getSkillHudInfo(): HudSkillInfo {
    const elapsed = this.scene.time.now - this.lastSkillAt;
    const remainingMs = Math.max(0, this.characterDef.skillCooldownMs - elapsed);
    return {
      name: this.characterDef.skillName,
      remainingMs,
      cooldownMs: this.characterDef.skillCooldownMs,
      ready: remainingMs <= 0,
    };
  }

  takeDamage(amount: number): void {
    if (this.playerState === "DEAD") return;
    const reduced = amount * Math.max(0, 1 - this.characterDef.defenseReduction - this.skillDefenseBonus);
    this.stats.hp = Math.max(0, this.stats.hp - reduced);
    this.onHpChanged?.();
    if (this.stats.hp <= 0) {
      this.die();
    }
  }

  heal(amount: number): void {
    if (this.playerState === "DEAD") return;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    this.onHpChanged?.();
  }

  gainEnergy(amount: number): void {
    if (this.playerState === "DEAD") return;
    this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + amount);
    this.onEnergyChanged?.();
  }

  increaseMaxHp(amount: number): void {
    this.stats.maxHp += amount;
    this.stats.hp += amount;
    this.onHpChanged?.();
  }

  equipRangedWeapon(def: WeaponDef): void {
    this.weapons[0] = createWeaponInstanceFromDef(def);
  }

  getSnapshot(): PlayerSnapshot {
    return {
      hp: this.stats.hp,
      maxHp: this.stats.maxHp,
      energy: this.stats.energy,
      maxEnergy: this.stats.maxEnergy,
      coins: this.coins,
      upgrades: { ...this.upgrades },
      weapons: [this.weapons[0].def, this.weapons[1].def],
      currentWeaponIndex: this.currentWeaponIndex,
    };
  }

  applySnapshot(snapshot: PlayerSnapshot): void {
    this.stats.maxHp = snapshot.maxHp;
    this.stats.hp = Math.min(snapshot.hp, snapshot.maxHp);
    this.stats.maxEnergy = snapshot.maxEnergy;
    this.stats.energy = Math.min(snapshot.energy, snapshot.maxEnergy);
    this.coins = snapshot.coins;
    this.upgrades = { ...snapshot.upgrades };
    this.weapons = [createWeaponInstanceFromDef(snapshot.weapons[0]), createWeaponInstanceFromDef(snapshot.weapons[1])];
    this.currentWeaponIndex = snapshot.currentWeaponIndex;
    this.onHpChanged?.();
    this.onEnergyChanged?.();
  }

  applyUpgrade(kind: "damage" | "atkSpeed" | "maxHp"): void {
    switch (kind) {
      case "damage":
        this.upgrades.damageMult *= 1.2;
        break;
      case "atkSpeed":
        this.upgrades.atkSpeedMult *= 1.15;
        break;
      case "maxHp":
        this.increaseMaxHp(25);
        break;
    }
  }

  private die(): void {
    this.playerState = "DEAD";
    this.setVelocity(0, 0);
    this.setTint(0x555555);
    this.aimIndicator.setVisible(false);
  }

  destroy(fromScene?: boolean): void {
    this.aimIndicator.destroy();
    super.destroy(fromScene);
  }
}
