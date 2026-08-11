/**
 * GameScene's camera zooms in on the world for crisper, more legible pixel art (see usage in
 * GameScene.setupCamera). Screen-fixed UI (Hud, ChoiceMenu, Minimap, pause overlay) is kept glued
 * to the screen despite that via GameScene.uiContainer + syncUiContainer(), not via this constant
 * — see the doc comment on Hud's constructor for why plain scrollFactor(0) isn't enough on its own
 * once the world camera is zoomed.
 */
export const CAMERA_ZOOM = 1;
