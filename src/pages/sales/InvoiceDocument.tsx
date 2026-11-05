import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { computeInvoice } from '../../lib/pricing'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import type { AppSettings, Sale } from '../../types/domain'
import { BrandMark } from '../../components/layout/BrandLogo'

const words = (n: number): string => {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ` ${a[x % 10]}` : ''}`)
  const three = (x: number) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${two(x % 100)}` : ''}` : two(x))
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 1e7)
  const lakh = Math.floor((n % 1e7) / 1e5)
  const thousand = Math.floor((n % 1e5) / 1e3)
  const rest = n % 1e3
  if (crore) parts.push(`${three(crore)} Crore`)
  if (lakh) parts.push(`${two(lakh)} Lakh`)
  if (thousand) parts.push(`${two(thousand)} Thousand`)
  if (rest) parts.push(three(rest))
  return parts.join(' ')
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  return `Rupees ${words(rupees)}${paise ? ` and ${words(paise)} Paise` : ''} Only`
}

/** Printable GST tax invoice. */
export function InvoiceDocument({ sale, settings }: { sale: Sale; settings: AppSettings }) {
  const st = settings.store
  const breakup = computeInvoice(sale.items, false).gstBreakup
  return (
    <div className="print-area mx-auto max-w-3xl bg-white text-[12px] text-ink-900">
      <div className="flex items-start justify-between gap-6 border-b-2 border-brand-700 pb-4">
        <div className="flex items-start gap-3">
          <BrandMark className="h-11 w-11" />
          <div>
            <div className="font-display text-lg font-extrabold text-ink-950">{st.name}</div>
            <div className="text-ink-600">{st.addressLine}, {st.city}, {st.state} – {st.pincode}</div>
            <div className="text-ink-600">
              {st.phone} · {st.email}
            </div>
            <div className="mt-1 text-ink-600">
              GSTIN: <span className="font-mono font-semibold text-ink-800">{st.gstin}</span> · DL: <span className="font-mono">{st.drugLicenseNo}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-sm font-bold tracking-[0.18em] text-brand-700 uppercase">Tax Invoice</div>
          <div className="mt-1 font-mono text-[13px] font-semibold">{sale.invoiceNumber}</div>
          <div className="text-ink-600">{formatDateTime(sale.date)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 border-b border-ink-200 py-3">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Billed to</div>
          <div className="font-semibold">{sale.customerName}</div>
          {sale.customerPhone && <div className="text-ink-600">{sale.customerPhone}</div>}
          {sale.prescriptionRef && <div className="text-ink-600">Rx: {sale.prescriptionRef}</div>}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Payment</div>
          <div className="font-semibold">{PAYMENT_METHOD_LABEL[sale.paymentMethod]}</div>
          {sale.paymentReference && <div className="font-mono text-ink-600">{sale.paymentReference}</div>}
          <div className="text-ink-600">Cashier: {sale.cashierName}</div>
        </div>
      </div>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-300 text-left text-[10px] tracking-wider text-ink-500 uppercase">
            <th className="py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Item</th>
            <th className="py-1.5 pr-2">HSN</th>
            <th className="py-1.5 pr-2">Batch / Exp</th>
            <th className="py-1.5 pr-2 text-right">Qty</th>
            <th className="py-1.5 pr-2 text-right">MRP</th>
            <th className="py-1.5 pr-2 text-right">Disc</th>
            <th className="py-1.5 pr-2 text-right">GST</th>
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i, idx) => (
            <tr key={i.lineId} className="border-b border-ink-100">
              <td className="py-1.5 pr-2 text-ink-500">{idx + 1}</td>
              <td className="py-1.5 pr-2 font-medium">
                {i.medicineName}
                {i.returnedQuantity > 0 && <span className="ml-1 text-[10px] text-amber-700">({i.returnedQuantity} returned)</span>}
              </td>
              <td className="py-1.5 pr-2 font-mono text-ink-600">{i.hsnCode}</td>
              <td className="py-1.5 pr-2 font-mono text-ink-600">
                {i.batchNumber} / {formatDate(i.expiryDate).replace(/^\d+ /, '')}
              </td>
              <td className="num py-1.5 pr-2 text-right">{i.quantity}</td>
              <td className="num py-1.5 pr-2 text-right">{i.unitPrice.toFixed(2)}</td>
              <td className="num py-1.5 pr-2 text-right">{i.discountAmount > 0 ? i.discountAmount.toFixed(2) : '—'}</td>
              <td className="num py-1.5 pr-2 text-right">{i.gstRate}%</td>
              <td className="num py-1.5 text-right font-semibold">{i.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-ink-200 text-left text-[10px] tracking-wider text-ink-500 uppercase">
                <th className="py-1">GST %</th>
                <th className="py-1 text-right">Taxable</th>
                <th className="py-1 text-right">CGST</th>
                <th className="py-1 text-right">SGST</th>
              </tr>
            </thead>
            <tbody>
              {breakup.map((b) => (
                <tr key={b.rate} className="border-b border-ink-100">
                  <td className="py-1">{b.rate}%</td>
                  <td className="num py-1 text-right">{b.taxable.toFixed(2)}</td>
                  <td className="num py-1 text-right">{b.cgst.toFixed(2)}</td>
                  <td className="num py-1 text-right">{b.sgst.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ink-600 italic">{amountInWords(sale.grandTotal)}</p>
        </div>
        <div className="space-y-1">
          {[
            ['Subtotal', formatINR(sale.subtotal)],
            ['Discount', sale.discountTotal > 0 ? `−${formatINR(sale.discountTotal)}` : formatINR(0)],
            ['Taxable value', formatINR(sale.taxableTotal)],
            ['CGST', formatINR(sale.cgstTotal)],
            ['SGST', formatINR(sale.sgstTotal)],
            ['Round off', sale.roundOff.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-ink-600">{k}</span>
              <span className="num">{v}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t-2 border-ink-900 pt-2 text-[15px] font-bold">
            <span>Grand total</span>
            <span className="num">{formatINR(sale.grandTotal)}</span>
          </div>
          {sale.amountTendered !== undefined && (
            <div className="flex justify-between text-ink-600">
              <span>Cash received / change</span>
              <span className="num">
                {formatINR(sale.amountTendered)} / {formatINR(sale.changeReturned ?? 0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {sale.notes && <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-ink-700">Note: {sale.notes}</p>}
      <div className="mt-6 flex items-end justify-between border-t border-ink-200 pt-3 text-[10px] text-ink-500">
        <p className="max-w-sm">
          Goods once sold may be returned only as per store policy with this invoice. Please check batch and expiry at the counter. {st.tagline}.
        </p>
        <div className="text-right">
          <div className="h-8" />
          <div className="border-t border-ink-300 pt-1">Pharmacist signature</div>
        </div>
      </div>
    </div>
  )
}
