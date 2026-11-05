/**
 * Healthcare demo data. Generated relative to "now" so appointments, admissions
 * and vitals always look current. All records are fictional.
 */
import { CATALOG } from './catalog'
import { DEFAULT_CLINIC_SETTINGS, DOCTORS, PATIENTS, ROOMS } from './clinicCatalog'
import { ACTIVE_ADMISSION, doctorSlots, nightsBetween } from '../lib/clinic'
import { addDays, startOfDay, toISODate } from '../lib/dates'
import { round2 } from '../lib/money'
import { documentNumber } from '../lib/utils'
import type {
  Admission,
  AdmissionStatus,
  Appointment,
  AppointmentStatus,
  Bed,
  ClinicalEntry,
  ClinicSettings,
  Consultation,
  ConsultationType,
  Doctor,
  DoctorReview,
  Patient,
  PatientAccount,
  PatientCharge,
  Prescription,
  PrescriptionItem,
  Room,
} from '../types/clinic'

export type ClinicCounter = 'patient' | 'appointment' | 'consultation' | 'rx' | 'admission' | 'account' | 'receipt' | 'bill'

export interface ClinicDatabase {
  doctors: Doctor[]
  reviews: DoctorReview[]
  patients: Patient[]
  appointments: Appointment[]
  consultations: Consultation[]
  prescriptions: Prescription[]
  rooms: Room[]
  admissions: Admission[]
  clinical: ClinicalEntry[]
  accounts: PatientAccount[]
  settings: ClinicSettings
  counters: Record<ClinicCounter, number>
}

function rngFrom(seed: number) {
  let a = seed
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    float: next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  }
}

const medId = (name: string): string | undefined => {
  const i = CATALOG.findIndex((c) => c.name === name)
  return i >= 0 ? `med_${String(i + 1).padStart(3, '0')}` : undefined
}

const RX_TEMPLATES: Record<string, { diagnosis: string; symptoms: string; items: [string, string, string, string, string, number][]; advice: string }[]> = {
  'General Physician': [
    { diagnosis: 'Acute viral fever', symptoms: 'Fever 101°F for 2 days, body ache, mild headache', items: [['Dolo 650', '1 tablet', 'Three times a day', '3 days', 'After food. Only if temperature above 100°F', 1], ['Electral ORS', '1 sachet in 1 L water', 'Sip through the day', '3 days', 'Maintain hydration', 4]], advice: 'Rest, plenty of fluids. Return if fever persists beyond 3 days or rash appears.' },
    { diagnosis: 'Type 2 diabetes mellitus — follow-up', symptoms: 'Routine review, fasting sugar 142 mg/dL', items: [['Glycomet GP 1', '1 tablet', 'Once daily before breakfast', '30 days', 'Do not skip meals', 2], ['Atorva 10', '1 tablet', 'Once daily at night', '30 days', '', 2]], advice: 'Low-sugar diet, 30 minutes of brisk walking daily. HbA1c in 3 months.' },
    { diagnosis: 'Essential hypertension', symptoms: 'BP 150/96 on two readings, occasional headache', items: [['Telma 40', '1 tablet', 'Once daily in the morning', '30 days', '', 1], ['Amlokind 5', '1 tablet', 'Once daily at night', '30 days', 'Report ankle swelling', 1]], advice: 'Reduce salt, home BP log twice daily.' },
  ],
  Cardiologist: [{ diagnosis: 'Stable coronary artery disease', symptoms: 'Exertional chest tightness, resolved with rest', items: [['Ecosprin 75', '1 tablet', 'Once daily after lunch', '30 days', 'Continue long term', 2], ['Rosuvas 10', '1 tablet', 'Once daily at night', '30 days', '', 2], ['Ivabradine 5 mg', '1 tablet', 'Twice daily', '30 days', 'Not stocked — obtain from hospital pharmacy', 2]], advice: 'Avoid heavy exertion. Lipid profile and ECG in 6 weeks.' }],
  Paediatrician: [{ diagnosis: 'Upper respiratory tract infection', symptoms: 'Cough and runny nose for 3 days, mild fever', items: [['Calpol 250 Suspension', '5 ml', 'Every 6 hours if fever', '3 days', 'Measure with the cup provided', 1], ['Cetzine 10', '½ tablet', 'Once at night', '5 days', '', 1]], advice: 'Steam inhalation, warm fluids. Review if breathing becomes fast.' }],
  Dermatologist: [{ diagnosis: 'Tinea corporis', symptoms: 'Itchy ring-shaped rash on the waist for 2 weeks', items: [['Candid Cream', 'Thin layer', 'Twice daily', '4 weeks', 'Apply 2 cm beyond the edge of the rash', 2], ['Avil 25', '1 tablet', 'At night if itching', '7 days', 'May cause drowsiness', 1]], advice: 'Keep the area dry, loose cotton clothing, do not share towels.' }],
  Endocrinologist: [{ diagnosis: 'Hypothyroidism', symptoms: 'Fatigue, TSH 7.8 mIU/L', items: [['Thyronorm 50', '1 tablet', 'Once daily, empty stomach', '60 days', '30 minutes before breakfast', 1]], advice: 'Repeat TSH after 6 weeks.' }],
  Pulmonologist: [{ diagnosis: 'Bronchial asthma — acute exacerbation', symptoms: 'Wheeze and breathlessness at night', items: [['Asthalin Inhaler', '2 puffs', 'When required, up to 4 times a day', '30 days', 'Use with spacer', 1], ['Montair LC', '1 tablet', 'Once at night', '14 days', '', 1]], advice: 'Avoid dust and smoke. Learn inhaler technique with the pharmacist.' }],
  'ENT Specialist': [{ diagnosis: 'Acute sinusitis', symptoms: 'Facial pain, nasal blockage, post-nasal drip', items: [['Otrivin Nasal Drops', '2 drops each nostril', 'Twice daily', '5 days', 'Do not use more than 5 days', 1], ['Augmentin 625 Duo', '1 tablet', 'Twice daily', '5 days', 'Complete the course', 1]], advice: 'Steam inhalation thrice daily.' }],
  'Orthopaedic Surgeon': [{ diagnosis: 'Lumbar muscle strain', symptoms: 'Low back pain after lifting, no radiation', items: [['Volini Gel', 'Apply locally', 'Three times a day', '7 days', '', 1], ['Combiflam', '1 tablet', 'Twice daily after food', '5 days', 'Stop if stomach upset', 1]], advice: 'Hot fomentation, avoid lifting heavy weights for 2 weeks.' }],
}

export function generateClinicSeed(now: Date = new Date()): ClinicDatabase {
  const rng = rngFrom(20261106)
  const today = startOfDay(now)
  const iso = (d: Date) => d.toISOString()
  const at = (dayOffset: number, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = addDays(today, dayOffset)
    d.setHours(h, m, 0, 0)
    return d
  }
  const counters: Record<ClinicCounter, number> = { patient: 0, appointment: 0, consultation: 0, rx: 0, admission: 0, account: 0, receipt: 0, bill: 0 }
  const no = (key: ClinicCounter, prefix: string, date: Date) => documentNumber(prefix, ++counters[key], date)
  const settings = structuredClone(DEFAULT_CLINIC_SETTINGS)

  const doctors: Doctor[] = DOCTORS.map((d) => ({ ...d, isActive: true }))
  const doctorName = (id: string) => doctors.find((d) => d.id === id)!.name
  const reception = 'Swati Jena'
  const nurse = 'Sr. Mamata Pradhan'

  // ── patients ──
  const patients: Patient[] = PATIENTS.map((p, i) => {
    const regDate = addDays(today, -rng.int(20, 400))
    counters.patient++
    return {
      id: `pat_${String(i + 1).padStart(3, '0')}`,
      patientCode: `SMP-${String(i + 1).padStart(5, '0')}`,
      name: p.name,
      dateOfBirth: p.dob,
      gender: p.gender,
      phone: `+91 9${rng.int(100, 999)}${rng.int(10, 99)} ${rng.int(10000, 99999)}`,
      email: rng.chance(0.4) ? `${p.name.split(' ')[0].toLowerCase()}.${rng.int(10, 99)}@example.in` : undefined,
      address: `${p.area}, Bhubaneswar, Odisha`,
      emergencyContact: rng.chance(0.85) ? { name: `${rng.pick(['Sanjukta', 'Prasant', 'Mamata', 'Sudhir', 'Rina', 'Amit'])} ${p.name.split(' ').slice(-1)[0]}`, relation: rng.pick(['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling']), phone: `+91 9${rng.int(100, 999)}${rng.int(10, 99)} ${rng.int(10000, 99999)}` } : undefined,
      bloodGroup: p.blood,
      allergies: p.allergies,
      conditions: p.conditions,
      history: p.conditions.length ? `Known case of ${p.conditions.join(', ').toLowerCase()}.` : undefined,
      registeredAt: iso(regDate),
      registeredBy: reception,
    }
  })

  // ── appointments, consultations, prescriptions ──
  const appointments: Appointment[] = []
  const consultations: Consultation[] = []
  const prescriptions: Prescription[] = []
  const reviews: DoctorReview[] = []
  const accounts: PatientAccount[] = []
  const booked = new Set<string>()
  const reasons = ['Follow-up visit', 'Fever and body ache', 'Medication review', 'Persistent cough', 'Skin rash', 'Joint pain', 'Breathlessness on exertion', 'Routine check-up', 'Lab report review', 'Headache']

  for (let d = -21; d <= 10; d++) {
    const date = toISODate(addDays(today, d))
    for (const doc of doctors) {
      const slots = doctorSlots(doc, date)
      if (slots.length === 0) continue
      const count = Math.min(slots.length, d < 0 ? rng.int(0, 3) : d === 0 ? rng.int(2, 4) : rng.int(0, 2))
      for (let k = 0; k < count; k++) {
        const slot = slots[rng.int(0, slots.length - 1)]
        const key = `${doc.id}|${date}|${slot.start}`
        if (booked.has(key)) continue
        booked.add(key)
        const patient = rng.pick(patients)
        const type: ConsultationType = rng.pick(doc.consultationTypes)
        const startAt = at(d, slot.start)
        const endAt = at(d, slot.end)
        let status: AppointmentStatus
        if (endAt.getTime() < now.getTime()) status = rng.pick(['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const)
        else if (startAt.getTime() <= now.getTime()) status = 'IN_PROGRESS'
        else if (d === 0) status = rng.pick(['SCHEDULED', 'SCHEDULED', 'CONFIRMED'] as const)
        else status = rng.pick(['PENDING', 'CONFIRMED', 'CONFIRMED', 'SCHEDULED'] as const)
        const created = addDays(startAt, -rng.int(1, 6))
        const via = rng.chance(0.55) ? 'PORTAL' : 'STAFF'
        const appt: Appointment = {
          id: `apt_${String(appointments.length + 1).padStart(4, '0')}`,
          appointmentNo: no('appointment', 'APT', created),
          patientId: patient.id,
          doctorId: doc.id,
          type,
          date,
          start: slot.start,
          end: slot.end,
          status,
          reason: rng.pick(reasons),
          symptoms: rng.chance(0.6) ? rng.pick(['Since 3 days', 'Worse at night', 'Mild, intermittent', 'Started after travel']) : undefined,
          reports: rng.chance(0.25) ? [{ name: rng.pick(['blood-report.pdf', 'xray-chest.jpg', 'ecg.pdf']), size: rng.int(80, 900) * 1024, type: 'application/pdf', uploadedAt: iso(created), uploadedBy: patient.name }] : [],
          fee: doc.consultationFee,
          bookedVia: via,
          createdAt: iso(created),
          cancelReason: status === 'CANCELLED' ? rng.pick(['Patient requested', 'Doctor unavailable — rescheduled']) : undefined,
          history: [{ at: iso(created), by: via === 'PORTAL' ? patient.name : reception, action: 'Booked', note: via === 'PORTAL' ? 'Online booking' : 'Booked at reception' }],
        }
        if (status !== 'PENDING') appt.history.push({ at: iso(addDays(created, 0)), by: reception, action: 'Confirmed' })
        if (status === 'CANCELLED') appt.history.push({ at: iso(addDays(startAt, -1)), by: reception, action: 'Cancelled', note: appt.cancelReason })
        if (status === 'NO_SHOW') appt.history.push({ at: iso(endAt), by: doc.name, action: 'Marked no-show' })
        appointments.push(appt)

        if (status === 'COMPLETED' || status === 'IN_PROGRESS') {
          const c: Consultation = {
            id: `con_${String(consultations.length + 1).padStart(4, '0')}`,
            appointmentId: appt.id,
            patientId: patient.id,
            doctorId: doc.id,
            type,
            status: status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
            startedAt: iso(startAt),
            endedAt: status === 'COMPLETED' ? iso(new Date(endAt.getTime() - rng.int(0, 4) * 60_000)) : undefined,
            messages: [
              { id: `msg_${appt.id}_1`, from: 'SYSTEM', author: 'System', text: `${type === 'IN_PERSON' ? 'In-person' : type === 'VIDEO' ? 'Video' : 'Audio'} consultation started`, at: iso(startAt) },
              ...(type !== 'IN_PERSON' ? [{ id: `msg_${appt.id}_2`, from: 'PATIENT' as const, author: patient.name, text: 'Good morning doctor, I have uploaded my report.', at: iso(new Date(startAt.getTime() + 60_000)) }] : []),
            ],
            files: appt.reports,
            notes: status === 'COMPLETED' ? 'History taken, examined. Advice given as per prescription.' : '',
          }
          consultations.push(c)
          appt.consultationId = c.id
          appt.history.push({ at: iso(startAt), by: doc.name, action: 'Consultation started' })
          if (status === 'COMPLETED') appt.history.push({ at: c.endedAt!, by: doc.name, action: 'Completed' })

          const templates = RX_TEMPLATES[doc.specialization]
          if (status === 'COMPLETED' && templates && rng.chance(0.75)) {
            const t = rng.pick(templates)
            const created = new Date(c.endedAt!)
            const items: PrescriptionItem[] = t.items.map(([name, dosage, frequency, duration, instructions, qty], i) => ({ id: `rxi_${prescriptions.length + 1}_${i}`, medicineId: medId(name), medicineName: name, dosage, frequency, duration, instructions, quantity: qty, dispensedQty: 0 }))
            const draft = d >= -1 && rng.chance(0.2)
            prescriptions.push({
              id: `rx_${String(prescriptions.length + 1).padStart(4, '0')}`,
              rxNo: no('rx', 'RX', created),
              patientId: patient.id,
              doctorId: doc.id,
              consultationId: c.id,
              appointmentId: appt.id,
              createdAt: iso(created),
              updatedAt: iso(created),
              diagnosis: t.diagnosis,
              symptoms: t.symptoms,
              items,
              recommendations: t.advice,
              followUpDate: toISODate(addDays(created, rng.pick([7, 14, 30]))),
              status: draft ? 'DRAFT' : 'FINAL',
              signature: draft ? undefined : { name: doc.name, registrationNo: doc.registrationNo, signedAt: iso(created), userId: doc.userId ?? 'external' },
              fulfilment: 'PENDING',
              saleIds: [],
              history: [{ at: iso(created), by: doc.name, action: draft ? 'Draft saved' : 'Finalised & signed' }],
            })
          }
          if (status === 'COMPLETED' && rng.chance(0.35)) {
            reviews.push({ id: `rev_${reviews.length + 1}`, doctorId: doc.id, patientInitials: patient.name.split(' ').map((w) => w[0]).join('').slice(0, 2), rating: rng.pick([4, 5, 5, 5, 4, 3]), comment: rng.pick(['Very patient and explained everything clearly.', 'Quick diagnosis, medicines worked well.', 'Good consultation, slightly delayed start.', 'Excellent doctor, highly recommended.', 'Helpful advice on diet and exercise.']), date: date, appointmentId: appt.id })
          }
          if (status === 'COMPLETED') {
            accounts.push({
              id: `acc_${String(accounts.length + 1).padStart(4, '0')}`,
              accountNo: no('account', 'PA', startAt),
              patientId: patient.id,
              appointmentId: appt.id,
              openedAt: iso(startAt),
              charges: [{ id: `chg_${appt.id}`, date: iso(startAt), category: 'CONSULTATION', description: `Consultation — ${doc.name} (${type === 'IN_PERSON' ? 'in-person' : type.toLowerCase()})`, quantity: 1, rate: doc.consultationFee, taxRate: 0, amount: doc.consultationFee, tax: 0, addedBy: reception }],
              discount: 0,
              payments: [{ id: `pay_${appt.id}`, receiptNo: no('receipt', 'RCPT', startAt), date: iso(startAt), amount: doc.consultationFee, method: rng.pick(['UPI', 'CASH', 'CARD'] as const), kind: 'FINAL', by: reception }],
              status: 'SETTLED',
              finalisedAt: iso(endAt),
              billNo: no('bill', 'OPB', startAt),
            })
          }
        }
      }
    }
  }

  // ── rooms & beds ──
  const rooms: Room[] = ROOMS.map((r, i) => {
    const id = `room_${String(i + 1).padStart(2, '0')}`
    return {
      id,
      number: r.number,
      type: r.type,
      department: r.department,
      floor: r.floor,
      dailyRate: r.dailyRate,
      beds: Array.from({ length: r.beds }, (_, b): Bed => ({ id: `${id}_b${b + 1}`, roomId: id, label: r.beds === 1 ? `${r.number}` : `${r.number}-${String.fromCharCode(65 + b)}`, status: 'AVAILABLE' })),
    }
  })
  const bedById = (bedId: string) => rooms.flatMap((r) => r.beds).find((b) => b.id === bedId)!
  bedById('room_04_b6').status = 'MAINTENANCE'
  bedById('room_04_b6').note = 'Bed rail repair'

  // ── admissions ──
  const admissions: Admission[] = []
  const clinical: ClinicalEntry[] = []
  interface AdmSeed {
    patient: number
    doctor: string
    status: AdmissionStatus
    type: Admission['type']
    bed?: string
    daysAgo: number
    reason: string
    diagnosis: string
    dept: string
    stay?: number
  }
  const plan: AdmSeed[] = [
    { patient: 28, doctor: 'doc_02', status: 'UNDER_TREATMENT', type: 'EMERGENCY', bed: 'room_07_b1', daysAgo: 3, reason: 'Acute breathlessness, swelling of legs', diagnosis: 'Decompensated heart failure', dept: 'Cardiology' },
    { patient: 4, doctor: 'doc_01', status: 'UNDER_TREATMENT', type: 'PLANNED', bed: 'room_03_b2', daysAgo: 2, reason: 'Uncontrolled blood sugar with foot ulcer', diagnosis: 'Type 2 DM with diabetic foot', dept: 'General Medicine' },
    { patient: 10, doctor: 'doc_10', status: 'UNDER_TREATMENT', type: 'REFERRAL', bed: 'room_06_b1', daysAgo: 4, reason: 'COPD exacerbation, low oxygen saturation', diagnosis: 'Acute exacerbation of COPD', dept: 'Pulmonology' },
    { patient: 7, doctor: 'doc_05', status: 'ADMITTED', type: 'PLANNED', bed: 'room_04_b1', daysAgo: 0, reason: 'Knee pain — planned physiotherapy & pain management', diagnosis: 'Osteoarthritis knee, bilateral', dept: 'Orthopaedics' },
    { patient: 29, doctor: 'doc_10', status: 'ADMITTED', type: 'EMERGENCY', bed: 'room_01_b1', daysAgo: 0, reason: 'Severe wheeze not responding to inhaler', diagnosis: 'Acute severe asthma', dept: 'Emergency' },
    { patient: 21, doctor: 'doc_01', status: 'DISCHARGE_REQUESTED', type: 'OBSERVATION', bed: 'room_02_b1', daysAgo: 2, reason: 'High-grade fever, dehydration', diagnosis: 'Acute gastroenteritis with dehydration', dept: 'General Medicine' },
    { patient: 14, doctor: 'doc_02', status: 'APPROVED', type: 'PLANNED', bed: 'room_05_b1', daysAgo: 0, reason: 'Planned evaluation — chest pain on exertion', diagnosis: 'Suspected stable angina', dept: 'Cardiology' },
    { patient: 19, doctor: 'doc_04', status: 'REQUESTED', type: 'PLANNED', daysAgo: 0, reason: 'Antenatal observation — high BP readings', diagnosis: 'Gestational hypertension (to evaluate)', dept: 'Obstetrics & Gynaecology' },
    { patient: 23, doctor: 'doc_01', status: 'REQUESTED', type: 'REFERRAL', daysAgo: 0, reason: 'Referred for fall risk assessment and IV hydration', diagnosis: 'Dehydration, Parkinson’s disease', dept: 'General Medicine' },
    { patient: 0, doctor: 'doc_01', status: 'DISCHARGED', type: 'EMERGENCY', daysAgo: 12, stay: 4, reason: 'Hypoglycaemic episode', diagnosis: 'Drug-induced hypoglycaemia', dept: 'General Medicine' },
    { patient: 21, doctor: 'doc_05', status: 'DISCHARGED', type: 'PLANNED', daysAgo: 20, stay: 3, reason: 'Ankle sprain with severe swelling', diagnosis: 'Grade II ankle sprain', dept: 'Orthopaedics' },
    { patient: 24, doctor: 'doc_01', status: 'DISCHARGED', type: 'OBSERVATION', daysAgo: 8, stay: 2, reason: 'Severe anaemia — fatigue, dizziness', diagnosis: 'Iron-deficiency anaemia', dept: 'General Medicine' },
    { patient: 16, doctor: 'doc_01', status: 'CANCELLED', type: 'PLANNED', daysAgo: 5, reason: 'Planned observation for chest pain', diagnosis: 'Non-cardiac chest pain', dept: 'General Medicine' },
  ]
  const dischargedBeds = ['room_03_b4', 'room_04_b3', 'room_02_b3']
  plan.forEach((p, idx) => {
    const patient = patients[p.patient]
    const requested = at(-p.daysAgo, `${String(rng.int(8, 14)).padStart(2, '0')}:${rng.pick(['05', '20', '40'])}`)
    const isActive = ACTIVE_ADMISSION.includes(p.status)
    const isDischarged = p.status === 'DISCHARGED'
    const bedId = p.bed ?? (isDischarged ? dischargedBeds[idx % dischargedBeds.length] : undefined)
    const room = bedId ? rooms.find((r) => r.beds.some((b) => b.id === bedId)) : undefined
    const admittedAt = isActive || isDischarged ? new Date(requested.getTime() + 45 * 60_000) : undefined
    const dischargedAt = isDischarged && admittedAt ? addDays(admittedAt, p.stay ?? 2) : undefined
    const a: Admission = {
      id: `adm_${String(idx + 1).padStart(3, '0')}`,
      admissionNo: no('admission', 'IPD', requested),
      patientId: patient.id,
      doctorId: p.doctor,
      requestedAt: iso(requested),
      requestedBy: reception,
      admittedAt: admittedAt ? iso(admittedAt) : undefined,
      expectedDischarge: isActive ? toISODate(addDays(today, rng.int(1, 3))) : undefined,
      reason: p.reason,
      diagnosis: p.diagnosis,
      type: p.type,
      department: p.dept,
      roomId: room?.id,
      bedId,
      attendant: patient.emergencyContact,
      initialObservations: 'Conscious, oriented. Vitals recorded on arrival. Allergies verified with the patient.',
      status: p.status,
      bedHistory: bedId && admittedAt ? [{ bedId, roomId: room!.id, from: iso(admittedAt), to: dischargedAt ? iso(dischargedAt) : undefined, reason: 'Initial allocation', by: reception }] : [],
      discharge: { status: 'NOT_REQUESTED' },
      cancelReason: p.status === 'CANCELLED' ? 'Patient opted for OPD follow-up instead' : undefined,
      history: [{ at: iso(requested), by: reception, action: 'Admission requested', note: p.reason }],
    }
    if (p.status !== 'REQUESTED' && p.status !== 'CANCELLED') a.history.push({ at: iso(new Date(requested.getTime() + 20 * 60_000)), by: doctorName(p.doctor), action: 'Approved' })
    if (p.status === 'CANCELLED') a.history.push({ at: iso(new Date(requested.getTime() + 3600_000)), by: reception, action: 'Cancelled', note: a.cancelReason })
    if (admittedAt) a.history.push({ at: iso(admittedAt), by: reception, action: 'Admitted', note: `Bed ${bedById(bedId!).label}` })
    if (bedId && p.status === 'APPROVED') {
      bedById(bedId).status = 'RESERVED'
      bedById(bedId).admissionId = a.id
    }
    if (bedId && isActive) {
      bedById(bedId).status = 'OCCUPIED'
      bedById(bedId).admissionId = a.id
    }
    if (p.status === 'DISCHARGE_REQUESTED') {
      a.discharge = { status: 'REQUESTED', requestedAt: iso(addDays(now, 0)), requestedBy: doctorName(p.doctor), finalDiagnosis: p.diagnosis, treatmentSummary: 'IV fluids and antipyretics for 48 hours. Tolerating oral diet, afebrile for 24 hours.', medicationInstructions: 'Electral ORS as needed, Dolo 650 SOS for fever.', followUp: 'Review in OPD after 5 days.' }
      a.history.push({ at: a.discharge.requestedAt!, by: doctorName(p.doctor), action: 'Discharge requested' })
    }
    if (isDischarged) {
      a.discharge = {
        status: 'COMPLETED',
        requestedAt: iso(addDays(dischargedAt!, 0)),
        requestedBy: doctorName(p.doctor),
        finalDiagnosis: p.diagnosis,
        treatmentSummary: 'Treated as per protocol. Clinically stable at discharge.',
        medicationInstructions: 'Continue medicines as per discharge prescription.',
        followUp: 'OPD review after 1 week.',
        followUpDate: toISODate(addDays(dischargedAt!, 7)),
        approvedBy: doctorName(p.doctor),
        approvedAt: iso(dischargedAt!),
        completedAt: iso(dischargedAt!),
        completedBy: reception,
      }
      a.history.push({ at: iso(dischargedAt!), by: doctorName(p.doctor), action: 'Discharge approved' }, { at: iso(dischargedAt!), by: reception, action: 'Discharged', note: 'Bed released' })
    }
    admissions.push(a)

    // Clinical records for admitted / discharged patients
    if (admittedAt) {
      const end = dischargedAt ?? now
      clinical.push({ id: `cli_${a.id}_as`, patientId: patient.id, admissionId: a.id, kind: 'ASSESSMENT', at: iso(admittedAt), by: doctorName(p.doctor), byRole: 'Doctor', title: 'Initial assessment', text: `${p.reason}. On examination: ${rng.pick(['pallor present', 'no pallor', 'mild dehydration', 'bilateral wheeze', 'pedal oedema'])}. Plan discussed with the patient and attendant.` })
      clinical.push({ id: `cli_${a.id}_tp`, patientId: patient.id, admissionId: a.id, kind: 'TREATMENT_PLAN', at: iso(new Date(admittedAt.getTime() + 30 * 60_000)), by: doctorName(p.doctor), byRole: 'Doctor', title: 'Treatment plan', text: rng.pick(['IV fluids, monitor intake-output, repeat labs in the morning.', 'Oxygen to keep SpO₂ ≥ 92%, nebulisation 6-hourly, steroids.', 'Diuretics, fluid restriction 1.5 L/day, daily weight.']) })
      let t = admittedAt.getTime()
      let n = 0
      const base = { sys: rng.int(118, 150), dia: rng.int(72, 94), hr: rng.int(78, 108), temp: rng.pick([37.0, 37.6, 38.4]), rr: rng.int(16, 24), spo2: rng.int(90, 97), wt: rng.int(48, 82) }
      while (t <= end.getTime() && n < 14) {
        const improve = Math.min(1, n / 8)
        clinical.push({
          id: `cli_${a.id}_v${n}`,
          patientId: patient.id,
          admissionId: a.id,
          kind: 'VITALS',
          at: iso(new Date(t)),
          by: nurse,
          byRole: 'Nurse',
          vitals: {
            systolic: Math.round(base.sys - improve * 10 + rng.int(-4, 4)),
            diastolic: Math.round(base.dia - improve * 6 + rng.int(-3, 3)),
            heartRate: Math.round(base.hr - improve * 14 + rng.int(-4, 4)),
            temperatureC: round2(Math.max(36.6, base.temp - improve * 1.2 + rng.float() * 0.3)),
            respiratoryRate: Math.round(base.rr - improve * 4 + rng.int(-1, 1)),
            spo2: Math.min(99, Math.round(base.spo2 + improve * 4 + rng.int(-1, 1))),
            weightKg: n === 0 ? base.wt : undefined,
          },
        })
        if (n % 2 === 1) clinical.push({ id: `cli_${a.id}_m${n}`, patientId: patient.id, admissionId: a.id, kind: 'MEDICATION', at: iso(new Date(t + 15 * 60_000)), by: nurse, byRole: 'Nurse', medication: { name: rng.pick(['Inj. Pantoprazole 40 mg', 'Tab. Dolo 650', 'Nebulisation — Salbutamol', 'Inj. Furosemide 20 mg', 'IV Normal Saline 500 ml']), dose: rng.pick(['1 dose', '500 ml', '1 tablet']), route: rng.pick(['IV', 'Oral', 'Inhaled']), givenAt: iso(new Date(t + 15 * 60_000)) } })
        if (n % 3 === 2) clinical.push({ id: `cli_${a.id}_p${n}`, patientId: patient.id, admissionId: a.id, kind: 'PROGRESS', at: iso(new Date(t + 40 * 60_000)), by: rng.chance(0.5) ? doctorName(p.doctor) : nurse, byRole: rng.chance(0.5) ? 'Doctor' : 'Nurse', text: rng.pick(['Comfortable, tolerating oral fluids.', 'Symptoms improving, no fresh complaints.', 'Slept well overnight. Ambulating with support.', 'Mild discomfort at cannula site — site changed.']) })
        t += 8 * 3600_000
        n++
      }
    }

    // Patient account for admissions that went ahead
    if (admittedAt || p.status === 'APPROVED') {
      const doc = doctors.find((x) => x.id === p.doctor)!
      const charges: PatientCharge[] = [{ id: `chg_${a.id}_adm`, date: iso(admittedAt ?? requested), category: 'ADMISSION', description: 'Admission & registration', quantity: 1, rate: settings.admissionCharge, taxRate: 0, amount: settings.admissionCharge, tax: 0, addedBy: reception }]
      if (admittedAt) {
        const visits = Math.max(1, nightsBetween(iso(admittedAt), iso(dischargedAt ?? now)))
        charges.push({ id: `chg_${a.id}_doc`, date: iso(admittedAt), category: 'CONSULTATION', description: `Doctor visits — ${doc.name}`, quantity: visits, rate: doc.consultationFee, taxRate: 0, amount: doc.consultationFee * visits, tax: 0, addedBy: reception })
        const svc = rng.pick(settings.serviceCatalog)
        charges.push({ id: `chg_${a.id}_svc`, date: iso(addDays(admittedAt, 0)), category: svc.category, description: svc.name, quantity: 1, rate: svc.rate, taxRate: svc.taxRate, amount: svc.rate, tax: round2((svc.rate * svc.taxRate) / 100), addedBy: 'Alok Ranjan Das' })
        charges.push({ id: `chg_${a.id}_med`, date: iso(addDays(admittedAt, 0)), category: 'MEDICINE', description: 'Ward medicines & consumables (issued from ward stock)', quantity: 1, rate: rng.int(6, 22) * 100, taxRate: 0, amount: 0, tax: 0, addedBy: nurse })
        charges[charges.length - 1].amount = charges[charges.length - 1].rate
        if (dischargedAt && room) {
          const nights = nightsBetween(iso(admittedAt), iso(dischargedAt))
          charges.push({ id: `chg_${a.id}_room`, date: iso(dischargedAt), category: 'ROOM', description: `Room ${room.number} — ${nights} night(s)`, quantity: nights, rate: room.dailyRate, taxRate: 0, amount: room.dailyRate * nights, tax: 0, addedBy: 'System', auto: true })
        }
      }
      const total = charges.reduce((s, c) => s + c.amount + c.tax, 0)
      const advance = p.status === 'APPROVED' ? 0 : rng.pick([2000, 5000, 10000])
      const acc: PatientAccount = {
        id: `acc_${String(accounts.length + 1).padStart(4, '0')}`,
        accountNo: no('account', 'PA', admittedAt ?? requested),
        patientId: patient.id,
        admissionId: a.id,
        openedAt: iso(admittedAt ?? requested),
        charges,
        discount: isDischarged ? rng.pick([0, 0, 500]) : 0,
        payments: advance ? [{ id: `pay_${a.id}_adv`, receiptNo: no('receipt', 'RCPT', admittedAt ?? requested), date: iso(admittedAt ?? requested), amount: advance, method: rng.pick(['UPI', 'CASH', 'CARD'] as const), kind: 'ADVANCE', by: 'Alok Ranjan Das' }] : [],
        status: 'OPEN',
      }
      if (isDischarged) {
        const due = round2(total - acc.discount - advance)
        if (due > 0) acc.payments.push({ id: `pay_${a.id}_fin`, receiptNo: no('receipt', 'RCPT', dischargedAt!), date: iso(dischargedAt!), amount: due, method: rng.pick(['UPI', 'CARD', 'BANK_TRANSFER'] as const), kind: 'FINAL', by: 'Alok Ranjan Das' })
        if (due < 0) acc.payments.push({ id: `pay_${a.id}_ref`, receiptNo: no('receipt', 'RCPT', dischargedAt!), date: iso(dischargedAt!), amount: -due, method: 'CASH', kind: 'REFUND', by: 'Alok Ranjan Das' })
        acc.status = 'SETTLED'
        acc.finalisedAt = iso(dischargedAt!)
        acc.billNo = no('bill', 'IPB', dischargedAt!)
      }
      accounts.push(acc)
      a.accountId = acc.id
    }
  })

  return {
    doctors,
    reviews,
    patients,
    appointments: appointments.sort((x, y) => `${y.date}${y.start}`.localeCompare(`${x.date}${x.start}`)),
    consultations,
    prescriptions: prescriptions.reverse(),
    rooms,
    admissions: admissions.reverse(),
    clinical,
    accounts,
    settings,
    counters,
  }
}
