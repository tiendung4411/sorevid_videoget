# TikTok / PineDrama Module Audit

Updated: 2026-06-28

## Summary

This audit documents the TikTok / PineDrama work added to SOREVID VideoGET.

The original issue was that some TikTok profiles, especially Short Drama / PineDrama style profiles, expose a normal desktop profile grid but return zero items through the regular `yt-dlp` profile extractor. Mobile TikTok shows those same accounts as drama/series pages with episodes, film titles, and playlist-like rows. Because `yt-dlp` cannot access those episode lists through the normal profile extractor, Sorevid now uses the user's active Chrome session to scan and resolve TikTok video pages.

The module now supports:

- Chrome extension profile scanning for TikTok Short Drama profiles.
- Direct TikTok media URL import into the desktop app.
- Batch organizer for grouping videos into series and episodes.
- AI-assisted organization through Google AI Studio / Gemini.
- Series-level selection and download.
- Safer scan modes to reduce temporary TikTok/Akamai blocks.
- Resume / skip existing direct downloads.
- Browser download fallback through Chrome when desktop HTTP download receives 403.
- Re-scan selected expired TikTok items.
- Cleaner layout with Download and Settings tabs plus a fixed bottom action bar.

## Problem Background

Example profile:

```text
https://www.tiktok.com/@teatrohoney
```

Observed behavior:

- Desktop TikTok shows a normal profile with posted videos.
- Mobile TikTok shows a Short Drama / Series interface.
- `yt-dlp` profile extraction can fail with:

```text
ERROR: [tiktok:user] teatrohoney: This account does not have any videos posted
```

Reason:

TikTok's Short Drama / PineDrama profile view does not expose episode items through the same public user-feed path that the normal `yt-dlp` TikTok profile extractor expects.

## Current Architecture

### Chrome Extension

Relevant files:

- `extension/manifest.json`
- `extension/src/popup.ts`
- `extension/src/background.ts`
- `extension/src/content.ts`
- `extension/src/protocol.ts`

Responsibilities:

- Detect TikTok profile pages.
- Show TikTok scan controls in the extension popup.
- Scroll the TikTok profile in Chrome.
- Collect visible `/@user/video/...` links.
- Resolve each video page using the user's Chrome session.
- Extract TikTok page state data from scripts such as:
  - `__UNIVERSAL_DATA_FOR_REHYDRATION__`
  - `SIGI_STATE`
  - `sigi-persisted-data`
- Extract direct media URLs, thumbnails, title, codecs, dimensions, subtitles, and pinned hints.
- Send resolved media items to the desktop app through Chrome Native Messaging.

### Tauri Desktop App

Relevant files:

- `src/App.tsx`
- `src/App.css`
- `src-tauri/src/lib.rs`

Responsibilities:

- Receive resolved TikTok media from the extension.
- Store imported TikTok direct media as metadata previews.
- Organize batch items into series and episodes.
- Let the user edit series names, episode numbers, and episode titles.
- Download selected direct media items.
- Skip already-downloaded outputs.
- Queue browser fallback downloads when direct HTTP receives 403.
- Queue selected TikTok items for re-scan when signed media URLs expire.

## Native Messaging Protocol

The extension and desktop app now support these native actions:

```text
ping
import_urls
import_resolved_media
drain_browser_downloads
drain_rescan_items
```

Important payload type:

```ts
ResolvedMediaItem {
  sourceUrl
  pageUrl
  mediaUrl
  title
  uploader
  duration
  thumbnail
  videoCodec
  audioCodec
  width
  height
  subtitles
  isPinned
  cookieHeader
  outputFolder
  outputFilename
}
```

Notes:

- `mediaUrl` is a signed TikTok/CDN URL and may expire.
- `cookieHeader` is gathered from Chrome TikTok cookies and passed only locally to the app.
- `outputFolder` and `outputFilename` come from the Batch Organizer.

## TikTok Scan Flow

User flow:

1. Open TikTok profile in Chrome.
2. Open Sorevid extension popup.
3. Choose scan limit and scan mode.
4. Click `Scan TikTok Profile`.
5. Extension scans visible TikTok episode/video links.
6. Extension resolves each page into direct media metadata.
7. Desktop app receives the resolved items.
8. User organizes, selects, and downloads.

### Scan Limit

The popup supports:

```text
10 videos
20 videos
50 videos
100 videos
All visible videos
```

Default:

```text
20 videos
```

### Safe Scan Modes

The extension supports:

```text
Safe recommended
Slow cautious
Fast
```

Safe mode behavior:

- Adds randomized delays between video resolves.
- Pauses after batches.
- Stops if TikTok/Akamai returns access-denied or rate-limit signals.

Slow mode behavior:

- Longer randomized delays.
- Longer pauses.
- Intended for use after TikTok temporarily blocks access.

Fast mode behavior:

- Short delay.
- No batch pause.
- Should only be used with small limits.

## Temporary TikTok Blocks

Observed TikTok/Akamai block:

```text
Access Denied
You don't have permission to access "http://www.tiktok.com/@..." on this server.
```

Interpretation:

This appears to be a temporary TikTok/Akamai bot-protection or rate-limit response, not a permanent account ban. The user reported access recovered after roughly two hours.

Mitigations added:

- Scan limit.
- Safe/slow scan modes.
- Randomized delay.
- Batch pauses.
- Stop on Access Denied / 403 / 429 / captcha-like response.

Recommended usage:

```text
Scan mode: Safe recommended
Scan limit: 10 or 20
Avoid repeated full-profile scans
Keep a TikTok tab open for re-scan/fallback flows
```

## Batch Organizer

The Batch Organizer appears after preview/import.

It supports:

- Series grouping.
- Series rename.
- Episode number edit.
- Episode title edit.
- Output filename preview.
- Select all / select none.
- Series-level checkbox selection.
- Partial selection state for series.
- Batch order modes:
  - `As scanned`
  - `Reverse order`
  - `Sort by episode`

Output naming:

```text
Download folder/
  Series Name/
    Series Name - EP001 - Episode title.mp4
```

The series name is the output folder name.

## Series-Level Download

The user can now download only one series from a larger scan.

Flow:

1. Scan 50 videos.
2. Organize into multiple series.
3. Tick only the checkbox for Series X.
4. Click `Start download`.
5. App downloads only selected items.

No backend changes were needed for this selection model because the downloader already uses selected preview items.

## AI Organizer

The app integrates Google AI Studio / Gemini for organizing batches.

Default model:

```text
gemini-3.1-flash-lite
```

Settings moved to the Settings tab:

- Google AI Studio API key.
- Model name.

The app sends Gemini:

- scan order
- page URL
- title
- uploader
- guessed episode number
- pinned flag
- local `namePattern`
- local `ruleSeriesHint`

The app does not send signed `mediaUrl` values to Gemini.

### AI Prompt Hardening

The prompt was updated after Gemini incorrectly grouped mixed title patterns into one series.

Example problematic mixed titles:

```text
隐婚小十岁老公超宠我_中巴葡_6
Episódio 6
1
1_batch
```

The prompt now explicitly tells Gemini:

- Different `ruleSeriesHint` / `namePattern` should usually become different series.
- `1_batch`, `2_batch`, `7_batch.mp4` are usually one group.
- `Episódio 7`, `Episódio 8` are a separate pattern.
- Chinese drama titles before final numbers indicate a separate Chinese-title series.
- Generic fallback like `Teatrohoney Series` should only be used when no useful title pattern exists.

### Local Fallback After AI

If Gemini still returns exactly one series but local rules detect multiple strong title patterns, the app splits locally by `ruleSeriesHint`.

This protects against over-aggressive AI grouping.

## Resume / Skip Existing

Direct TikTok downloads now check whether a target file already exists before requesting the media URL.

Example:

```text
Download folder/
  Some Series/
    Some Series - EP023 - Title.mp4
```

If the target exists, the app logs:

```text
Skipped existing file: ...
```

Benefit:

- If a 60-episode download fails at episode 23, the next run skips episodes already present.
- This avoids reusing or wasting expired signed URLs.
- It reduces TikTok/CDN hits.

## Direct Download Behavior

Direct download path:

1. Desktop app receives signed `mediaUrl`.
2. Backend uses `reqwest`.
3. Request includes browser-like headers:
   - User-Agent
   - Accept
   - Accept-Language
   - Referer
   - Range
   - optional Chrome TikTok Cookie header

Known limitation:

Some TikTok/CDN media URLs still return 403 even while the TikTok page itself opens normally in Chrome. This likely means the media CDN checks more than cookies, such as browser/TLS/session fingerprint.

## Browser Download Fallback

When backend direct HTTP receives 403:

1. App queues the item for browser fallback.
2. Extension polls the app through native messaging.
3. Extension receives pending fallback items.
4. Extension calls:

```text
chrome.downloads.download
```

Fallback output path:

```text
Chrome Downloads/
  Sorevid/
    Series Name/
      Series Name - EP001 - Title.mp4
```

Limitation:

Chrome extensions cannot freely write to the app-selected output folder. Therefore browser fallback saves under the user's Chrome Downloads folder.

Permissions added:

```text
downloads
alarms
cookies
```

## Re-scan Expired Items

The app now supports:

```text
Re-scan selected
```

Purpose:

Signed TikTok media URLs expire. Re-scan selected lets the user refresh only failed/expired items instead of rescanning the entire profile.

Flow:

1. Select failed/expired TikTok items.
2. Click `Re-scan selected`.
3. App queues those items.
4. Extension polls for re-scan work.
5. Extension uses an open TikTok tab to resolve fresh media URLs.
6. Extension imports refreshed items back into the app.

Requirement:

Keep at least one TikTok tab open in Chrome.

## UI / UX Changes

### Main Layout

The app now has two tabs:

```text
Download
Settings
```

The old segmented tab display was replaced with independent pill buttons because the segmented control caused spacing and truncation issues.

### Download Tab

Contains:

- URL input.
- Preview status.
- Channel/profile warning.
- Metadata preview.
- Batch Organizer.
- Series checkboxes.
- Episode editing.

### Settings Tab

Contains:

- Tool version checks.
- AI API key.
- Gemini model.
- Output folder.
- Format preset.
- Subtitles/Danmaku.
- Platform cookie profiles.
- Chrome integration setup.

### Bottom Action Bar

A fixed bottom bar was added so the main download actions are always visible.

Contains:

- selection/URL summary
- current output folder
- Settings shortcut
- Preview
- Re-scan selected
- Start download

## Current Known Limitations

1. Browser fallback downloads to Chrome Downloads, not the app-selected output folder.
2. Direct media URLs can expire quickly.
3. Some TikTok/CDN media URLs still reject desktop HTTP even with Chrome cookies.
4. Re-scan requires at least one TikTok tab open.
5. Pinned detection is heuristic and depends on TikTok DOM/text.
6. AI organizer can still make grouping mistakes, but local fallback now reduces the worst case.
7. Chrome fallback completion is not yet reported back into the app queue with exact final file path.

## Recommended Next Improvements

High value:

1. Add visible fallback status in the app queue when Chrome starts/completes fallback downloads.
2. Add a dedicated "Failed / Expired" filter in Batch Organizer.
3. Add manual split/merge controls:
   - split selected episodes into new series
   - merge selected series
   - move selected episodes to another series
4. Add local scan cache:
   - avoid rescanning TikTok when only reorganizing
   - reduce temporary block risk
5. Add import from Chrome Downloads fallback folder back into app queue history.

Longer term:

1. Add a dedicated PineDrama mode.
2. Add per-profile safety budget:

```text
Scanned today: 42
Last scan: 12 minutes ago
Risk: Medium
```

3. Add thumbnail similarity grouping for series detection.
4. Add persistent batch history and resume plan.

## Operational Checklist

When testing TikTok/PineDrama:

1. Reload Chrome extension after any extension build.
2. Restart Sorevid after backend/frontend changes.
3. Use Safe scan mode.
4. Start with 10 or 20 items.
5. Organize batch.
6. Select one series using the series checkbox.
7. Start download.
8. If 403 appears, allow Chrome fallback to run.
9. If URLs expire, select failed items and click `Re-scan selected`.

## Build / Verification Commands

Used during implementation:

```text
npm.cmd run build:extension
npx.cmd tsc -b
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected:

- Extension TypeScript builds.
- App TypeScript builds.
- Rust tests pass.
