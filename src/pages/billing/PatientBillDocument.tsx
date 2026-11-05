import { CHARGE_CATEGORY_LABEL } from '../../lib/clinic'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { AccountView } from '../../types/clinicApi'
import { ClinicLetterhead } from './PrintPortal'
import { PATIENT_PAYMENT_METHOD_LABEL, PAYMENT_KIND_LABEL } from './labels'

/** Printable patient bill (not a GST tax invoice; pharmacy invoices are issued separately). */
export function PatientBillDocument({ account: a }: { account: AccountView }) {
  const t = a.totals
  return (
    <div className="mx-auto max-w-3xl bg-white text-[12px] text-ink-900">
      <ClinicLetterhead
        title={a.status === 'OPEN' ? 'Interim patient statement' : 'Patient bill'}
        reference={
          <>
            <div className="font-mono font-semibold">{a.billNo ?? a.accountNo}</div>
            <div>{formatDate(a.finalisedAt ?? new Date().toISOString())}</div>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-6 border-b border-ink-200 py-3">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Patient</div>
          <div className="font-semibold">{a.patientName}</div>
          <div className="text-ink-600">ID {a.patientCode}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">{a.admissionId ? 'Inpatient' : 'Outpatient'}</div>
          <div className="font-mono">{a.admissionNo ?? a.appointmentNo ?? '—'}</div>
          <div className="text-ink-600">Account {a.accountNo}</div>
        </div>
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-300 text-left text-[10px] tracking-wider text-ink-500 uppercase">
            <th className="py-1.5 pr-2">Date</th>
            <th className="py-1.5 pr-2">Description</th>
            <th className="py-1.5 pr-2">Category</th>
            <th className="py-1.5 pr-2 text-right">Qty</th>
            <th className="py-1.5 pr-2 text-right">Rate</th>
            <th className="py-1.5 pr-2 text-right">Tax</th>
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {a.charges.map((c) => (
            <tr key={c.id} className="border-b border-ink-100">
              <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(c.date)}</td>
              <td className="py-1.5 pr-2">{c.description}</td>
              <td className="py-1.5 pr-2">{CHARGE_CATEGORY_LABEL[c.category]}</td>
              <td className="num py-1.5 pr-2 text-right">{c.quantity}</td>
              <td className="num py-1.5 pr-2 text-right">{c.rate.toFixed(2)}</td>
              <td className="num py-1.5 pr-2 text-right">{c.tax ? c.tax.toFixed(2) : '—'}</td>
              <td className="num py-1.5 text-right font-semibold">{(c.amount + c.tax).toFixed(2)}</td>
            </tr>
          ))}
          {a.accruedRoom && (
            <tr className="border-b border-ink-100 text-ink-500 italic">
              <td className="py-1.5 pr-2">—</td>
              <td className="py-1.5 pr-2">Room {a.accruedRoom.roomNumber} — {a.accruedRoom.nights} night(s), accrued (not yet posted)</td>
              <td className="py-1.5 pr-2">Room</td>
              <td className="num py-1.5 pr-2 text-right">{a.accruedRoom.nights}</td>
              <td className="num py-1.5 pr-2 text-right">{a.accruedRoom.rate.toFixed(2)}</td>
              <td className="py-1.5 pr-2 text-right">—</td>
              <td className="num py-1.5 text-right">({a.accruedRoom.amount.toFixed(2)})</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Payments</div>
          {a.payments.length === 0 ? (
            <p className="text-ink-500">No payments recorded.</p>
          ) : (
            <table className="w-full text-[11px]">
              <tbody>
                {a.payments.map((p) => (
                  <tr key={p.id} className="border-b border-ink-100">
                    <td className="py-1">{formatDateTime(p.date)}</td>
                    <td className="py-1">
                      {PAYMENT_KIND_LABEL[p.kind]} · {PATIENT_PAYMENT_METHOD_LABEL[p.method]}
                    </td>
                    <td className="py-1 font-mono">{p.receiptNo}</td>
                    <td className="num py-1 text-right">{p.kind === 'REFUND' ? '−' : ''}{p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="space-y-1">
          {[
            ['Charges', formatINR(t.charges)],
            ['Tax', formatINR(t.tax)],
            ['Discount', t.discount ? `−${formatINR(t.discount)}` : formatINR(0)],
            ['Net amount', formatINR(t.net)],
            ['Paid', formatINR(t.paid)],
            ['Refunded', formatINR(t.refunded)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-ink-600">{k}</span>
              <span className="num">{v}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t-2 border-ink-900 pt-2 text-[15px] font-bold">
            <span>{t.balance < 0 ? 'Refund due' : 'Balance due'}</span>
            <span className="num">{formatINR(Math.abs(t.balance))}</span>
          </div>
        </div>
      </div>
      <p className="mt-6 border-t border-ink-200 pt-3 text-[10px] text-ink-500">
        This is a patient bill for clinical services. Medicines purchased from Saraswati Medicines Store are billed on separate pharmacy tax invoices; linked invoices appear above under Medicines. Tax treatment is configurable and must be confirmed by the facility’s accountant.
      </p>
    </div>
  )
}
