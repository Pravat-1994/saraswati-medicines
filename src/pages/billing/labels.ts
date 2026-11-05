import type { BadgeTone } from '../../components/ui/Badge'
import type { PatientAccount, PatientPayment } from '../../types/clinic'

export const ACCOUNT_STATUS_LABEL: Record<PatientAccount['status'], string> = { OPEN: 'Open', FINALISED: 'Final bill issued', SETTLED: 'Settled' }
export const ACCOUNT_STATUS_TONE: Record<PatientAccount['status'], BadgeTone> = { OPEN: 'accent', FINALISED: 'info', SETTLED: 'success' }
export const PAYMENT_KIND_LABEL: Record<PatientPayment['kind'], string> = { ADVANCE: 'Advance', PARTIAL: 'Part payment', FINAL: 'Final payment', REFUND: 'Refund' }
export const PATIENT_PAYMENT_METHOD_LABEL: Record<PatientPayment['method'], string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', OTHER: 'Other', BANK_TRANSFER: 'Bank transfer', INSURANCE: 'Insurance' }
