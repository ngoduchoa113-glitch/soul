import Phaser from "phaser";
import { Player, type WasdKeys, type SkillPayload, type PlayerSnapshot } from "../entities/Player";
import { Projectile, type HomingConfig, type ProjectileExtraOptions } from "../entities/Projectile";
import { EnergyPickup } from "../entities/EnergyPickup";
import { CoinPickup } from "../entities/CoinPickup";
import { HpPickup } from "../entities/HpPickup";
import { WeaponPickup } from "../entities/WeaponPickup";
import { SpikeTrap } from "../entities/SpikeTrap";
import { ExplosiveCrate } from "../entities/ExplosiveCrate";
import { PoisonBarrel } from "../entities/PoisonBarrel";
import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import type { Combatant } from "../entities/Combatant";
import { elementColor, type EnemyDef } from "../data/enemies";
import { Hud } from "../ui/Hud";
import { ChoiceMenu } from "../ui/ChoiceMenu";
import { Minimap } from "../ui/Minimap";
import type { WeaponDef } from "../data/weapons";
import type { CharacterId, SkillId } from "../data/characters";
import { UPGRADES, pickRandomUpgradeOptions, type UpgradeId } from "../data/upgrades";
import { Dungeon } from "../dungeon/Dungeon";
import type { StageKind } from "../dungeon/DungeonLayout";
import type { ChestReward } from "../entities/Chest";
import type { ShopStand, ShopItem } from "../entities/ShopStand";
import { Sfx } from "../audio/Sfx";
import { Fx } from "../fx/Fx";
import { CAMERA_ZOOM } from "../ui/uiScale";
import { createPanel } from "../ui/panel";
import { COLOR, COLOR_NUM, bodyStyle, titleStyle } from "../ui/textStyles";

export interface GameSceneData {
  characterId: CharacterId;
  floor: number;
  stage: number;
  snapshot?: PlayerSnapshot;
}

function stageKindFor(stage: number): StageKind {
  if (stage === 5) return "boss";
  if (stage === 6) return "trophy";
  return "regular";
}

const DEFAULT_MELEE_ARC_DEG = 100;
const INTERACT_RADIUS = 40;
const CHEST_TOUCH_RADIUS = 30;
const UNARMED_RANGE = 45;
const UNARMED_ARC_DEG = 100;
const HP_ORB_HEAL_AMOUNT = 15;
const STAGE_UPGRADE_OPTION_COUNT = 3;

interface ActionKeys {
  one: Phaser.Input.Keyboard.Key;
  two: Phaser.Input.Keyboard.Key;
  three: Phaser.Input.Keyboard.Key;
  four: Phaser.Input.Keyboard.Key;
  five: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  fullscreen: Phaser.Input.Keyboard.Key;
}

const ENEMY_ENERGY_DROP_CHANCE = 0.6;
const ENEMY_ENERGY_DROP_RANGE: [number, number] = [8, 15];
const ENEMY_COIN_DROP_CHANCE = 0.5;
const ENEMY_COIN_DROP_RANGE: [number, number] = [3, 8];
const BOSS_ENERGY_DROP_AMOUNT = 50;
const BOSS_COIN_DROP_AMOUNT = 100;
const FIRE_BARRAGE_SPEED = 260;
const FIRE_BARRAGE_TURN_RATE = Math.PI * 2.2;

type ActiveChoice =
  | { kind: "stageUpgrade"; pendingData: GameSceneData; options: UpgradeId[] }
  | { kind: "shop"; stand: ShopStand };

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private dungeon!: Dungeon;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  /** Status effect to apply to the player on hit, for elemental enemy bullets — side channel since Projectile itself is element-agnostic. */
  private enemyProjectileDots = new WeakMap<Projectile, { dotDamage: number; tickMs: number; durationMs: number; color: number }>();
  private energyPickups!: Phaser.Physics.Arcade.Group;
  private coinPickups!: Phaser.Physics.Arcade.Group;
  private hpPickups!: Phaser.Physics.Arcade.Group;
  private weaponPickups!: Phaser.Physics.Arcade.Group;
  private keys!: WasdKeys;
  private actionKeys!: ActionKeys;
  private hud!: Hud;
  private choiceMenu!: ChoiceMenu;
  private minimap!: Minimap;
  private uiContainer!: Phaser.GameObjects.Container;
  private weaponInfoPanel!: Phaser.GameObjects.Container;
  private weaponInfoBg!: Phaser.GameObjects.Rectangle;
  private weaponInfoText!: Phaser.GameObjects.Text;
  private sfx!: Sfx;
  private fx!: Fx;
  private activeChoice: ActiveChoice | null = null;
  private dashHitSet = new Set<Combatant>();
  private floor = 1;
  private stage = 1;
  private killCount = 0;
  private isPaused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super("GameScene");
  }

  create(data: GameSceneData): void {
    this.cameras.main.fadeIn(220, 10, 10, 14);
    this.sfx = new Sfx();
    this.fx = new Fx(this);
    this.floor = data.floor ?? 1;
    this.stage = data.stage ?? 1;

    const seed = `${Date.now()}-${this.floor}-${this.stage}`;
    this.dungeon = new Dungeon(
      this,
      seed,
      stageKindFor(this.stage),
      {
        onAttackPlayer: (damage) => this.handlePlayerAttacked(damage),
        onFireProjectile: (x, y, angle, damage, speed) => this.spawnEnemyProjectile(x, y, angle, damage, speed),
        onFireProjectilePattern: (x, y, angle, def) => this.fireEnemyProjectilePattern(x, y, angle, def),
        onCastZone: (x, y, def) => this.handleEnemyCastZone(x, y, def),
        onHealAlly: (healer, radius, amount) => this.handleHealAlly(healer, radius, amount),
        onBuffAllies: (buffer, def) => this.handleBuffAllies(buffer, def),
        onBossPhaseChanged: (phase) => this.hud.flashMessage(`BOSS PHASE ${phase}!`),
        onDeath: (entity) => this.handleEntityDeath(entity),
      },
      () => this.advanceStage(),
      { fx: this.fx, sfx: this.sfx },
    );

    const spawn = this.dungeon.getSpawnPoint();
    this.player = new Player(this, spawn.x, spawn.y, data.characterId ?? "knight");
    this.player.setCallbacks({
      onHpChanged: () => this.hud.setHp(this.player.stats.hp, this.player.stats.maxHp),
      onEnergyChanged: () => this.hud.setEnergy(this.player.stats.energy, this.player.stats.maxEnergy),
      onFired: (x, y, angle, weapon) => this.spawnProjectile(x, y, angle, weapon),
      onMeleeAttack: (x, y, angle, weapon) => {
        this.sfx.playMeleeSwing();
        this.handleMeleeAttack(x, y, angle, weapon);
      },
      onUnarmedAttack: (x, y, angle) => {
        this.sfx.playMeleeSwing();
        this.handleUnarmedAttack(x, y, angle);
      },
      onSkillUsed: (kind, payload) => this.handleSkillUsed(kind, payload),
      onShieldTriggered: () => this.handleShieldTriggered(),
    });

    this.physics.world.setBounds(0, 0, this.dungeon.worldWidth, this.dungeon.worldHeight);

    this.projectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: false });
    this.enemyProjectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: false });
    this.energyPickups = this.physics.add.group({ classType: EnergyPickup, runChildUpdate: false });
    this.coinPickups = this.physics.add.group({ classType: CoinPickup, runChildUpdate: false });
    this.hpPickups = this.physics.add.group({ classType: HpPickup, runChildUpdate: false });
    this.weaponPickups = this.physics.add.group({ classType: WeaponPickup, runChildUpdate: false });

    this.physics.add.collider(this.player, this.dungeon.collidables);
    this.physics.add.collider(this.dungeon.enemies, this.dungeon.collidables);
    // Samurai's Iaijutsu Strike dashes *through* enemies to hit everything along the way —
    // skip collision resolution entirely while dashing so the blocking collider doesn't stop
    // the player right at an enemy's edge before the dash-hit check below can register it.
    this.physics.add.collider(this.player, this.dungeon.enemies, undefined, () => !this.player.isDashing);

    this.physics.add.collider(this.projectiles, this.dungeon.collidables, (proj) => {
      const projectile = proj as Projectile;
      if (!projectile.canHandleWallCollision(this.time.now)) return;
      if (projectile.bouncesRemaining > 0) {
        projectile.bouncesRemaining--;
        projectile.setRotation(projectile.body!.velocity.angle());
        return;
      }
      projectile.onImpact?.(projectile.x, projectile.y);
      projectile.destroy();
    });
    this.physics.add.overlap(this.projectiles, this.dungeon.enemies, (proj, enemy) => {
      const projectile = proj as Projectile;
      const target = enemy as unknown as Combatant;

      if (projectile.pierceCharges > 0) {
        if (!projectile.registerHit(target)) return;
        target.takeDamage(projectile.damage);
        this.fx.hitSpark(projectile.x, projectile.y);
        this.sfx.playHit();
        if (projectile.pierceCharges !== Infinity) projectile.pierceCharges--;
        return;
      }

      if (projectile.onImpact) {
        projectile.onImpact(projectile.x, projectile.y);
      } else {
        target.takeDamage(projectile.damage);
        this.fx.hitSpark(projectile.x, projectile.y);
      }
      this.sfx.playHit();
      projectile.destroy();
    });

    this.physics.add.collider(this.enemyProjectiles, this.dungeon.collidables, (proj) => {
      const projectile = proj as Projectile;
      if (!projectile.canHandleWallCollision(this.time.now)) return;
      if (projectile.bouncesRemaining > 0) {
        projectile.bouncesRemaining--;
        projectile.setRotation(projectile.body!.velocity.angle());
        return;
      }
      projectile.destroy();
    });
    // Phaser's overlap swaps argument order when arg2 is a lone Sprite (not a Group):
    // the callback receives (player, projectileGroupMember), not (groupMember, player).
    this.physics.add.overlap(this.enemyProjectiles, this.player, (_playerObj, proj) => {
      const projectile = proj as Projectile;
      if (this.player.currentWeapon.def.category === "melee" && Math.random() < this.player.meleeReflectChance) {
        this.reflectProjectile(projectile);
        return;
      }
      this.fx.hitSpark(projectile.x, projectile.y);
      this.fx.damageFlash(this.player);
      this.fx.screenShake(0.004, 120);
      this.sfx.playPlayerHit();
      this.player.takeDamage(projectile.damage);
      const dot = this.enemyProjectileDots.get(projectile);
      if (dot) this.applyPlayerDot(dot.dotDamage, dot.tickMs, dot.durationMs, dot.color);
      projectile.destroy();
    });

    // Same argument-order quirk as the enemyProjectiles/player overlap above.
    this.physics.add.overlap(this.energyPickups, this.player, (_playerObj, pickup) => {
      const orb = pickup as EnergyPickup;
      this.player.gainEnergy(orb.amount * this.player.energyOrbMult);
      this.fx.hitSpark(orb.x, orb.y, 0x60a5fa);
      this.sfx.playPickup();
      orb.destroy();
    });

    this.physics.add.overlap(this.coinPickups, this.player, (_playerObj, pickup) => {
      const coin = pickup as CoinPickup;
      this.player.coins += coin.amount;
      this.hud.setCoins(this.player.coins);
      this.fx.hitSpark(coin.x, coin.y, 0xf6d365);
      this.sfx.playPickup();
      coin.destroy();
    });

    this.physics.add.overlap(this.hpPickups, this.player, (_playerObj, pickup) => {
      const orb = pickup as HpPickup;
      this.player.heal(orb.amount);
      this.fx.hitSpark(orb.x, orb.y, 0xe25555);
      this.sfx.playPickup();
      orb.destroy();
    });

    // TNT crates / poison barrels are solid — block movement like any other obstacle...
    this.physics.add.collider(this.player, this.dungeon.destructibles);
    this.physics.add.collider(this.dungeon.enemies, this.dungeon.destructibles);
    // ...but a shot landing on one triggers it instead of just stopping there.
    this.physics.add.collider(this.projectiles, this.dungeon.destructibles, (proj, obj) => {
      this.triggerDestructible(obj as ExplosiveCrate | PoisonBarrel);
      (proj as Projectile).destroy();
    });
    this.physics.add.collider(this.enemyProjectiles, this.dungeon.destructibles, (proj, obj) => {
      this.triggerDestructible(obj as ExplosiveCrate | PoisonBarrel);
      (proj as Projectile).destroy();
    });

    // Spike traps are walkable (no blocking collider) — just periodic overlap damage.
    this.physics.add.overlap(this.player, this.dungeon.hazards, (_playerObj, obj) => {
      const trap = obj as SpikeTrap;
      if (!trap.canDamage(this.time.now, this.player)) return;
      this.player.takeDamage(trap.damage);
      this.fx.damageFlash(this.player);
      this.fx.hitSpark(this.player.x, this.player.y, 0x9ca3af);
    });
    this.physics.add.overlap(this.dungeon.enemies, this.dungeon.hazards, (enemyObj, obj) => {
      const trap = obj as SpikeTrap;
      const enemy = enemyObj as unknown as Combatant;
      if (!enemy.active || !enemy.alive || !trap.canDamage(this.time.now, enemy)) return;
      enemy.takeDamage(trap.damage);
      this.fx.hitSpark(enemy.x, enemy.y, 0x9ca3af);
    });

    this.setupInput();
    this.setupCamera();

    // Screen-fixed UI layer: repositioned/rescaled every frame in update() to counteract the
    // zoomed world camera's scroll and zoom (see Hud's constructor doc for why scrollFactor(0)
    // alone isn't enough). Everything meant to stay glued to the screen — HUD, menus, pause
    // overlay — gets added to this instead of using scrollFactor(0) directly.
    this.uiContainer = this.add.container(0, 0).setDepth(50);

    this.hud = new Hud(this, this.uiContainer);
    if (data.snapshot) this.player.applySnapshot(data.snapshot);
    this.hud.setHp(this.player.stats.hp, this.player.stats.maxHp);
    this.hud.setEnergy(this.player.stats.energy, this.player.stats.maxEnergy);
    this.hud.setCoins(this.player.coins);
    this.hud.setStage(this.floor, this.stage);
    this.choiceMenu = new ChoiceMenu(this, this.uiContainer);
    this.minimap = new Minimap(this, this.uiContainer);
    this.isPaused = false;
    this.buildPauseOverlay();
    this.buildWeaponInfoPanel();
  }

  private buildWeaponInfoPanel(): void {
    this.weaponInfoBg = this.add
      .rectangle(0, 0, 170, 90, 0x0e0e14, 0.85)
      .setStrokeStyle(2, COLOR_NUM.accent);
    this.weaponInfoText = this.add.text(0, 0, "", { ...bodyStyle(12), align: "center", lineSpacing: 4 }).setOrigin(0.5);
    this.weaponInfoPanel = this.add.container(0, 0, [this.weaponInfoBg, this.weaponInfoText]).setDepth(60).setVisible(false);
  }

  /** Shows a stat card above the nearest weapon on the ground once the player is close enough to pick it up (E). */
  private updateWeaponInfoPanel(): void {
    const pickup = this.getNearestWeaponPickup();
    const dist = pickup ? Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y) : Infinity;
    if (!pickup || !pickup.collectable || dist > INTERACT_RADIUS) {
      this.weaponInfoPanel.setVisible(false);
      return;
    }

    const def = pickup.def;
    const fireRate = (1000 / def.fireRateMs).toFixed(1);
    const critChance = Math.round((def.criticalChance + this.player.critChance) * 100);
    const lines = [
      def.name,
      `Damage: ${Math.round(def.damage)}`,
      `Energy: ${def.energyCost}`,
      `Fire Rate: ${fireRate}/s`,
      `Crit: ${critChance}%`,
      "[E] Pick up",
    ];
    this.weaponInfoText.setText(lines.join("\n"));
    this.weaponInfoBg.setSize(this.weaponInfoText.width + 24, this.weaponInfoText.height + 16);
    this.weaponInfoPanel.setPosition(pickup.x, pickup.y - 46);
    this.weaponInfoPanel.setVisible(true);
  }

  private buildPauseOverlay(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panel = createPanel(this, cx, cy, 320, 200, { depth: 300 });
    const title = this.add.text(cx, cy - 70, "PAUSED", titleStyle(20, COLOR.gold)).setOrigin(0.5).setDepth(301);
    const resumeBtn = this.add
      .text(cx, cy - 10, "1) Resume", bodyStyle(18))
      .setOrigin(0.5)
      .setDepth(301)
      .setInteractive({ useHandCursor: true });
    const quitBtn = this.add
      .text(cx, cy + 30, "2) Quit to Menu", bodyStyle(18))
      .setOrigin(0.5)
      .setDepth(301)
      .setInteractive({ useHandCursor: true });
    resumeBtn.on("pointerdown", () => this.togglePause());
    quitBtn.on("pointerdown", () => this.quitToMenu());

    this.pauseOverlay = this.add.container(0, 0, [...panel.all, title, resumeBtn, quitBtn]).setVisible(false);
    this.uiContainer.add(this.pauseOverlay);
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);
    if (this.isPaused) {
      this.physics.world.pause();
    } else {
      this.physics.world.resume();
    }
  }

  /** Short fade-to-black before handing off to another scene (or restarting this one for the next stage) instead of a hard cut. */
  private transitionToScene(key: string, data?: GameSceneData): void {
    this.cameras.main.fadeOut(200, 10, 10, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key, data);
    });
  }

  private quitToMenu(): void {
    this.physics.world.resume();
    this.transitionToScene("MainMenuScene");
  }

  private advanceStage(): void {
    if (this.stage === 6) {
      this.transitionToScene("MainMenuScene");
      return;
    }

    const snapshot = this.player.getSnapshot();
    let nextFloor = this.floor;
    let nextStage = this.stage + 1;

    if (this.stage === 5) {
      if (this.floor < 2) {
        nextFloor = this.floor + 1;
        nextStage = 1;
      } else {
        nextStage = 6; // trophy stage
      }
    }

    const data: GameSceneData = {
      characterId: this.player.characterDef.id,
      floor: nextFloor,
      stage: nextStage,
      snapshot,
    };
    this.openStageUpgradeChoice(data);
  }

  /** Between-stage power pick — offered right before the next stage loads, instead of mid-run from chests. */
  private openStageUpgradeChoice(pendingData: GameSceneData): void {
    const options = pickRandomUpgradeOptions(this.player.upgradeCounts, STAGE_UPGRADE_OPTION_COUNT);
    if (options.length === 0) {
      this.transitionToScene("GameScene", pendingData);
      return;
    }
    this.activeChoice = { kind: "stageUpgrade", pendingData, options };
    const lines = options.map((id, i) => `${i + 1}) ${UPGRADES[id].icon} ${UPGRADES[id].name} — ${UPGRADES[id].description}`);
    this.choiceMenu.show("Choose a Power", lines);
  }

  private handlePlayerAttacked(damage: number): void {
    this.fx.damageFlash(this.player);
    this.fx.screenShake(0.004, 120);
    this.sfx.playPlayerHit();
    this.player.takeDamage(damage);
  }

  private handleShieldTriggered(): void {
    this.fx.explosion(this.player.x, this.player.y, 55, 0x60a5fa, 0xbfe3ff);
    this.fx.screenShake(0.008, 200);
    this.sfx.playSkill();
    this.hud.flashMessage("Shield!");
  }

  private handleEntityDeath(entity: Enemy | Boss): void {
    this.killCount++;
    if (entity instanceof Boss) {
      this.spawnEnergyPickup(entity.x, entity.y, BOSS_ENERGY_DROP_AMOUNT);
      this.spawnCoinPickup(entity.x, entity.y, BOSS_COIN_DROP_AMOUNT);
      this.fx.explosion(entity.x, entity.y, 70, 0xef4444, 0xffb3b3);
      this.fx.screenShake(0.012, 350);
      this.sfx.playBossDeath();
      return;
    }
    if (Math.random() < ENEMY_ENERGY_DROP_CHANCE + this.player.energyHarvestChanceBonus) {
      const amount = Phaser.Math.Between(...ENEMY_ENERGY_DROP_RANGE) * this.player.energyHarvestAmountMult;
      this.spawnEnergyPickup(entity.x, entity.y, amount);
    }
    if (Math.random() < ENEMY_COIN_DROP_CHANCE) {
      this.spawnCoinPickup(entity.x, entity.y, Phaser.Math.Between(...ENEMY_COIN_DROP_RANGE));
    }
    if (Math.random() < this.player.lifeHarvestChance) {
      this.spawnHpPickup(entity.x, entity.y, HP_ORB_HEAL_AMOUNT);
    }
    if (entity.def.behavior === "bomber") return; // Enemy.explode() already played its own VFX/SFX
    this.fx.deathPoof(entity.x, entity.y);
    this.sfx.playEnemyDeath();
  }

  private spawnEnergyPickup(x: number, y: number, amount: number): EnergyPickup {
    const pickup = new EnergyPickup(this, x, y, amount);
    this.energyPickups.add(pickup);
    return pickup;
  }

  private spawnCoinPickup(x: number, y: number, amount: number): CoinPickup {
    const pickup = new CoinPickup(this, x, y, amount);
    this.coinPickups.add(pickup);
    return pickup;
  }

  /** Chest-opening flourish: a burst of coins and energy orbs flying outward from the chest. */
  private scatterChestLoot(x: number, y: number): void {
    const coinCount = Phaser.Math.Between(3, 5);
    for (let i = 0; i < coinCount; i++) {
      this.popOutPickup(this.spawnCoinPickup(x, y, Phaser.Math.Between(2, 5)));
    }
    const energyCount = Phaser.Math.Between(2, 3);
    for (let i = 0; i < energyCount; i++) {
      this.popOutPickup(this.spawnEnergyPickup(x, y, Phaser.Math.Between(3, 6)));
    }
  }

  /** Animates a freshly-spawned pickup flying outward a short distance from its spawn point. */
  private popOutPickup(sprite: Phaser.Physics.Arcade.Sprite): void {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(36, 64);
    const targetX = sprite.x + Math.cos(angle) * dist;
    const targetY = sprite.y + Math.sin(angle) * dist;
    sprite.setScale(0.4);
    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      scale: 1,
      duration: 260,
      ease: "Back.Out",
      // Arcade syncs a dynamic body's display position FROM the body each physics step, so
      // tweening x/y alone would get overwritten — keep the body glued to the tweened sprite.
      // The pickup can be collected (destroyed) mid-flight, which clears its body — guard that.
      onUpdate: () => {
        if (sprite.active && sprite.body) (sprite.body as Phaser.Physics.Arcade.Body).reset(sprite.x, sprite.y);
      },
    });
  }

  private spawnHpPickup(x: number, y: number, amount: number): void {
    const pickup = new HpPickup(this, x, y, amount);
    this.hpPickups.add(pickup);
  }

  /** Drops a bumped-out weapon a short distance from (x, y) so it doesn't land exactly under the player. */
  private spawnWeaponPickup(x: number, y: number, def: WeaponDef): void {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(30, 46);
    const pickup = new WeaponPickup(this, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, def);
    this.weaponPickups.add(pickup);
  }

  private getNearestWeaponPickup(): WeaponPickup | undefined {
    let nearest: WeaponPickup | undefined;
    let nearestDist = Infinity;
    this.weaponPickups.getChildren().forEach((child) => {
      const pickup = child as WeaponPickup;
      if (!pickup.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = pickup;
      }
    });
    return nearest;
  }

  private collectWeaponPickup(pickup: WeaponPickup): void {
    const bumped = this.player.equipWeapon(pickup.def);
    this.fx.hitSpark(pickup.x, pickup.y, 0xffffff);
    this.sfx.playPickup();
    pickup.destroy();
    this.spawnWeaponPickup(this.player.x, this.player.y, bumped);
  }

  /** Rolls a critical hit once for a damage-dealing action (one roll per shot/swing/burst, not per target hit). */
  private rollDamage(baseDamage: number): { damage: number; crit: boolean } {
    const isCrit = Math.random() < this.player.critChance;
    return { damage: isCrit ? baseDamage * this.player.critDamageMult : baseDamage, crit: isCrit };
  }

  private spawnProjectile(x: number, y: number, baseAngle: number, weapon: WeaponDef): void {
    const { damage, crit } = this.rollDamage(weapon.damage * this.player.damageMultiplier);

    if (weapon.behavior === "laser") {
      this.fireLaser(x, y, baseAngle, weapon, damage);
      return;
    }
    if (weapon.behavior === "shockwave") {
      this.sfx.playSkill();
      this.fireShockwave(x, y, weapon, damage, 0xa78bfa, 0xe9d5ff);
      return;
    }

    this.fx.muzzleFlash(x, y, baseAngle);
    this.sfx.playShoot();

    let pelletCount = weapon.pellets + this.player.bonusPellets;
    if (Math.random() < this.player.splitShotChance) pelletCount += 1;

    for (let i = 0; i < pelletCount; i++) {
      const jitterDeg = Phaser.Math.RND.realInRange(-weapon.spreadDeg / 2, weapon.spreadDeg / 2) * this.player.spreadMult;
      const angle = baseAngle + Phaser.Math.DegToRad(jitterDeg);
      const startX = x + Math.cos(angle) * 24;
      const startY = y + Math.sin(angle) * 24;
      const projectile = this.createWeaponProjectile(startX, startY, damage, weapon, crit);
      this.projectiles.add(projectile);
      projectile.launch(angle, weapon.projectileSpeed);
    }
  }

  private createWeaponProjectile(x: number, y: number, damage: number, weapon: WeaponDef, crit: boolean): Projectile {
    const pierceCharges = this.player.bonusPierce + (crit && this.player.piercingCritActive ? 1 : 0);
    const bounces = this.player.bonusBounces;

    switch (weapon.behavior) {
      case "homing":
        return new Projectile(
          this,
          x,
          y,
          damage,
          (px, py) => this.fx.trailDot(px, py, 0x60d3ff),
          {
            speed: weapon.projectileSpeed,
            turnRateRadPerSec: Phaser.Math.DegToRad(weapon.homingTurnRateDegPerSec ?? 240),
            acquireTarget: (fx, fy) => this.findNearestEnemyPointFrom(fx, fy),
          },
          { pierceCharges, bounces },
        );
      case "boomerang":
        return new Projectile(this, x, y, damage, (px, py) => this.fx.trailDot(px, py, 0x38bdf8), undefined, {
          boomerang: {
            outDistance: weapon.range,
            returnSpeed: weapon.projectileSpeed,
            getReturnPoint: () => ({ x: this.player.x, y: this.player.y }),
          },
        });
      case "explosive":
        return new Projectile(this, x, y, damage, (px, py) => this.fx.trailDot(px, py, 0xff9f43), undefined, {
          onImpact: (ex, ey) => this.explodeAt(ex, ey, weapon.explodeRadius ?? 80, damage, 0xff9f43),
        });
      case "poison":
        return new Projectile(this, x, y, damage, (px, py) => this.fx.trailDot(px, py, 0x4ade80), undefined, {
          onImpact: (ex, ey) => this.spawnDotZone(ex, ey, weapon, damage, weapon.dotDamage ?? 4, 0x4ade80),
        });
      case "fire":
        return new Projectile(this, x, y, damage, (px, py) => this.fx.trailDot(px, py, 0xff6b35), undefined, {
          onImpact: (ex, ey) => this.spawnDotZone(ex, ey, weapon, damage, weapon.dotDamage ?? 6, 0xff6b35),
        });
      default:
        return new Projectile(this, x, y, damage, (px, py) => this.fx.trailDot(px, py, 0xf6e05e), undefined, {
          pierceCharges,
          bounces,
        });
    }
  }

  /** Hitscan beam that pierces every enemy along the line, up to `weapon.range`. */
  private fireLaser(x: number, y: number, angle: number, weapon: WeaponDef, damage: number): void {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const endX = x + dirX * weapon.range;
    const endY = y + dirY * weapon.range;
    const beamHalfWidth = 16 * this.player.laserWidthMult;
    const effectiveDamage = damage * this.player.laserDamageMult;

    this.fx.muzzleFlash(x, y, angle);
    this.fx.laserBeam(x, y, endX, endY, 0xff4d6d, 3 * this.player.laserWidthMult + 1);
    this.sfx.playShoot();

    this.dungeon.enemies.getChildren().forEach((child) => {
      const enemy = child as unknown as Combatant;
      if (!enemy.active || !enemy.alive) return;
      const toEnemyX = enemy.x - x;
      const toEnemyY = enemy.y - y;
      const along = toEnemyX * dirX + toEnemyY * dirY;
      if (along < 0 || along > weapon.range) return;
      const perpendicular = Math.abs(toEnemyX * dirY - toEnemyY * dirX);
      if (perpendicular > beamHalfWidth) return;
      enemy.takeDamage(effectiveDamage);
      this.fx.hitSpark(enemy.x, enemy.y, 0xff4d6d);
    });
  }

  /** AoE burst centered on (x, y) — used by the shockwave staff and the hammer's ground slam. */
  private fireShockwave(x: number, y: number, weapon: WeaponDef, damage: number, color: number, strokeColor: number): void {
    const radius = weapon.explodeRadius ?? weapon.range;
    this.fx.explosion(x, y, radius, color, strokeColor);
    this.fx.screenShake(0.006, 150);
    this.dealAoeDamage(x, y, radius, damage, color);
  }

  /** Bomb detonation on impact or expiry. */
  private explodeAt(x: number, y: number, radius: number, damage: number, color: number): void {
    this.fx.explosion(x, y, radius, color);
    this.fx.screenShake(0.006, 150);
    this.sfx.playHit();
    this.dealAoeDamage(x, y, radius, damage, color);
  }

  /** Poison/fire impact: an immediate splash followed by ticking damage-over-time in the zone. */
  private spawnDotZone(x: number, y: number, weapon: WeaponDef, impactDamage: number, dotBase: number, color: number): void {
    const dotDamage = dotBase * this.player.damageMultiplier;
    const radius = weapon.explodeRadius ?? 70;
    const tickMs = weapon.dotTickMs ?? 500;
    const durationMs = weapon.dotDurationMs ?? 3000;
    const ticks = Math.max(1, Math.round(durationMs / tickMs));

    this.fx.explosion(x, y, radius, color, color);
    this.sfx.playHit();
    this.dealAoeDamage(x, y, radius, impactDamage, color);

    this.time.addEvent({
      delay: tickMs,
      repeat: ticks - 1,
      callback: () => this.dealAoeDamage(x, y, radius, dotDamage, color),
    });
  }

  private dealAoeDamage(x: number, y: number, radius: number, damage: number, color = 0xffffff): void {
    this.dungeon.enemies.getChildren().forEach((child) => {
      const enemy = child as unknown as Combatant;
      if (!enemy.active || !enemy.alive) return;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius) {
        enemy.takeDamage(damage);
        this.fx.hitSpark(enemy.x, enemy.y, color);
      }
    });
  }

  /** Same as dealAoeDamage but also hits the player — for environmental hazards (TNT, poison), not player weapons. */
  private dealAoeDamageToAll(x: number, y: number, radius: number, damage: number, color = 0xffffff): void {
    this.dealAoeDamage(x, y, radius, damage, color);
    if (this.player.playerState !== "DEAD" && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= radius) {
      this.player.takeDamage(damage);
      this.fx.damageFlash(this.player);
    }
  }

  private triggerDestructible(obj: ExplosiveCrate | PoisonBarrel): void {
    if (obj.triggered || !obj.active) return;
    obj.triggered = true;
    if (obj instanceof ExplosiveCrate) this.triggerExplosiveCrate(obj);
    else this.triggerPoisonBarrel(obj);
  }

  /** TNT: detonates on impact, damaging player and enemies alike, and chain-reacts nearby crates. */
  private triggerExplosiveCrate(crate: ExplosiveCrate): void {
    this.fx.explosion(crate.x, crate.y, crate.explodeRadius, 0xff9f43);
    this.fx.screenShake(0.01, 250);
    this.sfx.playHit();
    this.dealAoeDamageToAll(crate.x, crate.y, crate.explodeRadius, crate.damage, 0xff9f43);

    this.dungeon.destructibles.getChildren().forEach((child) => {
      if (child === crate || !(child instanceof ExplosiveCrate) || child.triggered) return;
      if (Phaser.Math.Distance.Between(crate.x, crate.y, child.x, child.y) <= crate.explodeRadius) {
        child.triggered = true;
        this.time.delayedCall(90, () => this.triggerExplosiveCrate(child));
      }
    });
    crate.destroy();
  }

  /** Poison barrel: ruptures on impact into a lingering damage-over-time cloud hitting player and enemies. */
  private triggerPoisonBarrel(barrel: PoisonBarrel): void {
    const { x, y, radius, impactDamage, tickDamage, tickMs, durationMs } = barrel;
    const ticks = Math.max(1, Math.round(durationMs / tickMs));

    this.fx.explosion(x, y, radius, 0x4ade80, 0x4ade80);
    this.sfx.playHit();
    this.dealAoeDamageToAll(x, y, radius, impactDamage, 0x4ade80);

    this.time.addEvent({
      delay: tickMs,
      repeat: ticks - 1,
      callback: () => this.dealAoeDamageToAll(x, y, radius, tickDamage, 0x4ade80),
    });
    barrel.destroy();
  }

  private spawnEnemyProjectile(x: number, y: number, angle: number, damage: number, speed: number): void {
    this.fx.muzzleFlash(x, y, angle);
    const projectile = new Projectile(
      this,
      x + Math.cos(angle) * 20,
      y + Math.sin(angle) * 20,
      damage,
      (px, py) => this.fx.trailDot(px, py, 0xb366ff),
    );
    // Tinted red so enemy bullets read as distinct from the player's (yellow) at a glance.
    projectile.setTint(0xff3b3b);
    this.enemyProjectiles.add(projectile);
    projectile.launch(angle, speed);
  }

  /** Enemy ranged/turret firing — reads the def's projectilePattern/element to build the right bullet(s). */
  private fireEnemyProjectilePattern(x: number, y: number, angle: number, def: EnemyDef): void {
    const pattern = def.projectilePattern ?? "standard";
    const pelletCount = pattern === "multi" ? def.pelletCount ?? 3 : 1;
    const spreadDeg = pattern === "multi" ? 28 : 0;

    for (let i = 0; i < pelletCount; i++) {
      const t = pelletCount > 1 ? i / (pelletCount - 1) - 0.5 : 0;
      const shotAngle = angle + Phaser.Math.DegToRad(t * spreadDeg);
      this.fireEnemyBullet(x, y, shotAngle, def, pattern);
    }
  }

  private fireEnemyBullet(x: number, y: number, angle: number, def: EnemyDef, pattern: EnemyDef["projectilePattern"]): void {
    this.fx.muzzleFlash(x, y, angle);
    const color = def.element ? elementColor(def.element) : 0xff3b3b;

    const extra: ProjectileExtraOptions = {};
    if (pattern === "bouncing") extra.bounces = 3;

    let homing: HomingConfig | undefined;
    if (pattern === "homing") {
      homing = {
        speed: def.projectileSpeed,
        turnRateRadPerSec: Phaser.Math.DegToRad(180),
        acquireTarget: () => (this.player.playerState === "DEAD" ? null : { x: this.player.x, y: this.player.y }),
      };
    }

    const projectile = new Projectile(
      this,
      x + Math.cos(angle) * 20,
      y + Math.sin(angle) * 20,
      def.damage,
      (px, py) => this.fx.trailDot(px, py, color),
      homing,
      extra,
    );
    projectile.setTint(color);
    this.enemyProjectiles.add(projectile);
    projectile.launch(angle, def.projectileSpeed);

    if (def.element) {
      this.enemyProjectileDots.set(projectile, {
        dotDamage: def.dotDamage ?? 3,
        tickMs: def.dotTickMs ?? 500,
        durationMs: def.dotDurationMs ?? 2000,
        color,
      });
    }
  }

  /** Applies a ticking status effect to the player — from an elemental enemy bullet landing. */
  private applyPlayerDot(dotDamage: number, tickMs: number, durationMs: number, color: number): void {
    const ticks = Math.max(1, Math.round(durationMs / tickMs));
    this.time.addEvent({
      delay: tickMs,
      repeat: ticks - 1,
      callback: () => {
        if (this.player.playerState === "DEAD") return;
        this.player.takeDamage(dotDamage);
        this.fx.damageFlash(this.player);
        this.fx.hitSpark(this.player.x, this.player.y, color);
      },
    });
  }

  /** aoeCaster enemy: casts a damage zone at the telegraphed point — hits only the player, ticking over time. Ice also slows. */
  private handleEnemyCastZone(x: number, y: number, def: EnemyDef): void {
    const radius = def.zoneRadius ?? 70;
    const tickMs = def.dotTickMs ?? 500;
    const durationMs = def.dotDurationMs ?? 2500;
    const ticks = Math.max(1, Math.round(durationMs / tickMs));
    const color = elementColor(def.element);

    this.fx.explosion(x, y, radius, color, color);
    this.sfx.playHit();
    this.dealZoneDamageToPlayer(x, y, radius, def.damage, color, def.element);

    this.time.addEvent({
      delay: tickMs,
      repeat: ticks - 1,
      callback: () => this.dealZoneDamageToPlayer(x, y, radius, def.dotDamage ?? 4, color, def.element),
    });
  }

  private dealZoneDamageToPlayer(x: number, y: number, radius: number, damage: number, color: number, element?: EnemyDef["element"]): void {
    if (this.player.playerState === "DEAD") return;
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > radius) return;
    this.player.takeDamage(damage);
    this.fx.damageFlash(this.player);
    this.fx.hitSpark(this.player.x, this.player.y, color);
    // Ice zones slow instead of piling on extra damage — refreshed each tick so it stays slowed while standing in it.
    if (element === "ice") this.player.applySlow(0.5, 600);
  }

  /** Healer enemy: mends the most wounded active ally within radius. */
  private handleHealAlly(healer: Enemy, radius: number, amount: number): void {
    let target: Enemy | undefined;
    let lowestFrac = 1;
    this.dungeon.enemies.getChildren().forEach((child) => {
      if (!(child instanceof Enemy) || child === healer || !child.active || !child.alive) return;
      if (Phaser.Math.Distance.Between(healer.x, healer.y, child.x, child.y) > radius) return;
      const frac = child.stats.hp / child.stats.maxHp;
      if (frac < 1 && frac < lowestFrac) {
        lowestFrac = frac;
        target = child;
      }
    });
    if (target) {
      target.heal(amount);
      this.fx.hitSpark(target.x, target.y, 0x4ade80);
    }
  }

  /** Buffer enemy: pulses a temporary damage/speed buff onto every active ally within radius. */
  private handleBuffAllies(buffer: Enemy, def: EnemyDef): void {
    const radius = def.buffRadius ?? 150;
    this.dungeon.enemies.getChildren().forEach((child) => {
      if (!(child instanceof Enemy) || child === buffer || !child.active || !child.alive) return;
      if (Phaser.Math.Distance.Between(buffer.x, buffer.y, child.x, child.y) > radius) return;
      child.applyBuff(def.buffDamageMult ?? 1.3, def.buffSpeedMult ?? 1.25, def.buffDurationMs ?? 4000);
      this.fx.hitSpark(child.x, child.y, 0xf59e0b);
    });
  }

  /** Reflects an incoming enemy bullet back the way it came, as a new player-owned projectile (Melee Reflect). */
  private reflectProjectile(projectile: Projectile): void {
    const angle = projectile.body!.velocity.angle() + Math.PI;
    const speed = projectile.body!.velocity.length() || 400;
    this.fx.hitSpark(projectile.x, projectile.y, 0x4fd1c5);
    this.sfx.playMeleeSwing();
    const reflected = new Projectile(this, projectile.x, projectile.y, projectile.damage, (px, py) =>
      this.fx.trailDot(px, py, 0x4fd1c5),
    );
    this.projectiles.add(reflected);
    reflected.launch(angle, speed);
    projectile.destroy();
  }

  private handleMeleeAttack(x: number, y: number, angle: number, weapon: WeaponDef): void {
    const { damage } = this.rollDamage(weapon.damage * this.player.damageMultiplier);

    if (weapon.behavior === "shockwave") {
      this.fireShockwave(x, y, weapon, damage, 0xf59e0b, 0xfff3b0);
      return;
    }

    const arcDeg = weapon.arcDeg ?? DEFAULT_MELEE_ARC_DEG;
    this.meleeArcDamage(x, y, angle, weapon.range * this.player.meleeRangeMult, arcDeg, damage);
  }

  /** Unarmed fallback punch — always available, used automatically when the ranged weapon in hand is out of energy. */
  private handleUnarmedAttack(x: number, y: number, angle: number): void {
    const { damage } = this.rollDamage(this.player.characterDef.damage);
    this.meleeArcDamage(x, y, angle, UNARMED_RANGE * this.player.meleeRangeMult, UNARMED_ARC_DEG, damage);
  }

  private meleeArcDamage(x: number, y: number, angle: number, range: number, arcDeg: number, damage: number): void {
    const halfArcRad = Phaser.Math.DegToRad(arcDeg / 2);
    this.dungeon.enemies.getChildren().forEach((child) => {
      const enemy = child as unknown as Combatant;
      if (!enemy.active || !enemy.alive) return;

      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist > range) return;

      const angleToEnemy = Phaser.Math.Angle.Between(x, y, enemy.x, enemy.y);
      const diff = Phaser.Math.Angle.Wrap(angleToEnemy - angle);
      if (Math.abs(diff) <= halfArcRad) {
        enemy.takeDamage(damage);
        this.fx.hitSpark(enemy.x, enemy.y);
      }
    });
  }

  private handleSkillUsed(kind: SkillId, payload: SkillPayload): void {
    if (kind === "dashSlash") {
      this.dashHitSet.clear();
    } else if (kind === "fireBarrage") {
      this.spawnFireBarrage(payload);
    } else if (kind === "healPulse") {
      this.fx.explosion(payload.x, payload.y, 70, 0x4ade80, 0xbbf7d0);
    } else if (kind === "weaponBoost") {
      this.fx.explosion(payload.x, payload.y, 50, 0xfacc15, 0xfff3b0);
    }
    this.sfx.playSkill();
    this.hud.flashMessage(this.player.characterDef.skillName);
  }

  /** Mage's Fire Barrage: a ring of bolts around the player, each homing onto the nearest live enemy. */
  private spawnFireBarrage(payload: SkillPayload): void {
    const count = (this.player.characterDef.fireBarrageCount ?? 10) + this.player.bonusPellets;
    const damage = Math.round(this.player.characterDef.damage * 0.5);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const startX = payload.x + Math.cos(angle) * 20;
      const startY = payload.y + Math.sin(angle) * 20;
      const projectile = new Projectile(
        this,
        startX,
        startY,
        damage,
        (px, py) => this.fx.trailDot(px, py, 0xff6b35),
        {
          speed: FIRE_BARRAGE_SPEED,
          turnRateRadPerSec: FIRE_BARRAGE_TURN_RATE,
          acquireTarget: (fromX, fromY) => this.findNearestEnemyPointFrom(fromX, fromY),
        },
      );
      this.projectiles.add(projectile);
      projectile.launch(angle, FIRE_BARRAGE_SPEED);
    }
  }

  /** Chests open on touch (see update()); E is for weapon pickups, shop stands, and the stage portal. */
  private handleInteract(): void {
    if (this.activeChoice) return;

    const pickup = this.getNearestWeaponPickup();
    if (
      pickup &&
      pickup.collectable &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y) <= INTERACT_RADIUS
    ) {
      this.collectWeaponPickup(pickup);
      return;
    }

    const stand = this.dungeon.getNearestShopStand(this.player.x, this.player.y);
    if (stand && Phaser.Math.Distance.Between(this.player.x, this.player.y, stand.x, stand.y) <= INTERACT_RADIUS) {
      this.openShopMenu(stand);
      return;
    }

    const portal = this.dungeon.getNearestPortal(this.player.x, this.player.y);
    if (portal && Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y) <= INTERACT_RADIUS) {
      this.sfx.playPickup();
      this.advanceStage();
    }
  }

  private updateChestAutoOpen(): void {
    const chest = this.dungeon.getNearestChest(this.player.x, this.player.y);
    if (!chest || chest.opened) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, chest.x, chest.y) > CHEST_TOUCH_RADIUS) return;

    const reward = chest.open();
    if (reward) {
      this.fx.hitSpark(chest.x, chest.y, 0xd4a017);
      this.sfx.playChestOpen();
      this.applyChestReward(reward, chest.x, chest.y);
      this.scatterChestLoot(chest.x, chest.y);
    }
  }

  private applyChestReward(reward: ChestReward, x: number, y: number): void {
    switch (reward.kind) {
      case "coin":
        this.player.coins += reward.amount;
        this.hud.setCoins(this.player.coins);
        this.sfx.playPickup();
        break;
      case "health":
        this.player.heal(reward.amount);
        this.sfx.playPickup();
        break;
      case "weapon":
        // Drop it as a ground pickup instead of auto-equipping — the player picks it up with E, same as any other weapon drop.
        this.spawnWeaponPickup(x, y, reward.def);
        break;
    }
  }

  private openShopMenu(stand: ShopStand): void {
    this.activeChoice = { kind: "shop", stand };
    this.renderShopMenu(stand);
  }

  private renderShopMenu(stand: ShopStand): void {
    const lines = stand.items.map((item, i) => {
      const cost = this.discountedCost(item.cost);
      return `${i + 1}) ${item.label} — ${cost} coins${item.purchased ? " (bought)" : ""}`;
    });
    this.choiceMenu.show("Shop", lines);
  }

  private discountedCost(baseCost: number): number {
    return Math.max(1, Math.round(baseCost * (1 - this.player.shopDiscountMult)));
  }

  private closeChoice(): void {
    this.activeChoice = null;
    this.choiceMenu.hide();
  }

  private pickChoice(index: number): void {
    if (!this.activeChoice) return;

    if (this.activeChoice.kind === "stageUpgrade") {
      const id = this.activeChoice.options[index];
      if (id) this.player.applyUpgrade(id);
      // Re-snapshot now — the pending snapshot was taken before this pick, so it wouldn't
      // carry the upgrade (or any HP/energy change) that happened while the menu was open.
      const pendingData: GameSceneData = { ...this.activeChoice.pendingData, snapshot: this.player.getSnapshot() };
      this.closeChoice();
      this.transitionToScene("GameScene", pendingData);
      return;
    }

    const stand = this.activeChoice.stand;
    const item: ShopItem | undefined = stand.items[index];
    if (!item || item.purchased) return;
    const cost = this.discountedCost(item.cost);
    if (this.player.coins < cost) return;

    this.player.coins -= cost;
    item.purchased = true;
    this.applyShopEffect(item);
    this.hud.setCoins(this.player.coins);
    this.sfx.playPickup();
    this.renderShopMenu(stand);
  }

  private applyShopEffect(item: ShopItem): void {
    switch (item.effect) {
      case "weapon": {
        const bumped = this.player.equipWeapon(item.weaponDef!);
        this.spawnWeaponPickup(this.player.x, this.player.y, bumped);
        break;
      }
      case "maxHp":
        this.player.increaseMaxHp(20);
        break;
      case "heal":
        this.player.heal(this.player.stats.maxHp);
        break;
      case "energy":
        this.player.gainEnergy(this.player.stats.maxEnergy);
        this.hud.setEnergy(this.player.stats.energy, this.player.stats.maxEnergy);
        break;
    }
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.actionKeys = {
      one: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      two: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      three: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      four: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      five: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      interact: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      pause: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      fullscreen: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.player.trySkill(this.time.now);
      }
    });
  }

  /** Character auto-aims at the nearest live enemy; the player only has to shoot. Falls back to the mouse point when no enemy is around, so movement/exploring still feels controllable. */
  private findAutoAimPoint(): Phaser.Math.Vector2 | null {
    const point = this.findNearestEnemyPointFrom(this.player.x, this.player.y);
    return point ? new Phaser.Math.Vector2(point.x, point.y) : null;
  }

  /** Nearest live enemy position to (x, y) — used for auto-aim and for Fire Barrage's homing bolts. */
  private findNearestEnemyPointFrom(x: number, y: number): { x: number; y: number } | null {
    let nearest: { x: number; y: number } | null = null;
    let nearestDist = Infinity;
    this.dungeon.enemies.getChildren().forEach((child) => {
      const enemy = child as unknown as Combatant;
      if (!enemy.active || !enemy.alive) return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { x: enemy.x, y: enemy.y };
      }
    });
    return nearest;
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, this.dungeon.worldWidth, this.dungeon.worldHeight);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  /**
   * Keeps uiContainer glued to the screen while the world camera scrolls/zooms around the player.
   * A child placed at local (x, y) always lands at screen pixel (x, y): the container's own
   * position cancels the camera's scroll, and its inverse scale cancels the camera's zoom, so by
   * the time the camera transform is applied on top, both effects cancel out exactly.
   */
  private syncUiContainer(): void {
    const cam = this.cameras.main;
    this.uiContainer.setPosition(cam.scrollX, cam.scrollY);
    this.uiContainer.setScale(1 / cam.zoom);
  }

  update(time: number, delta: number): void {
    this.syncUiContainer();

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.fullscreen)) {
      this.scale.toggleFullscreen();
    }
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.pause) && !this.activeChoice) {
      this.togglePause();
    }
    if (this.isPaused) {
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.one)) this.togglePause();
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.two)) this.quitToMenu();
      return;
    }

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const aimPoint = this.findAutoAimPoint() ?? worldPoint;

    this.player.update(time, delta, this.keys, aimPoint);
    this.dungeon.update(this.player);

    if (pointer.leftButtonDown()) {
      this.player.tryShoot(time);
    }

    if (this.activeChoice) {
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.one)) this.pickChoice(0);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.two)) this.pickChoice(1);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.three)) this.pickChoice(2);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.four)) this.pickChoice(3);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.five)) this.pickChoice(4);

      if (
        this.activeChoice &&
        this.activeChoice.kind === "shop" &&
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.activeChoice.stand.x,
          this.activeChoice.stand.y,
        ) > INTERACT_RADIUS
      ) {
        this.closeChoice();
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.one)) this.player.switchWeapon(0);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.two)) this.player.switchWeapon(1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.interact)) this.handleInteract();
    this.updateChestAutoOpen();

    this.minimap.update(this.dungeon, this.player);
    this.updateWeaponInfoPanel();

    const weaponInfo = this.player.getHudInfo();
    this.hud.setWeapon(weaponInfo.activeName, weaponInfo.activeIconKey, weaponInfo.reserveName, weaponInfo.reserveIconKey);

    const skillInfo = this.player.getSkillHudInfo();
    this.hud.setSkill(skillInfo.name, skillInfo.remainingMs, skillInfo.ready);

    if (this.player.isDashing) {
      const radius = this.player.characterDef.dashHitRadius ?? 36;
      const { damage } = this.rollDamage(this.player.characterDef.damage);
      let killedSomeone = false;
      this.dungeon.enemies.getChildren().forEach((child) => {
        const enemy = child as unknown as Combatant;
        if (!enemy.active || !enemy.alive || this.dashHitSet.has(enemy)) return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= radius) {
          enemy.takeDamage(damage);
          this.fx.hitSpark(enemy.x, enemy.y);
          this.dashHitSet.add(enemy);
          if (!enemy.alive) killedSomeone = true;
        }
      });
      // Iaijutsu Strike: a kill mid-dash refunds the cooldown instantly (Player caps this per chain).
      if (killedSomeone) this.player.refundDashCooldown();
    }

    this.dungeon.enemies.getChildren().forEach((child) => {
      (child as unknown as Combatant).update(time, this.player.playerState === "DEAD" ? null : this.player);
    });

    this.projectiles.getChildren().forEach((child) => {
      (child as Projectile).update(time);
    });
    this.enemyProjectiles.getChildren().forEach((child) => {
      (child as Projectile).update(time);
    });

    const liveBoss = this.dungeon.enemies.getChildren().find((child) => child instanceof Boss) as Boss | undefined;
    if (liveBoss) {
      this.hud.setBossHp(liveBoss.hp, liveBoss.maxHp, liveBoss.def.name);
    } else {
      this.hud.hideBossHp();
    }

    if (this.player.playerState === "DEAD") {
      this.hud.showDeath(this.killCount, this.floor, this.stage, () => this.quitToMenu());
    }
  }
}
