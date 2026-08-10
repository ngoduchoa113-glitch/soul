import Phaser from "phaser";
import { LoadingScene } from "./scenes/LoadingScene";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { GameScene } from "./scenes/GameScene";

function showFatalErrorOverlay(message: string): void {
  if (document.getElementById("fatal-error-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "fatal-error-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;" +
    "justify-content:center;gap:12px;background:rgba(10,10,14,0.95);color:#fff;" +
    "font-family:sans-serif;z-index:9999;text-align:center;padding:24px;";

  const title = document.createElement("div");
  title.textContent = "Something went wrong";
  title.style.cssText = "font-size:24px;font-weight:bold;color:#ef4444;";

  const detail = document.createElement("div");
  detail.textContent = message;
  detail.style.cssText = "font-size:14px;color:#aaa;max-width:480px;word-break:break-word;";

  const hint = document.createElement("div");
  hint.textContent = "Please reload the page.";
  hint.style.cssText = "font-size:16px;color:#4fd1c5;";

  overlay.append(title, detail, hint);
  document.body.appendChild(overlay);
}

window.addEventListener("error", (event) => {
  showFatalErrorOverlay(event.message || "Unknown error");
});
window.addEventListener("unhandledrejection", (event) => {
  showFatalErrorOverlay(String(event.reason));
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 640,
  backgroundColor: "#111111",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [LoadingScene, BootScene, MainMenuScene, CharacterSelectScene, GameScene],
  disableContextMenu: true,
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
