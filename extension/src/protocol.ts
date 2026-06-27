export const NATIVE_HOST = 'com.sorevid.downloader'

export type Trigger = 'popup' | 'context-menu' | 'player-button' | 'profile-scan'
export type Platform = 'bilibili' | 'douyin' | 'tiktok' | 'other'

export type ResolvedSubtitle = {
  format?: string
  language?: string
  url: string
}

export type ResolvedMediaItem = {
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
  cookieHeader?: string
  outputFolder?: string
  outputFilename?: string
}

export type NativeRequest =
  | { version: 1; id: string; action: 'ping' }
  | { version: 1; id: string; action: 'drain_browser_downloads' }
  | { version: 1; id: string; action: 'drain_rescan_items' }
  | {
      version: 1
      id: string
      action: 'import_urls'
      urls: string[]
      source: {
        pageUrl?: string
        title?: string
        platform?: Platform
        trigger: Trigger
      }
    }
  | {
      version: 1
      id: string
      action: 'import_resolved_media'
      items: ResolvedMediaItem[]
      source: {
        pageUrl?: string
        title?: string
        platform?: Platform
        trigger: Trigger
      }
    }

export type NativeResponse = {
  version: 1
  id: string
  ok: boolean
  code:
    | 'ok'
    | 'invalid_request'
    | 'origin_denied'
    | 'app_unavailable'
    | 'unsupported_url'
  message: string
  acceptedUrls?: string[]
  browserDownloads?: ResolvedMediaItem[]
  rescanItems?: ResolvedMediaItem[]
}

export function platformForUrl(url: string): Platform {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      return 'tiktok'
    }
    if (host === 'b23.tv' || host === 'bilibili.com' || host.endsWith('.bilibili.com')) {
      return 'bilibili'
    }
    if (
      host === 'douyin.com' ||
      host.endsWith('.douyin.com') ||
      host === 'iesdouyin.com' ||
      host.endsWith('.iesdouyin.com') ||
      host === 'amemv.com' ||
      host.endsWith('.amemv.com')
    ) {
      return 'douyin'
    }
  } catch {
    // The desktop app will perform final validation.
  }
  return 'other'
}

export function requestId() {
  return crypto.randomUUID()
}
