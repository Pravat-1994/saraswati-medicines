import type { OnlineOrder, OnlineOrderStatus } from '../types/domain'

export const ORDER_STATUS_LABEL: Record<OnlineOrderStatus, string> = {
  PLACED: 'New',
  CONFIRMED: 'Confirmed',
  READY: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/** Customer-facing wording. */
export const ORDER_STATUS_CUSTOMER: Record<OnlineOrderStatus, string> = {
  PLACED: 'Order received',
  CONFIRMED: 'Confirmed & being packed',
  READY: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const PAYMENT_PREFERENCE_LABEL: Record<OnlineOrder['paymentPreference'], string> = {
  PAY_AT_STORE: 'Pay at store',
  CASH_ON_DELIVERY: 'Cash on delivery',
  UPI_ON_DELIVERY: 'UPI on delivery',
}

/** Progress steps for the tracking timeline. */
export function orderSteps(fulfilment: OnlineOrder['fulfilment']): OnlineOrderStatus[] {
  return fulfilment === 'DELIVERY' ? ['PLACED', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'COMPLETED'] : ['PLACED', 'CONFIRMED', 'READY', 'COMPLETED']
}
