import { ADMISSION_TYPE_LABEL } from '../../lib/clinic'
import { formatDate, formatDateTime } from '../../lib/dates'
import type { AdmissionDetail } from '../../types/clinicApi'
import { ClinicLetterhead } from '../billing/PrintPortal'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">{title}</h3>
      <div className="text-[13px] leading-relaxed whitespace-pre-line text-ink-800">{children || '—'}</div>
    </section>
  )
}

/** Printable discharge summary. */
export function DischargeSummaryDocument({ detail }: { detail: AdmissionDetail }) {
  const { admission: a, patient: p, doctor: d } = detail
  const s = a.discharge
  return (
    <div className="mx-auto max-w-3xl bg-white text-ink-900">
      <ClinicLetterhead title="Discharge summary" reference={<span className="font-mono font-semibold">{a.admissionNo}</span>} />
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
        <div>
          <span className="text-ink-500">Patient: </span>
          <span className="font-semibold">{p.name}</span> ({a.patientCode})
        </div>
        <div>
          <span className="text-ink-500">Age / sex: </span>
          {a.patientAge} yrs / {a.patientGender.toLowerCase()}
        </div>
        <div>
          <span className="text-ink-500">Admitted: </span>
          {formatDateTime(a.admittedAt)}
        </div>
        <div>
          <span className="text-ink-500">Discharged: </span>
          {s.completedAt ? formatDateTime(s.completedAt) : 'Pending'}
        </div>
        <div>
          <span className="text-ink-500">Length of stay: </span>
          {a.lengthOfStayDays ?? '—'} day(s)
        </div>
        <div>
          <span className="text-ink-500">Admission type: </span>
          {ADMISSION_TYPE_LABEL[a.type]}
        </div>
        <div>
          <span className="text-ink-500">Department / bed: </span>
          {a.department} · {a.bedLabel ?? '—'}
        </div>
        <div>
          <span className="text-ink-500">Treating doctor: </span>
          {d.name}
        </div>
        <div className="col-span-2">
          <span className="text-ink-500">Allergies: </span>
          {p.allergies.length ? p.allergies.join(', ') : 'None known'}
        </div>
      </div>
      <Section title="Reason for admission">{a.reason}</Section>
      <Section title="Final diagnosis">{s.finalDiagnosis}</Section>
      <Section title="Treatment summary">{s.treatmentSummary}</Section>
      <Section title="Medication instructions">{s.medicationInstructions}</Section>
      <Section title="Follow-up">
        {s.followUp}
        {s.followUpDate ? `\nFollow-up date: ${formatDate(s.followUpDate)}` : ''}
      </Section>
      <div className="mt-8 flex items-end justify-between border-t border-ink-200 pt-4 text-[12px]">
        <p className="max-w-sm text-ink-500">In case of worsening symptoms, contact the clinic or visit the nearest emergency department immediately.</p>
        <div className="text-right">
          {s.approvedBy ? (
            <>
              <div className="font-semibold text-ink-900">{s.approvedBy}</div>
              <div className="text-ink-500">
                {d.qualifications} · Reg. {d.registrationNo}
              </div>
              <div className="text-ink-500">Approved {formatDateTime(s.approvedAt)}</div>
            </>
          ) : (
            <div className="font-semibold text-amber-700">DRAFT — not yet approved by a doctor</div>
          )}
        </div>
      </div>
    </div>
  )
}
