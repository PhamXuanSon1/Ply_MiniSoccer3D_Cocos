# CharacterFX

Prefab hiệu ứng nhân vật + hiệu ứng thắng / đánh nhau, dùng được ở project Cocos Creator 3.8 khác.
Thư mục này **tự đủ**: script chỉ import `cc` và các file cùng thư mục, prefab chỉ dùng ảnh / material / shader trong thư mục.

## Mang sang project khác

1. Đóng Cocos Creator của project đích (hoặc để mở cũng được, Creator sẽ tự import).
2. Copy **cả thư mục `CharacterFX`** (kèm toàn bộ file `.meta`) vào `assets/` của project đích.
   - Bắt buộc giữ `.meta`: prefab tham chiếu ảnh / script bằng UUID nằm trong `.meta`. Thiếu `.meta` là prefab mất ảnh hoặc "Missing Script".
   - Không copy lẻ từng prefab.
3. Nếu project đích đã có asset trùng UUID (vd đã từng copy bản cũ) thì xoá bản cũ trước.

## Xem thử hiệu ứng

### Ngay trong Scene editor (không cần Play)

1. Mở scene **`Preview/CharacterFX_Preview.scene`** (chỉ cần mở 1 lần).
2. **Bấm chọn 1 prefab FX trong panel Assets** → hiệu ứng tự chạy trong Scene view.
   - `FX_*_MaxLevel`: gắn lên nhân vật mẫu, nhân vật lách qua lại để thấy đuôi bóng mờ.
   - `FX_Win`, `FX_FightingCloud`: chạy lặp lại mỗi 3 giây (`Loop` trên `FxEditorPlayer`).
   - Prefab FX mới (có `CharacterFx`, `WinShowcase` hoặc `ParticleSystem`) cũng tự nhận, không cần đăng ký.
3. Sửa prefab (màu, tốc độ...) → lưu → bấm chọn lại prefab để xem bản mới.

- Scene view phải ở chế độ **3D** và nhìn vào node `Stage/Rig/Character` (chọn node rồi bấm phím **F** để focus).
- Tắt xem thử: bỏ tick `Playing` trên `Previewer > FxEditorPlayer`.
- Node hiệu ứng tạo ra không bị lưu vào scene.

### Bấm Play

Bấm **Play** (▶) khi đang mở scene này: chạy lần lượt `FX_Mbappe_MaxLevel` → `FX_Yamal_MaxLevel` → `FX_Ronaldo_MaxLevel` → `FX_Win` → `FX_FightingCloud`,
mỗi cái 4 giây; chạm / click để chuyển ngay. Thêm prefab vào danh sách: `Previewer > FxPreviewer > Character Fx`.

Đổi nhân vật mẫu: sửa `Sample` (ảnh + glow + scale/offset) và `Sample Win` trên `FxPreviewer`.

## Nội dung

| Thư mục | |
|---|---|
| `Prefabs/` | `FX_Mbappe_MaxLevel` (chạy kiểu The Flash), `FX_Yamal_MaxLevel` (hào quang), `FX_Ronaldo_MaxLevel` (glow bản v25), `FX_Win`, `FX_FightingCloud` |
| `Scripts/` | `CharacterFx` (lớp nền), `CharacterFxHost` (gắn lên nhân vật), `CharacterFrame`, `AuraFx`, `FlashTrail`, `RonaldoGlowFx`, `PowerAura`, `WinShowcase` |
| `Sprites/`, `Materials/`, `Animations/` | Asset mà các prefab dùng |
| `Preview/` | Scene xem thử + `FxPreviewer` + ảnh nhân vật mẫu (không bắt buộc khi copy) |

## Hiệu ứng max level của nhân vật

Cấu trúc node nhân vật cần có:

```
Rig                      (đứng yên theo chiều ngang, chạy theo camera)
└─ Character             ← gắn CharacterFxHost (node chạy ngang theo ngón tay)
   └─ Visuals            (gốc ở chân)
      └─ Body [Sprite]   ← kéo vào CharacterFxHost.body
```

Trong `CharacterFxHost`: kéo prefab vào `fxPrefab` (hoặc gọi `setPrefab` trong code), rồi từ code game gọi:

```ts
import { CharacterFxHost } from '../CharacterFX/Scripts/CharacterFxHost';

host.setPrefab(prefab);   // đổi hiệu ứng (đổi nhân vật)
host.setFrame(frame);     // mỗi lần đổi ảnh Body (AuraFx cần frame.glow để vẽ hào quang theo dáng người)
host.setMaxLevel(true);   // vừa lên max level -> chạy hiệu ứng
host.setMaxLevel(false);  // tụt khỏi max level -> tắt
```

- `FX_Mbappe_MaxLevel`, `FX_Ronaldo_MaxLevel` không cần `setFrame`.
- `FX_Yamal_MaxLevel` (AuraFx) cần `CharacterFrame.glow`: ảnh silhouette mờ của đúng ảnh Body (cùng tâm, có viền đệm). Không có thì chỉ chạy hạt năng lượng, không có hào quang.
- `FX_Ronaldo_MaxLevel` vẽ theo dáng ảnh Ronaldo 512px (lớp glow cố định), chỉ hợp với bộ ảnh Ronaldo.

### Làm hiệu ứng mới

Tạo prefab có component kế thừa `CharacterFx`, override `begin()` / `end()` / `setFrame()`.
Node cần vẽ sau người: kéo vào `behindBody`. Node cần đứng yên khi nhân vật lạng ngang (vd đuôi bóng mờ): kéo vào `behindCharacter`.

## Hiệu ứng thắng / đánh nhau

- `FX_Win`: đặt làm anh em, **ngay sau** sprite ảnh kết quả. Lúc chạy, nhóm `Back` (tia sáng + hào quang) tự lùi ra đầu node cha để vẽ sau ảnh. Gọi `getComponent(WinShowcase).play()` khi hiện ảnh thắng (chớp sáng, tia xoay, sao, pháo giấy).
- `FX_FightingCloud`: bật node lên và `play()` các `ParticleSystem` bên trong.

**Lưu ý khi nối code:** tham chiếu từ scene tới *component bên trong* một prefab instance, nếu gán bằng script, sẽ không được lưu. Hãy giữ tham chiếu tới **node gốc** của prefab rồi `getComponent` lúc chạy, hoặc kéo thả bằng Inspector.
