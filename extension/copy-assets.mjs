import { cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(here, '..', 'dist-extension')

await mkdir(output, { recursive: true })
for (const file of ['manifest.json', 'popup.html', 'popup.css', 'content.css']) {
  await cp(resolve(here, file), resolve(output, file))
}
await mkdir(resolve(output, 'icons'), { recursive: true })
try {
  await cp(resolve(here, '..', 'src', 'assets', 'icons', 'videoget.png'), resolve(output, 'icons', 'icon.png'))
} catch (error) {
  if (error?.code !== 'EPERM') throw error
  console.warn('Skipped icon refresh because Chrome is currently using it.')
}
