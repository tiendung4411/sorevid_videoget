import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'src-tauri', 'resources', 'bin', 'windows')
const tmpDir = join(root, 'src-tauri', 'resources', 'tmp')

async function download(url, dest) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  await mkdir(dirname(dest), { recursive: true })
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
}

async function expandArchive(zipPath, destDir) {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${destDir.replaceAll("'", "''")}' -Force`,
  ])
}

async function findFile(dir, filename) {
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
      return path
    }

    if (entry.isDirectory()) {
      const found = await findFile(path, filename)
      if (found) return found
    }
  }

  return undefined
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('Windows sidecar fetch must be run on Windows.')
  }

  await mkdir(binDir, { recursive: true })
  await mkdir(tmpDir, { recursive: true })

  const ytDlp = join(binDir, 'yt-dlp.exe')
  if (!existsSync(ytDlp)) {
    await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', ytDlp)
  }

  const deno = join(binDir, 'deno.exe')
  if (!existsSync(deno)) {
    const denoZip = join(tmpDir, 'deno.zip')
    const denoDir = join(tmpDir, 'deno')
    await download('https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip', denoZip)
    await rm(denoDir, { recursive: true, force: true })
    await mkdir(denoDir, { recursive: true })
    await expandArchive(denoZip, denoDir)

    const extractedDeno = await findFile(denoDir, 'deno.exe')
    if (!extractedDeno) {
      throw new Error('Could not find deno.exe in the downloaded archive.')
    }

    await copyFile(extractedDeno, deno)
  }

  const ffmpeg = join(binDir, 'ffmpeg.exe')
  const ffprobe = join(binDir, 'ffprobe.exe')
  if (!existsSync(ffmpeg) || !existsSync(ffprobe)) {
    const ffmpegZip = join(tmpDir, 'ffmpeg-release-essentials.zip')
    const ffmpegDir = join(tmpDir, 'ffmpeg')
    await download('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', ffmpegZip)
    await rm(ffmpegDir, { recursive: true, force: true })
    await mkdir(ffmpegDir, { recursive: true })
    await expandArchive(ffmpegZip, ffmpegDir)

    const extractedFfmpeg = await findFile(ffmpegDir, 'ffmpeg.exe')
    const extractedFfprobe = await findFile(ffmpegDir, 'ffprobe.exe')
    if (!extractedFfmpeg || !extractedFfprobe) {
      throw new Error('Could not find ffmpeg.exe and ffprobe.exe in the downloaded archive.')
    }

    await copyFile(extractedFfmpeg, ffmpeg)
    await copyFile(extractedFfprobe, ffprobe)
  }

  await rm(tmpDir, { recursive: true, force: true })
  console.log(`Windows sidecars ready in ${binDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
