import type { AdjustmentType } from '../../types/domain'

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  INCREASE: 'Increase (count correction)',
  DECREASE: 'Decrease (count correction)',
  DAMAGED: 'Mark as damaged',
  EXPIRED_WRITE_OFF: 'Expired write-off',
}
