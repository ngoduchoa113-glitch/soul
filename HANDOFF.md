# Dungeon Soul — Handoff Notes

Đây là project game 2D top-down roguelike shooter tên **Dungeon Soul**, làm dựa trên bản đặc tả `dungeon-soul-spec-v1.1.md` (bản gốc nằm ở `C:\Users\DELL\Downloads\dungeon-soul-spec-v1.1.md` trên máy chủ cũ — nên **đính kèm file này khi mở conversation mới** vì nó là nguồn sự thật cho mọi quyết định thiết kế/số liệu trong code).

Đưa file này (và spec gốc nếu có) cho Claude mới, kèm câu: *"Đọc HANDOFF.md và dungeon-soul-spec-v1.1.md, tiếp tục làm Phase 8"* (hoặc phase bạn muốn).

## Vị trí project
```
D:\Hoang study\FullStackWeb26A\HomeworkAndTest\test_game\soul_knight
```
Chạy: `npm run dev` → mở `http://localhost:5173`. Stack: Vite + TypeScript + Phaser 3.90 (Arcade Physics). Không dùng asset ảnh — mọi texture là hình khối màu generate runtime trong `src/scenes/BootScene.ts` (cố ý, để không copy asset Soul Knight thật, đúng nguyên tắc mục 41.5 của spec).

## Tiến độ (8 phase theo mục 36 của spec)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 1. Core | Movement, aim, shoot, collision, HP, chết | ✅ Xong |
| 2. Weapon | Pistol/Shotgun/Rifle/Energy Sword, **energy thay ammo/reload** (xem ghi chú), đổi súng | ✅ Xong |
| 3. Dungeon | Map nhánh + **hành lang thật** nối các phòng, door lock/unlock, 3 loại enemy (Melee/Ranged/Bomber), chest | ✅ Xong |
| 4. Loot & Shop | Chest roll 4 loại thưởng (coin/weapon rarity/health/upgrade), Shop mua bán thật, upgrade 3-lựa-chọn | ✅ Xong |
| 5. Boss | Boss thật 5 attack pattern (Normal/Dash/Projectile/AOE/Summon), Phase 2 tại ≤50% HP | ✅ Xong |
| 6. Character | 4 class (**Knight/Samurai/Healer/Mage** — đổi từ Warrior/Gunner/Mage/Medic, xem ghi chú), màn chọn nhân vật, skill chuột phải | ✅ Xong |
| 7. Multiplayer | Lobby, WebSocket, đồng bộ, revive | ⬜ **Người dùng quyết định BỎ QUA** — chỉ chơi solo, xem lý do bên dưới |
| 8. Polish | Sound (synth Web Audio API), VFX (flash/particle/shake), minimap, loading screen, error handling | ✅ Xong — animation thật (frame-based) vẫn chờ asset nhân vật thật |
| 9. Run structure | Map nhánh kiểu Soul Knight, floor/stage progression (1.1→2.5), Main Menu, Trophy | ✅ Xong (2026-08-10) — xem mục riêng bên dưới |
| 10. Corridors + Energy | Hành lang thật nối phòng, hệ thống energy thay ammo/reload | ✅ Xong (2026-08-10) — xem mục riêng bên dưới |

**Đổi roster (2026-08-10):** Bỏ Gunner, đổi thành 4 class **Knight** (tank, "Shield Charge" — dash + buff phòng thủ tạm thời), **Samurai** (melee DPS/burst mới, "Iaijutsu Strike" — dash ngắn/nhanh/damage cao/cooldown thấp, máu thấp), **Healer** (support, đổi tên từ Medic, giữ nguyên "Heal Pulse"), **Mage** (không đổi, "Fire Nova"). Knight/Samurai dùng chung cơ chế `dashSlash` trong `Player.ts`, chỉ khác số liệu trong `data/characters.ts` — không có knockback thật vì `Enemy.ts` ghi đè velocity mỗi frame trong AI, một impulse ngoài sẽ bị xóa ngay frame sau.

**Quyết định quan trọng cần nhớ:** user xác nhận chỉ chơi solo dài hạn, nên Phase 7 (Multiplayer) bị bỏ qua có chủ đích — không phải thiếu sót. Đã giải thích với user rằng: toàn bộ gameplay hiện tại chạy đầy đủ ở solo vì code không phụ thuộc networking; thứ duy nhất mất là cơ chế co-op thật (revive đồng đội — player hiện chỉ có state ALIVE/DEAD, chưa có DOWNED vì DOWNED chỉ có ý nghĩa khi có người cứu). Đừng tự ý quay lại làm Phase 7 trừ khi user đổi ý.

## Cấu trúc code

```
src/
  main.ts                    — Phaser game config, danh sách scene
  scenes/
    LoadingScene.ts            — "press any key" đầu tiên, unlock AudioContext
    BootScene.ts                — generate texture runtime, chuyển sang MainMenuScene
    MainMenuScene.ts             — title screen, điểm quay về sau khi lấy trophy
    CharacterSelectScene.ts      — màn chọn 1 trong 4 class, luôn start run mới ở floor:1,stage:1
    GameScene.ts                 — scene chính, 1 màn = 1 stage; tự restart chính nó khi qua stage/floor mới
  entities/
    Player.ts                 — nhân vật: movement, aim, weapon slots, skill, upgrades, coins, energy, getSnapshot/applySnapshot
    Enemy.ts                  — data-driven (EnemyDef), 3 behavior: melee/ranged/bomber
    Boss.ts                   — state machine riêng: IDLE/CHASE/TELEGRAPH/EXECUTING/COOLDOWN
    Projectile.ts             — dùng chung cho đạn người chơi lẫn enemy
    Chest.ts, ShopStand.ts    — loot & shop
    Portal.ts                  — prop tương tác cuối stage: kind "gate" (qua stage kế) hoặc "trophy" (về Main Menu)
    EnergyPickup.ts             — vật phẩm rớt từ quái, tự nhặt khi chạm, hồi Player.stats.energy
    Combatant.ts               — interface chung {active,x,y,roomIndex,update,takeDamage} để Room/GameScene
                                 không cần biết đang cast Enemy hay Boss
  dungeon/
    DungeonLayout.ts           — generateStageLayout(seed, kind): sinh MAP NHÁNH + pitch có khoảng trống cho corridor (CORRIDOR_LEN), xem mục "Run structure"
    Room.ts                    — state machine LOCKED→ACTIVE→CLEARED, xây tường đủ 4 hướng, spawn enemy/boss/chest/portal (KHÔNG biết corridor tồn tại)
    Door.ts                    — 3 tile gap, hỗ trợ cả trục ngang(h) lẫn dọc(v), export GAP_INDICES dùng chung với Room/Dungeon
    Dungeon.ts                 — build rooms+doors từ graph (edges), TỰ VẼ hành lang nối 2 phòng (createConnection), tính worldWidth/Height theo grid extent thật
  data/                        — TOÀN BỘ số liệu game nằm ở đây, tách khỏi logic
    weapons.ts, enemies.ts, boss.ts, characters.ts, types.ts
  ui/
    Hud.ts                     — HP/weapon/coins/skill/boss-bar/banner/stage-label, tất cả 1 class
    ChoiceMenu.ts               — popup dùng chung cho Shop và Upgrade-pick
    Minimap.ts                  — panel góc phải trên, đọc trực tiếp dungeon.rooms (public), không cần data riêng
  audio/
    Sfx.ts                      — âm thanh synth thuần Web Audio API (oscillator/noise), không dùng file .mp3/.wav
  fx/
    Fx.ts                       — muzzleFlash/hitSpark/damageFlash/deathPoof/explosion/screenShake/trailDot, dùng texture "spark" generate ở BootScene
```

**Nguyên tắc đã theo xuyên suốt:** mọi con số gameplay (damage, cooldown, tốc độ...) đều nằm trong file `data/*.ts` dạng object literal, KHÔNG hardcode rải rác trong logic. Muốn chỉnh cân bằng chỉ sửa ở `data/`.

## Quy trình làm việc đã dùng (nên tiếp tục giữ)

1. Mỗi phase mới → dùng `EnterPlanMode`, đọc code hiện tại, viết plan có mục **Context** (lý do), **Design** (từng file sẽ đổi gì), **Verification** (checklist cụ thể) → `ExitPlanMode` xin duyệt trước khi code.
2. Sau khi code xong → LUÔN chạy `npx tsc --noEmit` trước khi test.
3. Test trong browser bằng cách gọi trực tiếp `window.game.loop.step(t)` nhiều lần thủ công (xem mục "Ghi chú kỹ thuật quan trọng" bên dưới) + `dynamic import()` để lấy class/data ra test cô lập, thay vì chỉ nhìn hình.
4. Sau khi verify xong tất cả checklist trong plan → báo cáo ngắn gọn cho user bằng tiếng Việt, nêu rõ bug thật nào bắt được (nếu có) và đã sửa thế nào.

## Ghi chú kỹ thuật quan trọng (đỡ mất thời gian debug lại)

1. **Browser pane trong môi trường này không render/composite được** → tool `screenshot` luôn báo lỗi "not compositing frames". Đừng cố chụp ảnh. Thay vào đó: dùng `mcp__Claude_Browser__javascript_tool` gọi `window.game.loop.step(t)` (t tự tăng dần từng 16.67ms) để giả lập frame, và dispatch DOM event thật (`KeyboardEvent`, `MouseEvent`) lên `document.querySelector('canvas')` để giả lập input. `window.game` chỉ tồn tại vì `main.ts` có gán `if (import.meta.env.DEV) window.game = game`.

2. **Phaser tự đảo thứ tự tham số trong `physics.add.overlap(group, singleSprite, callback)`** khi tham số thứ 2 là 1 sprite đơn (không phải group) — callback nhận `(singleSprite, groupMember)` chứ không phải `(groupMember, singleSprite)` như trực giác. Đã từng gây bug thật (enemy bắn trúng player lại gọi nhầm `.destroy()` lên player). Xem comment trong `GameScene.ts` chỗ overlap `enemyProjectiles` vs `player`.

3. **Test cooldown/timer phải tự advance `t` đủ xa**, không dựa vào `performance.now()` tại thời điểm gọi script — vì đó là wall-clock thật của trình duyệt, không liên quan tới thời gian mô phỏng đã step. Từng tự gây hoang mang tưởng bug (skill Medic "không hoạt động") nhưng thực ra do tự set `lastSkillAt` bằng timestamp giả quá lớn ở bước test trước đó.

4. **Dispatch chuột phải phải dùng `new MouseEvent('mousedown', {button:2, buttons:2, ...})`**, không phải `'pointerdown'` — canvas của Phaser lắng nghe native `mousedown`/`mousemove`, không phải Pointer Events API tên đó.

5. `disableContextMenu: true` đã bật trong `main.ts` nên chuột phải không mở menu chuột phải của trình duyệt.

## Việc đã làm ở Phase 8 (2026-08-10)

Làm trọn Phase 8 trong 1 lần (user xác nhận: âm thanh synth bằng code nếu khả thi — có, nên làm hết luôn):

- **Sound** (`audio/Sfx.ts`): mọi âm thanh là oscillator/noise tự synth bằng Web Audio API, không có file .mp3/.wav. `LoadingScene` (scene đầu tiên trước `BootScene`) đóng vai trò màn "press any key to start" — vừa là nơi unlock `AudioContext` theo đúng yêu cầu user-gesture của trình duyệt, vừa hợp lý vì BootScene generate texture đồng bộ nên không có gì để hiện progress bar thật.
- **VFX** (`fx/Fx.ts`): muzzle flash, hit spark, damage flash (tint trắng), death poof, explosion (dùng cho bomber + boss AoE + Fire Nova), screen shake, projectile trail — toàn bộ dùng `Phaser.Tweens` + texture "spark" mới generate trong `BootScene.ts`, không cần particle system riêng.
- **onDeath bug tìm thấy lúc explore code cũ**: `Enemy`/`Boss` đã có sẵn callback `onDeath` được khai báo và gọi (`die()`), nhưng chưa ai từng nối nó lên `Room.spawnEnemy`/`spawnBoss` — nghĩa là trước đây callback này luôn `undefined`, không hoạt động, không liên quan gì Phase 8. Đã nối xuyên suốt `Enemy/Boss → Room → Dungeon → GameScene` để VFX/SFX chết có chỗ bám vào — đây là bug thật, không phải tính năng Phase 8.
- **Minimap** (`ui/Minimap.ts`): đọc thẳng `dungeon.rooms` (đã public sẵn, không cần sửa gì ở `Dungeon.ts`/`Room.ts` ngoài phần trên), vẽ bằng `Phaser.GameObjects.Graphics`, không cần asset.
- **Error handling** (`main.ts`): `window.addEventListener("error"/"unhandledrejection")` hiện overlay DOM (không phải Phaser object, vì scene có thể đã crash) báo "Something went wrong — reload the page". Không thêm try/catch rải rác vì game này không có I/O bên ngoài để mà fail.
- **Vite port**: thêm `vite.config.ts` đọc `process.env.PORT` (trước đó không có, Vite mặc định cứng port 5173) + `.claude/launch.json` bật `autoPort: true`, để nhiều session dev cùng lúc không đụng port nhau.

Đã verify qua browser pane (theo đúng quy trình `window.game.loop.step()` + dynamic import cô lập): tất cả 5 pattern boss + phase 2 + chết, bomber explode, fireNova/healPulse, chest, melee/reload/skill, chuyển room → minimap, error overlay — không lỗi console, số GameObject không leak (dao động ổn định, không tăng liên tục qua nhiều frame).

## Run structure (2026-08-10) — map nhánh + floor/stage progression

Trước đây `GameScene` chỉ có đúng 1 màn 6-room-thẳng-hàng, boss chết chỉ hiện text "FLOOR CLEARED" rồi hết — không có gì thật sự tiếp diễn. Giờ mỗi lần chơi là một **run** thật: `MainMenuScene → CharacterSelectScene → GameScene(floor 1, stage 1..5) → GameScene(floor 2, stage 1..5) → trophy → MainMenuScene`.

- **1 "màn" (stage) = 1 lần `GameScene.create()`** với `data: {characterId, floor, stage, snapshot?}`. `GameScene` tự gọi `this.scene.start("GameScene", nextData)` để "restart chính nó" khi qua stage/floor mới — không có scene riêng cho từng floor.
- **`generateStageLayout(seed, kind)`** trong `DungeonLayout.ts` sinh ra 1 trong 3 dạng map, không còn hàm cũ `generateDungeonLayout` (đã xoá):
  - `"regular"` (stage .1-.4): random-walk trên lưới ô vuông từ room gốc `(0,0)` = `"rest"`, rẽ nhánh ngẫu nhiên 4 hướng cho tới khi đủ 6-9 phòng → BFS tìm leaf xa nhất làm phòng `"gate"` → các phòng còn lại random theo trọng số `normal×4, elite×2, shop×1` (phần lớn phòng quái). Đây LÀ một cây (tree), luôn liền mạch, luôn connected.
  - `"boss"` (stage .5): chỉ 2 phòng — `"rest"` nối `"boss"`.
  - `"trophy"` (chỉ sau khi hạ boss floor 2): 1 phòng duy nhất.
- **Room không còn chỉ có `westDoor`/`eastDoor`** — giờ có tối đa 4 cửa (`north/south/east/west`), map `Partial<Record<Direction, Door>>`. `Room.buildWalls()` xây tường ĐỦ 4 cạnh mặc định, chỉ chừa 3 tile gap ở cạnh có cửa thật.
- **Bug thật tìm thấy lúc rewrite** (có từ Phase 3, không liên quan gì tính năng này): `buildPerimeterWalls` cũ chỉ xây tường trái/phải cho phòng đầu/cuối dãy — phòng giữa hoàn toàn không có tường trái/phải riêng, chỉ có 3 tile của `Door` che đúng 3/18 hàng biên. 15/18 hàng còn lại **không có collider gì cả**, nghĩa là cửa khóa vẫn có thể đi vòng qua chỗ không phải cửa. Vô hại ở bản cũ vì dãy phòng thẳng hàng (không ai để ý), nhưng bắt buộc phải xây tường 4 cạnh đầy đủ giờ mới lộ ra rõ — đã verify bằng cách check trực tiếp physics body ở toàn bộ 18 hàng biên (xem cách test trong "Ghi chú kỹ thuật" bên dưới).
- **Không bắt buộc dọn sạch từng phòng** — chỉ cần dọn phòng nào đứng trên đường đi tới `"gate"`, đúng tinh thần "phải tự tìm cổng" của Soul Knight thật. Test tool dùng `window.__clearAndFindPortal()` (dọn hết mọi phòng để test cho chắc, không phải yêu cầu gameplay).
- **Player state giữ nguyên qua các stage** (hp/maxHp/coins/upgrades/vũ khí) qua `Player.getSnapshot()`/`applySnapshot()`, **đạn KHÔNG giữ** (refill đầy mỗi stage mới) — quy ước chuẩn của roguelike. Phòng `"rest"` (luôn là room 0 của mọi stage trừ trophy) full-heal người chơi khi vào.
- **`GameScene.advanceStage()`** là nơi tính stage kế tiếp: `stage<5→stage+1`; `stage===5 && floor<2→floor+1,stage:1`; `stage===5 && floor===2→stage:6` (trophy); `stage===6` (đã ở trophy, bấm cổng) `→ scene.start("MainMenuScene")`. Được gọi từ 2 chỗ: boss chết (`onBossCleared` callback, tự động, không cần tìm cổng) và người chơi tương tác `Portal` kind `"gate"`/`"trophy"` (phải đi bộ tới + bấm E).
- **Bug thật bắt được lúc verify** (không phải bug cũ, mới tạo ra lúc code tính năng này): lúc đầu gọi `player.heal()` (cho phòng rest) TRƯỚC khi `this.hud = new Hud(this)` được tạo trong `create()` → crash vì `onHpChanged` callback gọi `this.hud.setHp` lúc `hud` còn `undefined`. Đã sửa: dời đoạn `applySnapshot`/heal xuống sau dòng tạo `Hud`.
- Trước mắt **chỉ 2 floor** (`floor < 2` hardcode trong `advanceStage`) — muốn thêm floor 3+ sau này chỉ cần đổi số `2` đó, không cần sửa gì khác.

Đã verify full run end-to-end qua browser pane: tự động dọn sạch cả floor 1 (1.1→1.5, hạ boss) → floor 2 (2.1→2.5, hạ boss) → trophy → về MainMenuScene, kiểm tra coins/vũ khí giữ nguyên còn đạn reset đúng ở mỗi lần qua stage, quay lại từ Main Menu chọn nhân vật khác chơi tiếp không lỗi, bắn/melee/skill/shop vẫn hoạt động trong map nhánh mới, `npx tsc --noEmit` sạch.

## Corridors + Energy system (2026-08-10)

- **Hành lang thật**: trước đó 2 phòng kề nhau chỉ cách nhau đúng 3 tile door-gap khoét thẳng vào tường chung (map nhánh mới làm phiên trước). Giờ có khoảng cách thật `CORRIDOR_LEN = 4` tile (128px) giữa 2 ô lưới, `Dungeon.ts` (method `createConnection`, thay cho `createDoor` cũ) tự vẽ sàn + tường 2 bên lấp khoảng trống đó bằng đúng texture `"floor"`/`"wall"` Room.ts đã dùng — không cần asset mới. `Door` (vẫn 1 cái/edge, không đổi class) giờ nằm ở CHÍNH GIỮA hành lang thay vì trên tường chung. `Room.ts` và `Door.ts` **hoàn toàn không đổi gì** — chúng không biết corridor tồn tại, chỉ quan tâm phía nào của chính mình có gap.
  - Lưu ý quan trọng lúc test: `GAP_INDICES=[7,8,9]` canh giữa theo **chiều cao** phòng (18 hàng) nhưng KHÔNG canh giữa theo **chiều rộng** phòng (24 cột) — muốn đi qua cửa/hành lang chiều ngang phải nhắm đúng tọa độ gap (`rect.x + 8*32+16`), không phải tâm phòng (`centerX`). Test đầu tiên tự dí thẳng vào tường vì nhắm nhầm tâm phòng, không phải bug code — nếu debug lần sau gặp player "không qua được cửa", kiểm tra tọa độ nhắm trước khi nghi ngờ code.
- **Energy thay ammo/reload**: bắn súng tầm xa giờ trừ `energy` (`data/weapons.ts` field `energyCost`, thay cho `maxAmmo`/`reloadTimeMs` đã xoá hẳn), không còn nạp đạn — hết energy thì không bắn được nữa, không tự hồi theo thời gian. Vũ khí cận chiến (`energySword`, `energyCost: 0`) vẫn bắn tự do như cũ. Duy nhất 1 nguồn hồi: `EnergyPickup` rớt ra khi giết quái — enemy thường 35% rớt 8-15, boss **luôn luôn** rớt 50, tự nhặt khi chạm (không cần phím E, khác với chest/shop). `Player.getSnapshot()/applySnapshot()` đã có sẵn từ phiên trước, chỉ thêm field `energy`/`maxEnergy` vào là carry-over qua stage tự động chạy đúng.
  - `WeaponInstance` giờ chỉ còn `{def, lastShotAt}` — không còn ammo/reloading/reloadEndsAt gì cả, energy nằm ở `Player.stats`, không phải per-weapon.
  - HUD có thêm thanh Energy (xanh dương) ngay dưới thanh HP, các dòng text bên dưới (weapon/coins/skill/stage) đều bị đẩy xuống theo — nếu sau này thêm dòng HUD mới thì nhớ tính offset dựa trên `afterBarsY` trong `Hud.ts`, đừng hardcode số.
- **Không có bug thật nào trong code lần này** — cả 2 lần tưởng bắt được bug lúc verify (player "không qua được hành lang", boss "không rớt energy") đều do tự sai lúc viết test (nhắm sai tọa độ; check kết quả sau khi scene đã restart nên nhóm object cũ đã bị huỷ) — đã note lại phía trên để khỏi lặp lại nhầm lẫn tương tự.

## Việc tiếp theo

- **Thêm asset ảnh/âm thanh thật khi có** — chỉ cần sửa `BootScene.ts` (thay `createCircleTexture`/`createRectTexture` bằng `this.load.image`/`spritesheet`) và thay các hàm trong `Sfx.ts` bằng `this.load.audio` + `sound.play`, không đụng gì tới gameplay logic. Animation hiện tại là procedural (tween scale/tint), có thể giữ song song hoặc thay bằng frame animation thật khi có spritesheet.
- Nếu muốn thêm floor 3 trở lên: sửa hằng số `2` trong `GameScene.advanceStage()`.
- Corridor hiện tại chỉ là 3-tile gap trên tường chung giữa 2 phòng kề nhau (giống ảnh ví dụ nhưng không có đoạn hành lang riêng biệt) — nếu muốn hành lang dài như ảnh gốc thì cần thêm bước sinh geometry riêng cho corridor, chưa làm vì user đồng ý giữ đơn giản.
