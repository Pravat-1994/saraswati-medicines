// Creates a clean source-code ZIP (no node_modules, build output or packages).
//   node scripts/package-source.mjs [out.zip]
import { createWriteStream } from 'node:fs'
import { basename, resolve } from 'node:path'
import { ZipArchive } from 'archiver'

const outFile = process.argv[2] ?? 'saraswati-medicines-store-source.zip'
const root = resolve('.')
const out = createWriteStream(resolve(outFile))
const archive = new ZipArchive({ zlib: { level: 9 } })
archive.on('error', (err) => {
  throw err
})
out.on('close', () => console.log(`${outFile} created (${(archive.pointer() / 1024).toFixed(0)} KB).`))
archive.pipe(out)
archive.glob('**/*', {
  cwd: root,
  dot: true,
  ignore: ['node_modules/**', 'dist/**', 'dist-*/**', '*.zip', '.git/**', 'test-results/**', 'playwright-report/**', 'e2e-screenshots/**', '.claude/**', basename(outFile)],
}, { prefix: 'saraswati-medicines-store' })
await archive.finalize()
