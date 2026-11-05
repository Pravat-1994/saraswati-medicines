import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { printPage } from '../../lib/export'
import { useQuery } from '../../hooks/useQuery'
import { clinicSettingsService } from '../../services'
import { useSettings } from '../../stores/settingsStore'
import { BrandMark } from '../../components/layout/BrandLogo'

/**
 * Prints only `children`: renders them into a body-level container that is
 * hidden on screen, hides everything else for the print, then calls print().
 */
export function PrintPortal({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  useEffect(() => {
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => {
      printPage()
      // Some embedded hosts never fire afterprint.
      setTimeout(done, 500)
    }, 80)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])
  return createPortal(
    <div className="sms-print-root hidden bg-white p-8 text-ink-900 print:block">
      <style>{'@media print { body > *:not(.sms-print-root) { display: none !important; } @page { margin: 14mm; } }'}</style>
      {children}
    </div>,
    document.body,
  )
}

/** Facility letterhead used on patient bills and discharge summaries. */
export function ClinicLetterhead({ title, reference }: { title: string; reference?: ReactNode }) {
  const store = useSettings().store
  const clinic = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-brand-700 pb-4">
      <div className="flex items-start gap-3">
        <BrandMark className="h-11 w-11" />
        <div>
          <div className="font-display text-lg font-extrabold text-ink-950">{clinic.data?.facilityName ?? 'Saraswati Clinic'}</div>
          <div className="text-[12px] text-ink-600">
            {store.addressLine}, {store.city}, {store.state} – {store.pincode}
          </div>
          <div className="text-[12px] text-ink-600">
            {store.phone} · {store.email} · GSTIN {store.gstin}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-sm font-bold tracking-[0.16em] text-brand-700 uppercase">{title}</div>
        {reference && <div className="mt-1 text-[12px] text-ink-700">{reference}</div>}
      </div>
    </div>
  )
}
