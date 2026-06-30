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

let activeTab: chrome.tabs.Tab | undefined

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  activeTab = tab
  const url = tab?.url || ''
  titleElement.textContent = tab?.title || 'Current page'
  urlElement.textContent = url || 'This Chrome page cannot be sent.'
  urlElement.title = url
  const platform = platformForUrl(url)
  const isTikTokProfile = platform === 'tiktok' && isTikTokProfileUrl(url)
  const isTikTokVideo = platform === 'tiktok' && isTikTokVideoUrl(url)
  platformElement.textContent =
    platform === 'bilibili'
      ? 'BiliBili detected'
      : platform === 'douyin'
        ? 'Douyin detected'
        : platform === 'tiktok'
          ? 'TikTok detected'
          : 'Web page'
  sendButton.disabled = !/^https?:/i.test(url)
  scanButton.hidden = !isTikTokProfile
  scanDramaButton.hidden = !isTikTokProfile
  downloadSeriesButton.hidden = !isTikTokVideo
  scanOptionsElement.hidden = !isTikTokProfile
  if (sendButton.disabled) {
    setStatus('This Chrome page does not provide a downloadable URL.', 'error')
  } else if (isTikTokProfile) {
    setStatus('This TikTok profile can be scanned and resolved into direct media links.', 'idle')
  }
})

sendButton.addEventListener('click', () => {
  const url = activeTab?.url
  if (!url) return
  sendButton.disabled = true
  sendButton.textContent = 'Opening VideoGET…'
  setStatus('Connecting to the desktop app…', 'idle')

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
      sendButton.textContent = 'Open in VideoGET'
      if (error) {
        setStatus(error.message || 'Could not contact the extension service worker.', 'error')
        return
      }
      if (!response) {
        setStatus('SOREVID VideoGET did not return a response.', 'error')
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
  scanButton.textContent = 'Scanning TikTok…'
  setStatus('Collecting video links and resolving signed media URLs…', 'idle')

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
      scanButton.textContent = 'Scan TikTok Profile'
      if (error) {
        setStatus(error.message || 'Could not contact the extension service worker.', 'error')
        return
      }
      if (!response) {
        setStatus('SOREVID VideoGET did not return a response.', 'error')
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
  scanDramaButton.textContent = 'Scanning Short Drama…'
  setStatus('Collecting video links and resolving signed media URLs…', 'idle')

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
      scanDramaButton.textContent = 'Scan Short Drama'
      if (error) {
        setStatus(error.message || 'Could not contact the extension service worker.', 'error')
        return
      }
      if (!response) {
        setStatus('SOREVID VideoGET did not return a response.', 'error')
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
  downloadSeriesButton.textContent = 'Downloading Series…'
  setStatus('Collecting video links and resolving signed media URLs…', 'idle')

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
      downloadSeriesButton.textContent = 'Download Full Series'
      if (error) {
        setStatus(error.message || 'Could not contact the extension service worker.', 'error')
        return
      }
      if (!response) {
        setStatus('SOREVID VideoGET did not return a response.', 'error')
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
  runPendingButton.textContent = 'Checking repairs...'
  setStatus('Checking pending subtitle repairs with the desktop app...', 'idle')

  chrome.runtime.sendMessage({ type: 'drain-pending' }, (response: NativeResponse | undefined) => {
    const error = chrome.runtime.lastError
    runPendingButton.disabled = false
    runPendingButton.textContent = 'Run pending repairs'
    if (error) {
      setStatus(error.message || 'Could not contact the extension service worker.', 'error')
      return
    }
    if (!response) {
      setStatus('SOREVID VideoGET did not return a response for pending repairs.', 'error')
      return
    }
    if (!response.ok) {
      setStatus(response.message, 'error')
      return
    }
    setStatus(response.message, 'success')
  })
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
