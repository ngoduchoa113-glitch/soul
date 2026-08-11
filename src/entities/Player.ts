import Phaser from "phaser";
import type { PlayerState, PlayerStats } from "../data/types";
import {
  createWeaponInstance,
  createWeaponInstanceFromDef,
  weaponIconKey,
  type WeaponDef,
  type WeaponInstance,
} from "../data/weapons";
import { CHARACTERS, type CharacterDef, type CharacterId, type SkillId } from "../data/characters";
import { UPGRADES, type UpgradeEffectPreview, type UpgradeId } from "../data/upgrades";
import { weaponHoldRotationOffset } from "../data/weaponIcons";
import { CHARACTER_SPRITES, type CreatureAnimSet } from "../data/creatureSprites";

/** Max number of instant cooldown refunds Samurai's dash-slash can chain per combo. */
const DASH_KILL_REFUND_CAP = 3;
/** How long Emergency Shield takes to recharge one used charge. */
const SHIELD_RECHARGE_MS = 25000;
/** A hit is "near-death or heavy" if it leaves the player at/below this HP fraction, or costs this fraction of max HP in one blow. */
const SHIELD_TRIGGER_HP_FRACTION = 0.25;
/** Unarmed fallback attack — always available, free, used automatically when the ranged weapon in hand can't afford its energy cost. */
const UNARMED_FIRE_RATE_MS = 400;

export interface WasdKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export interface HudWeaponInfo {
  activeName: string;
  activeIconKey: string;
  reserveName: string;
  reserveIconKey: string;
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
  upgradeCounts: Partial<Record<UpgradeId, number>>;
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

  /** Counts of each between-stage upgrade the player has picked this run. */
  upgradeCounts: Partial<Record<UpgradeId, number>> = {};
  private shieldCharges = 0;
  private shieldRechargeAt = -Infinity;
  private lastUnarmedAt = -Infinity;

  // Ice zones (enemy aoeCaster) slow the player while they're standing in one.
  private slowMultiplier = 1;
  private slowExpiresAt = -Infinity;

  private aimAngle = 0;
  /** The equipped weapon's icon, held out in front of the player and rotated to face the aim direction. */
  private handWeapon: Phaser.GameObjects.Image;
  private charSprites: CreatureAnimSet;
  private onHpChanged?: () => void;
  private onEnergyChanged?: () => void;
  private onFired?: (x: number, y: number, angle: number, weapon: WeaponDef) => void;
  private onMeleeAttack?: (x: number, y: number, angle: number, weapon: WeaponDef) => void;
  private onUnarmedAttack?: (x: number, y: number, angle: number) => void;
  private onSkillUsed?: (kind: SkillId, payload: SkillPayload) => void;
  private onShieldTriggered?: () => void;

  // Starts "already off cooldown" — a fresh 0 would read as "just used at time 0" and
  // silently lock the skill out for a full cooldown at the start of every stage.
  private lastSkillAt = -Infinity;
  private dashActive = false;
  private dashEndsAt = 0;

  // Samurai's Iaijutsu Strike: killing an enemy mid-dash refunds the cooldown instantly,
  // up to DASH_KILL_REFUND_CAP times per chain — dashChainActive marks "this cast was a
  // refund, don't reset the streak"; a normal (non-refunded) cast resets it back to 0.
  private dashRefundStreak = 0;
  private dashChainActive = false;

  // Knight's Weapon Overdrive: while active, attack speed is doubled and ranged weapons are free to fire.
  private weaponBoostEndsAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, characterId: CharacterId) {
    const charSprites = CHARACTER_SPRITES[characterId];
    super(scene, x, y, charSprites.idle.key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.charSprites = charSprites;
    this.characterDef = CHARACTERS[characterId];
    this.stats = {
      hp: this.characterDef.hp,
      maxHp: this.characterDef.hp,
      speed: this.characterDef.speed,
      damage: this.characterDef.damage,
      energy: this.characterDef.maxEnergy,
      maxEnergy: this.characterDef.maxEnergy,
    };

    this.setCircle(16, -4, 0);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.handWeapon = scene.add.image(x, y, weaponIconKey(this.currentWeapon.def)).setDepth(11);
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
    onUnarmedAttack?: (x: number, y: number, angle: number) => void;
    onSkillUsed?: (kind: SkillId, payload: SkillPayload) => void;
    onShieldTriggered?: () => void;
  }): void {
    this.onHpChanged = opts.onHpChanged;
    this.onEnergyChanged = opts.onEnergyChanged;
    this.onFired = opts.onFired;
    this.onMeleeAttack = opts.onMeleeAttack;
    this.onUnarmedAttack = opts.onUnarmedAttack;
    this.onSkillUsed = opts.onSkillUsed;
    this.onShieldTriggered = opts.onShieldTriggered;
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
    this.updateWalkAnimation();
    void delta;
  }

  /** Plays the walk cycle while moving (dashing counts as moving); holds on frame 0 while standing still. */
  private updateWalkAnimation(): void {
    const moving = this.dashActive || this.body!.velocity.lengthSq() > 0;
    if (moving) {
      this.play(this.charSprites.idle.key, true);
    } else if (this.anims.isPlaying) {
      this.anims.stop();
      this.setFrame(0);
    }
  }

  private updateSkillTimers(time: number): void {
    if (this.dashActive && time >= this.dashEndsAt) {
      this.dashActive = false;
    }
    if (this.weaponBoostEndsAt && time >= this.weaponBoostEndsAt) {
      this.weaponBoostEndsAt = 0;
    }

    const maxShieldCharges = this.stackCount("emergencyShield");
    if (maxShieldCharges > 0 && this.shieldCharges < maxShieldCharges && time >= this.shieldRechargeAt) {
      this.shieldCharges++;
      this.shieldRechargeAt = time + SHIELD_RECHARGE_MS;
    }
  }

  private stackCount(id: UpgradeId): number {
    return this.upgradeCounts[id] ?? 0;
  }

  /** Weapon damage multiplier — a hook for future permanent damage upgrades; none in the current roster. */
  get damageMultiplier(): number {
    return 1;
  }

  get weaponBoostActive(): boolean {
    return this.weaponBoostEndsAt > 0;
  }

  get fireRateMult(): number {
    return 1 + this.stackCount("fireRateBuff") * 0.15;
  }

  /** Multiplies weapon spreadDeg — Accuracy Buff tightens grouping. */
  get spreadMult(): number {
    return Math.max(0, 1 - this.stackCount("accuracyBuff") * 0.2);
  }

  get critChance(): number {
    return this.stackCount("accuracyBuff") * 0.05 + this.stackCount("critBuff") * 0.08;
  }

  get critDamageMult(): number {
    return 1.6;
  }

  get piercingCritActive(): boolean {
    return this.stackCount("piercingCrit") > 0;
  }

  get meleeRangeMult(): number {
    return 1 + this.stackCount("meleeRangeBuff") * 0.15;
  }

  get bonusPierce(): number {
    return this.stackCount("pierceBuff");
  }

  get bonusBounces(): number {
    return this.stackCount("bounceBuff");
  }

  /** Extra pellets applied to every multi-pellet weapon or skill (Shotgun Buff). */
  get bonusPellets(): number {
    return this.stackCount("shotgunBuff");
  }

  get splitShotChance(): number {
    return Math.min(0.8, this.stackCount("splitShot") * 0.2);
  }

  get laserWidthMult(): number {
    return 1 + this.stackCount("laserBuff") * 0.3;
  }

  get laserDamageMult(): number {
    return 1 + this.stackCount("laserBuff") * 0.15;
  }

  get lifeHarvestChance(): number {
    return Math.min(0.6, this.stackCount("lifeHarvest") * 0.15);
  }

  get energyHarvestChanceBonus(): number {
    return Math.min(0.6, this.stackCount("energyHarvest") * 0.15);
  }

  get energyHarvestAmountMult(): number {
    return 1 + this.stackCount("energyHarvest") * 0.2;
  }

  get energyOrbMult(): number {
    return 1 + this.stackCount("energyOrbBuff") * 0.25;
  }

  get cooldownMult(): number {
    return Math.max(0.3, 1 - this.stackCount("cooldownBuff") * 0.12);
  }

  get shopDiscountMult(): number {
    return Math.min(0.6, this.stackCount("onSale") * 0.15);
  }

  get meleeReflectChance(): number {
    return Math.min(0.75, this.stackCount("meleeReflect") * 0.25);
  }

  /**
   * Live "previous value → new value" for the upgrade detail panel — mirrors the formulas in the
   * getters above at the stack count this pick would produce (always 0 → 1, since every upgrade is
   * a one-time pick per run; see UPGRADES' doc comment). Kept here rather than in data/upgrades.ts
   * because it needs to read the player's actual current stats/getters, not just static data.
   */
  previewUpgradeEffect(id: UpgradeId): UpgradeEffectPreview {
    const statLabel = UPGRADES[id].statLabel;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const next = this.stackCount(id) + 1;
    const preview = ((): { before: string; after: string } => {
      switch (id) {
        case "maxHp":
          return { before: `${this.stats.maxHp}`, after: `${this.stats.maxHp + 25}` };
        case "maxEnergy":
          return { before: `${this.stats.maxEnergy}`, after: `${this.stats.maxEnergy + 20}` };
        case "emergencyShield":
          return { before: `${this.stackCount(id)}`, after: `${next}` };
        case "lifeHarvest":
          return { before: pct(this.lifeHarvestChance), after: pct(Math.min(0.6, next * 0.15)) };
        case "energyHarvest":
          return { before: pct(this.energyHarvestChanceBonus), after: pct(Math.min(0.6, next * 0.15)) };
        case "accuracyBuff":
          return { before: pct(1 - this.spreadMult), after: pct(1 - Math.max(0, 1 - next * 0.2)) };
        case "fireRateBuff":
          return { before: pct(this.fireRateMult - 1), after: pct(next * 0.15) };
        case "bounceBuff":
          return { before: `${this.bonusBounces}`, after: `${next}` };
        case "pierceBuff":
          return { before: `${this.bonusPierce}`, after: `${next}` };
        case "shotgunBuff":
          return { before: `${this.bonusPellets}`, after: `${next}` };
        case "laserBuff":
          return { before: pct(this.laserWidthMult - 1), after: pct(next * 0.3) };
        case "splitShot":
          return { before: pct(this.splitShotChance), after: pct(Math.min(0.8, next * 0.2)) };
        case "critBuff":
          return { before: pct(this.critChance), after: pct(this.critChance + 0.08) };
        case "piercingCrit":
          return { before: this.piercingCritActive ? "Unlocked" : "Locked", after: "Unlocked" };
        case "meleeRangeBuff":
          return { before: pct(this.meleeRangeMult - 1), after: pct(next * 0.15) };
        case "energyOrbBuff":
          return { before: pct(this.energyOrbMult - 1), after: pct(next * 0.25) };
        case "cooldownBuff":
          return { before: pct(1 - this.cooldownMult), after: pct(Math.min(0.7, next * 0.12)) };
        case "onSale":
          return { before: pct(this.shopDiscountMult), after: pct(Math.min(0.6, next * 0.15)) };
        case "meleeReflect":
          return { before: pct(this.meleeReflectChance), after: pct(Math.min(0.75, next * 0.25)) };
      }
    })();
    return { statLabel, ...preview };
  }

  private handleMovement(keys: WasdKeys): void {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (keys.up.isDown) dir.y -= 1;
    if (keys.down.isDown) dir.y += 1;
    if (keys.left.isDown) dir.x -= 1;
    if (keys.right.isDown) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize().scale(this.stats.speed * this.currentSlowMultiplier);
    }
    this.setVelocity(dir.x, dir.y);
  }

  private get currentSlowMultiplier(): number {
    return this.scene.time.now < this.slowExpiresAt ? this.slowMultiplier : 1;
  }

  /** Applied by an enemy ice zone while the player stands in it; wears off shortly after leaving. */
  applySlow(multiplier: number, durationMs: number): void {
    this.slowMultiplier = multiplier;
    this.slowExpiresAt = this.scene.time.now + durationMs;
  }

  private handleAim(aimWorldPoint: Phaser.Math.Vector2): void {
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, aimWorldPoint.x, aimWorldPoint.y);
    // The body art only faces one way (no per-direction frames) — mirror it instead of rotating
    // the whole sprite, which would tip the character over as it tracks the aim angle.
    this.setFlipX(Math.cos(this.aimAngle) < 0);

    const handDistance = 20;
    this.handWeapon.setPosition(
      this.x + Math.cos(this.aimAngle) * handDistance,
      this.y + Math.sin(this.aimAngle) * handDistance,
    );
    // Rotating straight through past +/-90 deg turns the weapon icon upside down (whatever art was
    // "on top" ends up on the bottom). Mirror it vertically instead, and rotate the other way, so it
    // stays right-side up while still pointing at the cursor on the left side.
    const offset = weaponHoldRotationOffset(this.currentWeapon.def);
    const facingLeft = Math.cos(this.aimAngle) < 0;
    this.handWeapon.setFlipY(facingLeft);
    this.handWeapon.setRotation(this.aimAngle + (facingLeft ? -offset : offset));
  }

  /** Syncs the in-hand weapon sprite to whatever's currently equipped — call after currentWeaponIndex or weapons[] changes. */
  private refreshHandWeapon(): void {
    this.handWeapon.setTexture(weaponIconKey(this.currentWeapon.def));
  }

  switchWeapon(index: 0 | 1): void {
    if (this.playerState === "DEAD") return;
    this.currentWeaponIndex = index;
    this.refreshHandWeapon();
  }

  tryShoot(time: number): void {
    if (this.playerState === "DEAD") return;
    const slot = this.currentWeapon;
    const weaponBoostAtkSpeedMult = this.weaponBoostActive ? this.characterDef.weaponBoostMultiplier ?? 2 : 1;
    const effectiveFireRateMs = slot.def.fireRateMs / (this.fireRateMult * weaponBoostAtkSpeedMult);

    if (slot.def.category === "ranged") {
      const energyCost = this.weaponBoostActive ? 0 : slot.def.energyCost;
      if (this.stats.energy < energyCost) {
        // Out of energy — fall back to a free unarmed punch instead of leaving the player helpless.
        this.tryUnarmedAttack(time);
        return;
      }
      if (time - slot.lastShotAt < effectiveFireRateMs) return;
      this.stats.energy -= energyCost;
      slot.lastShotAt = time;
      this.onEnergyChanged?.();
      this.onFired?.(this.x, this.y, this.aimAngle, slot.def);
    } else {
      if (time - slot.lastShotAt < effectiveFireRateMs) return;
      slot.lastShotAt = time;
      this.onMeleeAttack?.(this.x, this.y, this.aimAngle, slot.def);
    }
  }

  private tryUnarmedAttack(time: number): void {
    const rate = UNARMED_FIRE_RATE_MS / this.fireRateMult;
    if (time - this.lastUnarmedAt < rate) return;
    this.lastUnarmedAt = time;
    this.onUnarmedAttack?.(this.x, this.y, this.aimAngle);
  }

  get effectiveSkillCooldownMs(): number {
    return this.characterDef.skillCooldownMs * this.cooldownMult;
  }

  trySkill(time: number): void {
    if (this.playerState === "DEAD") return;
    if (time - this.lastSkillAt < this.effectiveSkillCooldownMs) return;
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
        // A refund-triggered recast keeps the streak; a normal cast (cooldown fully elapsed) starts a new one.
        if (!this.dashChainActive) this.dashRefundStreak = 0;
        this.dashChainActive = false;
        this.onSkillUsed?.("dashSlash", { x: this.x, y: this.y, angle: this.aimAngle });
        break;

      case "fireBarrage":
        this.onSkillUsed?.("fireBarrage", { x: this.x, y: this.y, angle: this.aimAngle });
        break;

      case "healPulse":
        this.heal(this.characterDef.healAmount ?? 30);
        this.onSkillUsed?.("healPulse", { x: this.x, y: this.y, angle: this.aimAngle });
        break;

      case "weaponBoost":
        this.weaponBoostEndsAt = time + (this.characterDef.weaponBoostDurationMs ?? 6000);
        this.onSkillUsed?.("weaponBoost", { x: this.x, y: this.y, angle: this.aimAngle });
        break;
    }
  }

  /**
   * Called by GameScene when a dash-slash hit kills an enemy: makes the skill
   * ready again immediately, up to DASH_KILL_REFUND_CAP times per chain.
   */
  refundDashCooldown(): void {
    if (this.dashRefundStreak >= DASH_KILL_REFUND_CAP) return;
    this.dashRefundStreak++;
    this.dashChainActive = true;
    this.lastSkillAt = -Infinity;
  }

  getHudInfo(): HudWeaponInfo {
    const active = this.currentWeapon.def;
    const reserve = this.weapons[this.currentWeaponIndex === 0 ? 1 : 0].def;
    return {
      activeName: active.name,
      activeIconKey: weaponIconKey(active),
      reserveName: reserve.name,
      reserveIconKey: weaponIconKey(reserve),
    };
  }

  getSkillHudInfo(): HudSkillInfo {
    const cooldownMs = this.effectiveSkillCooldownMs;
    const elapsed = this.scene.time.now - this.lastSkillAt;
    const remainingMs = Math.max(0, cooldownMs - elapsed);
    return {
      name: this.characterDef.skillName,
      remainingMs,
      cooldownMs,
      ready: remainingMs <= 0,
    };
  }

  takeDamage(amount: number): void {
    if (this.playerState === "DEAD") return;
    const reduced = amount * Math.max(0, 1 - this.characterDef.defenseReduction);

    const isNearDeathOrHeavyHit =
      this.stats.hp - reduced <= this.stats.maxHp * SHIELD_TRIGGER_HP_FRACTION ||
      reduced >= this.stats.maxHp * SHIELD_TRIGGER_HP_FRACTION;
    if (this.shieldCharges > 0 && isNearDeathOrHeavyHit) {
      this.shieldCharges--;
      this.shieldRechargeAt = this.scene.time.now + SHIELD_RECHARGE_MS;
      this.onShieldTriggered?.();
      return;
    }

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

  /**
   * Only the currently held weapon is ever replaced — the player carries one weapon in hand
   * and one on their back. Returns the bumped weapon so the caller can drop it on the ground.
   */
  equipWeapon(def: WeaponDef): WeaponDef {
    const bumped = this.weapons[this.currentWeaponIndex].def;
    this.weapons[this.currentWeaponIndex] = createWeaponInstanceFromDef(def);
    this.refreshHandWeapon();
    return bumped;
  }

  getSnapshot(): PlayerSnapshot {
    return {
      hp: this.stats.hp,
      maxHp: this.stats.maxHp,
      energy: this.stats.energy,
      maxEnergy: this.stats.maxEnergy,
      coins: this.coins,
      upgradeCounts: { ...this.upgradeCounts },
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
    this.upgradeCounts = { ...snapshot.upgradeCounts };
    this.shieldCharges = this.stackCount("emergencyShield");
    this.weapons = [createWeaponInstanceFromDef(snapshot.weapons[0]), createWeaponInstanceFromDef(snapshot.weapons[1])];
    this.currentWeaponIndex = snapshot.currentWeaponIndex;
    this.refreshHandWeapon();
    this.onHpChanged?.();
    this.onEnergyChanged?.();
  }

  /** Applies a between-stage upgrade pick: records the stack and applies any immediate one-time effect. */
  applyUpgrade(id: UpgradeId): void {
    const count = (this.upgradeCounts[id] ?? 0) + 1;
    this.upgradeCounts[id] = count;

    switch (id) {
      case "maxHp":
        this.increaseMaxHp(25);
        break;
      case "maxEnergy":
        this.stats.maxEnergy += 20;
        this.stats.energy += 20;
        this.onEnergyChanged?.();
        break;
      case "emergencyShield":
        // Grant the newly-unlocked charge immediately rather than waiting a full recharge cycle.
        this.shieldCharges = count;
        break;
    }
  }

  private die(): void {
    this.playerState = "DEAD";
    this.setVelocity(0, 0);
    this.handWeapon.setVisible(false);
    this.play(this.charSprites.death.key);
  }

  destroy(fromScene?: boolean): void {
    this.handWeapon.destroy();
    super.destroy(fromScene);
  }
}
