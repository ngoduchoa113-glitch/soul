import Phaser from "phaser";
import { UpgradeCard, CARD_WIDTH, CARD_HEIGHT } from "./UpgradeCard";
import { UpgradeDetailPanel, DETAIL_HEIGHT } from "./UpgradeDetailPanel";
import { COLOR, titleStyle } from "./textStyles";
import { UPGRADES, type UpgradeId } from "../data/upgrades";
import type { Player } from "../entities/Player";

const CARD_GAP = 20;
const HEADER_Y = 40;
const CARDS_CENTER_Y = 210;
/** Grace period before the detail panel hides after leaving a card — lets the pointer cross the
 * small gap between two cards without the panel flickering closed and back open. */
const HIDE_DELAY_MS = 60;

/**
 * The between-stage "pick one of 3 upgrades" screen: header, 3 UpgradeCards, and a shared
 * UpgradeDetailPanel that shows whichever card is currently hovered. Lives in GameScene's
 * screen-fixed uiContainer, same as ChoiceMenu/Hud/Minimap.
 */
export class UpgradeChoiceScreen {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private detail: UpgradeDetailPanel;
  private cards: UpgradeCard[] = [];
  private hideTimer?: Phaser.Time.TimerEvent;
  private selecting = false;
  private onChosen?: (id: UpgradeId) => void;

  constructor(scene: Phaser.Scene, uiContainer: Phaser.GameObjects.Container) {
    this.scene = scene;
    const cx = scene.scale.width / 2;

    this.container = scene.add.container(0, 0).setDepth(400).setVisible(false);
    uiContainer.add(this.container);

    const headerText = scene.add.text(cx, HEADER_Y, "CHOOSE YOUR UPGRADE", titleStyle(20, COLOR.gold)).setOrigin(0.5);
    this.container.add(headerText);

    const detailY = CARDS_CENTER_Y + CARD_HEIGHT / 2 + CARD_GAP + DETAIL_HEIGHT / 2;
    this.detail = new UpgradeDetailPanel(scene, cx, detailY);
    this.container.add(this.detail.container);

    // Belt-and-suspenders for a fast pointer flick straight off the canvas: a per-card pointerout
    // always fires for ordinary mouse movement, but this catches the pointer leaving the game
    // entirely (e.g. off the browser window) in one motion.
    scene.input.on(Phaser.Input.Events.GAME_OUT, () => {
      if (!this.container.visible) return;
      this.hideTimer?.remove();
      this.detail.hide();
      for (const card of this.cards) card.resetHover();
    });
  }

  get visible(): boolean {
    return this.container.visible;
  }

  show(options: UpgradeId[], player: Player, onChosen: (id: UpgradeId) => void): void {
    this.clearCards();
    this.onChosen = onChosen;
    this.selecting = false;

    const cx = this.scene.scale.width / 2;
    const total = options.length * CARD_WIDTH + (options.length - 1) * CARD_GAP;
    const startX = cx - total / 2 + CARD_WIDTH / 2;

    options.forEach((id, i) => {
      const def = UPGRADES[id];
      const x = startX + i * (CARD_WIDTH + CARD_GAP);
      const card = new UpgradeCard(this.scene, x, CARDS_CENTER_Y, def, {
        onHover: (hoveredDef) => {
          this.hideTimer?.remove();
          this.detail.show(hoveredDef, player.previewUpgradeEffect(hoveredDef.id));
        },
        onLeave: () => this.scheduleHideDetail(),
        onSelect: (selectedDef) => this.selectUpgrade(selectedDef.id),
      });
      this.container.add(card.container);
      this.cards.push(card);
    });

    this.container.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 180 });
  }

  /** Keyboard 1/2/3 parity with clicking a card — same confirm flow either way. */
  selectByIndex(index: number): void {
    const card = this.cards[index];
    if (card) this.selectUpgrade(card.def.id);
  }

  hide(): void {
    this.hideTimer?.remove();
    this.container.setVisible(false);
    this.detail.hide();
    this.clearCards();
  }

  private scheduleHideDetail(): void {
    this.hideTimer?.remove();
    this.hideTimer = this.scene.time.delayedCall(HIDE_DELAY_MS, () => this.detail.hide());
  }

  private selectUpgrade(id: UpgradeId): void {
    if (this.selecting) return;
    this.selecting = true;
    this.hideTimer?.remove();

    const chosenCard = this.cards.find((c) => c.def.id === id);
    for (const card of this.cards) {
      if (card === chosenCard) card.setSelected();
      else card.setDimmed();
    }
    chosenCard?.playConfirm(() => this.onChosen?.(id));
  }

  private clearCards(): void {
    for (const card of this.cards) card.destroy();
    this.cards = [];
  }
}
