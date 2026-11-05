// Healthcare module tests (Playwright, headless Chromium). Needs `npm run dev` running.
//   node scripts/e2e-healthcare.mjs [baseUrl]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173/saraswatimedicines/'
const SHOTS = 'e2e-screenshots/healthcare'
mkdirSync(SHOTS, { recursive: true })
const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('main h1', { timeout: 30000 })

const ids = await page.evaluate(async (base) => {
  const path = new URL(base).pathname
  const db = (await import(`${path}src/mock/clinicDb.ts`)).getClinicDb()
  return {
    doctor: db.doctors[0].id,
    appointment: db.appointments.find((a) => a.status === 'CONFIRMED').id,
    consultation: db.consultations.find((c) => c.status === 'COMPLETED').id,
    rx: db.prescriptions.find((r) => r.status === 'FINAL').id,
    patient: db.patients[0].id,
    admission: db.admissions.find((a) => a.status === 'UNDER_TREATMENT').id,
    account: db.accounts.find((a) => a.admissionId).id,
  }
}, BASE)

const routes = [
  '/doctors', `/doctors/${ids.doctor}`, '/appointments', '/appointments?tab=past', `/appointments/${ids.appointment}`, '/consultations', `/consultations/${ids.consultation}`,
  '/prescriptions', `/prescriptions/${ids.rx}`, '/patients', `/patients/${ids.patient}`, '/admissions', '/admissions/new', `/admissions/${ids.admission}`, '/inpatients', '/rooms',
  '/clinical', `/clinical?patient=${ids.patient}`, '/discharges', '/billing', `/billing/${ids.account}`, '/shop/doctors', `/shop/doctors/${ids.doctor}`, '/shop/appointments',
]
for (const r of routes) {
  const before = errors.length
  try {
    await page.goto(`${BASE}#${r}`)
    await page.waitForSelector('main h1', { timeout: 15000 })
    await page.waitForTimeout(400)
    const text = await page.locator('main').innerText()
    const broken = /Something went wrong|We couldn’t load this|Under construction/.test(text)
    await page.screenshot({ path: `${SHOTS}/${r.replace(/[/?=&]+/g, '_').replace(/^_/, '') || 'root'}.png`, fullPage: true })
    record(`route ${r.replace(/[a-z]+_[0-9a-z]+/g, ':id')}`, !broken && errors.length === before, broken ? 'error state' : errors.slice(before).join(' | '))
  } catch (e) {
    record(`route ${r}`, false, String(e).slice(0, 200))
  }
}

// ── Doctor-role pages render for each role ──
// Switch users through the real profile menu ("Act as …") so the UI session changes.
const actAs = async (name) => {
  await page.goto(`${BASE}#/`)
  await page.waitForSelector('main h1', { timeout: 15000 })
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: new RegExp(`Act as ${name.replace(/\./g, '\\.')}`) }).click()
  await page.waitForTimeout(900)
  await page.waitForSelector('main h1', { timeout: 15000 })
}
const PEOPLE = [
  ['Dr. Ananya Mishra', 'Doctor', /My appointments|appointments today/i],
  ['Swati Jena', 'Receptionist', /Register patient|appointment/i],
  ['Sr. Mamata Pradhan', 'Nurse', /inpatient/i],
  ['Alok Ranjan Das', 'Billing Operator', /bill|dues/i],
  ['Dr. Ashok Kumar Dash', 'Pharmacist', /Store overview|Performance/i],
  ['Pravat Ranjan Parhi', 'Administrator', /Store overview/i],
]
for (const [name, role, expectText] of PEOPLE) {
  try {
    await actAs(name)
    const header = await page.locator('header').innerText()
    const main = await page.locator('main').innerText()
    const nav = await page.locator('nav[aria-label="Main navigation"]').innerText().catch(() => '')
    await page.screenshot({ path: `${SHOTS}/home-${role.replace(/\s/g, '-').toLowerCase()}.png` })
    const navOk = role === 'Doctor' ? !/Purchases|Suppliers/.test(nav) : role === 'Nurse' ? !/Point of Sale|Patient Billing/.test(nav) : true
    record(`home for ${role}`, header.includes(name) && expectText.test(main) && navOk, `nav: ${nav.replace(/\s+/g, ' ').slice(0, 120)}`)
  } catch (e) {
    record(`home for ${role}`, false, String(e).slice(0, 200))
  }
}

// ── Workflow rules through the service layer ──
const rules = await page.evaluate(async (base) => {
  const path = new URL(base).pathname
  const s = await import(`${path}src/services/index.ts`)
  const session = (await import(`${path}src/stores/sessionStore.ts`)).useSessionStore.getState()
  const out = []
  const expect = async (name, fn, shouldFail, match) => {
    try {
      const r = await fn()
      out.push({ name, ok: !shouldFail, detail: shouldFail ? 'unexpectedly succeeded' : '' })
      return r
    } catch (e) {
      out.push({ name, ok: !!shouldFail && (!match || match.test(e.message)), detail: e.message })
    }
  }
  const day = (n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  await session.switchUser('usr_reception')
  const doctors = await s.doctorService.list()
  // find a doctor + future date with two free slots
  let doc, date, free
  outer: for (const d of doctors) for (let i = 1; i < 8; i++) {
    const sl = (await s.doctorService.slots(d.id, day(i))).filter((x) => x.available)
    if (sl.length >= 2) { doc = d; date = day(i); free = sl; break outer }
  }
  const patients = await s.patientService.search('')
  const p1 = patients[0], p2 = patients[1]
  const appt = await expect('Receptionist books appointment', () => s.appointmentService.book({ patientId: p1.id, doctorId: doc.id, type: doc.consultationTypes[0], date, start: free[0].start, reason: 'E2E check-up' }), false)
  await expect('Double booking the same slot is rejected', () => s.appointmentService.book({ patientId: p2.id, doctorId: doc.id, type: doc.consultationTypes[0], date, start: free[0].start, reason: 'E2E clash' }), true, /booked|available/i)
  const slotsAfter = await s.doctorService.slots(doc.id, date)
  out.push({ name: 'Booked slot no longer offered', ok: slotsAfter.find((x) => x.start === free[0].start)?.available === false })
  if (appt) {
    await expect('Reschedule to another free slot', () => s.appointmentService.reschedule(appt.id, date, free[1].start), false)
    await expect('No-show not allowed before the time', () => s.appointmentService.setStatus(appt.id, 'NO_SHOW'), true, /after the appointment/i)
    await expect('Cancel requires a reason', () => s.appointmentService.cancel(appt.id, ''), true, /reason/i)
  }
  await expect('Receptionist cannot start a consultation', async () => s.consultationService.start((await s.appointmentService.list({ view: 'TODAY' })).find((a) => ['CONFIRMED', 'SCHEDULED'].includes(a.status))?.id ?? 'x'), true, /permitted|not found/i)

  // Prescription authority
  await session.switchUser('usr_pharmacist')
  await expect('Pharmacist cannot create prescriptions', () => s.prescriptionService.saveDraft({ patientId: p1.id, diagnosis: 'x', symptoms: '', items: [{ medicineName: 'Dolo 650', dosage: '1', frequency: 'BD', duration: '3 days', instructions: '', quantity: 1 }], recommendations: '' }), true, /permitted|doctor/i)
  await session.switchUser('usr_admin')
  await expect('Administrator cannot create prescriptions', () => s.prescriptionService.saveDraft({ patientId: p1.id, diagnosis: 'x', symptoms: '', items: [{ medicineName: 'Dolo 650', dosage: '1', frequency: 'BD', duration: '3 days', instructions: '', quantity: 1 }], recommendations: '' }), true, /permitted|doctor/i)
  const roles = await s.userService.roles()
  const pharm = roles.find((r) => r.id === 'PHARMACIST')
  await expect('Role editor refuses prescription rights for non-doctors', () => s.userService.saveRole({ ...pharm, permissions: [...pharm.permissions, 'prescriptions.issue'] }), true, /Doctor role/i)
  await session.switchUser('usr_doctor')
  const medicines = await s.medicineService.list({ search: 'Dolo', pageSize: 1 })
  const draft = await expect('Doctor creates a draft prescription', () => s.prescriptionService.saveDraft({ patientId: p1.id, diagnosis: 'Viral fever', symptoms: 'Fever', items: [{ medicineId: medicines.items[0].id, medicineName: 'Dolo 650', dosage: '1 tablet', frequency: 'TDS', duration: '3 days', instructions: 'After food', quantity: 1 }, { medicineName: 'Not-stocked tonic', dosage: '10 ml', frequency: 'BD', duration: '5 days', instructions: '', quantity: 1 }], recommendations: 'Rest' }), false)
  if (draft) {
    await expect('Finalise requires the exact doctor name', () => s.prescriptionService.finalise(draft.id, 'Someone Else'), true, /exactly/i)
    const fin = await expect('Doctor finalises & signs', () => s.prescriptionService.finalise(draft.id, 'Dr. Ananya Mishra'), false)
    await expect('Finalised prescription cannot be edited', () => s.prescriptionService.saveDraft({ patientId: p1.id, diagnosis: 'changed', symptoms: '', items: [{ medicineName: 'x', dosage: '1', frequency: 'OD', duration: '1 day', instructions: '', quantity: 1 }], recommendations: '' }, draft.id), true, /cannot be edited/i)
    await session.switchUser('usr_pharmacist')
    const det = await s.prescriptionService.get(draft.id)
    out.push({ name: 'Pharmacy sees stock per item (stocked vs not stocked)', ok: det.availability[0].stocked && !det.availability[1].stocked, detail: JSON.stringify(det.availability.map((a) => [a.stocked, a.available])) })
    // Dispense via a real POS sale
    const sale = await (async () => {
      const item = await s.medicineService.getSaleable(medicines.items[0].id)
      const batch = item.batches.find((b) => b.expiryStatus !== 'EXPIRED' && b.quantity > 0)
      return s.salesService.create({ lines: [{ medicineId: item.medicine.id, batchId: batch.id, quantity: 1, discountPct: 0 }], billDiscountPct: 0, paymentMethod: 'CASH', prescriptionId: draft.id, patientId: p1.id })
    })().catch((e) => ({ error: e.message }))
    if (sale.id) {
      const after = await s.prescriptionService.recordDispense({ prescriptionId: draft.id, saleId: sale.id, invoiceNumber: sale.invoiceNumber, lines: [{ medicineId: medicines.items[0].id, quantity: 1 }] })
      out.push({ name: 'Dispensing marks prescription partially fulfilled & links sale', ok: after.fulfilment === 'PARTIALLY_FULFILLED' && after.saleIds.includes(sale.id), detail: after.fulfilment })
    } else out.push({ name: 'Dispensing sale', ok: false, detail: sale.error })
    void fin
  }

  // Admission → bed → discharge → bill → release
  await session.switchUser('usr_reception')
  const newPatient = await expect('Register patient', () => s.patientService.register({ name: 'E2E Test Patient', dateOfBirth: '1990-01-01', gender: 'FEMALE', phone: '9123456780', address: 'Test address', allergies: ['Penicillin'], conditions: [] }), false)
  await expect('Duplicate registration is flagged', () => s.patientService.register({ name: 'E2E Test Patient', dateOfBirth: '1990-01-01', gender: 'FEMALE', phone: '9123456780', address: 'x', allergies: [], conditions: [] }), true, /duplicate/i)
  const adm = await expect('Request admission', () => s.admissionService.request({ patientId: newPatient.id, doctorId: 'doc_01', type: 'PLANNED', department: 'General Medicine', reason: 'E2E observation', diagnosis: 'Test', initialObservations: 'Stable' }), false)
  await expect('Bed cannot be allocated before approval', async () => s.bedService.allocate(adm.id, (await s.roomService.list()).flatMap((r) => r.beds).find((b) => b.status === 'AVAILABLE').id), true, /approve/i)
  await session.switchUser('usr_doctor')
  await s.admissionService.approve(adm.id)
  await session.switchUser('usr_reception')
  const rooms = await s.roomService.list()
  const occupiedBed = rooms.flatMap((r) => r.beds).find((b) => b.status === 'OCCUPIED')
  await expect('Occupied bed cannot be allocated (no double allocation)', () => s.bedService.allocate(adm.id, occupiedBed.id), true, /not available/i)
  await expect('Occupied bed cannot be put into maintenance', () => s.bedService.setMaintenance(occupiedBed.id, true), true, /allocated/i)
  const freeBed = rooms.flatMap((r) => r.beds).find((b) => b.status === 'AVAILABLE')
  await s.bedService.allocate(adm.id, freeBed.id)
  const confirmed = await s.admissionService.confirm(adm.id)
  const bedNow = (await s.roomService.list()).flatMap((r) => r.beds).find((b) => b.id === freeBed.id)
  out.push({ name: 'Confirm admission occupies the bed & opens an account', ok: confirmed.status === 'ADMITTED' && bedNow.status === 'OCCUPIED' && !!confirmed.accountId, detail: `${confirmed.status}/${bedNow.status}` })
  await session.switchUser('usr_nurse')
  await expect('Nurse records vitals', () => s.clinicalRecordService.add({ patientId: newPatient.id, admissionId: adm.id, kind: 'VITALS', vitals: { systolic: 128, diastolic: 82, heartRate: 88, temperatureC: 37.2, spo2: 97 } }), false)
  await expect('Implausible vitals rejected', () => s.clinicalRecordService.add({ patientId: newPatient.id, admissionId: adm.id, kind: 'VITALS', vitals: { heartRate: 400 } }), true, /plausible/i)
  await expect('Nurse cannot write doctor notes', () => s.clinicalRecordService.add({ patientId: newPatient.id, admissionId: adm.id, kind: 'DOCTOR_NOTE', text: 'x' }), true, /permitted/i)
  await expect('Nurse requests discharge', () => s.dischargeService.request(adm.id), false)
  await expect('Nurse cannot approve discharge', () => s.dischargeService.approve(adm.id, { finalDiagnosis: 'x', treatmentSummary: 'x', medicationInstructions: 'x', followUp: 'x' }), true, /permitted|doctor/i)
  await session.switchUser('usr_doctor')
  await s.dischargeService.approve(adm.id, { finalDiagnosis: 'Observation complete', treatmentSummary: 'Monitored', medicationInstructions: 'None', followUp: 'OPD in 1 week' })
  await session.switchUser('usr_reception')
  await expect('Discharge cannot complete with an unsettled bill', () => s.dischargeService.complete(adm.id), true, /settle/i)
  await session.switchUser('usr_billing')
  const finalBill = await s.patientBillingService.finalise(confirmed.accountId)
  out.push({ name: 'Final bill posts room charges', ok: finalBill.charges.some((c) => c.category === 'ROOM') && !!finalBill.billNo, detail: finalBill.billNo })
  await expect('Payment over balance rejected', () => s.patientBillingService.recordPayment(confirmed.accountId, { amount: finalBill.totals.balance + 1000, method: 'CASH', kind: 'FINAL' }), true, /exceeds/i)
  const paid = await s.patientBillingService.recordPayment(confirmed.accountId, { amount: finalBill.totals.balance, method: 'UPI', kind: 'FINAL' })
  out.push({ name: 'Full payment settles the bill', ok: paid.status === 'SETTLED' && Math.abs(paid.totals.balance) < 0.01, detail: paid.status })
  await session.switchUser('usr_reception')
  const done = await s.dischargeService.complete(adm.id)
  const bedAfter = (await s.roomService.list()).flatMap((r) => r.beds).find((b) => b.id === freeBed.id)
  out.push({ name: 'Completed discharge releases the bed', ok: done.status === 'DISCHARGED' && bedAfter.status === 'AVAILABLE', detail: `${done.status}/${bedAfter.status}` })

  // Patient portal
  const portal = await expect('Portal booking (new patient)', async () => {
    const d = doctors.find((x) => x.consultationTypes.includes('VIDEO'))
    for (let i = 1; i < 10; i++) {
      const sl = (await s.patientPortalService.slots(d.id, day(i))).find((x) => x.available)
      if (sl) return s.patientPortalService.book({ name: 'Portal Person', phone: '9988776655', dateOfBirth: '1985-05-05', gender: 'MALE' }, { doctorId: d.id, type: 'VIDEO', date: day(i), start: sl.start, reason: 'Online consult' })
    }
    throw new Error('no slot')
  }, false)
  if (portal) {
    out.push({ name: 'Portal booking starts as Pending', ok: portal.status === 'PENDING', detail: portal.appointmentNo })
    await expect('Portal lookup needs matching DOB', () => s.patientPortalService.myAppointments('9988776655', '1999-01-01'), true, /No patient/i)
    const mine = await s.patientPortalService.myAppointments('9988776655', '1985-05-05')
    out.push({ name: 'Portal lists own appointments', ok: mine.some((a) => a.appointmentNo === portal.appointmentNo) })
    const c = await s.patientPortalService.cancel(portal.appointmentNo, '9988776655', '1985-05-05')
    out.push({ name: 'Portal cancel', ok: c.status === 'CANCELLED' })
  }
  out.push({ name: 'No healthcare records in localStorage', ok: Object.keys(localStorage).every((k) => !/clinic-db|patient/i.test(k)) && !/E2E Test Patient|Penicillin/.test(JSON.stringify(localStorage)), detail: Object.keys(localStorage).join(', ') })
  await session.switchUser('usr_admin')
  return out
}, BASE)
for (const r of rules) record(`rule: ${r.name}`, r.ok, r.detail)

// ── Mobile ──
const mobile = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage()
for (const r of ['/doctors', '/appointments', '/patients', '/admissions', '/rooms', '/inpatients', '/billing', '/discharges', '/clinical', '/shop/doctors']) {
  await mobile.goto(`${BASE}#${r}`)
  await mobile.waitForSelector('main h1', { timeout: 20000 })
  await mobile.waitForTimeout(500)
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await mobile.screenshot({ path: `${SHOTS}/m${r.replace(/\//g, '_')}.png`, fullPage: true })
  record(`mobile ${r} has no horizontal page scroll`, overflow <= 1, `overflow ${overflow}px`)
}
record('No console errors', errors.length === 0, errors.slice(0, 5).join(' | '))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} healthcare checks passed`)
process.exit(failed.length ? 1 : 0)
