import { useEffect, useMemo, useRef, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import {
  CheckCircle2,
  Bell,
  Cable,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Square,
  Terminal,
  Trash2,
  Unplug,
  Upload,
  X,
} from 'lucide-react'
import backgroundVideo from './assets/background.mp4'
import videoGetLogo from './assets/icons/videoget.png'
import errorNotificationSound from './assets/sounds/error.wav'
import normalNotificationSound from './assets/sounds/normal.wav'
import successfulNotificationSound from './assets/sounds/succesful.wav'
import './App.css'

type DownloadPreset =
  | 'compatibleMp4'
  | 'bestQuality'
  | 'audioOnly'
  | 'videoOnly'
  | 'originalCodec'
type CookieMode = 'none' | 'chrome' | 'manual'
type PlatformKey = 'bilibili' | 'douyin' | 'tiktok'
type SubtitleMode = 'off' | 'subtitles' | 'auto' | 'both'
type SubtitleFormat = 'srt' | 'vtt'
type DanmakuFormat = 'none' | 'xml' | 'ass'
type BatchOrderMode = 'asScanned' | 'reverse' | 'episodeNumber'
type BatchFileNameMode = 'episodeOnly' | 'fullTitle'
type JobStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'warning'
  | 'completed'
  | 'failed'
  | 'canceled'

type ToolStatus = {
  found: boolean
  path?: string
  version?: string
  error?: string
}

type ToolVersions = {
  ytDlp: ToolStatus
  ffmpeg: ToolStatus
  ffprobe: ToolStatus
}

type DownloadEvent = {
  jobId: string
  status: JobStatus
  percent?: number
  speed?: string
  eta?: string
  line?: string
  outputPath?: string
  mediaReport?: MediaReport
}

type MetadataPreview = {
  url: string
  sourceUrl: string
  dramaId?: string
  seriesName?: string
  episodeNumber?: number
  title?: string
  thumbnail?: string
  duration?: number
  uploader?: string
  platform: string
  webpageUrl?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistCount?: number
  formatCount: number
  bestWidth?: number
  bestHeight?: number
  recommendedPreset: string
  videoCodecs: string[]
  audioCodecs: string[]
  requiresSession: boolean
  warning?: string
  directMediaUrl?: string
  subtitleUrl?: string
  isPinned?: boolean
  cookieHeader?: string
}

type BatchItemEdit = {
  seriesTitle?: string
  episodeNumber?: number
  episodeTitle?: string
}

type OrganizedBatchItem = {
  item: MetadataPreview
  key: string
  seriesTitle: string
  episodeNumber: number
  episodeTitle: string
  suggested: BatchItemEdit
  outputTitle: string
}

type OrganizedSeries = {
  id: string
  title: string
  items: OrganizedBatchItem[]
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
  dramaId?: string
  seriesName?: string
  episodeNumber?: number
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
}

type ExtensionImportPayload = {
  urls: string[]
  resolvedMedia: ResolvedMediaItem[]
}

type AiBatchInputItem = {
  key: string
  url: string
  title: string
  uploader?: string
  scanIndex: number
  episodeNumber?: number
  isPinned: boolean
  namePattern: string
  ruleSeriesHint: string
}

type AiBatchResult = {
  series: {
    seriesTitle: string
    episodes: {
      key: string
      url: string
      episodeNumber: number
      episodeTitle?: string
    }[]
  }[]
}

type MediaReport = {
  path: string
  fileSize?: number
  container?: string
  duration?: number
  videoCodec?: string
  videoTag?: string
  audioCodec?: string
  audioTag?: string
  width?: number
  height?: number
  quicktimeCompatible: boolean
  warning?: string
}

type CoverResult = {
  path: string
}

type CoverViewer = {
  src: string
  title: string
  path?: string
}

type CookieProfile = {
  mode: CookieMode
  manualCookiePath: string
}

type AppSettings = {
  downloadDir: string
  cookieMode: CookieMode
  manualCookiePath: string
  downloadPreset: DownloadPreset
  audioNotifications: boolean
  subtitleMode: SubtitleMode
  subtitleFormat: SubtitleFormat
  embedSubtitles: boolean
  danmakuFormat: DanmakuFormat
  batchFileNameMode: BatchFileNameMode
  cookieProfiles: Record<string, CookieProfile>
  geminiApiKey: string
  geminiModel: string
}

type DownloadJob = {
  id: string
  urls: string[]
  titles?: string[]
  status: JobStatus
  percent?: number
  speed?: string
  eta?: string
  logs: string[]
  outputPath?: string
  mediaReport?: MediaReport
  converting?: boolean
}

type DirectDownloadItem = {
  sourceUrl: string
  pageUrl: string
  mediaUrl: string
  dramaId?: string
  seriesName?: string
  episodeNumber?: number
  title?: string
  uploader?: string
  duration?: number
  thumbnail?: string
  videoCodec?: string
  audioCodec?: string
  width?: number
  height?: number
  subtitles?: ResolvedSubtitle[]
  outputFolder?: string
  outputFilename?: string
  cookieHeader?: string
}

type ChromeIntegrationStatus = {
  state: 'installed' | 'notInstalled' | 'invalid'
  message: string
  manifestPath?: string
  extensionId: string
}

type CookieRequestGroup = {
  key: string
  urls: string[]
  titles: string[]
  cookieMode: CookieMode
  manualCookiePath: string
}

type CookieFileStatus = {
  path: string
  valid: boolean
  cookieCount: number
  fileSize: number
  modifiedAt?: number
  message: string
}

type PendingSubtitleRepair = {
  sourceUrl: string
  addedAt: number
}

type DirectSubtitleCheckItem = {
  sourceUrl: string
  pageUrl: string
  title?: string
  episodeNumber?: number
  mediaPath?: string
  expectedPaths: string[]
  presentPaths: string[]
  missingPaths: string[]
  mediaFound: boolean
  hasSubtitles: boolean
  hasMissingRequired: boolean
}

type DirectSubtitleCheckResult = {
  total: number
  checked: number
  missing: number
  mediaNotFound: number
  noSubtitles: number
  items: DirectSubtitleCheckItem[]
}

const defaultTools: ToolVersions = {
  ytDlp: { found: false },
  ffmpeg: { found: false },
  ffprobe: { found: false },
}

const defaultSettings: AppSettings = {
  downloadDir: '',
  cookieMode: 'none',
  manualCookiePath: '',
  downloadPreset: 'compatibleMp4',
  audioNotifications: true,
  subtitleMode: 'off',
  subtitleFormat: 'srt',
  embedSubtitles: false,
  danmakuFormat: 'none',
  batchFileNameMode: 'episodeOnly',
  cookieProfiles: {},
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite',
}

const isTauriRuntime = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

type AudioNotificationTone = 'start' | 'progress' | 'complete' | 'failed'

type JobAudioState = {
  status?: JobStatus
}

type BrowserAudioContext = typeof AudioContext

let notificationAudioContext: AudioContext | null = null

function getNotificationAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextCtor = (window.AudioContext ||
    (window as Window & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext)
  if (!AudioContextCtor) return null
  notificationAudioContext ??= new AudioContextCtor()
  return notificationAudioContext
}

function unlockNotificationAudio() {
  const context = getNotificationAudioContext()
  if (!context) return
  void context.resume().catch(() => undefined)
}

function playNotificationTone(tone: AudioNotificationTone) {
  const context = getNotificationAudioContext()
  if (!context) return

  void context.resume().then(() => {
    const soundByTone: Record<AudioNotificationTone, string> = {
      start: normalNotificationSound,
      progress: normalNotificationSound,
      complete: successfulNotificationSound,
      failed: errorNotificationSound,
    }

    const audio = new Audio(soundByTone[tone])
    audio.volume = 0.4
    audio.currentTime = 0

    void audio.play().catch(() => undefined)
  }).catch(() => undefined)
}

const platformConfigs: Record<PlatformKey, { label: string; hosts: string[]; sessionRequired: boolean }> = {
  bilibili: {
    label: 'BiliBili',
    hosts: ['bilibili.com', 'b23.tv', 'space.bilibili.com'],
    sessionRequired: true,
  },
  douyin: {
    label: 'Douyin',
    hosts: ['douyin.com', 'iesdouyin.com', 'amemv.com'],
    sessionRequired: true,
  },
  tiktok: {
    label: 'TikTok',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    sessionRequired: false,
  },
}

const defaultCookieProfile: CookieProfile = {
  mode: 'none',
  manualCookiePath: '',
}

function getPlatformForUrl(url: string): PlatformKey | undefined {
  const value = normalizeUrlCandidate(url)?.toLowerCase() || url.trim().toLowerCase()

  try {
    const parsed = new URL(value)
    return (Object.entries(platformConfigs) as [PlatformKey, typeof platformConfigs[PlatformKey]][])
      .find(([, config]) =>
        config.hosts.some(
          (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
        ),
      )?.[0]
  } catch {
    return (Object.entries(platformConfigs) as [PlatformKey, typeof platformConfigs[PlatformKey]][])
      .find(([, config]) => config.hosts.some((host) => value.includes(host)))?.[0]
  }
}

function isBilibiliChannelUrl(url: string) {
  const value = normalizeUrlCandidate(url)?.toLowerCase() || url.trim().toLowerCase()
  return (
    value.includes('space.bilibili.com') ||
    value.includes('bilibili.com/space/') ||
    value.includes('/space.bilibili.com/')
  )
}

function isTikTokChannelUrl(url: string) {
  const value = normalizeUrlCandidate(url)?.toLowerCase() || url.trim().toLowerCase()
  try {
    const parsed = new URL(value)
    return (
      (parsed.hostname === 'tiktok.com' || parsed.hostname.endsWith('.tiktok.com')) &&
      /^\/@[^/]/.test(parsed.pathname)
    )
  } catch {
    return value.includes('tiktok.com/@')
  }
}

function App() {
  const [bootLoading, setBootLoading] = useState(true)
  const [urlsText, setUrlsText] = useState('')
  const [downloadDir, setDownloadDir] = useState('')
  const [downloadPreset, setDownloadPreset] = useState<DownloadPreset>('compatibleMp4')
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('off')
  const [subtitleFormat, setSubtitleFormat] = useState<SubtitleFormat>('srt')
  const [embedSubtitles, setEmbedSubtitles] = useState(false)
  const [danmakuFormat, setDanmakuFormat] = useState<DanmakuFormat>('none')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-3.1-flash-lite')
  const [cookieMode, setCookieMode] = useState<CookieMode>('none')
  const [manualCookiePath, setManualCookiePath] = useState('')
  const [audioNotifications, setAudioNotifications] = useState(true)
  const [cookieProfiles, setCookieProfiles] = useState<Record<string, CookieProfile>>({})
  const [tools, setTools] = useState<ToolVersions>(defaultTools)
  const [checkingTools, setCheckingTools] = useState(false)
  const [metadata, setMetadata] = useState<MetadataPreview[]>([])
  const [selectedPreviewKeys, setSelectedPreviewKeys] = useState<Set<string>>(new Set())
  const [batchEdits, setBatchEdits] = useState<Record<string, BatchItemEdit>>({})
  const [batchOrder, setBatchOrder] = useState<BatchOrderMode>('asScanned')
  const [batchFileNameMode, setBatchFileNameMode] = useState<BatchFileNameMode>('episodeOnly')
  const [checkingMetadata, setCheckingMetadata] = useState(false)
  const [coverPaths, setCoverPaths] = useState<Record<string, string>>({})
  const [savingCoverUrl, setSavingCoverUrl] = useState('')
  const [coverViewer, setCoverViewer] = useState<CoverViewer | null>(null)
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'download' | 'settings'>('download')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [startingDownload, setStartingDownload] = useState(false)
  const [chromeIntegration, setChromeIntegration] = useState<ChromeIntegrationStatus | null>(null)
  const [chromeIntegrationBusy, setChromeIntegrationBusy] = useState(false)
  const [chromeIntegrationMessage, setChromeIntegrationMessage] = useState('')
  const [pendingSubtitleRepairs, setPendingSubtitleRepairs] = useState<PendingSubtitleRepair[]>([])
  const [rescanQueueing, setRescanQueueing] = useState(false)
  const [checkingDirectSubtitles, setCheckingDirectSubtitles] = useState(false)
  const [subtitleCheckMessage, setSubtitleCheckMessage] = useState('')
  const [subtitleCheckMissingUrls, setSubtitleCheckMissingUrls] = useState<Set<string>>(new Set())
  const [cookieStatuses, setCookieStatuses] = useState<Record<string, CookieFileStatus>>({})
  const [cookieBusyPlatform, setCookieBusyPlatform] = useState('')
  const [cookieMessage, setCookieMessage] = useState('')
  const [organizingBatch, setOrganizingBatch] = useState(false)
  const audioNotificationsRef = useRef(audioNotifications)
  const jobAudioStateRef = useRef<Map<string, JobAudioState>>(new Map())
  const pendingSubtitleRepairsRef = useRef<PendingSubtitleRepair[]>([])
  const downloadDirRef = useRef('')
  const batchFileNameModeRef = useRef<BatchFileNameMode>('episodeOnly')

  const urls = useMemo(
    () => collectUrlsFromText(urlsText),
    [urlsText],
  )

  const requiredPlatformKeys = useMemo(() => {
    const keys = urls.map(getPlatformForUrl).filter(Boolean) as PlatformKey[]
    return Array.from(new Set(keys))
  }, [urls])

  const hasBilibiliUrl = useMemo(
    () => urls.some((url) => getPlatformForUrl(url) === 'bilibili'),
    [urls],
  )

  const hasBilibiliChannelUrl = useMemo(
    () => urls.some(isBilibiliChannelUrl),
    [urls],
  )

  const hasTikTokChannelUrl = useMemo(
    () => urls.some(isTikTokChannelUrl),
    [urls],
  )

  const missingCookiePlatforms = useMemo(
    () =>
      requiredPlatformKeys.filter(
        (key) => platformConfigs[key].sessionRequired && !cookieProfileReady(getCookieProfile(cookieProfiles, key)),
      ),
    [cookieProfiles, requiredPlatformKeys],
  )

  const selectedMetadata = useMemo(
    () => metadata.filter((item) => selectedPreviewKeys.has(previewKey(item))),
    [metadata, selectedPreviewKeys],
  )

  const organizedBatch = useMemo(
    () => organizeMetadataBatch(metadata, batchEdits, batchOrder),
    [batchEdits, batchOrder, metadata],
  )

  const effectiveDanmakuFormat = hasBilibiliUrl ? danmakuFormat : 'none'

  pendingSubtitleRepairsRef.current = pendingSubtitleRepairs
  downloadDirRef.current = downloadDir
  batchFileNameModeRef.current = batchFileNameMode

  useEffect(() => {
    const timer = window.setTimeout(() => setBootLoading(false), 2000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    audioNotificationsRef.current = audioNotifications
    if (audioNotifications) {
      unlockNotificationAudio()
    }
  }, [audioNotifications])

  useEffect(() => {
    refreshTools()
    loadSavedSettings()
    refreshChromeIntegration()

    if (!isTauriRuntime()) {
      return
    }

    const importExtensionUrls = async () => {
      try {
        const imported = await invoke<ExtensionImportPayload>('drain_extension_imports')
        const resolvedPreviews = imported.resolvedMedia.map(metadataFromResolvedMedia)
        if (imported.urls.length > 0 || resolvedPreviews.length > 0) {
          if (resolvedPreviews.length === 0) {
            setUrlsText((current) => mergeUrlText(current, imported.urls))
          }
          setMetadata((current) => mergeMetadataPreviews(current, resolvedPreviews))
          setSelectedPreviewKeys((current) => {
            const next = new Set(current)
            resolvedPreviews.forEach((item) => next.add(previewKey(item)))
            return next
          })
          setChromeIntegrationMessage(
            resolvedPreviews.length > 0
              ? `${resolvedPreviews.length} resolved TikTok item${resolvedPreviews.length === 1 ? '' : 's'} received from Chrome.`
              : `${imported.urls.length} URL${imported.urls.length === 1 ? '' : 's'} received from Chrome.`,
          )

          const pendingRepairs = pendingSubtitleRepairsRef.current
          const currentDownloadDir = downloadDirRef.current
          if (resolvedPreviews.length > 0 && currentDownloadDir && pendingRepairs.length > 0) {
            const repairItems = resolvedPreviews.filter((preview) =>
              pendingRepairs.some((pending) => pending.sourceUrl === preview.sourceUrl),
            )
            if (repairItems.length > 0) {
              const directRepairItems = repairItems
                .map((item) => directDownloadItemFromMetadata(item, undefined, batchFileNameModeRef.current))
                .filter((item) => item.subtitles && item.subtitles.length > 0)
              if (directRepairItems.length > 0) {
                invoke<string>('retry_missing_direct_subtitles', {
                  request: {
                    items: directRepairItems,
                    downloadDir: currentDownloadDir,
                  },
                })
                  .then((message) => setChromeIntegrationMessage(message))
                  .catch((err) => setError(String(err)))
              }
              const repairedUrls = new Set(repairItems.map((item) => item.sourceUrl))
              setPendingSubtitleRepairs((current) =>
                current.filter((pending) => !repairedUrls.has(pending.sourceUrl)),
              )
            }
          }
        }
      } catch (err) {
        setError(String(err))
      }
    }

    importExtensionUrls()
    const unlisten = listen<DownloadEvent>('download-event', ({ payload }) => {
      handleDownloadAudioNotification(payload)
      setJobs((currentJobs) => {
        let matched = false
        const updatedJobs = currentJobs.map((job) => {
          if (job.id !== payload.jobId) return job

          matched = true
          return {
            ...job,
            status: payload.status,
            percent: payload.percent ?? job.percent,
            speed: payload.speed ?? job.speed,
            eta: payload.eta ?? job.eta,
            outputPath: payload.outputPath ?? job.outputPath,
            mediaReport: payload.mediaReport ?? job.mediaReport,
            logs: payload.line
              ? appendJobLog(job.logs, payload.line)
              : job.logs,
          }
        })

        if (matched) return updatedJobs

        const queuedDirectIndex = updatedJobs.findIndex(
          (job) =>
            job.id.startsWith('queued-') &&
            job.id.endsWith('-direct') &&
            job.status === 'queued',
        )
        const eventJob: DownloadJob = {
          id: payload.jobId,
          urls: [],
          titles: [],
          status: payload.status,
          percent: payload.percent,
          speed: payload.speed,
          eta: payload.eta,
          outputPath: payload.outputPath,
          mediaReport: payload.mediaReport,
          logs: payload.line ? appendJobLog([], payload.line) : [],
        }

        if (queuedDirectIndex >= 0) {
          const next = [...updatedJobs]
          const queued = next[queuedDirectIndex]
          next[queuedDirectIndex] = {
            ...eventJob,
            urls: queued.urls,
            titles: queued.titles,
            logs: [...queued.logs, ...eventJob.logs],
          }
          return next
        }

        return [eventJob, ...updatedJobs]
      })
    })
    const unlistenExtension = listen<ExtensionImportPayload>('extension-import', () => {
      importExtensionUrls()
    })

    return () => {
      unlisten.then((off) => off())
      unlistenExtension.then((off) => off())
    }
  }, [])

  useEffect(() => {
    if (!settingsLoaded) return

    const settings: AppSettings = {
      downloadDir,
      cookieMode,
      manualCookiePath,
      downloadPreset,
      audioNotifications,
      subtitleMode,
      subtitleFormat,
      embedSubtitles,
      danmakuFormat: effectiveDanmakuFormat,
      batchFileNameMode,
      cookieProfiles,
      geminiApiKey,
      geminiModel,
    }

    if (!isTauriRuntime()) {
      localStorage.setItem('bilibili-downloader-settings', JSON.stringify(settings))
      return
    }

    invoke('save_settings', { settings }).catch((err) => {
      setError(String(err))
    })
  }, [
    cookieMode,
    cookieProfiles,
    audioNotifications,
    batchFileNameMode,
    effectiveDanmakuFormat,
    downloadDir,
    downloadPreset,
    embedSubtitles,
    geminiApiKey,
    geminiModel,
    manualCookiePath,
    settingsLoaded,
    subtitleFormat,
    subtitleMode,
  ])

  async function loadSavedSettings() {
    try {
      const settings = isTauriRuntime()
        ? await invoke<AppSettings>('load_settings')
        : readBrowserSettings()

      setDownloadDir(settings.downloadDir || '')
      setCookieMode(isCookieMode(settings.cookieMode) ? settings.cookieMode : 'none')
      setManualCookiePath(settings.manualCookiePath || '')
      setCookieProfiles(normalizeCookieProfiles(settings))
      setSubtitleMode(isSubtitleMode(settings.subtitleMode) ? settings.subtitleMode : 'off')
      setSubtitleFormat(isSubtitleFormat(settings.subtitleFormat) ? settings.subtitleFormat : 'srt')
      setEmbedSubtitles(Boolean(settings.embedSubtitles))
      setAudioNotifications(settings.audioNotifications ?? true)
      setDanmakuFormat(isDanmakuFormat(settings.danmakuFormat) ? settings.danmakuFormat : 'none')
      setBatchFileNameMode(
        isBatchFileNameMode(settings.batchFileNameMode)
          ? settings.batchFileNameMode
          : 'episodeOnly',
      )
      setGeminiApiKey(settings.geminiApiKey || '')
      setGeminiModel(settings.geminiModel || 'gemini-3.1-flash-lite')
      setDownloadPreset(
        isDownloadPreset(settings.downloadPreset)
          ? settings.downloadPreset
          : 'compatibleMp4',
      )
    } catch (err) {
      setError(String(err))
    } finally {
      setSettingsLoaded(true)
    }
  }

  async function refreshTools() {
    setCheckingTools(true)
    setError('')

    try {
      if (!isTauriRuntime()) {
        setTools(defaultTools)
        return
      }

      const versions = await invoke<ToolVersions>('get_tool_versions')
      setTools(versions)
    } catch (err) {
      setError(String(err))
    } finally {
      setCheckingTools(false)
    }
  }

  async function refreshChromeIntegration() {
    if (!isTauriRuntime()) return
    try {
      const status = await invoke<ChromeIntegrationStatus>('get_chrome_integration_status')
      setChromeIntegration(status)
    } catch (err) {
      setChromeIntegrationMessage(String(err))
    }
  }

  async function changeChromeIntegration(action: 'install' | 'remove' | 'test') {
    if (!isTauriRuntime() || chromeIntegrationBusy) return
    setChromeIntegrationBusy(true)
    setChromeIntegrationMessage('')
    try {
      if (action === 'test') {
        const message = await invoke<string>('test_chrome_integration')
        setChromeIntegrationMessage(message)
      } else {
        const command =
          action === 'install' ? 'install_chrome_integration' : 'remove_chrome_integration'
        const status = await invoke<ChromeIntegrationStatus>(command)
        setChromeIntegration(status)
        setChromeIntegrationMessage(status.message)
      }
    } catch (err) {
      setChromeIntegrationMessage(String(err))
    } finally {
      setChromeIntegrationBusy(false)
    }
  }

  async function chooseDownloadDir() {
    if (!isTauriRuntime()) {
      setError('Folder picker is available in the Tauri desktop app.')
      return
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Choose download folder',
    })

    if (typeof selected === 'string') {
      setDownloadDir(selected)
    }
  }

  async function chooseCookieFile(platformKey?: PlatformKey) {
    if (!isTauriRuntime()) {
      setError('Cookie import is available in the Tauri desktop app.')
      return
    }

    const selected = await open({
      directory: false,
      multiple: false,
      title: 'Choose cookies.txt',
      filters: [{ name: 'Cookie text file', extensions: ['txt'] }],
    })

    if (typeof selected === 'string') {
      if (platformKey) {
        setCookieBusyPlatform(platformKey)
        setCookieMessage('')
        try {
          const status = await invoke<CookieFileStatus>('import_cookie_file', {
            request: { platform: platformKey, path: selected },
          })
          setCookieStatuses((current) => ({ ...current, [platformKey]: status }))
          updateCookieProfile(platformKey, {
            mode: 'manual',
            manualCookiePath: status.path,
          })
          setCookieMessage(`${platformConfigs[platformKey].label}: ${status.message}`)
        } catch (err) {
          setCookieMessage(String(err))
        } finally {
          setCookieBusyPlatform('')
        }
      } else {
        setManualCookiePath(selected)
        setCookieMode('manual')
      }
    }
  }

  async function exportChromeCookies(platformKey: PlatformKey) {
    setCookieBusyPlatform(platformKey)
    setCookieMessage('')
    try {
      const status = await invoke<CookieFileStatus>('export_browser_cookies', {
        request: { platform: platformKey, path: null },
      })
      setCookieStatuses((current) => ({ ...current, [platformKey]: status }))
      updateCookieProfile(platformKey, {
        mode: 'manual',
        manualCookiePath: status.path,
      })
      setCookieMessage(`${platformConfigs[platformKey].label}: ${status.message}`)
    } catch (err) {
      setCookieMessage(String(err))
    } finally {
      setCookieBusyPlatform('')
    }
  }

  async function validateCookieProfile(platformKey: PlatformKey) {
    const profile = getCookieProfile(cookieProfiles, platformKey)
    if (!profile.manualCookiePath) return
    setCookieBusyPlatform(platformKey)
    setCookieMessage('')
    try {
      const status = await invoke<CookieFileStatus>('validate_cookie_file', {
        request: { platform: platformKey, path: profile.manualCookiePath },
      })
      setCookieStatuses((current) => ({ ...current, [platformKey]: status }))
      setCookieMessage(`${platformConfigs[platformKey].label}: ${status.message}`)
    } catch (err) {
      setCookieMessage(String(err))
    } finally {
      setCookieBusyPlatform('')
    }
  }

  async function deleteCookieProfile(platformKey: PlatformKey) {
    const profile = getCookieProfile(cookieProfiles, platformKey)
    if (!profile.manualCookiePath) return
    if (!window.confirm(`Delete the managed ${platformConfigs[platformKey].label} cookie file?`)) {
      return
    }
    setCookieBusyPlatform(platformKey)
    setCookieMessage('')
    try {
      await invoke('delete_cookie_file', {
        request: { platform: platformKey, path: profile.manualCookiePath },
      })
      setCookieStatuses((current) => {
        const next = { ...current }
        delete next[platformKey]
        return next
      })
      updateCookieProfile(platformKey, { mode: 'none', manualCookiePath: '' })
      setCookieMessage(`${platformConfigs[platformKey].label} cookie file deleted.`)
    } catch (err) {
      setCookieMessage(String(err))
    } finally {
      setCookieBusyPlatform('')
    }
  }

  function updateCookieProfile(platformKey: PlatformKey, profile: Partial<CookieProfile>) {
    setCookieProfiles((current) => {
      const existing = getCookieProfile(current, platformKey)
      return {
        ...current,
        [platformKey]: {
          ...existing,
          ...profile,
        },
      }
    })
  }

  function buildCookieRequestGroups(targetUrls: string[], targetTitles: string[] = []) {
    const platformKeys = Array.from(
      new Set(targetUrls.map(getPlatformForUrl).filter(Boolean) as PlatformKey[]),
    )

    const missing = platformKeys.filter(
      (key) => platformConfigs[key].sessionRequired && !cookieProfileReady(getCookieProfile(cookieProfiles, key)),
    )
    if (missing.length > 0) {
      return {
        ok: false as const,
        message: `${missing.map((key) => platformConfigs[key].label).join(', ')} needs a cookie/session profile before preview or download.`,
      }
    }

    const groups = new Map<string, CookieRequestGroup>()
    targetUrls.forEach((url, index) => {
      const platformKey = getPlatformForUrl(url)
      const profile = platformKey
        ? getCookieProfile(cookieProfiles, platformKey)
        : {
          mode: cookieMode,
          manualCookiePath: cookieMode === 'manual' ? manualCookiePath : '',
        }
      const groupKey = `${platformKey || 'other'}::${profile.mode}::${profile.manualCookiePath}`
      const existing = groups.get(groupKey)
      if (existing) {
        existing.urls.push(url)
        if (targetTitles[index]) existing.titles.push(targetTitles[index])
      } else {
        groups.set(groupKey, {
          key: groupKey,
          urls: [url],
          titles: targetTitles[index] ? [targetTitles[index]] : [],
          cookieMode: profile.mode,
          manualCookiePath: profile.mode === 'manual' ? profile.manualCookiePath : '',
        })
      }
    })

    return {
      ok: true as const,
      groups: Array.from(groups.values()),
    }
  }

  async function refreshMetadata() {
    setError('')
    setMetadata([])
    setBatchEdits({})

    if (!isTauriRuntime()) {
      setError('Metadata preview runs inside the Tauri desktop app.')
      return
    }

    if (urls.length === 0) {
      setError('Add at least one URL.')
      return
    }

    const groupedRequest = buildCookieRequestGroups(urls)
    if (!groupedRequest.ok) {
      setError(groupedRequest.message)
      return
    }

    setCheckingMetadata(true)
    try {
      const results = await Promise.allSettled(
        groupedRequest.groups.map((group) =>
          invoke<MetadataPreview[]>('fetch_metadata', {
            request: {
              urls: group.urls,
              cookieMode: group.cookieMode,
              manualCookiePath:
                group.cookieMode === 'manual' ? group.manualCookiePath : null,
            },
          }),
        ),
      )
      const previews = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      )
      const sourceOrder = new Map(urls.map((url, index) => [url, index]))
      previews.sort(
        (left, right) =>
          (sourceOrder.get(left.sourceUrl) ?? Number.MAX_SAFE_INTEGER) -
          (sourceOrder.get(right.sourceUrl) ?? Number.MAX_SAFE_INTEGER),
      )
      setMetadata(previews)
      setSelectedPreviewKeys(new Set(previews.map(previewKey)))
      const failures = results
        .map((result, index) =>
          result.status === 'rejected'
            ? `${groupedRequest.groups[index].urls[0]}: ${String(result.reason)}`
            : '',
        )
        .filter(Boolean)
      if (failures.length > 0) {
        setError(
          `${previews.length} item${previews.length === 1 ? '' : 's'} previewed. ${failures.length} group${failures.length === 1 ? '' : 's'} failed:\n${failures.join('\n')}`,
        )
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setCheckingMetadata(false)
    }
  }

  async function startDownload() {
    setError('')
    if (audioNotificationsRef.current) {
      unlockNotificationAudio()
    }

    if (startingDownload) {
      return
    }

    if (!isTauriRuntime()) {
      setError('Downloads run inside the Tauri desktop app.')
      return
    }

    const selectedOrganizedEntries = organizedBatch
      .flatMap((series) => series.items)
      .filter((entry) => selectedPreviewKeys.has(entry.key))
    const selectedItems = metadata.length > 0
      ? selectedOrganizedEntries.length > 0
        ? selectedOrganizedEntries.map((entry) => entry.item)
        : selectedMetadata
      : []
    const organizedItemByKey = new Map(
      organizedBatch.flatMap((series) => series.items.map((entry) => [entry.key, entry])),
    )
    const directSourceEntries = selectedOrganizedEntries.length > 0
      ? selectedOrganizedEntries
      : selectedItems.map((item) => ({
        item,
        key: previewKey(item),
        seriesTitle: item.uploader || 'TikTok Series',
        episodeNumber: 1,
        episodeTitle: displayPartTitle(item),
        suggested: {},
        outputTitle: displayPartTitle(item),
      }))
    const directItems = directSourceEntries
      .filter((entry) => entry.item.directMediaUrl)
      .map((entry) =>
        directDownloadItemFromMetadata(
          entry.item,
          organizedItemByKey.get(entry.key) || entry,
          batchFileNameMode,
        ),
      )
    const regularItemsBase = selectedItems.filter((item) => !item.directMediaUrl)
    const regularItems = directItems.length > 0
      ? regularItemsBase.filter((item) => getPlatformForUrl(item.url) !== 'tiktok')
      : regularItemsBase
    const downloadUrls = selectedItems.length > 0 ? regularItems.map((item) => item.url) : urls
    const downloadTitles = regularItems.map((item) => displayPartTitle(item))

    if (downloadUrls.length === 0 && directItems.length === 0) {
      setError('Add at least one URL.')
      return
    }

    if (metadata.length > 0 && selectedItems.length === 0) {
      setError('Select at least one preview item to download.')
      return
    }

    if (!downloadDir) {
      setError('Choose a download folder.')
      return
    }

    if (embedSubtitles && subtitleMode !== 'off' && !tools.ffmpeg.found) {
      setError('ffmpeg is required to embed subtitles into MP4.')
      return
    }

    const groupedRequest = downloadUrls.length > 0
      ? buildCookieRequestGroups(downloadUrls, downloadTitles)
      : { ok: true as const, groups: [] }
    if (!groupedRequest.ok) {
      setError(groupedRequest.message)
      return
    }

    const directOptimisticJob = directItems.length > 0
      ? {
        id: `queued-${Date.now()}-direct`,
        urls: directItems.map((item) => item.sourceUrl),
        titles: directItems.map((item) => item.title || item.sourceUrl),
        status: 'queued' as JobStatus,
        logs: [`Queued ${directItems.length} direct TikTok item${directItems.length === 1 ? '' : 's'} from Chrome.`],
      }
      : undefined
    const regularOptimisticJobs = groupedRequest.groups.map((group, index) => ({
      id: `queued-${Date.now()}-${index}`,
      urls: group.urls,
      titles: group.titles,
      status: 'queued' as JobStatus,
      logs: [`Queued ${group.urls.length} item${group.urls.length === 1 ? '' : 's'} from the shared list.`],
    }))
    const optimisticJobs = directOptimisticJob
      ? [directOptimisticJob, ...regularOptimisticJobs]
      : regularOptimisticJobs
    setStartingDownload(true)
    setJobs((currentJobs) => [...optimisticJobs, ...currentJobs])

    try {
      const directResult = directItems.length > 0
        ? await Promise.allSettled([
          withTimeout(
            invoke<string>('start_direct_download', {
              request: {
                items: directItems,
                downloadDir,
              },
            }),
            15_000,
            'Direct TikTok download did not start within 15 seconds. Restart the app so the updated backend command is loaded.',
          ),
        ])
        : []
      const regularResults = await Promise.allSettled(
        groupedRequest.groups.map((group) =>
          invoke<string>('start_download', {
            request: {
              urls: group.urls,
              downloadDir,
              preset: downloadPreset,
              cookieMode: group.cookieMode,
              manualCookiePath:
                group.cookieMode === 'manual' ? group.manualCookiePath : null,
              subtitleMode,
              subtitleFormat,
              embedSubtitles,
              danmakuFormat: group.urls.some(
                (url) => getPlatformForUrl(url) === 'bilibili',
              )
                ? danmakuFormat
                : 'none',
            },
          }),
        ),
      )
      const results = [...directResult, ...regularResults]
      setJobs((currentJobs) =>
        currentJobs.map((job) => {
          const index = optimisticJobs.findIndex((queued) => queued.id === job.id)
          if (index < 0) return job
          const result = results[index]
          return result.status === 'fulfilled'
            ? { ...job, id: result.value, status: 'starting' }
            : {
              ...job,
              status: 'failed',
              logs: [...job.logs, String(result.reason)],
            }
        }),
      )
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length > 0) {
        setError(
          `${failures.length} download group${failures.length === 1 ? '' : 's'} could not start. Other groups continue normally.`,
        )
      }
    } catch (err) {
      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          optimisticJobs.some((queued) => queued.id === job.id)
            ? {
              ...job,
              status: 'failed',
              logs: [...job.logs, String(err)],
            }
            : job,
        ),
      )
      setError(String(err))
    } finally {
      setStartingDownload(false)
    }
  }

  function handleDownloadAudioNotification(event: DownloadEvent) {
    if (!audioNotificationsRef.current) return

    const state = jobAudioStateRef.current.get(event.jobId) || {}
    const previousStatus = state.status

    if (event.status !== previousStatus) {
      state.status = event.status
      if (event.status === 'starting') {
        playNotificationTone('start')
      } else if (event.status === 'completed') {
        playNotificationTone('complete')
      } else if (event.status === 'failed' || event.status === 'canceled') {
        playNotificationTone('failed')
      } else if (event.status === 'warning') {
        playNotificationTone('progress')
      }
    }

    jobAudioStateRef.current.set(event.jobId, state)
  }

  async function cancelDownload(jobId: string) {
    setError('')

    try {
      await invoke('cancel_download', { jobId })
    } catch (err) {
      setError(String(err))
    }
  }

  async function openOutput(path: string) {
    setError('')
    try {
      await invoke('open_path', { path })
    } catch (err) {
      setError(String(err))
    }
  }

  async function revealOutput(path: string) {
    setError('')
    try {
      await invoke('reveal_path', { path })
    } catch (err) {
      setError(String(err))
    }
  }

  async function convertOutput(jobId: string, path: string) {
    setError('')
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === jobId
          ? { ...job, converting: true, logs: [...job.logs, 'Converting to H.264 MP4...'] }
          : job,
      ),
    )

    try {
      const report = await invoke<MediaReport>('convert_to_h264', { path })
      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          job.id === jobId
            ? {
              ...job,
              converting: false,
              outputPath: report.path,
              mediaReport: report,
              logs: [...job.logs, `Converted file: ${report.path}`],
            }
            : job,
        ),
      )
    } catch (err) {
      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          job.id === jobId
            ? { ...job, converting: false, logs: [...job.logs, String(err)] }
            : job,
        ),
      )
      setError(String(err))
    }
  }

  function clearQueue() {
    setMetadata([])
    setSelectedPreviewKeys(new Set())
    setBatchEdits({})
    setCoverPaths({})
    setUrlsText('')
    setError('')
    setSubtitleCheckMessage('')
    setSubtitleCheckMissingUrls(new Set())
    setJobs((currentJobs) =>
      currentJobs.filter((job) => ['queued', 'starting', 'running', 'warning'].includes(job.status)),
    )
  }

  async function checkDirectSubtitles() {
    setError('')
    setSubtitleCheckMessage('')
    setSubtitleCheckMissingUrls(new Set())
    const directEntries = organizedBatch
      .flatMap((series) => series.items)
      .filter((entry) => entry.item.directMediaUrl)
    if (directEntries.length === 0) {
      setError('Preview or import direct TikTok items before checking subtitles.')
      return
    }
    if (!downloadDir) {
      setError('Choose a download folder before checking subtitles.')
      return
    }

    setCheckingDirectSubtitles(true)
    setSubtitleCheckMessage(`Checking subtitles for ${directEntries.length} direct item${directEntries.length === 1 ? '' : 's'}...`)
    try {
      const result = await invoke<DirectSubtitleCheckResult>('check_direct_subtitles', {
        request: {
          items: directEntries.map((entry) =>
            directDownloadItemFromMetadata(entry.item, entry, batchFileNameMode),
          ),
          downloadDir,
        },
      })
      const missingItems = result.items.filter((item) => item.hasMissingRequired)
      const missingUrls = new Set(missingItems.map((item) => item.sourceUrl))
      setSubtitleCheckMissingUrls(missingUrls)

      if (missingItems.length > 0) {
        setSelectedPreviewKeys(
          new Set(
            metadata
              .filter((item) => missingUrls.has(item.sourceUrl))
              .map((item) => previewKey(item)),
          ),
        )
        const examples = missingItems
          .slice(0, 3)
          .map((item) =>
            item.episodeNumber
              ? `EP${padEpisodeNumber(item.episodeNumber)}`
              : item.title || item.sourceUrl,
          )
          .join(', ')
        setSubtitleCheckMessage(
          `Missing subtitles on ${missingItems.length} item${missingItems.length === 1 ? '' : 's'} (${examples}${missingItems.length > 3 ? ', ...' : ''}). Selected only those items for re-scan.`,
        )
        return
      }

      const extra =
        result.mediaNotFound > 0
          ? ` ${result.mediaNotFound} media file${result.mediaNotFound === 1 ? '' : 's'} were not found in the download folder.`
          : ''
      setSubtitleCheckMessage(
        `Subtitle check passed for ${result.checked} downloaded item${result.checked === 1 ? '' : 's'}.${extra}`,
      )
    } catch (err) {
      setError(String(err))
    } finally {
      setCheckingDirectSubtitles(false)
    }
  }

  async function rescanSelectedTikTokItems() {
    setError('')
    setRescanQueueing(true)
    const selectedOrganizedEntries = organizedBatch
      .flatMap((series) => series.items)
      .filter((entry) => selectedPreviewKeys.has(entry.key) && entry.item.directMediaUrl)
    if (selectedOrganizedEntries.length === 0) {
      setError('Select at least one resolved TikTok item to re-scan.')
      setRescanQueueing(false)
      return
    }
    try {
      await invoke<string>('queue_tiktok_rescan', {
        request: {
          items: selectedOrganizedEntries.map((entry) =>
            directDownloadItemFromMetadata(entry.item, entry, batchFileNameMode),
          ),
        },
      })
      const now = Date.now()
      setPendingSubtitleRepairs((current) => [
        ...current,
        ...selectedOrganizedEntries.map((entry) => ({
          sourceUrl: entry.item.sourceUrl,
          addedAt: now,
        })),
      ])
      setChromeIntegrationMessage(
        `Queued ${selectedOrganizedEntries.length} TikTok item${selectedOrganizedEntries.length === 1 ? '' : 's'} for subtitle URL refresh. Open the SOREVID VideoGET Chrome extension on a TikTok tab to run it now.`,
      )
    } catch (err) {
      setError(String(err))
    } finally {
      setRescanQueueing(false)
    }
  }

  async function saveCover(item: MetadataPreview) {
    setError('')

    if (!isTauriRuntime()) {
      setError('Cover download runs inside the Tauri desktop app.')
      return
    }

    if (!downloadDir) {
      setError('Choose a download folder before saving the cover.')
      return
    }

    if (!item.thumbnail) {
      setError('This video does not expose a cover image.')
      return
    }

    setSavingCoverUrl(item.url)
    try {
      const result = await invoke<CoverResult>('download_cover', {
        request: {
          thumbnailUrl: item.thumbnail,
          title: item.title || 'cover',
          downloadDir,
        },
      })
      setCoverPaths((current) => ({ ...current, [item.url]: result.path }))
      setCoverViewer({
        src: convertFileSrc(result.path),
        title: item.title || 'Cover image',
        path: result.path,
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingCoverUrl('')
    }
  }

  function viewCover(item: MetadataPreview) {
    const savedPath = coverPaths[item.url]
    if (savedPath) {
      setCoverViewer({
        src: convertFileSrc(savedPath),
        title: item.title || 'Cover image',
        path: savedPath,
      })
      return
    }

    if (item.thumbnail) {
      setCoverViewer({
        src: item.thumbnail,
        title: item.title || 'Cover image',
      })
    } else {
      setError('This video does not expose a cover image.')
    }
  }

  function togglePreview(item: MetadataPreview) {
    const key = previewKey(item)
    setSelectedPreviewKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function selectAllPreviews() {
    setSelectedPreviewKeys(new Set(metadata.map(previewKey)))
  }

  function clearPreviewSelection() {
    setSelectedPreviewKeys(new Set())
  }

  function selectSeries(series: OrganizedSeries) {
    setSelectedPreviewKeys((current) => {
      const next = new Set(current)
      series.items.forEach((entry) => next.add(entry.key))
      return next
    })
  }

  function clearSeriesSelection(series: OrganizedSeries) {
    setSelectedPreviewKeys((current) => {
      const next = new Set(current)
      series.items.forEach((entry) => next.delete(entry.key))
      return next
    })
  }

  function updateBatchItem(key: string, edit: BatchItemEdit) {
    setBatchEdits((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...edit,
      },
    }))
  }

  function renameBatchSeries(series: OrganizedSeries, title: string) {
    setBatchEdits((current) => {
      const next = { ...current }
      series.items.forEach((entry) => {
        next[entry.key] = {
          ...next[entry.key],
          seriesTitle: title,
        }
      })
      return next
    })
  }

  async function organizeBatchWithAi() {
    setError('')
    if (!metadata.length) {
      setError('Scan or preview videos before organizing with AI.')
      return
    }
    if (!geminiApiKey.trim()) {
      setError('Add a Google AI Studio API key before organizing with AI.')
      return
    }
    if (!isTauriRuntime()) {
      setError('AI organizer runs inside the Tauri desktop app.')
      return
    }

    setOrganizingBatch(true)
    try {
      const items: AiBatchInputItem[] = metadata.map((item, index) => {
        const key = previewKey(item)
        const edit = batchEdits[key]
        const suggested = suggestBatchItem(item, index)
        return {
          key,
          url: item.webpageUrl || item.url,
          title: item.title || displayPartTitle(item),
          uploader: item.uploader,
          scanIndex: index + 1,
          episodeNumber: edit?.episodeNumber || suggested.episodeNumber,
          isPinned: Boolean(item.isPinned),
          namePattern: inferTitlePattern(item.title || displayPartTitle(item)),
          ruleSeriesHint: inferRuleSeriesHint(item.title || displayPartTitle(item), item.uploader),
        }
      })
      const result = await invoke<AiBatchResult>('organize_batch_with_ai', {
        request: {
          apiKey: geminiApiKey.trim(),
          model: geminiModel.trim() || 'gemini-3.1-flash-lite',
          items,
        },
      })
      applyAiBatchResult(refineAiBatchResult(result, items))
      setBatchOrder('asScanned')
    } catch (err) {
      setError(String(err))
    } finally {
      setOrganizingBatch(false)
    }
  }

  function applyAiBatchResult(result: AiBatchResult) {
    const itemByKey = new Map(metadata.map((item) => [previewKey(item), item]))
    const nextEdits: Record<string, BatchItemEdit> = {}
    const nextMetadata: MetadataPreview[] = []

    result.series.forEach((series) => {
      series.episodes.forEach((episode) => {
        const item = itemByKey.get(episode.key)
        if (!item) return
        nextMetadata.push(item)
        nextEdits[episode.key] = {
          seriesTitle: series.seriesTitle,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.episodeTitle || '',
        }
      })
    })

    setMetadata(nextMetadata)
    setBatchEdits(nextEdits)
    setSelectedPreviewKeys((current) => {
      const next = new Set<string>()
      nextMetadata.forEach((item) => {
        const key = previewKey(item)
        if (current.has(key)) next.add(key)
      })
      return next
    })
  }

  return (
    <main className="app-shell">
      <video className="app-bg-video" autoPlay loop muted playsInline>
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      {bootLoading && (
        <div className="app-loading-screen" role="status" aria-live="polite">
          <div className="loading-logo-shell">
            <img className="loading-logo" src={videoGetLogo} alt="SOREVID VideoGET" />
          </div>
          <div className="loading-wordmark">
            <span>SOREVID</span>
            <strong>VideoGET</strong>
          </div>
          <div className="loading-progress" aria-hidden="true" />
        </div>
      )}
      <section className="workspace">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-title-row">
              <div className="brand-mark" aria-hidden="true">
                <img className="brand-logo" src={videoGetLogo} alt="" />
              </div>
              <div className="brand-copy">
                <h1 className="brand-title">
                  <span className="brand-title-primary">SOREVID</span>
                  <span className="brand-title-secondary">VideoGet</span>
                </h1>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <nav className="page-tabs" aria-label="App sections">
              <button
                className={activeTab === 'download' ? 'tab-button active' : 'tab-button'}
                type="button"
                onClick={() => setActiveTab('download')}
              >
                Download
              </button>
              <button
                className={activeTab === 'settings' ? 'tab-button active' : 'tab-button'}
                type="button"
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </nav>
            <button className="icon-button" type="button" onClick={refreshTools}>
              {checkingTools ? <Loader2 className="spin" /> : <RefreshCw />}
              <span>Check tools</span>
            </button>
          </div>
        </header>

        {activeTab === 'settings' && (
          <div className="tab-panel">
            <section className="tool-strip" aria-label="Tool versions">
              <ToolBadge label="yt-dlp" tool={tools.ytDlp} />
              <ToolBadge label="ffmpeg" tool={tools.ffmpeg} />
              <ToolBadge label="ffprobe" tool={tools.ffprobe} />
            </section>

            <section className="settings-panel" aria-label="Audio notification settings">
              <div className="settings-heading">
                <div>
                  <strong>Audio notifications</strong>
                  <span>Play short sounds when downloads start, complete, fail, or need attention.</span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => playNotificationTone('complete')}
                >
                  <Bell />
                  <span>Test sound</span>
                </button>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={audioNotifications}
                  onChange={(event) => setAudioNotifications(event.target.checked)}
                />
                <span>Enable download sounds</span>
              </label>
            </section>

            <section className="settings-panel" aria-label="AI organizer settings">
              <div className="settings-heading">
                <div>
                  <strong>AI organizer</strong>
                  <span>Used by the Batch organizer button on the Download tab.</span>
                </div>
              </div>
              <div className="settings-grid">
                <label className="field-block">
                  <span>Google AI Studio API key</span>
                  <input
                    className="text-input"
                    type="password"
                    value={geminiApiKey}
                    onChange={(event) => setGeminiApiKey(event.target.value)}
                    placeholder="Paste API key"
                  />
                </label>
                <label className="field-block">
                  <span>Model</span>
                  <input
                    className="text-input"
                    value={geminiModel}
                    onChange={(event) => setGeminiModel(event.target.value)}
                    placeholder="gemini-3.1-flash-lite"
                  />
                </label>
              </div>
            </section>

            <section className="settings-panel" aria-label="Download output settings">
              <div className="settings-heading">
                <div>
                  <strong>Output</strong>
                  <span>Folder and media format used when starting downloads.</span>
                </div>
              </div>
              <div className="control-grid">
                <div className="field-block">
                  <label>Download folder</label>
                  <button
                    className="path-button"
                    type="button"
                    onClick={chooseDownloadDir}
                  >
                    <FolderOpen />
                    <span>{downloadDir || 'Choose folder'}</span>
                  </button>
                </div>

                <div className="field-block">
                  <label>Format preset</label>
                  <div className="segmented format-presets">
                    <SegmentButton active={downloadPreset === 'compatibleMp4'} onClick={() => setDownloadPreset('compatibleMp4')}>
                      MP4
                    </SegmentButton>
                    <SegmentButton active={downloadPreset === 'bestQuality'} onClick={() => setDownloadPreset('bestQuality')}>
                      Best
                    </SegmentButton>
                    <SegmentButton active={downloadPreset === 'audioOnly'} onClick={() => setDownloadPreset('audioOnly')}>
                      Audio
                    </SegmentButton>
                    <SegmentButton active={downloadPreset === 'videoOnly'} onClick={() => setDownloadPreset('videoOnly')}>
                      Video
                    </SegmentButton>
                    <SegmentButton active={downloadPreset === 'originalCodec'} onClick={() => setDownloadPreset('originalCodec')}>
                      Original
                    </SegmentButton>
                  </div>
                </div>
              </div>
            </section>

            {hasBilibiliUrl && (
              <section className="subtitle-panel" aria-label="Subtitles and danmaku">
                <div className="subtitle-panel-heading">
                  <div>
                    <strong>Subtitles & Danmaku</strong>
                    <span>Download subtitle sidecars, BiliBili danmaku XML, or convert danmaku XML to ASS after download.</span>
                  </div>
                </div>

                <div className="subtitle-grid">
                  <div className="field-block">
                    <label>Subtitles</label>
                    <div className="segmented subtitle-modes">
                      <SegmentButton active={subtitleMode === 'off'} onClick={() => setSubtitleMode('off')}>
                        Off
                      </SegmentButton>
                      <SegmentButton active={subtitleMode === 'subtitles'} onClick={() => setSubtitleMode('subtitles')}>
                        Subs
                      </SegmentButton>
                      <SegmentButton active={subtitleMode === 'auto'} onClick={() => setSubtitleMode('auto')}>
                        Auto
                      </SegmentButton>
                      <SegmentButton active={subtitleMode === 'both'} onClick={() => setSubtitleMode('both')}>
                        Both
                      </SegmentButton>
                    </div>
                  </div>

                  <div className="field-block">
                    <label>Subtitle format</label>
                    <div className="segmented">
                      <SegmentButton active={subtitleFormat === 'srt'} onClick={() => setSubtitleFormat('srt')}>
                        SRT
                      </SegmentButton>
                      <SegmentButton active={subtitleFormat === 'vtt'} onClick={() => setSubtitleFormat('vtt')}>
                        VTT
                      </SegmentButton>
                    </div>
                  </div>

                  <div className="field-block">
                    <label>Danmaku</label>
                    <div className="segmented">
                      <SegmentButton active={danmakuFormat === 'none'} onClick={() => setDanmakuFormat('none')}>
                        Off
                      </SegmentButton>
                      <SegmentButton active={danmakuFormat === 'xml'} onClick={() => setDanmakuFormat('xml')}>
                        XML
                      </SegmentButton>
                      <SegmentButton active={danmakuFormat === 'ass'} onClick={() => setDanmakuFormat('ass')}>
                        ASS
                      </SegmentButton>
                    </div>
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={embedSubtitles}
                      disabled={subtitleMode === 'off'}
                      onChange={(event) => setEmbedSubtitles(event.target.checked)}
                    />
                    <span>Embed subtitles into MP4 when possible</span>
                  </label>
                </div>
              </section>
            )}

            <section className="platform-cookie-panel" aria-label="Platform cookie profiles">
              <div className="cookie-panel-heading">
                <div>
                  <strong>Platform cookie profiles</strong>
                  <span>
                    {requiredPlatformKeys.length > 0
                      ? 'Detected protected platforms from the pasted URLs.'
                      : 'Choose a platform session before preview/download.'}
                  </span>
                </div>
                {missingCookiePlatforms.length > 0 && (
                  <small>
                    Missing: {missingCookiePlatforms.map((key) => platformConfigs[key].label).join(', ')}
                  </small>
                )}
              </div>

              <div className="platform-cookie-grid">
                {(Object.keys(platformConfigs) as PlatformKey[]).map((platformKey) => (
                  <CookieProfileCard
                    key={platformKey}
                    platformKey={platformKey}
                    profile={getCookieProfile(cookieProfiles, platformKey)}
                    onChange={(profile) => updateCookieProfile(platformKey, profile)}
                    onImport={() => chooseCookieFile(platformKey)}
                    onExport={() => exportChromeCookies(platformKey)}
                    onValidate={() => validateCookieProfile(platformKey)}
                    onDelete={() => deleteCookieProfile(platformKey)}
                    status={cookieStatuses[platformKey]}
                    busy={cookieBusyPlatform === platformKey}
                  />
                ))}
              </div>
              {cookieMessage && <div className="cookie-manager-message">{cookieMessage}</div>}
            </section>

            <div className="notice">
              <ShieldAlert />
              <span>
                {requiredPlatformKeys.length > 0
                  ? `${requiredPlatformKeys.map((key) => platformConfigs[key].label).join(', ')} detected. The app will use the matching platform cookie profile for preview and download.`
                  : 'Cookie files are sensitive. This app passes them only to local yt-dlp and does not upload or sync them.'}
              </span>
            </div>

            <section className="chrome-integration-panel" aria-label="Chrome integration">
              <div className="chrome-integration-heading">
                <div className={`integration-icon ${chromeIntegration?.state || 'unknown'}`}>
                  <Cable />
                </div>
                <div>
                  <strong>Chrome Integration Bridge</strong>
                  <span>
                    {chromeIntegration?.message ||
                      'Register the desktop bridge, then load the extension separately in Chrome.'}
                  </span>
                </div>
                <small className={chromeIntegration?.state || 'unknown'}>
                  {chromeIntegration?.state === 'installed'
                    ? 'Installed'
                    : chromeIntegration?.state === 'invalid'
                      ? 'Invalid'
                      : 'Not installed'}
                </small>
              </div>
              <div className="chrome-integration-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => changeChromeIntegration('install')}
                  disabled={chromeIntegrationBusy}
                >
                  <Cable />
                  <span>Register bridge</span>
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => changeChromeIntegration('test')}
                  disabled={chromeIntegrationBusy || chromeIntegration?.state !== 'installed'}
                >
                  {chromeIntegrationBusy ? <Loader2 className="spin" /> : <RefreshCw />}
                  <span>Test desktop bridge</span>
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => changeChromeIntegration('remove')}
                  disabled={chromeIntegrationBusy || chromeIntegration?.state === 'notInstalled'}
                >
                  <Unplug />
                  <span>Remove bridge</span>
                </button>
                {chromeIntegrationMessage && <span>{chromeIntegrationMessage}</span>}
              </div>
              <div className="chrome-extension-steps">
                <strong>Chrome extension is a separate step</strong>
                <span>
                  Open <code>chrome://extensions</code>, enable Developer mode, choose Load unpacked,
                  then select the <code>dist-extension</code> folder.
                </span>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'download' && (
          <section className="download-panel tab-panel">
            <div className="field-block">
              <label htmlFor="urls">URLs</label>
              <textarea
                id="urls"
                value={urlsText}
                onChange={(event) => setUrlsText(event.target.value)}
                placeholder="Paste one or more video, playlist, or audio URLs..."
                spellCheck={false}
              />
            </div>

            <div className="preview-actions">
              <span>{metadata.length > 0 ? `${metadata.length} preview ready` : 'Run preview before downloading protected links.'}</span>
            </div>

            {(hasBilibiliChannelUrl || hasTikTokChannelUrl) && (
              <div className="notice notice-soft">
                <ShieldAlert />
                <span>
                  Channel/profile pages are previewed in limited mode to avoid endless loading. You can still download the full channel, but preview only loads the first batch of items.
                </span>
              </div>
            )}

            {subtitleCheckMessage && (
              <div className={subtitleCheckMissingUrls.size > 0 ? 'notice' : 'notice notice-soft'}>
                <FileText />
                <span>{subtitleCheckMessage}</span>
              </div>
            )}

            {metadata.length > 0 && (
              <section className="metadata-list" aria-label="Metadata preview">
                <div className="selection-bar">
                  <span>
                    {selectedMetadata.length}/{metadata.length} selected
                    {metadata.some((item) => item.playlistCount && item.playlistCount > 1)
                      ? ' from playlist'
                      : ''}
                  </span>
                  <div>
                    <button className="secondary-button" type="button" onClick={selectAllPreviews}>
                      Select all
                    </button>
                    <button className="secondary-button" type="button" onClick={clearPreviewSelection}>
                      Select none
                    </button>
                  </div>
                </div>
                <BatchOrganizer
                  aiReady={Boolean(geminiApiKey.trim())}
                  batchFileNameMode={batchFileNameMode}
                  batchOrder={batchOrder}
                  isOrganizing={organizingBatch}
                  series={organizedBatch}
                  selectedKeys={selectedPreviewKeys}
                  onClearSeries={clearSeriesSelection}
                  onOrganizeWithAi={organizeBatchWithAi}
                  onRenameSeries={renameBatchSeries}
                  onSelectSeries={selectSeries}
                  onSetBatchFileNameMode={setBatchFileNameMode}
                  onSetBatchOrder={setBatchOrder}
                  onUpdateItem={updateBatchItem}
                />
                {metadata.map((item) => (
                  <MetadataCard
                    key={item.url}
                    coverPath={coverPaths[item.url]}
                    isSavingCover={savingCoverUrl === item.url}
                    isSelected={selectedPreviewKeys.has(previewKey(item))}
                    isPendingSubtitleRepair={pendingSubtitleRepairs.some(
                      (pending) => pending.sourceUrl === item.sourceUrl,
                    )}
                    isMissingSubtitle={subtitleCheckMissingUrls.has(item.sourceUrl)}
                    item={item}
                    onSaveCover={saveCover}
                    onToggle={togglePreview}
                    onViewCover={viewCover}
                  />
                ))}
              </section>
            )}

            {error && <div className="error-line">{error}</div>}
          </section>
        )}
      </section>

      <aside className="jobs-pane">
        <div className="pane-heading">
          <div>
            <Terminal />
            <h2>Queue</h2>
            {jobs.length > 0 && (
              <span className="queue-progress">
                {jobs.filter((job) => job.status === 'completed').length}/{jobs.length} downloaded
              </span>
            )}
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={clearQueue}
            disabled={metadata.length === 0 && urlsText.trim() === '' && jobs.every((job) => ['queued', 'starting', 'running', 'warning'].includes(job.status))}
          >
            <Trash2 />
            <span>Clear all</span>
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="empty-state">No downloads yet.</div>
        ) : (
          <div className="job-list">
            {jobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                onCancel={cancelDownload}
                onOpen={openOutput}
                onReveal={revealOutput}
                onConvert={convertOutput}
              />
            ))}
          </div>
        )}
      </aside>

      <section className="bottom-action-bar" aria-label="Download actions">
        <div className="bottom-action-summary">
          <strong>
            {metadata.length > 0
              ? `${selectedMetadata.length}/${metadata.length} selected`
              : `${urls.length} URL${urls.length === 1 ? '' : 's'} ready`}
          </strong>
          <span>{subtitleCheckMessage || chromeIntegrationMessage || downloadDir || 'No output folder selected'}</span>
        </div>
        <div className="bottom-action-controls">
          <button className="secondary-button" type="button" onClick={() => setActiveTab('settings')}>
            <FolderOpen />
            <span>Settings</span>
          </button>
          <button className="secondary-button" type="button" onClick={refreshMetadata} disabled={checkingMetadata}>
            {checkingMetadata ? <Loader2 className="spin" /> : <RefreshCw />}
            <span>Preview</span>
          </button>
          {metadata.some((item) => item.directMediaUrl) && (
            <button
              className="secondary-button"
              type="button"
              onClick={checkDirectSubtitles}
              disabled={checkingDirectSubtitles}
            >
              {checkingDirectSubtitles ? <Loader2 className="spin" /> : <FileText />}
              <span>Check subtitles</span>
            </button>
          )}
          {metadata.some((item) => item.directMediaUrl) && (
            <button
              className="secondary-button"
              type="button"
              onClick={rescanSelectedTikTokItems}
              disabled={rescanQueueing}
            >
              {rescanQueueing ? <Loader2 className="spin" /> : <RefreshCw />}
              <span>Re-scan selected</span>
            </button>
          )}
          <button className="primary-button" type="button" onClick={startDownload} disabled={startingDownload}>
            <Download />
            <span>{startingDownload ? 'Starting...' : 'Start download'}</span>
          </button>
        </div>
      </section>

      {coverViewer && (
        <CoverModal viewer={coverViewer} onClose={() => setCoverViewer(null)} />
      )}
    </main>
  )
}

function ToolBadge({ label, tool }: { label: string; tool: ToolStatus }) {
  return (
    <div className={tool.found ? 'tool-badge ok' : 'tool-badge missing'}>
      <CheckCircle2 />
      <div>
        <strong>{label}</strong>
        <span>{tool.version || tool.error || 'Not found'}</span>
      </div>
    </div>
  )
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      className={active ? 'segment active' : 'segment'}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CookieProfileCard({
  busy,
  platformKey,
  profile,
  status,
  onChange,
  onDelete,
  onExport,
  onImport,
  onValidate,
}: {
  busy: boolean
  platformKey: PlatformKey
  profile: CookieProfile
  status?: CookieFileStatus
  onChange: (profile: Partial<CookieProfile>) => void
  onDelete: () => void
  onExport: () => void
  onImport: () => void
  onValidate: () => void
}) {
  const config = platformConfigs[platformKey]
  const ready = cookieProfileReady(profile)

  return (
    <article className={ready ? 'cookie-profile-card ready' : 'cookie-profile-card missing'}>
      <div className="cookie-profile-top">
        <div>
          <strong>{config.label}</strong>
          <span>{config.hosts.join(', ')}</span>
        </div>
        <small>{ready ? 'Ready' : 'Needs session'}</small>
      </div>

      <div className="segmented">
        <SegmentButton active={profile.mode === 'none'} onClick={() => onChange({ mode: 'none' })}>
          None
        </SegmentButton>
        <SegmentButton active={profile.mode === 'chrome'} onClick={() => onChange({ mode: 'chrome' })}>
          Chrome
        </SegmentButton>
        <SegmentButton active={profile.mode === 'manual'} onClick={() => onChange({ mode: 'manual' })}>
          Manual
        </SegmentButton>
      </div>

      <div className="cookie-file-row">
        <button className="path-button cookie-file" type="button" onClick={onImport} disabled={busy}>
          {busy ? <Loader2 className="spin" /> : <Upload />}
          <span>{profile.manualCookiePath || `Import ${config.label} cookies.txt`}</span>
        </button>
        <button className="secondary-button" type="button" onClick={onExport} disabled={busy}>
          <Download />
          <span>Export from Chrome</span>
        </button>
      </div>

      {profile.manualCookiePath && (
        <div className="cookie-manager-actions">
          <button className="secondary-button" type="button" onClick={onValidate} disabled={busy}>
            <CheckCircle2 />
            <span>Validate</span>
          </button>
          <button className="secondary-button danger" type="button" onClick={onDelete} disabled={busy}>
            <Trash2 />
            <span>Delete</span>
          </button>
        </div>
      )}

      {status && (
        <div className={status.valid ? 'cookie-status valid' : 'cookie-status invalid'}>
          <strong>{status.valid ? 'Valid cookie file' : 'Invalid cookie file'}</strong>
          <span>
            {status.cookieCount} cookies · {formatBytes(status.fileSize)}
            {status.modifiedAt ? ` · ${new Date(status.modifiedAt * 1000).toLocaleString()}` : ''}
          </span>
        </div>
      )}
    </article>
  )
}

function BatchOrganizer({
  aiReady,
  batchFileNameMode,
  batchOrder,
  isOrganizing,
  series,
  selectedKeys,
  onClearSeries,
  onOrganizeWithAi,
  onRenameSeries,
  onSelectSeries,
  onSetBatchFileNameMode,
  onSetBatchOrder,
  onUpdateItem,
}: {
  aiReady: boolean
  batchFileNameMode: BatchFileNameMode
  batchOrder: BatchOrderMode
  isOrganizing: boolean
  series: OrganizedSeries[]
  selectedKeys: Set<string>
  onClearSeries: (series: OrganizedSeries) => void
  onOrganizeWithAi: () => void
  onRenameSeries: (series: OrganizedSeries, title: string) => void
  onSelectSeries: (series: OrganizedSeries) => void
  onSetBatchFileNameMode: (mode: BatchFileNameMode) => void
  onSetBatchOrder: (mode: BatchOrderMode) => void
  onUpdateItem: (key: string, edit: BatchItemEdit) => void
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  if (series.length === 0) return null

  const totalItems = series.reduce((sum, group) => sum + group.items.length, 0)
  const sampleEntry = series[0]?.items[0]
  const fileNameExample = sampleEntry
    ? `${batchFileNameMode === 'episodeOnly'
      ? String(sampleEntry.episodeNumber)
      : sampleEntry.outputTitle
    }.mp4`
    : batchFileNameMode === 'episodeOnly'
      ? '001.mp4'
      : 'Series Title - EP001 - Episode Title.mp4'

  async function copyAiPrompt() {
    const prompt = buildBatchAiPrompt(series)
    await navigator.clipboard.writeText(prompt)
    setCopiedPrompt(true)
    window.setTimeout(() => setCopiedPrompt(false), 1800)
  }

  return (
    <section className="batch-organizer" aria-label="Batch organizer">
      <div className="batch-organizer-heading">
        <div>
          <strong>Batch organizer</strong>
          <span>
            {series.length} series group{series.length === 1 ? '' : 's'} from {totalItems} preview item{totalItems === 1 ? '' : 's'}
          </span>
        </div>
        <div className="batch-heading-actions">
          <small>Series folders are used for direct TikTok downloads.</small>
          <div className="batch-mode-field">
            <label htmlFor="batch-file-name-mode">Episode file names</label>
            <select
              id="batch-file-name-mode"
              className="select-input"
              value={batchFileNameMode}
              onChange={(event) => onSetBatchFileNameMode(event.target.value as BatchFileNameMode)}
              title="Direct TikTok file naming"
            >
              <option value="episodeOnly">Episode numbers only</option>
              <option value="fullTitle">Series + episode title</option>
            </select>
            <span className="batch-mode-example">Example: {fileNameExample}</span>
          </div>
          <select
            className="select-input"
            value={batchOrder}
            onChange={(event) => onSetBatchOrder(event.target.value as BatchOrderMode)}
          >
            <option value="asScanned">As scanned</option>
            <option value="reverse">Reverse order</option>
            <option value="episodeNumber">Sort by episode</option>
          </select>
          <button
            className="secondary-button"
            type="button"
            onClick={onOrganizeWithAi}
            disabled={isOrganizing || !aiReady}
          >
            {isOrganizing ? <Loader2 className="spin" /> : <RefreshCw />}
            <span>{isOrganizing ? 'Organizing...' : 'Organize with AI'}</span>
          </button>
          <button className="secondary-button" type="button" onClick={copyAiPrompt}>
            <FileText />
            <span>{copiedPrompt ? 'Copied' : 'Copy AI prompt'}</span>
          </button>
        </div>
      </div>

      <div className="batch-series-list">
        {series.map((group, groupIndex) => {
          const selectedCount = group.items.filter((entry) => selectedKeys.has(entry.key)).length
          const checked = selectedCount === group.items.length
          const indeterminate = selectedCount > 0 && selectedCount < group.items.length
          return (
            <article className="batch-series" key={group.id}>
              <div className="batch-series-top">
                <div className="batch-series-title-row">
                  <SeriesCheckbox
                    checked={checked}
                    indeterminate={indeterminate}
                    label={`Select series ${groupIndex + 1}`}
                    onChange={() => checked ? onClearSeries(group) : onSelectSeries(group)}
                  />
                  <div className="field-block compact">
                    <label>Series {groupIndex + 1}</label>
                    <input
                      className="text-input"
                      value={group.title}
                      onChange={(event) => onRenameSeries(group, event.target.value)}
                    />
                  </div>
                </div>
                <div className="batch-series-actions">
                  <span>
                    {selectedCount}/{group.items.length} selected
                  </span>
                  <button className="secondary-button" type="button" onClick={() => onSelectSeries(group)}>
                    <CheckCircle2 />
                    <span>Select</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={() => onClearSeries(group)}>
                    <X />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="episode-table">
                {group.items.slice(0, 8).map((entry, index) => {
                  const previous = group.items[index - 1]
                  const outOfOrder = Boolean(previous && entry.episodeNumber <= previous.episodeNumber)
                  return (
                    <div
                      className={`episode-row${entry.item.isPinned ? ' pinned' : ''}${outOfOrder ? ' out-of-order' : ''}`}
                      key={entry.key}
                    >
                      <Thumbnail src={entry.item.thumbnail} />
                      <label>
                        <span>EP</span>
                        <input
                          className="number-input"
                          type="number"
                          min={1}
                          value={entry.episodeNumber}
                          onChange={(event) =>
                            onUpdateItem(entry.key, {
                              episodeNumber: Math.max(1, Number(event.target.value) || entry.episodeNumber),
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Title</span>
                        <input
                          className="text-input"
                          value={entry.episodeTitle}
                          onChange={(event) =>
                            onUpdateItem(entry.key, { episodeTitle: event.target.value })
                          }
                        />
                      </label>
                      <small>
                        {entry.item.isPinned ? 'Pinned - ' : ''}
                        {outOfOrder ? 'Check order - ' : ''}
                        {entry.outputTitle}
                      </small>
                    </div>
                  )
                })}
                {group.items.length > 8 && (
                  <div className="episode-more">
                    + {group.items.length - 8} more episode{group.items.length - 8 === 1 ? '' : 's'} in this series
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function MetadataCard({
  coverPath,
  isSavingCover,
  isSelected,
  item,
  onSaveCover,
  onToggle,
  onViewCover,
  isPendingSubtitleRepair,
  isMissingSubtitle,
}: {
  coverPath?: string
  isSavingCover: boolean
  isSelected: boolean
  item: MetadataPreview
  onSaveCover: (item: MetadataPreview) => void
  onToggle: (item: MetadataPreview) => void
  onViewCover: (item: MetadataPreview) => void
  isPendingSubtitleRepair?: boolean
  isMissingSubtitle?: boolean
}) {
  return (
    <article className={isSelected ? 'metadata-card selected' : 'metadata-card'}>
      <label className="part-check">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(item)}
        />
      </label>
      <Thumbnail src={item.thumbnail} />
      <div>
        <div className="metadata-heading">
          <strong>{displayPartTitle(item)}</strong>
          <span>{item.platform}</span>
        </div>
        {item.playlistTitle && (
          <div className="playlist-row">
            {item.playlistTitle}
            {item.playlistIndex && item.playlistCount
              ? ` - Part ${item.playlistIndex}/${item.playlistCount}`
              : ''}
          </div>
        )}
        <div className="metadata-grid">
          <span>{item.duration ? formatDuration(item.duration) : 'Duration unknown'}</span>
          <span>{item.uploader || 'Uploader unknown'}</span>
          <span>{formatResolution(item)}</span>
          <span>{item.formatCount} formats</span>
        </div>
        <div className="codec-row">
          <span>V: {formatCodecs(item.videoCodecs)}</span>
          <span>A: {formatCodecs(item.audioCodecs)}</span>
        </div>
        <div className="recommend-row">Recommended: {item.recommendedPreset}</div>
        <div className="cover-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onViewCover(item)}
            disabled={!item.thumbnail && !coverPath}
          >
            <FileText />
            <span>View cover</span>
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onSaveCover(item)}
            disabled={!item.thumbnail || isSavingCover}
          >
            {isSavingCover ? <Loader2 className="spin" /> : <Download />}
            <span>{coverPath ? 'Save again' : 'Save cover'}</span>
          </button>
          {coverPath && <span className="cover-saved">Saved</span>}
        </div>
        {item.warning && <small>{item.warning}</small>}
        {isPendingSubtitleRepair && (
          <div className="subtitle-repair-warning">
            <ShieldAlert />
            <span>Subtitle recovery pending after re-scan.</span>
          </div>
        )}
        {isMissingSubtitle && (
          <div className="subtitle-repair-warning">
            <ShieldAlert />
            <span>Missing subtitle sidecar. Selected for re-scan.</span>
          </div>
        )}
      </div>
    </article>
  )
}

function SeriesCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  label: string
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <label className="series-check" title={label}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
    </label>
  )
}

function CoverModal({
  viewer,
  onClose,
}: {
  viewer: CoverViewer
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="cover-modal" onClick={onClose}>
      <div className="cover-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="cover-dialog-bar">
          <div>
            <strong>{viewer.title}</strong>
            {viewer.path && <span>{viewer.path}</span>}
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close cover preview">
            <X />
          </button>
        </div>
        <div className="cover-image-stage">
          <img src={viewer.src} alt="" />
        </div>
      </div>
    </div>
  )
}

function Thumbnail({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="thumb-empty">
        <span>No preview</span>
      </div>
    )
  }

  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function JobItem({
  job,
  onCancel,
  onOpen,
  onReveal,
  onConvert,
}: {
  job: DownloadJob
  onCancel: (jobId: string) => void
  onOpen: (path: string) => void
  onReveal: (path: string) => void
  onConvert: (jobId: string, path: string) => void
}) {
  const active = ['queued', 'starting', 'running', 'warning'].includes(job.status)
  const canConvert =
    job.outputPath &&
    job.mediaReport &&
    !job.mediaReport.quicktimeCompatible &&
    job.status === 'completed'

  const label = job.titles?.[0] || job.urls[0]
  const extraCount = Math.max((job.titles?.length || job.urls.length) - 1, 0)
  const visibleLogs = job.logs.filter(Boolean)

  return (
    <article className={`job-item ${job.status}`}>
      <div className="job-main">
        <div>
          <strong>{label}</strong>
          {extraCount > 0 && <span>+ {extraCount} more</span>}
        </div>
        <small>{job.status}</small>
      </div>

      <JobBatchSummary job={job} />

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(job.percent ?? 0, 100)}%` }}
        />
      </div>

      <div className="job-meta">
        <span>{job.percent ? `${job.percent.toFixed(1)}%` : 'Waiting'}</span>
        <span>{job.speed || 'Speed pending'}</span>
        <span>{job.eta ? `ETA ${job.eta}` : 'ETA pending'}</span>
      </div>

      <div className="job-log-panel">
        <div className="job-log-header">
          <span>Activity log</span>
          <small>{visibleLogs.length} lines</small>
        </div>
        <pre>{visibleLogs.slice(-6).join('\n') || statusLabel(job.status)}</pre>
      </div>

      {job.mediaReport && (
        <div className={job.mediaReport.quicktimeCompatible ? 'media-report ok' : 'media-report warn'}>
          <strong>
            {job.mediaReport.videoCodec || 'no video'} / {job.mediaReport.audioCodec || 'no audio'}
          </strong>
          <span>
            {job.mediaReport.width && job.mediaReport.height
              ? `${job.mediaReport.width}x${job.mediaReport.height}`
              : 'Resolution unknown'}{' '}
            {job.mediaReport.fileSize ? `- ${formatBytes(job.mediaReport.fileSize)}` : ''}
          </span>
          {job.mediaReport.warning && <small>{job.mediaReport.warning}</small>}
        </div>
      )}

      {job.outputPath && (
        <div className="job-actions">
          <button className="secondary-button" type="button" onClick={() => onOpen(job.outputPath!)}>
            <FileText />
            <span>Open</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => onReveal(job.outputPath!)}>
            <FolderOpen />
            <span>Folder</span>
          </button>
          {canConvert && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => onConvert(job.id, job.outputPath!)}
              disabled={job.converting}
            >
              {job.converting ? <Loader2 className="spin" /> : <RefreshCw />}
              <span>Convert H.264</span>
            </button>
          )}
        </div>
      )}

      {active && !job.id.startsWith('queued-') && (
        <button className="cancel-button" type="button" onClick={() => onCancel(job.id)}>
          <Square />
          <span>Cancel</span>
        </button>
      )}
    </article>
  )
}

function JobBatchSummary({ job }: { job: DownloadJob }) {
  const summary = summarizeJobActivity(job.logs)
  const batchCount = summary.totalItems && summary.currentItem
    ? `${summary.currentItem}/${summary.totalItems} clips`
    : job.urls.length > 1
      ? `${job.urls.length} URLs queued`
      : 'Single video'
  const progress =
    summary.totalItems && summary.currentItem
      ? Math.min((summary.currentItem / summary.totalItems) * 100, 100)
      : undefined
  const sourceLabel =
    summary.playlistTitle ||
    summary.activeTitle ||
    summary.lastMeaningfulLine ||
    'Waiting for activity...'

  return (
    <div className="job-batch-summary">
      <div className="job-batch-top">
        <strong>{batchCount}</strong>
        <span>{sourceLabel}</span>
      </div>
      {progress !== undefined && (
        <div className="job-batch-track" aria-label="Batch progress">
          <div className="job-batch-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function formatCodecs(codecs: string[]) {
  return codecs.length > 0 ? codecs.slice(0, 4).join(', ') : 'unknown'
}

function appendJobLog(logs: string[], rawLine: string) {
  const line = cleanJobLogLine(rawLine)
  if (!line) return logs
  if (logs[logs.length - 1] === line) return logs
  return [...logs.slice(-80), line]
}

function cleanJobLogLine(line: string) {
  const value = line.trim()
  if (!value) return ''
  if (value.startsWith('yt-dlp ') || value.includes('--progress-template')) {
    return ''
  }
  if (value.startsWith('[debug]')) {
    return ''
  }
  if (value.startsWith('[download] Destination:')) {
    return `Saving: ${value.replace('[download] Destination:', '').trim()}`
  }
  if (value.startsWith('[download] Downloading item')) {
    return value.replace('[download] ', '')
  }
  if (value.startsWith('[direct] ')) {
    return value.replace('[direct] ', '')
  }
  return value
}

function statusLabel(status: JobStatus) {
  if (status === 'completed') return 'Download completed.'
  if (status === 'failed') return 'Download failed.'
  if (status === 'queued') return 'Waiting to start.'
  if (status === 'starting') return 'Starting download...'
  if (status === 'running') return 'Downloading...'
  if (status === 'canceled') return 'Download canceled.'
  return 'Working...'
}

type JobActivitySummary = {
  totalItems?: number
  currentItem?: number
  playlistTitle?: string
  activeTitle?: string
  lastMeaningfulLine?: string
}

function summarizeJobActivity(logs: string[]): JobActivitySummary {
  const summary: JobActivitySummary = {}

  for (const rawLine of logs) {
    const line = rawLine.trim()
    if (!line) continue

    const playlistMatch = line.match(/^\[download\] Downloading playlist: (.+)$/)
    if (playlistMatch) {
      summary.playlistTitle = playlistMatch[1]
    }

    const itemMatch = line.match(/^\[download\] Downloading item (\d+) of (\d+)$/)
    if (itemMatch) {
      summary.currentItem = Number(itemMatch[1])
      summary.totalItems = Number(itemMatch[2])
    }

    const destinationMatch = line.match(/^\[download\] Destination: (.+)$/)
    if (destinationMatch) {
      summary.activeTitle = destinationMatch[1]
    }

    const youtubeMatch = line.match(/^\[youtube\] ([^:]+): Downloading webpage$/)
    if (youtubeMatch && !summary.activeTitle) {
      summary.activeTitle = youtubeMatch[1]
    }

    if (!line.startsWith('[debug]')) {
      summary.lastMeaningfulLine = line
    }
  }

  return summary
}

function collectUrlsFromText(text: string) {
  const matches = text.match(
    /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>"'`]+)?/gi,
  ) || []

  const urls: string[] = []
  const seen = new Set<string>()

  for (const match of matches) {
    const normalized = normalizeUrlCandidate(match)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    urls.push(normalized)
  }

  return urls
}

function mergeUrlText(current: string, incoming: string[]) {
  const currentUrls = collectUrlsFromText(current)
  const merged = [...currentUrls]
  const seen = new Set(currentUrls)

  for (const value of incoming) {
    const normalized = normalizeUrlCandidate(value)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      merged.push(normalized)
    }
  }

  return merged.join('\n')
}

function metadataFromResolvedMedia(item: ResolvedMediaItem): MetadataPreview {
  const warning = [
    'Resolved from your Chrome TikTok session. Download soon because signed media URLs can expire.',
    item.isPinned ? 'This item appears pinned on the profile and may be out of chronological order.' : '',
  ].filter(Boolean).join(' ')

  return {
    url: item.sourceUrl,
    sourceUrl: item.sourceUrl,
    dramaId: item.dramaId,
    seriesName: item.seriesName,
    episodeNumber: item.episodeNumber,
    title: item.title || item.sourceUrl,
    thumbnail: item.thumbnail,
    duration: item.duration,
    uploader: item.uploader,
    platform: 'TikTok',
    webpageUrl: item.pageUrl,
    formatCount: 1,
    bestWidth: item.width,
    bestHeight: item.height,
    recommendedPreset: item.videoCodec === 'h264' ? 'Direct MP4' : 'Direct media',
    videoCodecs: item.videoCodec ? [item.videoCodec] : [],
    audioCodecs: item.audioCodec ? [item.audioCodec] : ['aac'],
    requiresSession: false,
    warning,
    directMediaUrl: item.mediaUrl,
    subtitleUrl: item.subtitles?.[0]?.url,
    isPinned: item.isPinned,
    cookieHeader: item.cookieHeader,
  }
}

function mergeMetadataPreviews(current: MetadataPreview[], incoming: MetadataPreview[]) {
  if (incoming.length === 0) return current

  const merged = [...current]
  const indexes = new Map(current.map((item, index) => [previewKey(item), index]))

  for (const item of incoming) {
    const key = previewKey(item)
    const existingIndex = indexes.get(key)
    if (existingIndex === undefined) {
      indexes.set(key, merged.length)
      merged.push(item)
    } else {
      merged[existingIndex] = item
    }
  }

  return merged
}

function directDownloadItemFromMetadata(
  item: MetadataPreview,
  organized?: OrganizedBatchItem,
  fileNameMode: BatchFileNameMode = 'episodeOnly',
): DirectDownloadItem {
  const episodeNumber = organized?.episodeNumber || item.episodeNumber
  const outputFilename =
    fileNameMode === 'episodeOnly' && episodeNumber
      ? String(episodeNumber)
      : organized?.outputTitle

  return {
    sourceUrl: item.sourceUrl,
    pageUrl: item.webpageUrl || item.url,
    mediaUrl: item.directMediaUrl || '',
    dramaId: item.dramaId,
    seriesName: item.seriesName,
    episodeNumber,
    title: organized?.outputTitle || displayPartTitle(item),
    uploader: item.uploader,
    duration: item.duration,
    thumbnail: item.thumbnail,
    videoCodec: item.videoCodecs[0],
    audioCodec: item.audioCodecs[0],
    width: item.bestWidth,
    height: item.bestHeight,
    subtitles: item.subtitleUrl ? [{ url: item.subtitleUrl }] : [],
    outputFolder: organized?.seriesTitle,
    outputFilename,
    cookieHeader: item.cookieHeader,
  }
}

function organizeMetadataBatch(
  metadata: MetadataPreview[],
  edits: Record<string, BatchItemEdit>,
  order: BatchOrderMode,
): OrganizedSeries[] {
  if (
    metadata.length > 0 &&
    metadata.every((item) => Boolean(item.seriesName?.trim()) && item.episodeNumber !== undefined)
  ) {
    const groups: OrganizedSeries[] = []
    const orderedMetadata = orderMetadataForBatch(metadata, edits, order)

    orderedMetadata.forEach((item, index) => {
      const key = previewKey(item)
      const edit = edits[key] || {}
      const suggested = suggestBatchItem(item, index)
      const seriesTitle = edit.seriesTitle?.trim() || item.seriesName?.trim() || suggested.seriesTitle || item.uploader || 'TikTok Series'
      const episodeNumber = edit.episodeNumber || item.episodeNumber || suggested.episodeNumber || index + 1
      const episodeTitle = edit.episodeTitle ?? suggested.episodeTitle ?? `Episode ${padEpisodeNumber(episodeNumber)}`
      const outputTitle = buildEpisodeOutputTitle(seriesTitle, episodeNumber, episodeTitle)
      const entry: OrganizedBatchItem = {
        item,
        key,
        seriesTitle,
        episodeNumber,
        episodeTitle,
        suggested,
        outputTitle,
      }
      const groupId = normalizeGroupingKey(seriesTitle)
      const group = groups.find((existing) => existing.id === groupId)
      if (group) {
        group.items.push(entry)
      } else {
        groups.push({
          id: groupId,
          title: seriesTitle,
          items: [entry],
        })
      }
    })

    return groups
  }

  const groups: OrganizedSeries[] = []
  const orderedMetadata = orderMetadataForBatch(metadata, edits, order)
  let currentFallbackGroup = 0
  let previousEpisode = 0
  let previousSeriesTitle = ''

  orderedMetadata.forEach((item, index) => {
    const key = previewKey(item)
    const edit = edits[key] || {}
    const suggested = suggestBatchItem(item, index)
    const editedSeriesTitle = edit.seriesTitle?.trim()
    const hasExplicitSeries =
      Boolean(editedSeriesTitle) ||
      Boolean(item.playlistTitle?.trim()) ||
      Boolean(suggested.seriesTitle && !isEpisodeOnlyTitle(item.title || ''))
    const episodeNumber = edit.episodeNumber || suggested.episodeNumber || index + 1
    let seriesTitle = editedSeriesTitle || suggested.seriesTitle || item.uploader || 'TikTok Series'

    if (!hasExplicitSeries) {
      if (episodeNumber <= previousEpisode && previousEpisode > 1) {
        currentFallbackGroup += 1
      }
      seriesTitle = `${item.uploader || 'TikTok Series'} ${currentFallbackGroup + 1}`
    } else if (seriesTitle !== previousSeriesTitle) {
      previousSeriesTitle = seriesTitle
    }

    const episodeTitle = edit.episodeTitle ?? suggested.episodeTitle ?? `Episode ${padEpisodeNumber(episodeNumber)}`
    const outputTitle = buildEpisodeOutputTitle(seriesTitle, episodeNumber, episodeTitle)
    const entry: OrganizedBatchItem = {
      item,
      key,
      seriesTitle,
      episodeNumber,
      episodeTitle,
      suggested,
      outputTitle,
    }
    const groupId = normalizeGroupingKey(seriesTitle)
    const group = groups.find((existing) => existing.id === groupId)
    if (group) {
      group.items.push(entry)
    } else {
      groups.push({
        id: groupId,
        title: seriesTitle,
        items: [entry],
      })
    }

    previousEpisode = episodeNumber
    previousSeriesTitle = seriesTitle
  })

  return groups
}

function orderMetadataForBatch(
  metadata: MetadataPreview[],
  edits: Record<string, BatchItemEdit>,
  order: BatchOrderMode,
) {
  if (order === 'asScanned') return metadata
  if (order === 'reverse') return [...metadata].reverse()

  return [...metadata].sort((left, right) => {
    const leftKey = previewKey(left)
    const rightKey = previewKey(right)
    const leftEpisode =
      edits[leftKey]?.episodeNumber || suggestBatchItem(left, metadata.indexOf(left)).episodeNumber || Number.MAX_SAFE_INTEGER
    const rightEpisode =
      edits[rightKey]?.episodeNumber || suggestBatchItem(right, metadata.indexOf(right)).episodeNumber || Number.MAX_SAFE_INTEGER
    if (leftEpisode !== rightEpisode) return leftEpisode - rightEpisode
    return metadata.indexOf(left) - metadata.indexOf(right)
  })
}

function suggestBatchItem(item: MetadataPreview, index: number): BatchItemEdit {
  const rawTitle = item.title?.trim() || displayPartTitle(item)
  const episodeNumber = item.episodeNumber || inferEpisodeNumber(rawTitle) || item.playlistIndex || index + 1
  const stripped = stripEpisodeMarker(rawTitle).trim()
  const seriesTitle = item.seriesName?.trim() || item.playlistTitle?.trim() || inferSeriesTitle(rawTitle, item.uploader)
  const episodeTitle = stripped && stripped !== seriesTitle ? stripped : `Episode ${padEpisodeNumber(episodeNumber)}`

  return {
    seriesTitle,
    episodeNumber,
    episodeTitle,
  }
}

function inferEpisodeNumber(title: string) {
  const patterns = [
    /\b(?:ep|eps|episode|episodio|episódio|tap|tập|part|p)[\s._:-]*(\d{1,4})\b/i,
    /[#№]\s*(\d{1,4})\b/i,
    /\b(\d{1,4})\s*\/\s*\d{1,4}\b/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) return Number(match[1])
  }

  const numericOnly = title.match(/^\D*(\d{1,4})\D*$/)
  return numericOnly ? Number(numericOnly[1]) : undefined
}

function inferSeriesTitle(title: string, uploader?: string) {
  const stripped = stripEpisodeMarker(title).trim()
  if (stripped && !isEpisodeOnlyTitle(stripped)) {
    return stripped
  }
  return uploader || 'TikTok Series'
}

function stripEpisodeMarker(title: string) {
  return title
    .replace(/\b(?:ep|eps|episode|episodio|episódio|tap|tập|part|p)[\s._:-]*\d{1,4}\b/gi, '')
    .replace(/[#№]\s*\d{1,4}\b/gi, '')
    .replace(/\b\d{1,4}\s*\/\s*\d{1,4}\b/gi, '')
    .replace(/\s*[-_|:]\s*$/g, '')
    .replace(/^\s*[-_|:]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
}

function isEpisodeOnlyTitle(title: string) {
  return /^(?:ep|eps|episode|episodio|episódio|tap|tập|part|p)?[\s._:-]*\d{1,4}$/i.test(title.trim())
}

function buildEpisodeOutputTitle(seriesTitle: string, episodeNumber: number, episodeTitle: string) {
  const episodeLabel = `EP${padEpisodeNumber(episodeNumber)}`
  const cleanEpisodeTitle = episodeTitle.trim()
  if (!cleanEpisodeTitle || cleanEpisodeTitle === episodeLabel) {
    return `${seriesTitle} - ${episodeLabel}`
  }
  return `${seriesTitle} - ${episodeLabel} - ${cleanEpisodeTitle}`
}

function padEpisodeNumber(value: number) {
  return String(Math.max(1, value)).padStart(3, '0')
}

function normalizeGroupingKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ') || 'unsorted'
}

function buildBatchAiPrompt(series: OrganizedSeries[]) {
  const rows = series.flatMap((group, groupIndex) =>
    group.items.map((entry, itemIndex) =>
      [
        `scanOrder=${groupIndex + 1}.${itemIndex + 1}`,
        `currentSeries="${group.title}"`,
        `episode=${entry.episodeNumber}`,
        `title="${entry.item.title || ''}"`,
        `suggestedOutput="${entry.outputTitle}"`,
        `url="${entry.item.webpageUrl || entry.item.url}"`,
      ].join(' | '),
    ),
  )

  return [
    'Bạn là trợ lý tổ chức batch video Short Drama.',
    'Hãy chia các item dưới đây thành từng bộ phim/series và đánh số tập theo đúng thứ tự hiển thị.',
    'Nếu title chỉ là EP/tập/số, hãy dựa vào scanOrder và điểm số tập reset để tách bộ.',
    'Trả về JSON duy nhất theo schema:',
    '[{"seriesTitle":"Tên bộ","episodes":[{"url":"...","episodeNumber":1,"episodeTitle":"Tên tập hoặc để rỗng"}]}]',
    '',
    rows.join('\n'),
  ].join('\n')
}

function refineAiBatchResult(result: AiBatchResult, inputItems: AiBatchInputItem[]): AiBatchResult {
  if (result.series.length !== 1 || inputItems.length < 2) {
    return result
  }

  const hints = new Map<string, AiBatchInputItem[]>()
  inputItems.forEach((item) => {
    const hint = item.ruleSeriesHint || item.namePattern || item.uploader || 'Unknown Series'
    if (!hints.has(hint)) hints.set(hint, [])
    hints.get(hint)!.push(item)
  })

  const meaningfulHints = Array.from(hints.entries()).filter(
    ([hint, items]) => !/^unknown series$/i.test(hint) && items.length > 0,
  )
  if (meaningfulHints.length <= 1) {
    return result
  }

  return {
    series: meaningfulHints.map(([hint, items]) => ({
      seriesTitle: hint,
      episodes: items.map((item, index) => ({
        key: item.key,
        url: item.url,
        episodeNumber: item.episodeNumber || index + 1,
        episodeTitle: stripEpisodeMarker(item.title).trim(),
      })),
    })),
  }
}

function inferTitlePattern(title: string) {
  const value = title.trim()
  if (/_batch(?:\.mp4)?$/i.test(value) || /^\d+_batch(?:\.mp4)?$/i.test(value)) {
    return 'number_batch'
  }
  if (/\bepis[oó]dio\b/i.test(value)) {
    return 'episodio_number'
  }
  if (/[\u3400-\u9fff]/.test(value)) {
    return 'chinese_title'
  }
  if (isEpisodeOnlyTitle(value)) {
    return 'episode_only'
  }
  return 'descriptive_title'
}

function inferRuleSeriesHint(title: string, uploader?: string) {
  const value = title.trim()
  const batchMatch = value.match(/^(\d+)_batch(?:\.mp4)?$/i)
  if (batchMatch) {
    return 'Batch clips'
  }

  const chineseMatch = value.match(/^(.+?)(?:[_\s-]*(?:中巴葡)?[_\s-]*\d+)?$/)
  if (chineseMatch && /[\u3400-\u9fff]/.test(chineseMatch[1])) {
    return chineseMatch[1].replace(/[_\s-]+$/g, '')
  }

  if (/\bepis[oó]dio\b/i.test(value)) {
    return `${uploader || 'TikTok'} Episódio Series`
  }

  if (isEpisodeOnlyTitle(value)) {
    return `${uploader || 'TikTok'} Numbered Series`
  }

  const stripped = stripEpisodeMarker(value).trim()
  return stripped || `${uploader || 'TikTok'} Series`
}

function normalizeUrlCandidate(value: string) {
  const trimmed = value
    .trim()
    .replace(/^[<('"\u005b\s]+/, '')
    .replace(/[>)"'\u005d\s,.;!?，。！？；、]+$/, '')

  if (!trimmed) {
    return ''
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
    return normalizeYoutubeWatchUrl(trimmed)
  }

  if (trimmed.startsWith('//')) {
    return normalizeYoutubeWatchUrl(`https:${trimmed}`)
  }

  if (looksLikeBareUrl(trimmed)) {
    return normalizeYoutubeWatchUrl(`https://${trimmed}`)
  }

  return trimmed
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms)
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timer))
  })
}

function looksLikeBareUrl(value: string) {
  return /^((?:[\w-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#]|$)/i.test(value)
}

function normalizeYoutubeWatchUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const isYoutubeWatch =
      ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host) &&
      parsed.pathname === '/watch'

    if (!isYoutubeWatch || !parsed.searchParams.has('v')) {
      return value
    }

    for (const key of ['list', 'index', 'start_radio', 'pp']) {
      parsed.searchParams.delete(key)
    }

    return parsed.toString()
  } catch {
    return value
  }
}

function previewKey(item: MetadataPreview) {
  return `${item.sourceUrl}::${item.playlistIndex ?? 0}::${item.url}`
}

function displayPartTitle(item: MetadataPreview) {
  const title = item.title || item.url
  if (!item.playlistIndex || !item.playlistCount || item.playlistCount <= 1) {
    return title
  }

  return `P${item.playlistIndex}. ${title}`
}

function readBrowserSettings(): AppSettings {
  const text = localStorage.getItem('bilibili-downloader-settings')
  if (!text) return defaultSettings

  try {
    return { ...defaultSettings, ...JSON.parse(text) }
  } catch {
    return defaultSettings
  }
}

function normalizeCookieProfiles(settings: AppSettings): Record<string, CookieProfile> {
  const profiles: Record<string, CookieProfile> = {}

  Object.entries(settings.cookieProfiles || {}).forEach(([key, profile]) => {
    profiles[key] = {
      mode: isCookieMode(profile.mode) ? profile.mode : 'none',
      manualCookiePath: profile.manualCookiePath || '',
    }
  })

  if (
    !profiles.bilibili &&
    isCookieMode(settings.cookieMode) &&
    settings.cookieMode !== 'none'
  ) {
    profiles.bilibili = {
      mode: settings.cookieMode,
      manualCookiePath: settings.manualCookiePath || '',
    }
  }

  return profiles
}

function getCookieProfile(
  profiles: Record<string, CookieProfile>,
  platformKey: PlatformKey,
) {
  return profiles[platformKey] || defaultCookieProfile
}

function cookieProfileReady(profile: CookieProfile) {
  return profile.mode === 'chrome' || (profile.mode === 'manual' && Boolean(profile.manualCookiePath))
}

function isCookieMode(value: string): value is CookieMode {
  return ['none', 'chrome', 'manual'].includes(value)
}

function isDownloadPreset(value: string): value is DownloadPreset {
  return ['compatibleMp4', 'bestQuality', 'audioOnly', 'videoOnly', 'originalCodec'].includes(value)
}

function isSubtitleMode(value: string): value is SubtitleMode {
  return ['off', 'subtitles', 'auto', 'both'].includes(value)
}

function isSubtitleFormat(value: string): value is SubtitleFormat {
  return ['srt', 'vtt'].includes(value)
}

function isDanmakuFormat(value: string): value is DanmakuFormat {
  return ['none', 'xml', 'ass'].includes(value)
}

function isBatchFileNameMode(value: string): value is BatchFileNameMode {
  return ['episodeOnly', 'fullTitle'].includes(value)
}

function formatResolution(item: MetadataPreview) {
  if (item.bestWidth && item.bestHeight) return `${item.bestWidth}x${item.bestHeight}`
  if (item.bestHeight) return `${item.bestHeight}p`
  return 'Resolution unknown'
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export default App
