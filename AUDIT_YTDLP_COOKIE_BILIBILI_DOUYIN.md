# Audit: yt-dlp Cookie Management for Bilibili and Douyin

This document summarizes how SOREVID VideoGET uses `yt-dlp` to manage cookies and download videos from Bilibili and Douyin. It is written as an integration handoff for another app that already has `yt-dlp`.

## Scope

Covered platforms:

- Bilibili: `bilibili.com`, `b23.tv`, `space.bilibili.com`
- Douyin: `douyin.com`, `iesdouyin.com`, `amemv.com`

Core implementation files in this app:

- Frontend grouping and profile selection: `src/App.tsx`
- Backend cookie export/import/validation/download execution: `src-tauri/src/lib.rs`

## High-Level Flow

1. User enters one or more URLs.
2. Frontend detects whether each URL belongs to Bilibili or Douyin.
3. For Bilibili/Douyin URLs, frontend requires a cookie/session profile before preview or download.
4. URLs are grouped by platform and cookie profile.
5. Each group is sent to the backend separately.
6. Backend normalizes URLs, validates cookie availability, builds `yt-dlp` arguments, and starts a `yt-dlp` process.
7. Backend streams progress lines back to the UI.
8. After download completes, backend optionally probes media with `ffprobe` and converts Bilibili danmaku XML to ASS if requested.

## Platform Detection

The frontend treats these hosts as requiring platform-specific session handling:

```ts
const platformConfigs = {
  bilibili: {
    label: 'BiliBili',
    hosts: ['bilibili.com', 'b23.tv', 'space.bilibili.com'],
  },
  douyin: {
    label: 'Douyin',
    hosts: ['douyin.com', 'iesdouyin.com', 'amemv.com'],
  },
}
```

The backend also blocks anonymous download/metadata attempts for:

```text
bilibili.com
b23.tv
space.bilibili.com
douyin.com
iesdouyin.com
amemv.com
```

If `cookieMode` is `none` and any URL matches those hosts, backend returns an error asking the user to choose Chrome cookies or import `cookies.txt`.

## Cookie Modes

The app supports three cookie modes:

```ts
type CookieMode = 'none' | 'chrome' | 'manual'
```

Behavior:

- `none`: no cookie arguments are passed to `yt-dlp`.
- `chrome`: backend passes `--cookies-from-browser chrome`.
- `manual`: backend passes `--cookies <path-to-cookies.txt>`.

Backend argument builder:

```rust
fn build_cookie_args(cookie_mode: &CookieMode, manual_cookie_path: Option<&str>) -> Vec<String> {
    match cookie_mode {
        CookieMode::None => Vec::new(),
        CookieMode::Chrome => vec!["--cookies-from-browser".to_string(), "chrome".to_string()],
        CookieMode::Manual => manual_cookie_path
            .map(|path| vec!["--cookies".to_string(), path.to_string()])
            .unwrap_or_default(),
    }
}
```

## Managed Cookie Files

Sorevid can import or export cookies into app-managed files.

Managed path pattern:

```text
<app_config_dir>/cookies/bilibili.cookies.txt
<app_config_dir>/cookies/douyin.cookies.txt
```

Backend function:

```rust
app.path()
  .app_config_dir()
  .map(|dir| dir.join("cookies").join(format!("{platform}.cookies.txt")))
```

Supported managed platforms:

```text
bilibili
douyin
```

The app only deletes cookie files from its own managed cookie folder.

## Exporting Cookies from Chrome

When the user clicks "Export from Chrome", backend uses `yt-dlp` itself to read Chrome cookies and write a Netscape-format cookie file.

Command shape:

```bash
yt-dlp \
  --cookies-from-browser chrome \
  --cookies "<temporary-cookie-output-path>" \
  --skip-download \
  --no-warnings \
  "<platform-probe-url>"
```

Probe URLs:

```text
Bilibili: https://www.bilibili.com/
Douyin:   https://www.douyin.com/
```

The export writes to a temporary path first:

```text
<managed-output>.tmp
```

Then the app validates the temporary file. If valid, it replaces the previous managed cookie file atomically via rename.

Important integration note:

- Chrome can lock its cookie database.
- If export fails, prompt the user to close Chrome and retry, or import a `cookies.txt` file manually.

## Importing Manual Cookies

Manual import flow:

1. User chooses a `cookies.txt` file.
2. Backend validates that it is Netscape cookie format.
3. Backend copies it into the managed platform cookie path.
4. Frontend updates that platform profile to:

```json
{
  "mode": "manual",
  "manualCookiePath": "<managed-cookie-path>"
}
```

## Cookie Validation

Validation requires:

- File exists.
- File includes a Netscape cookie header in the first three lines.
- File contains at least one usable cookie record.

Accepted header examples:

```text
# Netscape HTTP Cookie File
```

Cookie records are counted when:

- The line is not empty.
- The line is either a normal cookie line or starts with `#HttpOnly_`.
- After stripping `#HttpOnly_`, the line has at least 7 tab-separated fields.

Status returned to UI:

```ts
type CookieFileStatus = {
  path: string
  valid: boolean
  cookieCount: number
  fileSize: number
  modifiedAt?: number
  message: string
}
```

## Frontend Grouping Logic

The frontend groups URLs by platform and cookie profile before calling the backend.

Reason:

- A mixed input can contain Bilibili and Douyin URLs.
- Each platform may use a different cookie file.
- `yt-dlp` receives one cookie source per process, so groups need separate backend calls.

Group key:

```ts
`${platformKey || 'other'}::${profile.mode}::${profile.manualCookiePath}`
```

For each group, frontend sends:

```ts
{
  urls: group.urls,
  downloadDir,
  preset: downloadPreset,
  cookieMode: group.cookieMode,
  manualCookiePath: group.cookieMode === 'manual' ? group.manualCookiePath : null,
  subtitleMode,
  subtitleFormat,
  embedSubtitles,
  danmakuFormat: group.urls.some((url) => getPlatformForUrl(url) === 'bilibili')
    ? danmakuFormat
    : 'none'
}
```

## Metadata Preview

Metadata preview also uses the selected cookie profile.

Command shape:

```bash
yt-dlp \
  --dump-single-json \
  --skip-download \
  --no-warnings \
  [cookie args] \
  "<url>"
```

For Bilibili channel/space URLs, preview is limited:

```bash
--playlist-end 24
```

This avoids endless or very slow preview loading for `space.bilibili.com`.

## Download Command

Base `yt-dlp` arguments:

```bash
yt-dlp \
  --newline \
  --no-color \
  --progress-template "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s" \
  --merge-output-format mp4 \
  -P "<download-dir>" \
  -o "%(title)s [%(id)s].%(ext)s" \
  [--ffmpeg-location "<ffmpeg-folder>"] \
  [format args] \
  [subtitle/danmaku args] \
  [cookie args] \
  --print "after_move:downloaded:%(filepath)s" \
  "<url-1>" "<url-2>" ...
```

Cookie args are one of:

```bash
# Chrome profile cookies
--cookies-from-browser chrome

# Manual Netscape cookies
--cookies "<path-to-cookies.txt>"
```

## Download Presets

Compatible MP4:

```bash
-f "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*[vcodec^=avc1]+ba/b[ext=mp4]/bv*+ba/b"
--merge-output-format mp4
```

Best quality:

```bash
-f "bv*+ba/b"
--merge-output-format mp4
```

Audio only:

```bash
-x --audio-format mp3
--merge-output-format mp4
```

Video only:

```bash
-f "bv*[vcodec^=avc1]/bv*[ext=mp4]/bv*"
--merge-output-format mp4
```

Original codec:

```bash
-f "bv*+ba/b"
```

For original codec mode, the app removes `--merge-output-format mp4`.

## Subtitles and Bilibili Danmaku

Subtitle modes:

- `off`
- `subtitles`
- `auto`
- `both`

Subtitle format:

- `srt`: `--sub-format srt/best`
- `vtt`: `--sub-format vtt/best`

When regular subtitles are requested:

```bash
--write-subs
--sub-langs all
--sub-format "srt/best" # or "vtt/best"
```

When auto subtitles are requested:

```bash
--write-auto-subs
--sub-langs all
--sub-format "srt/best" # or "vtt/best"
```

When embedding subtitles:

```bash
--embed-subs
```

Embedding requires `ffmpeg`.

Bilibili danmaku:

- Only enabled for groups containing Bilibili URLs.
- `xml` or `ass` both request subtitle sidecars from `yt-dlp`.
- For `ass`, after download completes the backend scans matching `.xml` sidecars and converts them to `.ass`.

Danmaku-triggered args:

```bash
--write-subs
--sub-langs all
```

## URL Normalization

The app normalizes URL input before sending it to `yt-dlp`.

Behavior:

- Trims surrounding punctuation and quotes.
- Converts protocol-relative URLs like `//example.com/a` to `https://example.com/a`.
- Converts bare URLs like `bilibili.com/video/...` to `https://bilibili.com/video/...`.
- Deduplicates URLs on the frontend.
- Removes playlist/list noise from YouTube watch URLs, but leaves Bilibili/Douyin query strings intact.

Examples:

```text
bilibili.com/video/BVxxxx
=> https://bilibili.com/video/BVxxxx

v.douyin.com/xxxxx/
=> https://v.douyin.com/xxxxx/
```

Note: frontend platform config currently recognizes `douyin.com`, `iesdouyin.com`, and `amemv.com`. If the integration receives `v.douyin.com` short links, make sure host matching treats subdomains as Douyin. The current frontend parser does this by checking whether hostname ends with `.douyin.com`.

## Progress and Output Tracking

The backend uses:

```bash
--progress-template "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s"
```

Then parses lines shaped like:

```text
download:<percent>|<speed>|<eta>
```

The backend also uses:

```bash
--print "after_move:downloaded:%(filepath)s"
```

Then watches for:

```text
downloaded:<final-file-path>
```

This gives the app the final file path after `yt-dlp` moves/merges the completed output.

## Recommended Integration Contract

If another app wants to integrate this flow, use a request model like:

```ts
type DownloadRequest = {
  urls: string[]
  downloadDir: string
  preset: 'compatibleMp4' | 'bestQuality' | 'audioOnly' | 'videoOnly' | 'originalCodec'
  cookieMode: 'none' | 'chrome' | 'manual'
  manualCookiePath?: string | null
  subtitleMode: 'off' | 'subtitles' | 'auto' | 'both'
  subtitleFormat: 'srt' | 'vtt'
  embedSubtitles: boolean
  danmakuFormat: 'none' | 'xml' | 'ass'
}
```

Recommended cookie profile model:

```ts
type CookieProfile = {
  mode: 'none' | 'chrome' | 'manual'
  manualCookiePath: string
}

type CookieProfiles = {
  bilibili?: CookieProfile
  douyin?: CookieProfile
}
```

Before preview/download:

1. Detect platform per URL.
2. Require a ready profile for Bilibili/Douyin.
3. Group URLs by `platform + cookie mode + cookie path`.
4. Run one `yt-dlp` process per group.

Ready profile rule:

```ts
profile.mode === 'chrome' || (profile.mode === 'manual' && Boolean(profile.manualCookiePath))
```

## Practical Notes for Bilibili

- Bilibili frequently rejects anonymous downloader requests, so require cookies before metadata preview or download.
- Bilibili channel/space preview can be slow. Limit preview with `--playlist-end 24`.
- Direct channel download can still be allowed, but warn users that large spaces may take time.
- If danmaku ASS is needed, request subtitle XML first, then convert XML sidecars after download.

## Practical Notes for Douyin

- Douyin should also be treated as session-required.
- Use either `--cookies-from-browser chrome` or a manual Netscape `cookies.txt`.
- Short links and mobile links should be normalized and passed directly to `yt-dlp`; let `yt-dlp` resolve redirects.
- Make sure platform detection includes subdomains such as `v.douyin.com`.

## Failure Messages Worth Preserving

Useful user-facing errors from this app:

```text
Choose Chrome cookies or import cookies.txt before starting.
Choose Chrome cookies or import cookies.txt before preview/download.
Chrome cookie export failed. Close Chrome and try again if its cookie database is locked.
The selected cookies.txt file does not exist.
Invalid cookie file: missing Netscape HTTP Cookie File header.
Cookie file contains no usable cookie records.
ffmpeg is required to embed subtitles into MP4.
```

## Minimal Example Commands

Bilibili with Chrome cookies:

```bash
yt-dlp \
  --newline \
  --no-color \
  --merge-output-format mp4 \
  -P "<download-dir>" \
  -o "%(title)s [%(id)s].%(ext)s" \
  -f "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*[vcodec^=avc1]+ba/b[ext=mp4]/bv*+ba/b" \
  --cookies-from-browser chrome \
  "https://www.bilibili.com/video/BV..."
```

Douyin with manual cookies:

```bash
yt-dlp \
  --newline \
  --no-color \
  --merge-output-format mp4 \
  -P "<download-dir>" \
  -o "%(title)s [%(id)s].%(ext)s" \
  -f "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*[vcodec^=avc1]+ba/b[ext=mp4]/bv*+ba/b" \
  --cookies "<path-to-douyin.cookies.txt>" \
  "https://www.douyin.com/video/..."
```

Export Bilibili cookies from Chrome:

```bash
yt-dlp \
  --cookies-from-browser chrome \
  --cookies "<app-config>/cookies/bilibili.cookies.txt.tmp" \
  --skip-download \
  --no-warnings \
  "https://www.bilibili.com/"
```

Export Douyin cookies from Chrome:

```bash
yt-dlp \
  --cookies-from-browser chrome \
  --cookies "<app-config>/cookies/douyin.cookies.txt.tmp" \
  --skip-download \
  --no-warnings \
  "https://www.douyin.com/"
```
