import { platformForUrl, type NativeResponse } from './protocol.js'

const titleElement = document.querySelector<HTMLElement>('#title')!
const urlElement = document.querySelector<HTMLElement>('#url')!
const platformElement = document.querySelector<HTMLElement>('#platform')!
const statusElement = document.querySelector<HTMLElement>('#status')!
const sendButton = document.querySelector<HTMLButtonElement>('#send')!
const scanButton = document.querySelector<HTMLButtonElement>('#scan')!
const scanDramaButton = document.querySelector<HTMLButtonElement>('#scan-drama')!
const downloadSeriesButton = document.querySelector<HTMLButtonElement>('#download-series')!
const runPendingButton = document.querySelector<HTMLButtonElement>('#run-pending')!
const scanOptionsElement = document.querySelector<HTMLElement>('#scan-options')!
const scanLimitElement = document.querySelector<HTMLSelectElement>('#scan-limit')!
const scanModeElement = document.querySelector<HTMLSelectElement>('#scan-mode')!
const languageElement = document.querySelector<HTMLSelectElement>('#language')!
const scanModeLabel = document.querySelector<HTMLElement>('#scan-mode-label')!
const scanLimitLabel = document.querySelector<HTMLElement>('#scan-limit-label')!
const helperTextElement = document.querySelector<HTMLElement>('#helper-text')!

let activeTab: chrome.tabs.Tab | undefined
type PopupLanguage = 'en' | 'vi'

const popupCopy = {
  en: {
    language: 'Language',
    checkingCurrentTab: 'Checking current tab...',
    currentPage: 'Current page',
    cannotSendPage: 'This Chrome page cannot be sent.',
    bilibiliDetected: 'BiliBili detected',
    douyinDetected: 'Douyin detected',
    tiktokDetected: 'TikTok detected',
    webPage: 'Web page',
    unsupportedPage: 'This Chrome page does not provide a downloadable URL.',
    tiktokProfileReady: 'This TikTok profile can be scanned and resolved into direct media links.',
    ready: 'Ready to send this page to the desktop app.',
    scanMode: 'Scan mode',
    scanLimit: 'Scan limit',
    scanModes: {
      safe: 'Safe recommended',
      slow: 'Slow cautious',
      fast: 'Fast',
    },
    allVisibleVideos: 'All visible videos',
    videos: 'videos',
    openInVideoGet: 'Open in VideoGET',
    openingVideoGet: 'Opening VideoGET...',
    connectingDesktop: 'Connecting to the desktop app...',
    noWorker: 'Could not contact the extension service worker.',
    noResponse: 'SOREVID VideoGET did not return a response.',
    scanTikTokProfile: 'Scan TikTok Profile',
    scanningTikTok: 'Scanning TikTok...',
    scanShortDrama: 'Scan Short Drama',
    scanningShortDrama: 'Scanning Short Drama...',
    downloadFullSeries: 'Download Full Series',
    downloadingSeries: 'Downloading Series...',
    collectingLinks: 'Collecting video links and resolving signed media URLs...',
    runPendingRepairs: 'Run pending repairs',
    checkingRepairs: 'Checking repairs...',
    checkingPending: 'Checking pending subtitle repairs with the desktop app...',
    noPendingResponse: 'SOREVID VideoGET did not return a response for pending repairs.',
    helper: 'SOREVID VideoGET will open and fill the URL. Review your download options there.',
  },
  vi: {
    language: 'Ngôn ngữ',
    checkingCurrentTab: 'Đang kiểm tra tab hiện tại...',
    currentPage: 'Trang hiện tại',
    cannotSendPage: 'Trang Chrome này không thể gửi được.',
    bilibiliDetected: 'Đã nhận diện BiliBili',
    douyinDetected: 'Đã nhận diện Douyin',
    tiktokDetected: 'Đã nhận diện TikTok',
    webPage: 'Trang web',
    unsupportedPage: 'Trang Chrome này không có URL có thể tải.',
    tiktokProfileReady: 'Profile TikTok này có thể quét và resolve thành link media trực tiếp.',
    ready: 'Sẵn sàng gửi trang này sang app desktop.',
    scanMode: 'Chế độ quét',
    scanLimit: 'Giới hạn quét',
    scanModes: {
      safe: 'An toàn khuyến nghị',
      slow: 'Chậm cẩn thận',
      fast: 'Nhanh',
    },
    allVisibleVideos: 'Tất cả video đang thấy',
    videos: 'video',
    openInVideoGet: 'Mở trong VideoGET',
    openingVideoGet: 'Đang mở VideoGET...',
    connectingDesktop: 'Đang kết nối app desktop...',
    noWorker: 'Không liên hệ được service worker của extension.',
    noResponse: 'SOREVID VideoGET không trả về phản hồi.',
    scanTikTokProfile: 'Quét Profile TikTok',
    scanningTikTok: 'Đang quét TikTok...',
    scanShortDrama: 'Quét Short Drama',
    scanningShortDrama: 'Đang quét Short Drama...',
    downloadFullSeries: 'Tải trọn bộ',
    downloadingSeries: 'Đang tải series...',
    collectingLinks: 'Đang thu thập link video và resolve URL media đã ký...',
    runPendingRepairs: 'Chạy sửa lỗi đang chờ',
    checkingRepairs: 'Đang kiểm tra sửa lỗi...',
    checkingPending: 'Đang kiểm tra phụ đề cần sửa với app desktop...',
    noPendingResponse: 'SOREVID VideoGET không trả về phản hồi cho tác vụ sửa lỗi đang chờ.',
    helper: 'SOREVID VideoGET sẽ mở và điền URL. Hãy kiểm tra tùy chọn tải trong app.',
  },
} as const

let language: PopupLanguage = 'en'
let copy: (typeof popupCopy)[PopupLanguage] = popupCopy.en

void loadLanguage()

languageElement.addEventListener('change', () => {
  language = languageElement.value === 'vi' ? 'vi' : 'en'
  copy = popupCopy[language]
  saveLanguage(language)
  applyStaticCopy()
  renderActiveTab()
})

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  activeTab = tab
  renderActiveTab()
})

async function loadLanguage() {
  language = await readLanguage()
  copy = popupCopy[language]
  languageElement.value = language
  applyStaticCopy()
  renderActiveTab()
}

function renderActiveTab() {
  if (!activeTab) {
    applyStaticCopy()
    return
  }
  const tab = activeTab
  const url = tab?.url || ''
  titleElement.textContent = tab?.title || copy.currentPage
  urlElement.textContent = url || copy.cannotSendPage
  urlElement.title = url
  const platform = platformForUrl(url)
  const isTikTokProfile = platform === 'tiktok' && isTikTokProfileUrl(url)
  const isTikTokVideo = platform === 'tiktok' && isTikTokVideoUrl(url)
  platformElement.textContent =
    platform === 'bilibili'
      ? copy.bilibiliDetected
      : platform === 'douyin'
        ? copy.douyinDetected
        : platform === 'tiktok'
          ? copy.tiktokDetected
          : copy.webPage
  sendButton.disabled = !/^https?:/i.test(url)
  scanButton.hidden = !isTikTokProfile
  scanDramaButton.hidden = !isTikTokProfile
  downloadSeriesButton.hidden = !isTikTokVideo
  scanOptionsElement.hidden = !isTikTokProfile
  if (sendButton.disabled) {
    setStatus(copy.unsupportedPage, 'error')
  } else if (isTikTokProfile) {
    setStatus(copy.tiktokProfileReady, 'idle')
  } else {
    setStatus(copy.ready, 'idle')
  }
}

function applyStaticCopy() {
  document.documentElement.lang = language
  languageElement.setAttribute('aria-label', copy.language || 'Language')
  platformElement.textContent = copy.checkingCurrentTab
  titleElement.textContent ||= copy.currentPage
  statusElement.textContent = copy.ready
  scanModeLabel.textContent = copy.scanMode
  scanLimitLabel.textContent = copy.scanLimit
  scanModeElement.options[0].textContent = copy.scanModes.safe
  scanModeElement.options[1].textContent = copy.scanModes.slow
  scanModeElement.options[2].textContent = copy.scanModes.fast
  Array.from(scanLimitElement.options).forEach((option) => {
    option.textContent = option.value === '0' ? copy.allVisibleVideos : `${option.value} ${copy.videos}`
  })
  sendButton.textContent = copy.openInVideoGet
  scanButton.textContent = copy.scanTikTokProfile
  scanDramaButton.textContent = copy.scanShortDrama
  downloadSeriesButton.textContent = copy.downloadFullSeries
  runPendingButton.textContent = copy.runPendingRepairs
  helperTextElement.textContent = copy.helper
}

sendButton.addEventListener('click', () => {
  const url = activeTab?.url
  if (!url) return
  sendButton.disabled = true
  sendButton.textContent = copy.openingVideoGet
  setStatus(copy.connectingDesktop, 'idle')

  chrome.runtime.sendMessage(
    {
      type: 'send-url',
      url,
      title: activeTab?.title,
      trigger: 'popup',
    },
    (response: NativeResponse | undefined) => {
      const error = chrome.runtime.lastError
      sendButton.disabled = false
      sendButton.textContent = copy.openInVideoGet
      if (error) {
        setStatus(error.message || copy.noWorker, 'error')
        return
      }
      if (!response) {
        setStatus(copy.noResponse, 'error')
        return
      }
      setStatus(response.message, response.ok ? 'success' : 'error')
    },
  )
})

scanButton.addEventListener('click', () => {
  const url = activeTab?.url
  const tabId = activeTab?.id
  if (!url || tabId === undefined) return

  sendButton.disabled = true
  scanButton.disabled = true
  scanButton.textContent = copy.scanningTikTok
  setStatus(copy.collectingLinks, 'idle')

  chrome.runtime.sendMessage(
    {
      type: 'scan-profile',
      tabId,
      pageUrl: url,
      title: activeTab?.title,
      limit: Number(scanLimitElement.value) || undefined,
      mode: scanModeElement.value,
    },
    (response: NativeResponse | undefined) => {
      const error = chrome.runtime.lastError
      sendButton.disabled = false
      scanButton.disabled = false
      scanButton.textContent = copy.scanTikTokProfile
      if (error) {
        setStatus(error.message || copy.noWorker, 'error')
        return
      }
      if (!response) {
        setStatus(copy.noResponse, 'error')
        return
      }
      setStatus(response.message, response.ok ? 'success' : 'error')
    },
  )
})

scanDramaButton.addEventListener('click', () => {
  const url = activeTab?.url
  const tabId = activeTab?.id
  if (!url || tabId === undefined) return

  sendButton.disabled = true
  scanButton.disabled = true
  scanDramaButton.disabled = true
  scanDramaButton.textContent = copy.scanningShortDrama
  setStatus(copy.collectingLinks, 'idle')

  chrome.runtime.sendMessage(
    {
      type: 'scan-shortdrama',
      tabId,
      pageUrl: url,
      title: activeTab?.title,
      limit: Number(scanLimitElement.value) || undefined,
      mode: scanModeElement.value,
    },
    (response: NativeResponse | undefined) => {
      const error = chrome.runtime.lastError
      sendButton.disabled = false
      scanButton.disabled = false
      scanDramaButton.disabled = false
      scanDramaButton.textContent = copy.scanShortDrama
      if (error) {
        setStatus(error.message || copy.noWorker, 'error')
        return
      }
      if (!response) {
        setStatus(copy.noResponse, 'error')
        return
      }
      setStatus(response.message, response.ok ? 'success' : 'error')
    },
  )
})

downloadSeriesButton.addEventListener('click', () => {
  const url = activeTab?.url
  const tabId = activeTab?.id
  if (!url || tabId === undefined) return

  sendButton.disabled = true
  scanButton.disabled = true
  downloadSeriesButton.disabled = true
  downloadSeriesButton.textContent = copy.downloadingSeries
  setStatus(copy.collectingLinks, 'idle')

  chrome.runtime.sendMessage(
    {
      type: 'scan-series',
      tabId,
      pageUrl: url,
      title: activeTab?.title,
      limit: undefined,
      mode: scanModeElement.value,
    },
    (response: NativeResponse | undefined) => {
      const error = chrome.runtime.lastError
      sendButton.disabled = false
      scanButton.disabled = false
      downloadSeriesButton.disabled = false
      downloadSeriesButton.textContent = copy.downloadFullSeries
      if (error) {
        setStatus(error.message || copy.noWorker, 'error')
        return
      }
      if (!response) {
        setStatus(copy.noResponse, 'error')
        return
      }
      setStatus(response.message, response.ok ? 'success' : 'error')
    },
  )
})

runPendingButton.addEventListener('click', () => {
  runPendingRepairs()
})

function runPendingRepairs() {
  runPendingButton.disabled = true
  runPendingButton.textContent = copy.checkingRepairs
  setStatus(copy.checkingPending, 'idle')

  chrome.runtime.sendMessage({ type: 'drain-pending' }, (response: NativeResponse | undefined) => {
    const error = chrome.runtime.lastError
    runPendingButton.disabled = false
    runPendingButton.textContent = copy.runPendingRepairs
    if (error) {
      setStatus(error.message || copy.noWorker, 'error')
      return
    }
    if (!response) {
      setStatus(copy.noPendingResponse, 'error')
      return
    }
    if (!response.ok) {
      setStatus(response.message, 'error')
      return
    }
    setStatus(response.message, 'success')
  })
}

function readLanguage(): Promise<PopupLanguage> {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local?.get?.(['sorevidLanguage'], (result) => {
        const value = result?.sorevidLanguage
        resolve(value === 'vi' || value === 'en' ? value : readLocalLanguage())
      })
    } catch {
      resolve(readLocalLanguage())
    }
  })
}

function saveLanguage(value: PopupLanguage) {
  try {
    chrome.storage?.local?.set?.({ sorevidLanguage: value })
  } catch {
    localStorage.setItem('sorevidLanguage', value)
  }
}

function readLocalLanguage(): PopupLanguage {
  const value = localStorage.getItem('sorevidLanguage')
  return value === 'vi' || value === 'en' ? value : 'en'
}

function setStatus(message: string, state: 'idle' | 'success' | 'error') {
  statusElement.textContent = message
  statusElement.className = `status ${state}`
}

function isTikTokProfileUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (
      (parsed.hostname === 'tiktok.com' || parsed.hostname.endsWith('.tiktok.com')) &&
      /^\/@[^/]+\/?$/.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

function isTikTokVideoUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (
      (parsed.hostname === 'tiktok.com' || parsed.hostname.endsWith('.tiktok.com')) &&
      /^\/@[^/]+\/video\/\d+/.test(parsed.pathname)
    )
  } catch {
    return false
  }
}
