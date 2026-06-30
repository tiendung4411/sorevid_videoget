# PineDrama Series Missing `.und.vtt` Recovery Plan

## Muc tieu

Dam bao luong tai TikTok / PineDrama Series khong ket thuc trong trang thai "co ve thanh cong" khi subtitle sidecar quan trong (dac biet `.und.vtt`) bi thieu.

Can co co che:

1. Phat hien subtitle sidecar bi thieu sau khi tai xong media.
2. Co gang bat lai subtitle URL moi tu Chrome/TikTok page neu link cu het han hoac subtitle list da thay doi.
3. Thu tai lai subtitle ma khong can tai lai video.
4. Luu dau vet ro rang de pipeline dich / long tieng biet episode nao chua du file.

## Hien trang code

### 1. Extension da resolve subtitle URLs

Trong [extension/src/content.ts](/Users/macbook/Documents/BiliBili%20Downloader/extension/src/content.ts), TikTok episode duoc map sang `ResolvedMediaItem`, trong do:

- `video.subtitleInfos` -> `ResolvedSubtitle[]`
- moi subtitle co:
  - `format`
  - `language`
  - `url`

### 2. Desktop backend tai subtitle theo kieu best-effort

Trong [src-tauri/src/lib.rs](/Users/macbook/Documents/BiliBili%20Downloader/src-tauri/src/lib.rs):

- `download_direct_media_item(...)` tai xong media roi goi `download_direct_subtitles(...)`
- `download_direct_subtitles(...)` lap qua `item.subtitles`
- `download_direct_subtitle(...)`:
  - tinh output path bang `subtitle_output_path(...)`
  - neu file da ton tai thi bo qua
  - neu HTTP subtitle fail thi tra `Err(...)`
- loi subtitle hien tai chi emit event `warning`
- job direct download van co the ket thuc `completed`

### 3. Ten file `.und.vtt` den tu fallback language

`subtitle_output_path(...)` dang dat:

- neu `subtitle.language` rong -> fallback thanh `"und"`
- extension mac dinh la `vtt` neu format/url khong ro

Vi vay file subtitle trong PineDrama rat de ra dang:

- `Episode Title.und.vtt`

### 4. Lo hong hien tai

Neu subtitle URL het han, 403/404, hoac response loi:

- video van duoc tai xong
- subtitle khong co file tren disk
- metadata sidecar van duoc ghi, nhung `subtitlePaths` chi chua file da luu duoc
- khong co buoc hau kiem bat buoc so sanh "expected subtitle" vs "actual subtitle"
- neu user bam tai lai, item co media ton tai san se bi `skip`, nen subtitle van thieu mai

## Nguyen nhan can xu ly

Van de khong chi la "download subtitle that bai".

Van de lon hon la:

1. He thong khong coi subtitle la mot artifact bat buoc cho PineDrama pipeline.
2. He thong khong co mode "repair subtitle only".
3. He thong da co ha tang `rescan` voi Chrome extension, nhung chua noi vao luong tu dong sua subtitle.

## Huong sua de xuat

## Phase 1: Them subtitle audit sau moi direct download

### Muc tieu

Sau khi tai xong media va subtitle, phai biet ro:

- episode nay expected bao nhieu subtitle file
- da co bao nhieu file thuc te
- file nao dang missing

### Thay doi de xuat

Them mot helper moi trong [src-tauri/src/lib.rs](/Users/macbook/Documents/BiliBili%20Downloader/src-tauri/src/lib.rs), vi du:

- `audit_direct_subtitles(item: &ResolvedMediaItem, media_path: &Path) -> DirectSubtitleAudit`

Struct de xuat:

```rust
struct DirectSubtitleAudit {
    expected_paths: Vec<PathBuf>,
    present_paths: Vec<PathBuf>,
    missing_paths: Vec<PathBuf>,
    has_missing_required: bool,
}
```

Logic:

1. Tu `item.subtitles`, dung lai `subtitle_output_path(...)` de tinh danh sach file du kien.
2. Kiem tra tung file:
   - co ton tai khong
   - kich thuoc > 0 khong
3. Danh dau missing neu:
   - file khong ton tai
   - hoac file rong

### Luu y

Buoc nay phai chay ca trong 2 truong hop:

- vua tai xong media moi
- media da ton tai san tren disk va item dang bi `skip`

Neu khong, case "video co roi nhung `.und.vtt` thieu" se khong bao gio duoc phat hien.

## Phase 2: Doi luong "skip existing file"

### Van de hien tai

Trong `start_direct_download(...)`, neu `existing_direct_media_output(...)` tim thay video thi item bi `continue` ngay.

Dieu nay can thay doi cho PineDrama/TikTok direct items co subtitle.

### Huong sua

Thay vi skip som:

1. Neu media da ton tai:
   - chay subtitle audit cho media file do
2. Neu khong co subtitle nao missing:
   - moi emit `Skipped existing file`
3. Neu co subtitle missing:
   - chuyen item sang nhanh "subtitle repair"
   - khong tai lai media

Co the tach helper:

- `repair_direct_subtitles_for_existing_media(...)`

Helper nay:

1. Co gang tai subtitle tu `item.subtitles` hien co truoc
2. Audit lai
3. Neu van missing thi queue rescan

## Phase 3: Tu dong queue Chrome re-scan khi missing subtitle

### Tai sao dung re-scan

Repo da co san co che:

- desktop command `queue_tiktok_rescan(...)`
- extension background `drainRescanItems()`
- extension se mo TikTok tab dang login, resolve lai item, gan `cookieHeader`, roi `import_resolved_media`

Day la duong ngan nhat de "bat lai link subtitle moi".

### Thay doi de xuat

Khi subtitle audit phat hien missing sau lan tai dau tien:

1. Backend queue item vao `pending_rescan_items`
2. Emit warning ro rang:
   - subtitle file nao missing
   - dang yeu cau Chrome refresh subtitle URL
3. Metadata sidecar ghi lai trang thai "awaiting subtitle recovery"

### Quan trong

Khong nen chi queue item im lang.

Can co event log kieu:

`[direct] Missing subtitle sidecar Episode 03.und.vtt. Queued Chrome re-scan to refresh subtitle URL.`

De user hieu vi sao app can Chrome tab TikTok mo san.

## Phase 4: Them luong "subtitle-only recovery" sau khi re-scan

### Van de hien tai

Sau khi extension `import_resolved_media` item moi vao app, hien tai du lieu moi chi quay lai preview queue. Chua co che noi tiep "item nay duoc rescan vi subtitle missing, hay dung item moi de repair subtitle cho file video da co san".

### Huong sua de xuat

Them mot command/backend path rieng, vi du:

- `retry_missing_direct_subtitles(request: DirectSubtitleRepairRequest)`

Request co the chua:

- `items: Vec<ResolvedMediaItem>`
- `downloadDir: String`

Behavior:

1. Tim media file da ton tai cho tung item.
2. Khong tai video.
3. Thu tai subtitle sidecar tu `item.subtitles` moi vua refresh.
4. Audit lai.
5. Neu du file thi mark recovered.
6. Neu van thieu thi giu warning/blocker.

### Cach noi vao UI

Co 2 cach:

1. Tu dong:
   - khi app nhan resolved item moi tu extension va nhan ra item do dang "pending subtitle recovery", tu dong goi repair command.
2. Ban tu dong:
   - them nut `Repair missing subtitles` cho selected TikTok direct items.

De bai toan nay, minh de xuat uu tien **tu dong** cho PineDrama vi day la artifact bat buoc cho pipeline sau.

## Phase 5: Ghi state ro rang trong metadata sidecar

### Van de hien tai

`write_direct_metadata_sidecar(...)` moi luu:

- `subtitles`
- `subtitlePaths`

Nhung chua luu:

- expected files
- missing files
- subtitle recovery state

### Thay doi de xuat

Mo rong JSON sidecar, vi du:

```json
{
  "subtitles": [...],
  "subtitlePaths": [...],
  "expectedSubtitlePaths": [...],
  "missingSubtitlePaths": [...],
  "subtitleRecovery": {
    "status": "ok | missing | queued_rescan | recovered | failed",
    "lastCheckedAt": 1234567890
  }
}
```

### Loi ich

Pipeline sau co the doc sidecar de:

- chan dich / long tieng neu subtitle chua du
- bao cao episode nao dang cho repair
- retry co chu dich thay vi scan lai ca series

## Phase 6: Doi tieu chi thanh cong cua direct download

### De xuat rule moi

Voi TikTok / PineDrama direct items:

1. Neu `item.subtitles` rong:
   - cho phep completed, nhung warning ro "source khong tra subtitle"
2. Neu `item.subtitles` khong rong va tat ca subtitle files da co:
   - `completed`
3. Neu `item.subtitles` khong rong va con missing:
   - khong nen coi la "clean success"
   - emit `warning` hoac `partial`
   - sidecar phai danh dau blocker

### Ghi chu

Neu schema event hien tai chi co `starting/running/warning/completed/failed`, co the giu nguyen va:

- job van `completed`
- nhung phai co warning tong ket rat ro rang
- va UI can tong hop job nay la "completed with subtitle recovery pending"

Neu muon sach hon, co the bo sung status moi `partial`, nhung day la thay doi lon hon cho UI.

## Phase 7: UI/UX de user nhin thay item nao dang thieu subtitle

### De xuat toi thieu

Trong [src/App.tsx](/Users/macbook/Documents/BiliBili%20Downloader/src/App.tsx):

1. Hien warning badge cho TikTok direct item neu metadata sidecar/preview cho biet subtitle recovery pending.
2. Sau khi bam `Re-scan selected`, neu muc tieu la subtitle recovery thi thong diep nen ro hon:
   - `Queued 5 TikTok items for subtitle URL refresh in Chrome.`

### De xuat them

Them filter hoac quick action:

- `Select items missing subtitles`
- `Repair missing subtitles`

Khong bat buoc cho ban dau, nhung rat huu ich khi series dai 50-100 tap.

## Phase 8: Test cases can them

### Unit tests trong Rust

Them test cho:

1. `subtitle_output_path(...)`
   - language rong => `.und.vtt`
2. `audit_direct_subtitles(...)`
   - file ton tai day du
   - file missing
   - file rong
3. case media ton tai san nhung subtitle missing
   - phai khong skip im lang

### Integration behavior tests

Can cover:

1. Direct download thanh cong video + subtitle
2. Video thanh cong, subtitle HTTP fail
   - phai queue rescan
   - phai ghi metadata missing
3. Rescan tra subtitle URL moi
   - repair subtitle only thanh cong
4. Rescan xong van khong co subtitle
   - item van bi danh dau blocker

## Thu tu implement de xuat

1. Them `DirectSubtitleAudit` + helper audit.
2. Sua luong `existing_direct_media_output(...)` de audit subtitle thay vi skip som.
3. Them metadata sidecar fields cho expected/missing/recovery state.
4. Tu dong queue `pending_rescan_items` khi subtitle van missing.
5. Them command subtitle-only repair cho items da co media.
6. Noi ket qua re-scan tu extension vao repair flow.
7. Cap nhat UI thong diep/warning badge.
8. Them tests.

## File can sua

- [src-tauri/src/lib.rs](/Users/macbook/Documents/BiliBili%20Downloader/src-tauri/src/lib.rs)
  - them audit helper
  - sua `start_direct_download(...)`
  - sua `download_direct_subtitles(...)` hoac them helper repair
  - mo rong `write_direct_metadata_sidecar(...)`
  - them command subtitle-only recovery
- [src/App.tsx](/Users/macbook/Documents/BiliBili%20Downloader/src/App.tsx)
  - hien warning ro hon
  - neu can, trigger repair flow / re-scan flow
- [extension/src/background.ts](/Users/macbook/Documents/BiliBili%20Downloader/extension/src/background.ts)
  - co the can noi tiep ket qua rescan vao repair flow neu muon tu dong hon
- [extension/src/protocol.ts](/Users/macbook/Documents/BiliBili%20Downloader/extension/src/protocol.ts)
  - neu can them payload/action rieng cho subtitle repair

## Quy tac nghiep vu de chot

De tranh mo ho sau nay, minh de xuat chot rule:

1. Voi PineDrama/TikTok direct download, subtitle sidecar la artifact quan trong ngang muc "required downstream asset".
2. Neu source co tra `subtitles[]` ma file sidecar con missing, item khong duoc xem la thanh cong tron ven.
3. App phai tu dong co gang refresh subtitle URL it nhat 1 lan qua Chrome re-scan.
4. Neu van that bai sau recovery, metadata phai ghi ro de pipeline sau dung lai hoac bao nguoi van hanh.

## Ket luan

Huong sua tot nhat khong phai chi la "neu thieu `.und.vtt` thi download lai file subtitle".

Huong dung hon la:

1. coi subtitle la artifact can audit,
2. tranh skip im lang khi media da ton tai,
3. tan dung re-scan ha tang san co de refresh subtitle URL,
4. va them mot luong subtitle-only repair de khong phai tai lai ca video.

Neu lam theo huong nay, PineDrama series se on dinh hon nhieu cho pipeline dich va long tieng o buoc sau.
