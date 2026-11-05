import { Mic, User, Video } from 'lucide-react'
import { Badge, type BadgeTone } from '../ui/Badge'
import { ADMISSION_STATUS_LABEL, APPOINTMENT_STATUS_LABEL, BED_STATUS_LABEL, CONSULTATION_TYPE_LABEL, DISCHARGE_STATUS_LABEL, FULFILMENT_LABEL } from '../../lib/clinic'
import type { AdmissionStatus, AppointmentStatus, BedStatus, ConsultationType, DischargeStatus, FulfilmentStatus } from '../../types/clinic'

const APT: Record<AppointmentStatus, BadgeTone> = { PENDING: 'accent', CONFIRMED: 'info', SCHEDULED: 'brand', IN_PROGRESS: 'violet', COMPLETED: 'success', CANCELLED: 'neutral', NO_SHOW: 'danger' }
export const AppointmentStatusBadge = ({ status }: { status: AppointmentStatus }) => (
  <Badge tone={APT[status]} dot>
    {APPOINTMENT_STATUS_LABEL[status]}
  </Badge>
)

const ADM: Record<AdmissionStatus, BadgeTone> = { REQUESTED: 'accent', APPROVED: 'info', ADMITTED: 'brand', UNDER_TREATMENT: 'violet', DISCHARGE_REQUESTED: 'warning', DISCHARGED: 'success', CANCELLED: 'neutral' }
export const AdmissionStatusBadge = ({ status }: { status: AdmissionStatus }) => (
  <Badge tone={ADM[status]} dot>
    {ADMISSION_STATUS_LABEL[status]}
  </Badge>
)

const DIS: Record<DischargeStatus, BadgeTone> = { NOT_REQUESTED: 'neutral', REQUESTED: 'accent', UNDER_REVIEW: 'info', APPROVED: 'brand', COMPLETED: 'success' }
export const DischargeStatusBadge = ({ status }: { status: DischargeStatus }) => (
  <Badge tone={DIS[status]} dot>
    {DISCHARGE_STATUS_LABEL[status]}
  </Badge>
)

const BED: Record<BedStatus, BadgeTone> = { AVAILABLE: 'success', OCCUPIED: 'danger', RESERVED: 'warning', MAINTENANCE: 'neutral' }
export const BedStatusBadge = ({ status }: { status: BedStatus }) => <Badge tone={BED[status]}>{BED_STATUS_LABEL[status]}</Badge>

const FUL: Record<FulfilmentStatus, BadgeTone> = { PENDING: 'accent', PARTIALLY_FULFILLED: 'warning', FULFILLED: 'success', UNAVAILABLE: 'danger' }
export const FulfilmentBadge = ({ status }: { status: FulfilmentStatus }) => (
  <Badge tone={FUL[status]} dot>
    {FULFILMENT_LABEL[status]}
  </Badge>
)

export function ConsultationTypeBadge({ type }: { type: ConsultationType }) {
  const Icon = type === 'VIDEO' ? Video : type === 'AUDIO' ? Mic : User
  return (
    <Badge tone={type === 'VIDEO' ? 'violet' : type === 'AUDIO' ? 'info' : 'neutral'} icon={<Icon className="h-3 w-3" />}>
      {CONSULTATION_TYPE_LABEL[type]}
    </Badge>
  )
}
