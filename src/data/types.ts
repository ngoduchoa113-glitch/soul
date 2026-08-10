export interface PlayerStats {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  energy: number;
  maxEnergy: number;
}

export type PlayerState = "ALIVE" | "DEAD";

export interface EnemyStats {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
}

export type EnemyAIState =
  | "IDLE"
  | "DETECT"
  | "CHASE"
  | "ATTACK"
  | "COOLDOWN";

export type RoomType = "normal" | "elite" | "shop" | "boss" | "rest" | "gate" | "trophy";

export type RoomState = "LOCKED" | "ACTIVE" | "CLEARING" | "CLEARED";
