// Serves a static build under a sub-path, the way GitHub Pages hosts project sites.
//   node scripts/serve-subpath.mjs dist-pages /saraswati-medicines-store/ 4180
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const [, , dir = 'dist', prefix = '/repo/', port = '4180'] = process.argv
const root = resolve(dir)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' }

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (!url.startsWith(prefix)) {
    res.writeHead(404).end('Not found')
    return
  }
  const rel = normalize(url.slice(prefix.length) || 'index.html').replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(root, rel.endsWith('/') || rel === '.' ? 'index.html' : rel))
    res.writeHead(200, { 'Content-Type': types[extname(rel)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(Number(port), () => console.log(`Serving ${root} at http://localhost:${port}${prefix}`))
