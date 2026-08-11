import type { SpriteSheetAnim } from "./creatureSprites";

const TRADER_BASE = "/assets/craftpix-net-922426-free-city-trader-character-sprite-sheets-pixel-art/Trader_1";

/** Looping anim for the shop room's merchant NPC (ShopStand) — uses the trader's approval/nodding frames so it reads as actively selling, not just standing there. */
export const SHOP_KEEPER_ANIM: SpriteSheetAnim = {
  key: "shop-keeper",
  path: `${TRADER_BASE}/Approval.png`,
  frameWidth: 128,
  frameHeight: 128,
  frameCount: 8,
  frameRate: 8,
  loop: true,
};
