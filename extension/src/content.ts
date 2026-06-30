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
  dramaId?: string
  seriesName?: string
  episodeNumber?: number
}

type ScanProfileMessage = {
  type:
    | 'scan-tiktok-profile'
    | 'resolve-tiktok-urls'
    | 'scan-tiktok-shortdrama'
    | 'scan-tiktok-series'
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
const dramaCaptureBuffer = new Map<string, any>()
let scanTimer: number | undefined

window.addEventListener('message', (event) => {
  if (
    event.source === window &&
    event.data?.source === 'sorevid-drama-capture' &&
    typeof event.data.url === 'string'
  ) {
    dramaCaptureBuffer.set(event.data.url, event.data.payload)
  }
})

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

  if (message?.type === 'scan-tiktok-shortdrama') {
    scanTikTokShortDrama(message.limit, message.mode)
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

  if (message?.type === 'scan-tiktok-series') {
    scanTikTokSeriesFromVideo(message.limit, message.mode)
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

async function waitForCapture(matchSubstring: string, timeoutMs = 15000): Promise<any> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    for (const [url, payload] of dramaCaptureBuffer.entries()) {
      if (url.includes(matchSubstring)) {
        dramaCaptureBuffer.delete(url)
        return payload
      }
    }
    await wait(200)
  }
  throw new Error(`Timed out waiting for ${matchSubstring}`)
}

async function waitForSelector(selector: string, timeoutMs = 10000): Promise<Element> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const element = document.querySelector(selector)
    if (element) {
      return element
    }
    await wait(200)
  }
  throw new Error(`Timed out waiting for selector ${selector}`)
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
  button.textContent = '↓ VideoGET'
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
      button.textContent = '↓ VideoGET'
      if (error) {
        showToast(error.message || 'Could not connect to SOREVID VideoGET.', true)
        return
      }
      showToast(response?.message || 'SOREVID VideoGET did not return a response.', !response?.ok)
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

async function scanTikTokShortDrama(limit?: number, mode: TikTokScanMode = 'safe'): Promise<ResolvedMediaItem[]> {
  if (!isTikTokProfilePage()) {
    throw new Error('Open a TikTok profile page before scanning.')
  }

  const timing = scanTiming(mode)
  const scanLimit = typeof limit === 'number' && limit > 0 ? limit : undefined
  dramaCaptureBuffer.clear()

  const dramaTab = document.querySelector<HTMLElement>(shortDramaTabSelector)
  if (!dramaTab) {
    throw new Error('Short Drama tab was not found on this TikTok profile.')
  }

  if (dramaTab.getAttribute('aria-selected') !== 'true') {
    dramaTab.click()
  }
  await waitForSelector('div[data-e2e="creator-drama-card"]', 10000)
  await wait(randomBetween(...timing.scrollDelay))

  const cards = Array.from(document.querySelectorAll<HTMLElement>('div[data-e2e="creator-drama-card"]'))
  if (cards.length === 0) {
    throw new Error('No Short Drama series cards found on this profile.')
  }
  const results: ResolvedMediaItem[] = []

  dramaLoop: for (const card of cards) {
    ;(card.closest('button') as HTMLElement | null || card).click()
    await waitForSelector('[role=dialog][aria-label="Cinema mode"]')

    const segments = Array.from(
      document.querySelectorAll<HTMLElement>('[role=dialog][aria-label="Cinema mode"] button[data-testid="tux-segment-item"]'),
    )

    if (segments.length === 0) {
      const episodePayload = await waitForCapture('/api/drama/episode/item_list/')
      const itemList = Array.isArray(episodePayload?.itemList) ? episodePayload.itemList : []
      for (const item of itemList) {
        results.push(mapDramaEpisodeToResolved(item))
        if (scanLimit && results.length >= scanLimit) {
          break dramaLoop
        }
        await wait(randomBetween(...timing.resolveDelay))
      }
    } else {
      for (const segment of segments) {
        segment.click()
        const episodePayload = await waitForCapture('/api/drama/episode/item_list/')
        const itemList = Array.isArray(episodePayload?.itemList) ? episodePayload.itemList : []
        for (const item of itemList) {
          results.push(mapDramaEpisodeToResolved(item))
          if (scanLimit && results.length >= scanLimit) {
            break dramaLoop
          }
          await wait(randomBetween(...timing.resolveDelay))
        }
      }
    }

    const closeButton =
      document.querySelector<HTMLElement>('[role=dialog][aria-label="Cinema mode"] button[aria-label]') || null
    if (closeButton) {
      closeButton.click()
    } else if (document.querySelector('[role=dialog]')) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    }

    await wait(randomBetween(...timing.scrollDelay))
  }

  if (results.length === 0) {
    throw new Error('No Short Drama episodes were resolved from this profile.')
  }

  return scanLimit ? results.slice(0, scanLimit) : results
}

async function waitForCaptureEntry(
  matchSubstring: string,
  timeoutMs = 12000,
): Promise<{ url: string; payload: any }> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    for (const [url, payload] of dramaCaptureBuffer.entries()) {
      if (url.includes(matchSubstring)) {
        dramaCaptureBuffer.delete(url)
        return { url, payload }
      }
    }
    await wait(200)
  }
  throw new Error('Timed out waiting for ' + matchSubstring)
}

function firstItemDramaId(payload: any): string {
  const list = Array.isArray(payload?.itemList) ? payload.itemList : []
  for (const item of list) {
    const id = item?.dramaInfo?.dramaID
    if (id) {
      return String(id)
    }
  }
  return ''
}

function ingestEpisodePayload(
  payload: any,
  dramaId: string,
  target: Map<string, ResolvedMediaItem>,
): void {
  const list = Array.isArray(payload?.itemList) ? payload.itemList : []
  for (const item of list) {
    if (dramaId && String(item?.dramaInfo?.dramaID || '') !== dramaId) {
      continue
    }
    const mapped = mapDramaEpisodeToResolved(item)
    if (!mapped.mediaUrl) {
      console.warn('[sorevid] episode missing media URL', mapped.episodeNumber, item?.id)
    }
    const key = mapped.episodeNumber != null ? 'ep:' + mapped.episodeNumber : 'id:' + (item?.id || mapped.pageUrl)
    if (!target.has(key)) {
      target.set(key, mapped)
    }
  }
}

async function scanTikTokSeriesFromVideo(
  _limit?: number,
  mode: TikTokScanMode = 'safe',
): Promise<ResolvedMediaItem[]> {
  if (!/\/@[^/]+\/video\/\d+/.test(location.pathname)) {
    throw new Error('Open a TikTok drama video page before downloading the series.')
  }

  const timing = scanTiming(mode)
  dramaCaptureBuffer.clear()

  let segments: HTMLElement[] = []
  try {
    await waitForSelector('button[data-testid="tux-segment-item"]', 8000)
    segments = Array.from(
      document.querySelectorAll<HTMLElement>('button[data-testid="tux-segment-item"]'),
    )
  } catch {
    // No segment control: single-page drama or panel not open yet.
  }

  let signed: { url: string; payload: any } | undefined
  for (const segment of segments) {
    segment.click()
    try {
      signed = await waitForCaptureEntry('/api/drama/episode/item_list/', 5000)
      break
    } catch {
      // Segment likely already active; try the next one.
    }
  }
  if (!signed) {
    try {
      signed = await waitForCaptureEntry('/api/drama/episode/item_list/', 6000)
    } catch {
      // No live network capture (drama panel already cached). Fall back to embedded page state below.
    }
  }

  const collected = new Map<string, ResolvedMediaItem>()
  let dramaId = ''

  const performanceEpisodeApi = findEpisodeApiFromPerformance()
  const episodeApiUrls = Array.from(
    new Set([signed?.url, performanceEpisodeApi].filter(Boolean) as string[]),
  )

  if (episodeApiUrls.length > 0) {
    const targetDramaId = signed ? firstItemDramaId(signed.payload) : ''
    if (signed) {
      ingestEpisodePayload(signed.payload, targetDramaId, collected)
    }

    for (const episodeApiUrl of episodeApiUrls) {
      const base = new URL(episodeApiUrl)
      const apiDramaId = targetDramaId || base.searchParams.get('dramaID') || dramaId
      if (apiDramaId) {
        dramaId = apiDramaId
      }

      for (let cursor = 0; ; cursor += 24) {
        const url = new URL(base.toString())
        url.searchParams.set('count', '24')
        url.searchParams.set('cursor', String(cursor))
        if (dramaId) {
          url.searchParams.set('dramaID', dramaId)
        }

        let payload: any
        try {
          payload = await fetch(url.toString(), { credentials: 'include' }).then((response) => response.json())
        } catch {
          break
        }

        const before = collected.size
        ingestEpisodePayload(payload, dramaId, collected)
        console.debug('[sorevid] series page', {
          cursor,
          added: collected.size - before,
          total: collected.size,
          hasMore: payload?.hasMore,
        })

        if (payload?.hasMore !== true) {
          break
        }
        await wait(randomBetween(...timing.resolveDelay))
      }
    }
  } else {
    const html = document.documentElement.outerHTML
    const seed = parseTikTokItemStruct(html)
    dramaId = String(seed?.dramaInfo?.dramaID || '')
    const items = parseTikTokDramaItems(html, dramaId)
    ingestEpisodePayload({ itemList: items }, dramaId, collected)
  }

  const results = Array.from(collected.values()).sort(
    (left, right) => (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0),
  )
  console.debug('[sorevid] series scan complete', { dramaId, total: results.length })

  if (results.length === 0) {
    throw new Error('No episodes were resolved from this drama.')
  }

  return results
}

function findEpisodeApiFromPerformance() {
  const entries = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => url.includes('/api/drama/episode/item_list/'))
  return entries.at(-1) || ''
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

function mapDramaEpisodeToResolved(item: any): ResolvedMediaItem {
  const fmt = choosePreferredFormat(item?.video)
  const uniqueId = item?.author?.uniqueId || item?.dramaInfo?.authorUID || ''
  const pageUrl = `https://www.tiktok.com/@${uniqueId}/video/${item?.id || ''}`

  return {
    sourceUrl: pageUrl,
    pageUrl,
    mediaUrl: fmt?.url || '',
    title: item?.desc,
    uploader: item?.author?.uniqueId,
    duration: typeof item?.video?.duration === 'number' ? item.video.duration : undefined,
    thumbnail: cleanUrl(item?.video?.cover || item?.video?.originCover || item?.video?.dynamicCover),
    videoCodec: fmt?.videoCodec,
    audioCodec: fmt?.audioCodec,
    width: fmt?.width,
    height: fmt?.height,
    dramaId: item?.dramaInfo?.dramaID,
    seriesName: item?.dramaInfo?.dramaName,
    episodeNumber: numericValue(item?.dramaInfo?.DramaVideoData?.EpisodeNumber),
    subtitles: Array.isArray(item?.video?.subtitleInfos)
      ? item.video.subtitleInfos
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

function parseTikTokDramaItems(html: string, dramaId: string): any[] {
  const jsonCandidates = [
    scriptJsonById(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__'),
    scriptJsonById(html, 'SIGI_STATE'),
    scriptJsonById(html, 'sigi-persisted-data'),
  ].filter(Boolean)

  const found = new Map<string, any>()
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    const looksLikeEpisode = node?.video && node?.dramaInfo && node?.id != null
    if (looksLikeEpisode) {
      const id = String(node.dramaInfo?.dramaID || '')
      if (!dramaId || id === dramaId) {
        const key = String(node.id)
        if (!found.has(key)) found.set(key, node)
      }
    }
    for (const value of Object.values(node)) visit(value)
  }

  for (const candidate of jsonCandidates) {
    try {
      visit(JSON.parse(candidate))
    } catch {
      // Ignore malformed candidates.
    }
  }
  return Array.from(found.values())
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
