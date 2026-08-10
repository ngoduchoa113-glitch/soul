import Phaser from "phaser";
import { Player, type WasdKeys, type SkillPayload, type PlayerSnapshot } from "../entities/Player";
import { Projectile } from "../entities/Projectile";
import { EnergyPickup } from "../entities/EnergyPickup";
import { Boss } from "../entities/Boss";
import type { Enemy } from "../entities/Enemy";
import type { Combatant } from "../entities/Combatant";
import { Hud } from "../ui/Hud";
import { ChoiceMenu } from "../ui/ChoiceMenu";
import { Minimap } from "../ui/Minimap";
import { getWeaponVariant, type WeaponDef } from "../data/weapons";
import type { CharacterId, SkillId } from "../data/characters";
import { Dungeon } from "../dungeon/Dungeon";
import type { StageKind } from "../dungeon/DungeonLayout";
import type { ChestReward } from "../entities/Chest";
import type { ShopStand, ShopItem } from "../entities/ShopStand";
import { Sfx } from "../audio/Sfx";
import { Fx } from "../fx/Fx";

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

const MELEE_HALF_ARC_RAD = Phaser.Math.DegToRad(50);
const INTERACT_RADIUS = 40;

interface ActionKeys {
  one: Phaser.Input.Keyboard.Key;
  two: Phaser.Input.Keyboard.Key;
  three: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
}

const ENEMY_ENERGY_DROP_CHANCE = 0.35;
const ENEMY_ENERGY_DROP_RANGE: [number, number] = [8, 15];
const BOSS_ENERGY_DROP_AMOUNT = 50;

type ActiveChoice = { kind: "upgrade" } | { kind: "shop"; stand: ShopStand };

const UPGRADE_KINDS = ["damage", "atkSpeed", "maxHp"] as const;
const UPGRADE_LABELS: Record<(typeof UPGRADE_KINDS)[number], string> = {
  damage: "+20% Damage",
  atkSpeed: "+15% Attack Speed",
  maxHp: "+25 Max HP",
};

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private dungeon!: Dungeon;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private energyPickups!: Phaser.Physics.Arcade.Group;
  private keys!: WasdKeys;
  private actionKeys!: ActionKeys;
  private hud!: Hud;
  private choiceMenu!: ChoiceMenu;
  private minimap!: Minimap;
  private sfx!: Sfx;
  private fx!: Fx;
  private activeChoice: ActiveChoice | null = null;
  private dashHitSet = new Set<Combatant>();
  private floor = 1;
  private stage = 1;

  constructor() {
    super("GameScene");
  }

  create(data: GameSceneData): void {
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
      onSkillUsed: (kind, payload) => this.handleSkillUsed(kind, payload),
    });

    this.physics.world.setBounds(0, 0, this.dungeon.worldWidth, this.dungeon.worldHeight);

    this.projectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: false });
    this.enemyProjectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: false });
    this.energyPickups = this.physics.add.group({ classType: EnergyPickup, runChildUpdate: false });

    this.physics.add.collider(this.player, this.dungeon.collidables);
    this.physics.add.collider(this.dungeon.enemies, this.dungeon.collidables);
    this.physics.add.collider(this.player, this.dungeon.enemies);

    this.physics.add.collider(this.projectiles, this.dungeon.collidables, (proj) => {
      (proj as Projectile).destroy();
    });
    this.physics.add.overlap(this.projectiles, this.dungeon.enemies, (proj, enemy) => {
      const projectile = proj as Projectile;
      const target = enemy as unknown as Combatant;
      target.takeDamage(projectile.damage);
      this.fx.hitSpark(projectile.x, projectile.y);
      this.sfx.playHit();
      projectile.destroy();
    });

    this.physics.add.collider(this.enemyProjectiles, this.dungeon.collidables, (proj) => {
      (proj as Projectile).destroy();
    });
    // Phaser's overlap swaps argument order when arg2 is a lone Sprite (not a Group):
    // the callback receives (player, projectileGroupMember), not (groupMember, player).
    this.physics.add.overlap(this.enemyProjectiles, this.player, (_playerObj, proj) => {
      const projectile = proj as Projectile;
      this.fx.hitSpark(projectile.x, projectile.y);
      this.fx.damageFlash(this.player);
      this.fx.screenShake(0.004, 120);
      this.sfx.playPlayerHit();
      this.player.takeDamage(projectile.damage);
      projectile.destroy();
    });

    // Same argument-order quirk as the enemyProjectiles/player overlap above.
    this.physics.add.overlap(this.energyPickups, this.player, (_playerObj, pickup) => {
      const orb = pickup as EnergyPickup;
      this.player.gainEnergy(orb.amount);
      this.fx.hitSpark(orb.x, orb.y, 0x60a5fa);
      this.sfx.playPickup();
      orb.destroy();
    });

    this.setupInput();
    this.setupCamera();

    this.hud = new Hud(this);
    if (data.snapshot) this.player.applySnapshot(data.snapshot);
    if (this.dungeon.rooms[0].type === "rest") this.player.heal(this.player.stats.maxHp);
    this.hud.setHp(this.player.stats.hp, this.player.stats.maxHp);
    this.hud.setEnergy(this.player.stats.energy, this.player.stats.maxEnergy);
    this.hud.setCoins(this.player.coins);
    this.hud.setStage(this.floor, this.stage);
    this.choiceMenu = new ChoiceMenu(this);
    this.minimap = new Minimap(this);
  }

  private advanceStage(): void {
    if (this.stage === 6) {
      this.scene.start("MainMenuScene");
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
    this.scene.start("GameScene", data);
  }

  private handlePlayerAttacked(damage: number): void {
    this.fx.damageFlash(this.player);
    this.fx.screenShake(0.004, 120);
    this.sfx.playPlayerHit();
    this.player.takeDamage(damage);
  }

  private handleEntityDeath(entity: Enemy | Boss): void {
    if (entity instanceof Boss) {
      this.spawnEnergyPickup(entity.x, entity.y, BOSS_ENERGY_DROP_AMOUNT);
      this.fx.explosion(entity.x, entity.y, 70, 0xef4444, 0xffb3b3);
      this.fx.screenShake(0.012, 350);
      this.sfx.playBossDeath();
      return;
    }
    if (Math.random() < ENEMY_ENERGY_DROP_CHANCE) {
      this.spawnEnergyPickup(entity.x, entity.y, Phaser.Math.Between(...ENEMY_ENERGY_DROP_RANGE));
    }
    if (entity.def.behavior === "bomber") return; // Enemy.explode() already played its own VFX/SFX
    this.fx.deathPoof(entity.x, entity.y);
    this.sfx.playEnemyDeath();
  }

  private spawnEnergyPickup(x: number, y: number, amount: number): void {
    const pickup = new EnergyPickup(this, x, y, amount);
    this.energyPickups.add(pickup);
  }

  private spawnProjectile(x: number, y: number, baseAngle: number, weapon: WeaponDef): void {
    const damage = weapon.damage * this.player.upgrades.damageMult;
    this.fx.muzzleFlash(x, y, baseAngle);
    this.sfx.playShoot();
    for (let i = 0; i < weapon.pellets; i++) {
      const jitterDeg = Phaser.Math.RND.realInRange(-weapon.spreadDeg / 2, weapon.spreadDeg / 2);
      const angle = baseAngle + Phaser.Math.DegToRad(jitterDeg);
      const projectile = new Projectile(
        this,
        x + Math.cos(angle) * 24,
        y + Math.sin(angle) * 24,
        damage,
        (px, py) => this.fx.trailDot(px, py, 0xf6e05e),
      );
      this.projectiles.add(projectile);
      projectile.launch(angle, weapon.projectileSpeed);
    }
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
    this.enemyProjectiles.add(projectile);
    projectile.launch(angle, speed);
  }

  private handleMeleeAttack(x: number, y: number, angle: number, weapon: WeaponDef): void {
    const damage = weapon.damage * this.player.upgrades.damageMult;
    this.dungeon.enemies.getChildren().forEach((child) => {
      const enemy = child as unknown as Combatant;
      if (!enemy.active) return;

      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist > weapon.range) return;

      const angleToEnemy = Phaser.Math.Angle.Between(x, y, enemy.x, enemy.y);
      const diff = Phaser.Math.Angle.Wrap(angleToEnemy - angle);
      if (Math.abs(diff) <= MELEE_HALF_ARC_RAD) {
        enemy.takeDamage(damage);
        this.fx.hitSpark(enemy.x, enemy.y);
      }
    });
  }

  private handleSkillUsed(kind: SkillId, payload: SkillPayload): void {
    if (kind === "dashSlash") {
      this.dashHitSet.clear();
    } else if (kind === "fireNova") {
      const radius = this.player.characterDef.novaRadius ?? 120;
      const damage = this.player.characterDef.damage * this.player.upgrades.damageMult;
      this.fx.explosion(payload.x, payload.y, radius, 0xff6b35, 0xffb35c);
      this.dungeon.enemies.getChildren().forEach((child) => {
        const enemy = child as unknown as Combatant;
        if (!enemy.active) return;
        if (Phaser.Math.Distance.Between(payload.x, payload.y, enemy.x, enemy.y) <= radius) {
          enemy.takeDamage(damage);
        }
      });
    } else if (kind === "healPulse") {
      this.fx.explosion(payload.x, payload.y, 70, 0x4ade80, 0xbbf7d0);
    }
    this.sfx.playSkill();
    this.hud.flashMessage(this.player.characterDef.skillName);
  }

  private handleInteract(): void {
    if (this.activeChoice) return;

    const chest = this.dungeon.getNearestChest(this.player.x, this.player.y);
    if (chest && Phaser.Math.Distance.Between(this.player.x, this.player.y, chest.x, chest.y) <= INTERACT_RADIUS) {
      const reward = chest.open();
      if (reward) {
        this.fx.hitSpark(chest.x, chest.y, 0xd4a017);
        this.sfx.playChestOpen();
        this.applyChestReward(reward);
      }
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

  private applyChestReward(reward: ChestReward): void {
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
        this.player.equipRangedWeapon(reward.def);
        this.sfx.playPickup();
        break;
      case "upgrade":
        this.openUpgradeChoice();
        break;
    }
  }

  private openUpgradeChoice(): void {
    this.activeChoice = { kind: "upgrade" };
    const lines = UPGRADE_KINDS.map((kind, i) => `${i + 1}) ${UPGRADE_LABELS[kind]}`);
    this.choiceMenu.show("Choose an Upgrade", lines);
  }

  private openShopMenu(stand: ShopStand): void {
    this.activeChoice = { kind: "shop", stand };
    this.renderShopMenu(stand);
  }

  private renderShopMenu(stand: ShopStand): void {
    const lines = stand.items.map(
      (item, i) => `${i + 1}) ${item.label} — ${item.cost} coins${item.purchased ? " (bought)" : ""}`,
    );
    this.choiceMenu.show("Shop", lines);
  }

  private closeChoice(): void {
    this.activeChoice = null;
    this.choiceMenu.hide();
  }

  private pickChoice(index: number): void {
    if (!this.activeChoice) return;

    if (this.activeChoice.kind === "upgrade") {
      const kind = UPGRADE_KINDS[index];
      if (kind) this.player.applyUpgrade(kind);
      this.closeChoice();
      return;
    }

    const stand = this.activeChoice.stand;
    const item: ShopItem | undefined = stand.items[index];
    if (!item || item.purchased) return;
    if (this.player.coins < item.cost) return;

    this.player.coins -= item.cost;
    item.purchased = true;
    this.applyShopEffect(item.effect);
    this.hud.setCoins(this.player.coins);
    this.sfx.playPickup();
    this.renderShopMenu(stand);
  }

  private applyShopEffect(effect: ShopItem["effect"]): void {
    switch (effect) {
      case "weapon":
        this.player.equipRangedWeapon(getWeaponVariant("shotgun", "common"));
        break;
      case "maxHp":
        this.player.increaseMaxHp(20);
        break;
      case "heal":
        this.player.heal(this.player.stats.maxHp);
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
      interact: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.player.trySkill(this.time.now);
      }
    });
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, this.dungeon.worldWidth, this.dungeon.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  update(time: number, delta: number): void {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    this.player.update(time, delta, this.keys, worldPoint);
    this.dungeon.update(this.player);

    if (pointer.leftButtonDown()) {
      this.player.tryShoot(time);
    }

    if (this.activeChoice) {
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.one)) this.pickChoice(0);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.two)) this.pickChoice(1);
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.three)) this.pickChoice(2);

      if (
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

    this.minimap.update(this.dungeon.rooms, this.player);

    const weaponInfo = this.player.getHudInfo();
    this.hud.setWeapon(weaponInfo.name);

    const skillInfo = this.player.getSkillHudInfo();
    this.hud.setSkill(skillInfo.name, skillInfo.remainingMs, skillInfo.ready);

    if (this.player.isDashing) {
      const radius = this.player.characterDef.dashHitRadius ?? 36;
      const damage = this.player.characterDef.damage * this.player.upgrades.damageMult;
      this.dungeon.enemies.getChildren().forEach((child) => {
        const enemy = child as unknown as Combatant;
        if (!enemy.active || this.dashHitSet.has(enemy)) return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= radius) {
          enemy.takeDamage(damage);
          this.fx.hitSpark(enemy.x, enemy.y);
          this.dashHitSet.add(enemy);
        }
      });
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
      this.hud.showDeath();
    }
  }
}
