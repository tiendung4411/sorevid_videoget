import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, chmod, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'src-tauri', 'resources', 'bin', 'macos')
const tmpDir = join(root, 'src-tauri', 'resources', 'tmp')

async function download(url, dest) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  await mkdir(dirname(dest), { recursive: true })
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
}

async function main() {
  await mkdir(binDir, { recursive: true })
  await mkdir(tmpDir, { recursive: true })

  const ytDlp = join(binDir, 'yt-dlp')
  if (!existsSync(ytDlp)) {
    await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos', ytDlp)
    await chmod(ytDlp, 0o755)
  }

  const deno = join(binDir, 'deno')
  if (!existsSync(deno)) {
    const denoTarget = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
    const denoZip = join(tmpDir, 'deno.zip')
    const denoDir = join(tmpDir, 'deno')
    await download(`https://github.com/denoland/deno/releases/latest/download/deno-${denoTarget}.zip`, denoZip)
    await rm(denoDir, { recursive: true, force: true })
    await mkdir(denoDir, { recursive: true })
    await execFileAsync('unzip', ['-o', denoZip, '-d', denoDir])
    await execFileAsync('cp', [join(denoDir, 'deno'), deno])
    await chmod(deno, 0o755)
  }

  const ffmpegZip = join(tmpDir, 'ffmpeg.zip')
  const ffmpegDir = join(tmpDir, 'ffmpeg')
  if (!existsSync(join(binDir, 'ffmpeg'))) {
    await download('https://evermeet.cx/ffmpeg/getrelease/zip', ffmpegZip)
    await rm(ffmpegDir, { recursive: true, force: true })
    await mkdir(ffmpegDir, { recursive: true })
    await execFileAsync('unzip', ['-o', ffmpegZip, '-d', ffmpegDir])
    await execFileAsync('cp', [join(ffmpegDir, 'ffmpeg'), join(binDir, 'ffmpeg')])
    await chmod(join(binDir, 'ffmpeg'), 0o755)
  }

  const ffprobeZip = join(tmpDir, 'ffprobe.zip')
  const ffprobeDir = join(tmpDir, 'ffprobe')
  if (!existsSync(join(binDir, 'ffprobe'))) {
    await download('https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip', ffprobeZip)
    await rm(ffprobeDir, { recursive: true, force: true })
    await mkdir(ffprobeDir, { recursive: true })
    await execFileAsync('unzip', ['-o', ffprobeZip, '-d', ffprobeDir])
    await execFileAsync('cp', [join(ffprobeDir, 'ffprobe'), join(binDir, 'ffprobe')])
    await chmod(join(binDir, 'ffprobe'), 0o755)
  }

  await rm(tmpDir, { recursive: true, force: true })
  console.log(`Sidecars ready in ${binDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
