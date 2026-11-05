// Zips the contents of a build folder (default: dist) for upload to Decisions
// (Custom Web Apps → upload package → Deploy). Cross-platform replacement for
// the template's `cd dist && zip -r ...` which needs a Unix `zip` binary.
//   node scripts/package.mjs dist deployPackage.zip
import { createWriteStream, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZipArchive } from 'archiver'

const [, , srcDir = 'dist', outFile = 'deployPackage.zip'] = process.argv
const src = resolve(srcDir)
if (!existsSync(src) || !statSync(src).isDirectory()) {
  console.error(`Build folder not found: ${src}. Run the Vite build first.`)
  process.exit(1)
}

const out = createWriteStream(resolve(outFile))
const archive = new ZipArchive({ zlib: { level: 9 } })
archive.on('warning', (err) => console.warn(err))
archive.on('error', (err) => {
  throw err
})
out.on('close', () => {
  console.log(`${outFile} is ready (${(archive.pointer() / 1024).toFixed(0)} KB). Upload it to Decisions and use the deploy action.`)
})
archive.pipe(out)
// Files at the zip root (index.html, assets/...), matching the template's package layout.
archive.directory(src, false)
await archive.finalize()
