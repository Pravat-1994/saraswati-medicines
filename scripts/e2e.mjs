// End-to-end smoke & business-rule tests (Playwright, headless Chromium).
// Requires the dev server: `npm run dev` (http://localhost:5173/saraswatimedicines/).
//   node scripts/e2e.mjs [baseUrl]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173/saraswatimedicines/'
const SHOTS = 'e2e-screenshots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

async function go(hash) {
  await page.goto(`${BASE}#${hash}`)
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('main h1', { timeout: 15000 })
  await page.waitForTimeout(500)
}

// Fresh demo data
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('main h1', { timeout: 30000 })

// ── 1. Every route renders ──
const routes = [
  ['/', 'dashboard'],
  ['/pos', 'pos'],
  ['/sales', 'sales'],
  ['/sales?tab=returns', 'returns'],
  ['/medicines', 'medicines'],
  ['/medicines/new', 'medicine-new'],
  ['/medicines/med_001', 'medicine-detail'],
  ['/medicines/med_001?tab=batches', 'medicine-batches'],
  ['/medicines/med_001/edit', 'medicine-edit'],
  ['/inventory', 'inventory'],
  ['/inventory?tab=batches', 'inventory-batches'],
  ['/inventory?tab=movements', 'inventory-movements'],
  ['/inventory?tab=adjustments', 'inventory-adjustments'],
  ['/inventory?tab=transfers', 'inventory-transfers'],
  ['/inventory?tab=alerts', 'inventory-alerts'],
  ['/purchases', 'purchases'],
  ['/purchases/new', 'purchase-new'],
  ['/purchases/po_001', 'purchase-detail'],
  ['/suppliers', 'suppliers'],
  ['/suppliers/sup_01', 'supplier-detail'],
  ['/customers', 'customers'],
  ['/customers/cus_001', 'customer-detail'],
  ['/reports', 'reports'],
  ['/reports?tab=medicines', 'reports-medicines'],
  ['/reports?tab=profit', 'reports-profit'],
  ['/reports?tab=purchases', 'reports-purchases'],
  ['/reports?tab=inventory', 'reports-inventory'],
  ['/reports?tab=lowstock', 'reports-lowstock'],
  ['/reports?tab=expiry', 'reports-expiry'],
  ['/reports?tab=payments', 'reports-payments'],
  ['/admin/users', 'admin-users'],
  ['/admin/users?tab=roles', 'admin-roles'],
  ['/admin/settings', 'admin-settings'],
  ['/orders', 'orders'],
  ['/orders?tab=ALL', 'orders-all'],
  ['/orders/ord_001', 'order-detail'],
  ['/shop', 'shop'],
  ['/shop/checkout', 'shop-checkout-empty'],
  ['/shop/track', 'shop-track'],
  ['/does-not-exist', 'not-found'],
]
for (const [hash, name] of routes) {
  const before = consoleErrors.length
  try {
    await go(hash)
    const text = await page.locator('main').innerText()
    const broken = /Something went wrong|We couldn’t load this|Under construction/.test(text)
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
    record(`route ${hash}`, !broken && consoleErrors.length === before, broken ? 'error state rendered' : consoleErrors.slice(before).join(' | '))
  } catch (e) {
    record(`route ${hash}`, false, String(e).slice(0, 200))
  }
}

// ── 2. POS end-to-end ──
try {
  await go('/pos')
  const search = page.getByRole('combobox', { name: 'Search medicines to add' })
  for (const term of ['dolo', 'pan 40', 'cetzine']) {
    await search.fill(term)
    await page.waitForTimeout(600)
    await search.press('Enter')
    await page.waitForTimeout(300)
  }
  const lines = await page.locator('tbody tr').count()
  record('POS adds 3 medicines to cart', lines === 3, `${lines} lines`)
  await page.getByRole('button', { name: /Increase Dolo 650/ }).click()
  const payable = await page.locator('text=Amount payable').locator('..').innerText()
  await page.getByLabel('Prescription reference').fill('Dr. Kar / RX-1042').catch(() => {})
  await page.getByRole('radio', { name: 'UPI' }).click()
  await page.getByRole('button', { name: /^Complete sale/ }).click()
  await page.waitForSelector('text=Sale completed', { timeout: 8000 })
  const modal = await page.getByRole('dialog').innerText()
  await page.screenshot({ path: `${SHOTS}/pos-completed.png` })
  record('POS completes sale and shows invoice', /SMS\/\d{2}-\d{2}\/\d+/.test(modal), payable.replace(/\s+/g, ' '))
  await page.getByRole('button', { name: 'New sale' }).click()
} catch (e) {
  record('POS end-to-end', false, String(e).slice(0, 300))
}

// ── 2b. Online order: customer storefront → checkout → confirmation ──
let webOrderNumber
try {
  await go('/shop')
  await page.getByLabel('Search medicines').fill('dolo')
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Add Dolo 650 to cart' }).click()
  await page.getByLabel('Search medicines').fill('electral')
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Add Electral ORS to cart' }).click()
  await page.getByRole('button', { name: /^Cart/ }).click()
  await page.getByRole('button', { name: 'Proceed to checkout' }).click()
  await page.waitForSelector('text=Your details')
  await page.getByLabel('Full name').fill('E2E Customer')
  await page.getByLabel('Mobile number').fill('9876501234')
  await page.getByRole('radio', { name: /Home delivery/ }).click()
  await page.getByLabel('Delivery address').fill('Plot 12, Nayapalli, Bhubaneswar 751012')
  await page.screenshot({ path: `${SHOTS}/shop-checkout.png`, fullPage: true })
  await page.getByRole('button', { name: 'Place order' }).click()
  await page.waitForSelector('text=Thank you, your order is placed!', { timeout: 8000 })
  const text = await page.locator('main').innerText()
  webOrderNumber = text.match(/WEB\/\d{2}-\d{2}\/\d+/)?.[0]
  await page.screenshot({ path: `${SHOTS}/shop-placed.png`, fullPage: true })
  record('Storefront order placed', !!webOrderNumber, webOrderNumber)
} catch (e) {
  record('Storefront order placed', false, String(e).slice(0, 300))
}

// ── 3. Business rules via the service layer (same module instances as the app) ──
const rules = await page.evaluate(async ({ base, orderNumber }) => {
  const path = new URL(base).pathname
  const svc = await import(`${path}src/services/index.ts`)
  const db = (await import(`${path}src/mock/db.ts`)).getDb()
  const out = []
  const expect = async (name, fn, shouldFail, match) => {
    try {
      const r = await fn()
      out.push({ name, ok: !shouldFail, detail: shouldFail ? 'unexpectedly succeeded' : '', r })
    } catch (e) {
      out.push({ name, ok: shouldFail && (!match || match.test(e.message)), detail: e.message })
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  const expired = db.batches.find((b) => b.expiryDate < today && b.quantity > 0)
  await expect('Expired batch cannot be sold', () => svc.salesService.create({ lines: [{ medicineId: expired.medicineId, batchId: expired.id, quantity: 1, discountPct: 0 }], billDiscountPct: 0, paymentMethod: 'CASH' }), true, /expired/i)
  const live = db.batches.find((b) => b.expiryDate > today && b.quantity > 3)
  await expect('Stock cannot go negative', () => svc.salesService.create({ lines: [{ medicineId: live.medicineId, batchId: live.id, quantity: live.quantity + 1, discountPct: 0 }], billDiscountPct: 0, paymentMethod: 'CASH' }), true, /available/i)
  const before = live.quantity
  await expect('Valid sale succeeds', () => svc.salesService.create({ lines: [{ medicineId: live.medicineId, batchId: live.id, quantity: 1, discountPct: 0 }], billDiscountPct: 0, paymentMethod: 'CASH' }), false)
  // Read back through the service (module instances may differ after HMR).
  const afterQty = (await svc.medicineService.get(live.medicineId)).batches.find((b) => b.id === live.id)?.quantity
  out.push({ name: 'Sale reduces batch quantity', ok: afterQty === before - 1, detail: `${before} → ${afterQty}` })

  // GST maths: inclusive pricing, 12%: ₹112 → taxable 100, GST 12
  const pricing = await import(`${path}src/lib/pricing.ts`)
  const l = pricing.computeLine({ unitPrice: 112, quantity: 1, discountPct: 0, gstRate: 12, pricesIncludeGst: true })
  out.push({ name: 'GST inclusive calculation', ok: l.taxableAmount === 100 && l.gstAmount === 12 && l.lineTotal === 112, detail: JSON.stringify(l) })
  const d = pricing.computeLine({ unitPrice: 33.6, quantity: 3, discountPct: 10, billDiscountPct: 5, gstRate: 12, pricesIncludeGst: true })
  const sum = Math.round((d.taxableAmount + d.gstAmount) * 100) / 100
  out.push({ name: 'Discount + GST reconcile to line total', ok: sum === d.lineTotal && d.grossAmount === 100.8, detail: JSON.stringify(d) })

  // Sales operator: discount limit and FEFO override
  const session = (await import(`${path}src/stores/sessionStore.ts`)).useSessionStore.getState()
  await session.switchUser('usr_sales')
  await expect('Sales operator discount limit enforced', () => svc.salesService.create({ lines: [{ medicineId: live.medicineId, batchId: live.id, quantity: 1, discountPct: 20 }], billDiscountPct: 0, paymentMethod: 'CASH' }), true, /discount/i)
  const multi = Object.values(db.batches.reduce((acc, b) => { if (b.expiryDate > today && b.quantity > 0) (acc[b.medicineId] ??= []).push(b); return acc }, {})).find((list) => list.length > 1)
  if (multi) {
    const later = [...multi].sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0]
    await expect('FEFO override blocked for sales operator', () => svc.salesService.create({ lines: [{ medicineId: later.medicineId, batchId: later.id, quantity: 1, discountPct: 0 }], billDiscountPct: 0, paymentMethod: 'CASH' }), true, /FEFO/)
  }
  await expect('Sales operator cannot approve adjustments', () => svc.inventoryService.decideAdjustment(db.adjustments.find((a) => a.status === 'PENDING').id, true), true, /permitted/i)
  await session.switchUser('usr_admin')

  // Returns reference the original sale
  const sale = (await svc.salesService.list({ pageSize: 1 })).items[0]
  const detail = await svc.salesService.get(sale.id)
  const line = detail.sale.items[0]
  const ret = await svc.salesService.requestReturn({ saleId: sale.id, lines: [{ lineId: line.lineId, quantity: 1, restock: true }], refundMethod: 'CASH', reason: 'Test return' })
  out.push({ name: 'Return references original sale & auto-approves for admin', ok: ret.saleId === sale.id && ret.status === 'APPROVED', detail: ret.returnNumber })
  await expect('Cannot return more than sold', () => svc.salesService.requestReturn({ saleId: sale.id, lines: [{ lineId: line.lineId, quantity: line.quantity + 5, restock: true }], refundMethod: 'CASH', reason: 'x' }), true, /can be returned/)

  // Purchase receipt increases stock
  const po = db.purchaseOrders.find((p) => p.status === 'ORDERED')
  const item = po.items[0]
  const med = db.medicines.find((m) => m.id === item.medicineId)
  const stockBefore = (await svc.medicineService.get(med.id)).stock.sellable
  const exp = new Date(Date.now() + 500 * 86400000).toISOString().slice(0, 10)
  await svc.purchaseService.receive({ purchaseOrderId: po.id, supplierInvoiceNumber: 'TEST/001', lines: [{ poItemId: item.id, batchNumber: 'E2E001', mfgDate: '2026-09-01', expiryDate: exp, quantity: 5, sellingPrice: med.sellingPrice }] })
  const stockAfter = (await svc.medicineService.get(med.id)).stock.sellable
  const poAfter = await svc.purchaseService.get(po.id)
  out.push({ name: 'Goods receipt increases batch stock', ok: stockAfter === stockBefore + 5, detail: `${stockBefore} → ${stockAfter}, PO ${poAfter.status}` })
  await expect('Receipt cannot exceed pending quantity', () => svc.purchaseService.receive({ purchaseOrderId: po.id, supplierInvoiceNumber: 'TEST/002', lines: [{ poItemId: item.id, batchNumber: 'E2E002', mfgDate: '2026-09-01', expiryDate: exp, quantity: 99999, sellingPrice: med.sellingPrice }] }), true, /pending/)

  // Duplicate medicine code rejected
  const m0 = db.medicines[0]
  await expect('Medicine code must be unique', () => svc.medicineService.create({ ...m0, code: m0.code }), true, /already in use/)

  // Large adjustment by pharmacist requires approval
  await session.switchUser('usr_pharmacist')
  const big = db.batches.find((b) => b.expiryDate > today && b.quantity > 40)
  const adj = await svc.inventoryService.requestAdjustment({ medicineId: big.medicineId, batchId: big.id, type: 'DECREASE', quantity: 30, reason: 'E2E large count variance' })
  out.push({ name: 'Large adjustment goes to approval', ok: adj.status === 'PENDING', detail: adj.status })
  await session.switchUser('usr_admin')

  // Online orders: staff fulfilment of the storefront order placed above
  const sold = async (medicineId) => (await svc.medicineService.get(medicineId)).stock.sellable
  const web = (await svc.onlineOrderService.list({ status: 'PLACED', search: orderNumber })).find((o) => o.orderNumber === orderNumber)
  out.push({ name: 'Staff queue shows the storefront order', ok: !!web, detail: orderNumber })
  if (web) {
    const medId = web.items[0].medicineId
    const before = await sold(medId)
    const confirmed = await svc.onlineOrderService.confirm(web.id)
    const afterReserve = await sold(medId)
    out.push({ name: 'Confirm reserves stock (FEFO)', ok: confirmed.status === 'CONFIRMED' && afterReserve === before - web.items[0].quantity && confirmed.items[0].allocations.length > 0, detail: `${before} → ${afterReserve}` })
    await svc.onlineOrderService.advance(web.id, 'OUT_FOR_DELIVERY')
    const done = await svc.onlineOrderService.complete({ orderId: web.id, paymentMethod: 'CASH' })
    const afterSale = await sold(medId)
    const sale = await svc.salesService.get(done.saleId)
    out.push({ name: 'Complete converts reservation into an invoice', ok: done.status === 'COMPLETED' && !!done.invoiceNumber && afterSale === afterReserve && sale.sale.items.length >= web.items.length, detail: `${done.invoiceNumber}, stock ${afterSale}` })
    const tracked = await svc.shopService.track(orderNumber, '+91 98765 01234')
    out.push({ name: 'Customer tracking shows completed + invoice', ok: tracked.status === 'COMPLETED' && tracked.invoiceNumber === done.invoiceNumber, detail: tracked.status })
    await expect('Tracking needs the matching phone', () => svc.shopService.track(orderNumber, '9000000000'), true, /No order found/)
  }
  const rxMed = db.medicines.find((m) => m.prescriptionRequired && db.batches.some((b) => b.medicineId === m.id && b.quantity > 2 && b.expiryDate > today))
  const rxReq = { customerName: 'Rx Tester', customerPhone: '9876509999', fulfilment: 'PICKUP', items: [{ medicineId: rxMed.id, quantity: 1 }], paymentPreference: 'PAY_AT_STORE' }
  await expect('Rx order needs a prescription', () => svc.shopService.placeOrder(rxReq), true, /prescription/i)
  const rxOrder = await svc.shopService.placeOrder({ ...rxReq, prescriptionRef: 'RX-E2E-1' })
  const rxId = (await svc.onlineOrderService.list({ status: 'PLACED', search: rxOrder.orderNumber }))[0].id
  await expect('Rx order cannot be confirmed before verification', () => svc.onlineOrderService.confirm(rxId), true, /verify/i)
  await session.switchUser('usr_sales')
  await expect('Sales operator cannot verify prescriptions', () => svc.onlineOrderService.verifyPrescription(rxId), true, /permitted/i)
  await session.switchUser('usr_admin')
  await svc.onlineOrderService.verifyPrescription(rxId)
  const rxBefore = await sold(rxMed.id)
  await svc.onlineOrderService.confirm(rxId)
  await svc.onlineOrderService.cancel(rxId, 'E2E cancel')
  out.push({ name: 'Cancelling releases reserved stock', ok: (await sold(rxMed.id)) === rxBefore, detail: `${rxBefore} → ${await sold(rxMed.id)}` })
  await expect('Out-of-stock item cannot be ordered online', () => svc.shopService.placeOrder({ ...rxReq, prescriptionRef: 'x', items: [{ medicineId: live.medicineId, quantity: 999 }] }), true, /available|up to/i)
  return out
}, { base: BASE, orderNumber: webOrderNumber })
for (const r of rules) record(`rule: ${r.name}`, r.ok, r.detail)

// ── 4. Medicine form validation ──
try {
  await go('/medicines/new')
  await page.getByRole('button', { name: 'Create medicine' }).click()
  await page.waitForTimeout(400)
  const alerts = await page.locator('[role="alert"]').count()
  record('Medicine form shows validation errors', alerts > 3, `${alerts} messages`)
} catch (e) {
  record('Medicine form validation', false, String(e).slice(0, 200))
}

// ── 5. Mobile layouts ──
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
const mp = await mobile.newPage()
mp.on('pageerror', (e) => consoleErrors.push(String(e)))
for (const [hash, name] of [['/', 'm-dashboard'], ['/pos', 'm-pos'], ['/shop', 'm-shop'], ['/shop/track', 'm-shop-track'], ['/orders', 'm-orders'], ['/medicines', 'm-medicines'], ['/inventory', 'm-inventory'], ['/sales', 'm-sales'], ['/purchases/new', 'm-purchase-new'], ['/reports', 'm-reports'], ['/admin/settings', 'm-settings']]) {
  await mp.goto(`${BASE}#${hash}`)
  await mp.waitForSelector('main h1', { timeout: 20000 })
  await mp.waitForTimeout(700)
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await mp.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  record(`mobile ${hash} has no horizontal page scroll`, overflow <= 1, `overflow ${overflow}px`)
}

record('No console errors overall', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
