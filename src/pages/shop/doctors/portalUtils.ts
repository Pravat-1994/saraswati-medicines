import { formatSlot } from '../../../lib/clinic'
import { formatDate, todayISO } from '../../../lib/dates'
import type { DoctorListItem } from '../../../types/clinicApi'

export function nextAvailableLabel(d: Pick<DoctorListItem, 'nextAvailable'>): string {
  if (!d.nextAvailable) return 'No slots in the booking window'
  const day = d.nextAvailable.date === todayISO() ? 'Today' : formatDate(d.nextAvailable.date)
  return `${day}, ${formatSlot(d.nextAvailable.start)}`
}

/** Navigation state passed to My appointments (kept out of the URL for privacy). */
export interface PortalLookupState {
  phone?: string
  dateOfBirth?: string
  highlight?: string
}

export const ACCEPTED_REPORT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

export const formatBytes = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
