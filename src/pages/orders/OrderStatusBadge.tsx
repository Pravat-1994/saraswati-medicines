import { ORDER_STATUS_LABEL } from '../../lib/orders'
import type { OnlineOrderStatus } from '../../types/domain'
import { Badge, type BadgeTone } from '../../components/ui/Badge'

const TONE: Record<OnlineOrderStatus, BadgeTone> = {
  PLACED: 'accent',
  CONFIRMED: 'info',
  READY: 'violet',
  OUT_FOR_DELIVERY: 'violet',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

export function OrderStatusBadge({ status }: { status: OnlineOrderStatus }) {
  return (
    <Badge tone={TONE[status]} dot>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  )
}
