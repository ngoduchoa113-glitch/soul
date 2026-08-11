import Phaser from "phaser";
import type { CharacterId } from "./characters";
import type { ElementType, EnemyBehavior } from "./enemies";

export interface SpriteSheetAnim {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
}

export interface CreatureAnimSet {
  idle: SpriteSheetAnim;
  death: SpriteSheetAnim;
}

const CHAR_BASE = "/assets/characters_2d_assets";
const MONSTER_BASE = "/assets/monsters_2d_assets";

function charAnims(id: CharacterId): CreatureAnimSet {
  return {
    idle: {
      key: `char-${id}-walk`,
      path: `${CHAR_BASE}/${id}_walk_spritesheet.png`,
      frameWidth: 24,
      frameHeight: 32,
      frameCount: 4,
      frameRate: 8,
      loop: true,
    },
    death: {
      key: `char-${id}-death`,
      path: `${CHAR_BASE}/${id}_death_spritesheet.png`,
      frameWidth: 24,
      frameHeight: 32,
      frameCount: 6,
      frameRate: 10,
      loop: false,
    },
  };
}

/** Walk (looped, doubles as idle) + death animations per playable character. */
export const CHARACTER_SPRITES: Record<CharacterId, CreatureAnimSet> = {
  knight: charAnims("knight"),
  samurai: charAnims("samurai"),
  mage: charAnims("mage"),
  healer: charAnims("healer"),
};

const NEW_MONSTER_BASE = "/assets/new_monsters_2d_assets";

function monsterAnims(key: string, fileBase: string, frameWidth: number, frameHeight: number, base = MONSTER_BASE): CreatureAnimSet {
  return {
    idle: {
      key: `mon-${key}-idle`,
      path: `${base}/${fileBase}_idle_spritesheet.png`,
      frameWidth,
      frameHeight,
      frameCount: 4,
      frameRate: 6,
      loop: true,
    },
    death: {
      key: `mon-${key}-death`,
      path: `${base}/${fileBase}_death_spritesheet.png`,
      frameWidth,
      frameHeight,
      frameCount: 5,
      frameRate: 10,
      loop: false,
    },
  };
}

const SLIME_GREEN = monsterAnims("slime-green", "slime_green", 32, 32);
const SLIME_BLUE = monsterAnims("slime-blue", "slime_blue", 32, 32);
const SLIME_FIRE = monsterAnims("slime-fire", "slime_fire", 32, 32);
const BEHOLDER_EMBER = monsterAnims("beholder-ember", "beholder_ember", 40, 40);
const BEHOLDER_PALE = monsterAnims("beholder-pale", "beholder_pale", 40, 40);
export const BOSS_BEHOLDER = monsterAnims("boss-beholder", "boss_beholder", 64, 64);

const ENT_AMBER = monsterAnims("ent-amber", "ent_amber", 36, 44, NEW_MONSTER_BASE);
const ENT_BLUE = monsterAnims("ent-blue", "ent_blue", 36, 44, NEW_MONSTER_BASE);
const ENT_RED = monsterAnims("ent-red", "ent_red", 36, 44, NEW_MONSTER_BASE);
const GHOST_DEMON = monsterAnims("ghost-demon", "ghost_demon", 32, 36, NEW_MONSTER_BASE);
const GHOST_PALE = monsterAnims("ghost-pale", "ghost_pale", 32, 36, NEW_MONSTER_BASE);
const GHOST_SHADE = monsterAnims("ghost-shade", "ghost_shade", 32, 36, NEW_MONSTER_BASE);
const GOLEM_CRYSTAL = monsterAnims("golem-crystal", "golem_crystal", 48, 48, NEW_MONSTER_BASE);
const GOLEM_ICE = monsterAnims("golem-ice", "golem_ice", 48, 48, NEW_MONSTER_BASE);
const GOLEM_STONE = monsterAnims("golem-stone", "golem_stone", 48, 48, NEW_MONSTER_BASE);
const ORC_CHIEF = monsterAnims("orc-chief", "orc_chief", 28, 36, NEW_MONSTER_BASE);
const ORC_GRUNT = monsterAnims("orc-grunt", "orc_grunt", 28, 36, NEW_MONSTER_BASE);
const ORC_WARRIOR = monsterAnims("orc-warrior", "orc_warrior", 28, 36, NEW_MONSTER_BASE);
const PREDATOR_PLANT_AZURE = monsterAnims("predator-plant-azure", "predator_plant_azure", 32, 40, NEW_MONSTER_BASE);
const PREDATOR_PLANT_EMBER = monsterAnims("predator-plant-ember", "predator_plant_ember", 32, 40, NEW_MONSTER_BASE);
const PREDATOR_PLANT_VIOLET = monsterAnims("predator-plant-violet", "predator_plant_violet", 32, 40, NEW_MONSTER_BASE);

/**
 * Every behavior now has dedicated, thematically-matched art:
 * - melee: orc grunt (elite: orc chief); ranged/bomber: still slimes (elite: pale beholder) —
 *   no dedicated art for those two yet.
 * - tank: stone/ice golem (random per spawn); fast: orc warrior; turret: crystal golem (a stationary construct).
 * - aoeCaster: predator plant, color-matched to its element (ember=fire, azure=ice, violet=shock).
 * - summoner: demon ghost; teleporter: shade ghost; healer: pale ghost; buffer: ent (random color per spawn).
 */
export function enemyAnimSet(behavior: EnemyBehavior, isElite: boolean, element?: ElementType): CreatureAnimSet {
  switch (behavior) {
    case "melee":
      return isElite ? ORC_CHIEF : ORC_GRUNT;
    case "ranged":
      return isElite ? BEHOLDER_PALE : SLIME_BLUE;
    case "bomber":
      return isElite ? BEHOLDER_PALE : SLIME_FIRE;
    case "tank":
      return Phaser.Math.RND.pick([GOLEM_STONE, GOLEM_ICE]);
    case "fast":
      return ORC_WARRIOR;
    case "aoeCaster":
      if (element === "ice") return PREDATOR_PLANT_AZURE;
      if (element === "shock") return PREDATOR_PLANT_VIOLET;
      return PREDATOR_PLANT_EMBER;
    case "turret":
      return GOLEM_CRYSTAL;
    case "summoner":
      return GHOST_DEMON;
    case "teleporter":
      return GHOST_SHADE;
    case "healer":
      return GHOST_PALE;
    case "buffer":
      return Phaser.Math.RND.pick([ENT_AMBER, ENT_BLUE, ENT_RED]);
  }
}

export const ALL_CREATURE_SPRITE_SHEETS: SpriteSheetAnim[] = [
  ...Object.values(CHARACTER_SPRITES).flatMap((set) => [set.idle, set.death]),
  ...[
    SLIME_GREEN,
    SLIME_BLUE,
    SLIME_FIRE,
    BEHOLDER_EMBER,
    BEHOLDER_PALE,
    BOSS_BEHOLDER,
    ENT_AMBER,
    ENT_BLUE,
    ENT_RED,
    GHOST_DEMON,
    GHOST_PALE,
    GHOST_SHADE,
    GOLEM_CRYSTAL,
    GOLEM_ICE,
    GOLEM_STONE,
    ORC_CHIEF,
    ORC_GRUNT,
    ORC_WARRIOR,
    PREDATOR_PLANT_AZURE,
    PREDATOR_PLANT_EMBER,
    PREDATOR_PLANT_VIOLET,
  ].flatMap((set) => [set.idle, set.death]),
];
