type NativeResponse = {
  ok: boolean
  message: string
}

type ResolvedSubtitle = {
  format?: string
  language?: string
  url: string
}

type ResolvedMediaItem = {
  sourceUrl: string
  pageUrl: string
  mediaUrl: string
  title?: string
  uploader?: string
  duration?: number
  thumbnail?: string
  videoCodec?: string
  audioCodec?: string
  width?: number
  height?: number
  subtitles?: ResolvedSubtitle[]
  isPinned?: boolean
}

type ScanProfileMessage = {
  type: 'scan-tiktok-profile' | 'resolve-tiktok-urls'
  limit?: number
  mode?: TikTokScanMode
  urls?: string[]
}

type TikTokScanMode = 'fast' | 'safe' | 'slow'

type ScanTiming = {
  scrollDelay: [number, number]
  resolveDelay: [number, number]
  pauseEvery: number
  pauseDelay: [number, number]
}

const hostMarker = 'sorevidPlayerButton'
const shortDramaTabSelector = '[data-e2e="drama-tab"]'
let scanTimer: number | undefined

scanPlayers()
const observer = new MutationObserver(scheduleScan)
observer.observe(document.documentElement, { childList: true, subtree: true })
window.addEventListener('popstate', scheduleScan)
window.addEventListener('hashchange', scheduleScan)
setInterval(scanPlayers, 3000)

chrome.runtime.onMessage.addListener((message: ScanProfileMessage, _sender, sendResponse) => {
  if (message?.type === 'resolve-tiktok-urls') {
    resolveTikTokUrls(message.urls || [], message.mode)
      .then((items) => sendResponse({ ok: true, items }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          items: [],
        })
      })
    return true
  }

  if (message?.type !== 'scan-tiktok-profile') return false

  scanTikTokProfile(message.limit, message.mode)
    .then((items) => sendResponse({ ok: true, items }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        items: [],
      })
    })

  return true
})

async function resolveTikTokUrls(urls: string[], mode: TikTokScanMode = 'safe') {
  const timing = scanTiming(mode)
  const resolved: ResolvedMediaItem[] = []
  for (const [index, url] of urls.entries()) {
    resolved.push(await resolveTikTokVideo(url, false))
    if (index < urls.length - 1) {
      await wait(randomBetween(...timing.resolveDelay))
    }
  }
  return resolved
}

function scheduleScan() {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(scanPlayers, 180)
}

function scanPlayers() {
  for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
    const container = findPlayerContainer(video)
    if (!container || container.dataset[hostMarker] === 'true') continue
    attachButton(container)
  }
}

function findPlayerContainer(video: HTMLVideoElement): HTMLElement | null {
  return (
    video.closest<HTMLElement>(
      '[class*="player-container"], [class*="video-player"], [class*="bpx-player"], [class*="xgplayer"], [class*="player"]',
    ) ||
    video.parentElement
  )
}

function attachButton(container: HTMLElement) {
  container.dataset[hostMarker] = 'true'
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  const host = document.createElement('div')
  host.className = 'sorevid-player-host'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'sorevid-player-button'
  button.textContent = '↓ Sorevid'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    sendCurrentPage(button)
  })
  host.append(button)
  container.append(host)
}

function sendCurrentPage(button: HTMLButtonElement) {
  if (button.disabled) return
  button.disabled = true
  button.textContent = 'Sending…'
  chrome.runtime.sendMessage(
    {
      type: 'send-url',
      url: location.href,
      title: document.title,
      trigger: 'player-button',
    },
    (response: NativeResponse | undefined) => {
      const error = chrome.runtime.lastError
      button.disabled = false
      button.textContent = '↓ Sorevid'
      if (error) {
        showToast(error.message || 'Could not connect to Sorevid.', true)
        return
      }
      showToast(response?.message || 'Sorevid did not return a response.', !response?.ok)
    },
  )
}

async function scanTikTokProfile(limit?: number, mode: TikTokScanMode = 'safe') {
  if (!isTikTokProfilePage()) {
    throw new Error('Open a TikTok profile page before scanning.')
  }

  const dramaTab = document.querySelector<HTMLElement>(shortDramaTabSelector)
  const isDramaVisible = dramaTab && getComputedStyle(dramaTab).display !== 'none'
  const scanLimit = typeof limit === 'number' && limit > 0 ? limit : undefined
  const timing = scanTiming(mode)
  const links = await collectProfileVideoLinks(scanLimit, timing)
  if (links.length === 0) {
    throw new Error('No TikTok video links were visible after scanning this profile.')
  }

  const resolved: ResolvedMediaItem[] = []
  const failures: string[] = []

  for (const [index, link] of links.entries()) {
    try {
      resolved.push(await resolveTikTokVideo(link.url, link.isPinned))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${link.url}: ${message}`)
      if (isTikTokBlockMessage(message)) {
        showToast('TikTok appears to be rate-limiting this session. Scan stopped to avoid making it worse.', true)
        break
      }
    }

    if (index < links.length - 1) {
      if (timing.pauseEvery > 0 && (index + 1) % timing.pauseEvery === 0) {
        showToast(`Safe scan pause after ${index + 1} videos...`, false)
        await wait(randomBetween(...timing.pauseDelay))
      } else {
        await wait(randomBetween(...timing.resolveDelay))
      }
    }
  }

  if (resolved.length === 0) {
    const detail = failures[0] || 'TikTok did not return any resolvable video metadata.'
    throw new Error(detail)
  }

  if (failures.length > 0) {
    showToast(
      `Resolved ${resolved.length} videos. ${failures.length} item${failures.length === 1 ? '' : 's'} failed.`,
      false,
    )
  } else if (isDramaVisible) {
    showToast(`Resolved ${resolved.length} videos from this Short Drama profile.`, false)
  }

  return resolved
}

type ProfileVideoLink = {
  url: string
  isPinned: boolean
}

async function collectProfileVideoLinks(limit: number | undefined, timing: ScanTiming) {
  const links = new Map<string, ProfileVideoLink>()
  let stagnantRounds = 0
  let lastCount = 0

  for (let round = 0; round < 18 && stagnantRounds < 3; round += 1) {
    collectVisibleVideoLinks().forEach((link) => {
      if (!links.has(link.url)) links.set(link.url, link)
    })
    if (limit && links.size >= limit) break
    if (links.size === lastCount) {
      stagnantRounds += 1
    } else {
      stagnantRounds = 0
      lastCount = links.size
    }

    window.scrollBy({ top: Math.max(window.innerHeight * 1.6, 1200), behavior: 'instant' as ScrollBehavior })
    await wait(randomBetween(...timing.scrollDelay))
  }

  return Array.from(links.values()).slice(0, limit)
}

function collectVisibleVideoLinks() {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"]'))
    .map((anchor) => {
      const url = normalizeVideoLink(anchor.href)
      return url ? { url, isPinned: isPinnedVideoAnchor(anchor) } : undefined
    })
    .filter(Boolean) as ProfileVideoLink[]
}

function scanTiming(mode: TikTokScanMode): ScanTiming {
  if (mode === 'fast') {
    return {
      scrollDelay: [450, 850],
      resolveDelay: [250, 650],
      pauseEvery: 0,
      pauseDelay: [0, 0],
    }
  }
  if (mode === 'slow') {
    return {
      scrollDelay: [1800, 3200],
      resolveDelay: [3500, 7000],
      pauseEvery: 5,
      pauseDelay: [45000, 90000],
    }
  }
  return {
    scrollDelay: [900, 1800],
    resolveDelay: [1500, 4000],
    pauseEvery: 8,
    pauseDelay: [18000, 45000],
  }
}

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * Math.max(0, max - min))
}

function isTikTokBlockMessage(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes('access denied') ||
    lower.includes('permission to access') ||
    lower.includes('http 403') ||
    lower.includes('http 429') ||
    lower.includes('rate') ||
    lower.includes('captcha')
  )
}

async function resolveTikTokVideo(url: string, isPinned: boolean): Promise<ResolvedMediaItem> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const html = await response.text()
  if (looksLikeAccessDeniedPage(html)) {
    throw new Error('Access Denied page returned by TikTok/Akamai.')
  }
  const item = parseTikTokItemStruct(html)
  if (!item) {
    throw new Error('TikTok page state did not expose itemStruct.')
  }

  const video = item.video || {}
  const primaryFormat = choosePreferredFormat(video)
  if (!primaryFormat?.url) {
    throw new Error('No signed TikTok media URL was found.')
  }

  return {
    sourceUrl: url,
    pageUrl: url,
    mediaUrl: primaryFormat.url,
    title: item.desc,
    uploader: item.author?.uniqueId,
    duration: typeof video.duration === 'number' ? video.duration : undefined,
    thumbnail: cleanUrl(video.cover || video.originCover || video.dynamicCover),
    videoCodec: primaryFormat.videoCodec,
    audioCodec: primaryFormat.audioCodec,
    width: primaryFormat.width,
    height: primaryFormat.height,
    isPinned,
    subtitles: Array.isArray(video.subtitleInfos)
      ? video.subtitleInfos
          .map((entry: any) => ({
            format: entry?.Format,
            language: entry?.LanguageCodeName || entry?.languageCode,
            url: cleanUrl(entry?.Url),
          }))
          .filter((entry: { url: string }) => entry.url)
      : [],
  }
}

function looksLikeAccessDeniedPage(html: string) {
  const lower = html.slice(0, 3000).toLowerCase()
  return lower.includes('access denied') && lower.includes("permission to access")
}

function isPinnedVideoAnchor(anchor: HTMLAnchorElement) {
  const text = [
    anchor.textContent || '',
    anchor.getAttribute('aria-label') || '',
    anchor.closest<HTMLElement>('article, div[class], li')?.textContent || '',
  ]
    .join(' ')
    .toLowerCase()
  return /\b(pinned|pinado|fixado|ghim|đã ghim)\b/i.test(text)
}

function parseTikTokItemStruct(html: string): any | null {
  const jsonCandidates = [
    scriptJsonById(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__'),
    scriptJsonById(html, 'SIGI_STATE'),
    scriptJsonById(html, 'sigi-persisted-data'),
  ].filter(Boolean)

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate)
      const scope = parsed?.__DEFAULT_SCOPE__ || parsed
      const itemStruct = scope?.['webapp.video-detail']?.itemInfo?.itemStruct
      if (itemStruct?.video) {
        return itemStruct
      }
    } catch {
      // Ignore malformed candidates and continue.
    }
  }

  return null
}

function scriptJsonById(html: string, id: string) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`<script[^>]+id=["']${escapedId}["'][^>]*>([\\s\\S]*?)</script>`, 'i'))
  return match?.[1]?.trim() || ''
}

function choosePreferredFormat(video: any) {
  const h264Format = Array.isArray(video?.bitrateInfo)
    ? video.bitrateInfo
        .filter((entry: any) => entry?.CodecType === 'h264')
        .sort((left: any, right: any) => (right?.Bitrate || 0) - (left?.Bitrate || 0))[0]
    : null

  if (h264Format?.PlayAddr?.UrlList?.[0]) {
    return {
      url: cleanUrl(h264Format.PlayAddr.UrlList[0]),
      videoCodec: 'h264',
      audioCodec: 'aac',
      width: numericValue(h264Format.PlayAddr.Width),
      height: numericValue(h264Format.PlayAddr.Height),
    }
  }

  if (video?.downloadAddr) {
    return {
      url: cleanUrl(video.downloadAddr),
      videoCodec: video.codecType || 'h264',
      audioCodec: 'aac',
      width: numericValue(video.width),
      height: numericValue(video.height),
    }
  }

  if (video?.playAddr) {
    return {
      url: cleanUrl(video.playAddr),
      videoCodec: video.codecType,
      audioCodec: 'aac',
      width: numericValue(video.width),
      height: numericValue(video.height),
    }
  }

  const fallback = Array.isArray(video?.bitrateInfo)
    ? video.bitrateInfo.find((entry: any) => entry?.PlayAddr?.UrlList?.[0])
    : null

  if (fallback?.PlayAddr?.UrlList?.[0]) {
    return {
      url: cleanUrl(fallback.PlayAddr.UrlList[0]),
      videoCodec: fallback.CodecType,
      audioCodec: 'aac',
      width: numericValue(fallback.PlayAddr.Width),
      height: numericValue(fallback.PlayAddr.Height),
    }
  }

  return null
}

function normalizeVideoLink(value: string) {
  try {
    const parsed = new URL(value)
    if (
      (parsed.hostname === 'www.tiktok.com' || parsed.hostname.endsWith('.tiktok.com')) &&
      /\/@[^/]+\/video\/\d+/.test(parsed.pathname)
    ) {
      return `${parsed.origin}${parsed.pathname}`
    }
  } catch {
    // Ignore malformed hrefs.
  }
  return ''
}

function cleanUrl(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.replace(/\\u002F/g, '/').replace(/&amp;/g, '&') : ''
}

function numericValue(value: unknown) {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || undefined : undefined
}

function isTikTokProfilePage() {
  return location.hostname.endsWith('tiktok.com') && /^\/@[^/]+\/?$/.test(location.pathname)
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function showToast(message: string, isError: boolean) {
  document.querySelector('.sorevid-toast')?.remove()
  const toast = document.createElement('div')
  toast.className = `sorevid-toast${isError ? ' error' : ''}`
  toast.textContent = message
  document.documentElement.append(toast)
  window.setTimeout(() => toast.remove(), 3500)
}
