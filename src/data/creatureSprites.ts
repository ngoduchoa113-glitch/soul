import Phaser from "phaser";
import type { CharacterId } from "./characters";
import type { EnemyDef } from "./enemies";

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
  /** One-shot swing played on melee hit (see Enemy.meleeUpdate) instead of staying on the idle loop. Optional — most creature sets don't have dedicated attack frames yet. */
  attack?: SpriteSheetAnim;
  /** Extra scale applied on top of the sprite's native frame size — for art packs (like the skeleton set) drawn at a much higher resolution than this game's other creature sheets. Defaults to 1. */
  scale?: number;
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
const ORC_WARRIOR = monsterAnims("orc-warrior", "orc_warrior", 28, 36, NEW_MONSTER_BASE);
const PREDATOR_PLANT_AZURE = monsterAnims("predator-plant-azure", "predator_plant_azure", 32, 40, NEW_MONSTER_BASE);
const PREDATOR_PLANT_EMBER = monsterAnims("predator-plant-ember", "predator_plant_ember", 32, 40, NEW_MONSTER_BASE);
const PREDATOR_PLANT_VIOLET = monsterAnims("predator-plant-violet", "predator_plant_violet", 32, 40, NEW_MONSTER_BASE);

const SKELETON_BASE = "/assets/craftpix-net-957123-free-skeleton-pixel-art-sprite-sheets/Skeleton_Spearman";

/** Regular (non-elite) melee grunt art — drawn at a much higher native resolution (128x128/frame) than this game's other creature sheets, so it needs `scale` to come back down to the same on-screen size. */
const SKELETON_SPEARMAN: CreatureAnimSet = {
  // "idle" here is really the Run+attack loop — this codebase only has one persistent looping
  // slot per creature (see Enemy.ts, which never re-triggers it outside of playAttackAnim), so
  // a livelier always-moving loop reads better for this enemy than a true standing-still idle.
  idle: {
    key: "mon-skeleton-spearman-idle",
    path: `${SKELETON_BASE}/Run_attack.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 5,
    frameRate: 8,
    loop: true,
  },
  death: {
    key: "mon-skeleton-spearman-death",
    path: `${SKELETON_BASE}/Dead.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 5,
    frameRate: 10,
    loop: false,
  },
  attack: {
    key: "mon-skeleton-spearman-attack",
    path: `${SKELETON_BASE}/Attack_1.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 4,
    frameRate: 10,
    loop: false,
  },
  scale: 0.55,
};

const MINOTAUR_1_BASE = "/assets/craftpix-net-170637-free-minotaur-sprite-sheet-pixel-art-pack/Minotaur_1";
const MINOTAUR_3_BASE = "/assets/craftpix-net-170637-free-minotaur-sprite-sheet-pixel-art-pack/Minotaur_3";
const GORGON_1_BASE = "/assets/craftpix-net-280097-free-gorgon-pixel-art-character-sprite-sheets/Gorgon_1";

/** Melee brute — id-specific art (see enemyAnimSet), not tied to the "melee" behavior's default. */
const MINOTAUR_1: CreatureAnimSet = {
  idle: {
    key: "mon-minotaur-1-walk",
    path: `${MINOTAUR_1_BASE}/Walk.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 12,
    frameRate: 10,
    loop: true,
  },
  death: {
    key: "mon-minotaur-1-death",
    path: `${MINOTAUR_1_BASE}/Dead.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 5,
    frameRate: 10,
    loop: false,
  },
  attack: {
    key: "mon-minotaur-1-attack",
    path: `${MINOTAUR_1_BASE}/Attack.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 5,
    frameRate: 10,
    loop: false,
  },
  scale: 0.6,
};

/** Second melee brute variant — same behavior as MINOTAUR_1, distinct look + stats (see enemies.ts). */
const MINOTAUR_3: CreatureAnimSet = {
  idle: {
    key: "mon-minotaur-3-walk",
    path: `${MINOTAUR_3_BASE}/Walk.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 12,
    frameRate: 10,
    loop: true,
  },
  death: {
    key: "mon-minotaur-3-death",
    path: `${MINOTAUR_3_BASE}/Dead.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 5,
    frameRate: 10,
    loop: false,
  },
  attack: {
    key: "mon-minotaur-3-attack",
    path: `${MINOTAUR_3_BASE}/Attack.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 4,
    frameRate: 10,
    loop: false,
  },
  scale: 0.58,
};

/** Ranged spitter — "idle" is the Run loop, "attack" plays on each bullet fired (see Enemy.rangedUpdate). */
const GORGON_1: CreatureAnimSet = {
  idle: {
    key: "mon-gorgon-1-run",
    path: `${GORGON_1_BASE}/Run.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 7,
    frameRate: 8,
    loop: true,
  },
  death: {
    key: "mon-gorgon-1-death",
    path: `${GORGON_1_BASE}/Dead.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 3,
    frameRate: 10,
    loop: false,
  },
  attack: {
    key: "mon-gorgon-1-attack",
    path: `${GORGON_1_BASE}/Attack_3.png`,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 10,
    frameRate: 12,
    loop: false,
  },
  scale: 0.52,
};

/**
 * Every behavior now has dedicated, thematically-matched art:
 * - melee: skeleton spearman by default (elite: orc chief), except the minotaurBrute/minotaurWarlord
 *   ids below, which override to their own distinct look despite sharing the "melee" behavior.
 * - ranged/bomber: still slimes (elite: pale beholder), except the gorgonSpitter id, which fires a
 *   plain bullet with its own art instead.
 * - tank: stone/ice golem (random per spawn); fast: orc warrior; turret: crystal golem (a stationary construct).
 * - aoeCaster: predator plant, color-matched to its element (ember=fire, azure=ice, violet=shock).
 * - summoner: demon ghost; teleporter: shade ghost; healer: pale ghost; buffer: ent (random color per spawn).
 */
export function enemyAnimSet(def: EnemyDef, isElite: boolean): CreatureAnimSet {
  switch (def.id) {
    case "minotaurBrute":
      return MINOTAUR_1;
    case "minotaurWarlord":
      return MINOTAUR_3;
    case "gorgonSpitter":
      return GORGON_1;
  }

  switch (def.behavior) {
    case "melee":
      return isElite ? ORC_CHIEF : SKELETON_SPEARMAN;
    case "ranged":
      return isElite ? BEHOLDER_PALE : SLIME_BLUE;
    case "bomber":
      return isElite ? BEHOLDER_PALE : SLIME_FIRE;
    case "tank":
      return Phaser.Math.RND.pick([GOLEM_STONE, GOLEM_ICE]);
    case "fast":
      return ORC_WARRIOR;
    case "aoeCaster":
      if (def.element === "ice") return PREDATOR_PLANT_AZURE;
      if (def.element === "shock") return PREDATOR_PLANT_VIOLET;
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
    ORC_WARRIOR,
    PREDATOR_PLANT_AZURE,
    PREDATOR_PLANT_EMBER,
    PREDATOR_PLANT_VIOLET,
    SKELETON_SPEARMAN,
    MINOTAUR_1,
    MINOTAUR_3,
    GORGON_1,
  ].flatMap((set) => [set.idle, set.death, ...(set.attack ? [set.attack] : [])]),
];
