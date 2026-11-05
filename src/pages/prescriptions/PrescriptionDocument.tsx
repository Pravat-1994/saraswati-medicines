import { ageFrom } from '../../lib/clinic'
import { formatDate, formatDateTime } from '../../lib/dates'
import type { Doctor, Patient } from '../../types/clinic'
import type { PrescriptionView } from '../../types/clinicApi'
import type { StoreProfile } from '../../types/domain'
import { BrandMark } from '../../components/layout/BrandLogo'

/** Printable prescription in a professional letterhead layout. */
export function PrescriptionDocument({ rx, patient, doctor, facilityName, store }: { rx: PrescriptionView; patient: Patient; doctor: Doctor; facilityName: string; store: StoreProfile }) {
  const draft = rx.status === 'DRAFT'
  return (
    <div className="print-area relative mx-auto max-w-3xl overflow-hidden bg-white text-[12.5px] text-ink-900">
      {draft && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-[24deg] font-display text-5xl font-extrabold tracking-widest text-red-500/15 sm:text-7xl">DRAFT</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-6 border-b-2 border-brand-700 pb-4">
        <div className="flex items-start gap-3">
          <BrandMark className="h-11 w-11" />
          <div>
            <div className="font-display text-lg font-extrabold text-ink-950">{facilityName}</div>
            <div className="text-ink-600">
              {store.addressLine}, {store.city}, {store.state} – {store.pincode}
            </div>
            <div className="text-ink-600">{store.phone}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[15px] font-bold text-ink-950">{doctor.name}</div>
          <div className="text-ink-600">{doctor.qualifications}</div>
          <div className="text-ink-600">{doctor.specialization}</div>
          <div className="mt-1 font-mono text-[11px] text-ink-500">
            Reg. {doctor.registrationNo} · {doctor.registrationCouncil}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-ink-200 py-3 sm:grid-cols-4">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Patient</div>
          <div className="font-semibold">{patient.name}</div>
          <div className="text-ink-600">
            {ageFrom(patient.dateOfBirth)} yrs · {patient.gender.toLowerCase()}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Patient ID</div>
          <div className="font-mono">{patient.patientCode}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Prescription</div>
          <div className="font-mono font-semibold">{rx.rxNo}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Date</div>
          <div>{formatDate(rx.createdAt.slice(0, 10))}</div>
        </div>
      </div>

      {patient.allergies.length > 0 && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 font-semibold text-red-700">Allergies: {patient.allergies.join(', ')}</div>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Diagnosis</span>
          <div className="font-medium">{rx.diagnosis}</div>
        </div>
        {rx.symptoms && (
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Symptoms</span>
            <div>{rx.symptoms}</div>
          </div>
        )}
      </div>

      <div className="mt-4 font-display text-3xl font-bold text-brand-700" aria-label="Prescription">
        ℞
      </div>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-300 text-left text-[10px] tracking-wider text-ink-500 uppercase">
            <th className="py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Medicine</th>
            <th className="py-1.5 pr-2">Dosage</th>
            <th className="py-1.5 pr-2">Frequency</th>
            <th className="py-1.5 pr-2">Duration</th>
            <th className="py-1.5 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {rx.items.map((i, idx) => (
            <tr key={i.id} className="border-b border-ink-100 align-top">
              <td className="py-2 pr-2 text-ink-500">{idx + 1}</td>
              <td className="py-2 pr-2">
                <div className="font-semibold">{i.medicineName}</div>
                {i.instructions && <div className="text-[11px] text-ink-600 italic">{i.instructions}</div>}
              </td>
              <td className="py-2 pr-2">{i.dosage}</td>
              <td className="py-2 pr-2">{i.frequency}</td>
              <td className="py-2 pr-2">{i.duration}</td>
              <td className="num py-2 text-right">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rx.recommendations && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Advice</div>
          <p className="leading-relaxed">{rx.recommendations}</p>
        </div>
      )}
      {rx.followUpDate && (
        <p className="mt-3">
          <span className="font-semibold">Follow-up:</span> {formatDate(rx.followUpDate)}
        </p>
      )}

      <div className="mt-8 flex items-end justify-between gap-6 border-t border-ink-200 pt-4">
        <p className="max-w-sm text-[10px] text-ink-500">Dispense as written. Substitution only with the prescriber’s authorisation. Valid only with the prescriber’s signature.</p>
        <div className="text-right">
          {rx.signature ? (
            <>
              <div className="font-display text-base font-semibold text-brand-800 italic">{rx.signature.name}</div>
              <div className="text-[11px] text-ink-500">
                Digitally signed · Reg. {rx.signature.registrationNo}
                <br />
                {formatDateTime(rx.signature.signedAt)}
              </div>
            </>
          ) : (
            <div className="font-semibold text-red-600">DRAFT — not valid for dispensing</div>
          )}
        </div>
      </div>
    </div>
  )
}
