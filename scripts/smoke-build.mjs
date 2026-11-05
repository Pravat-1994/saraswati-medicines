// Smoke-tests a *built* bundle (catches production-only issues such as chunk
// initialisation order). Build a demo copy and serve it first:
//   npx vite build --mode demo --config vite.config.prod.ts --outDir dist-smoke
//   npx vite preview --config vite.config.prod.ts --outDir dist-smoke --port 4173
//   node scripts/smoke-build.mjs http://localhost:4173/saraswatimedicines/
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4173/saraswatimedicines/'
const routes = ['/', '/pos', '/sales', '/medicines', '/medicines/med_001', '/medicines/new', '/inventory', '/inventory?tab=alerts', '/purchases', '/purchases/new', '/suppliers', '/customers', '/reports', '/admin/users', '/admin/settings', '/orders', '/orders/ord_001', '/shop', '/shop/checkout', '/shop/track', '/doctors', '/appointments', '/consultations', '/prescriptions', '/patients', '/admissions', '/admissions/new', '/inpatients', '/rooms', '/clinical', '/discharges', '/billing', '/shop/doctors', '/shop/appointments']
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
let failed = 0
for (const r of routes) {
  const before = errors.length
  await page.goto(`${BASE}#${r}`)
  const ok = await page.waitForSelector('main h1', { timeout: 20000 }).then(() => true, () => false)
  const pass = ok && errors.length === before
  if (!pass) failed++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${r}${pass ? '' : ` — ${errors.slice(before).join(' | ') || 'no heading rendered'}`}`)
}
await browser.close()
console.log(failed ? `${failed} route(s) failed` : `All ${routes.length} routes rendered from the built bundle`)
process.exit(failed ? 1 : 0)
