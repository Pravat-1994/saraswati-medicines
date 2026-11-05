import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/partyHandlers'
import type { ListQuery, PagedResult, PurchaseOrderInput, ReceiveGoodsRequest } from '../types/api'
import type { PurchaseOrder } from '../types/domain'
import type { PurchaseOrderListItem } from '../types/views'

export type { PurchaseFilters } from '../mock/handlers/partyHandlers'

/** Purchase orders and goods receipts. */
export const purchaseService = {
  list(query: ListQuery<mock.PurchaseFilters>): Promise<PagedResult<PurchaseOrderListItem>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.list, query, () => mock.listPurchaseOrders(query))
  },

  get(id: string): Promise<PurchaseOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.get, { id }, () => mock.getPurchaseOrder(id))
  },

  create(input: PurchaseOrderInput): Promise<PurchaseOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.create, input, () => mock.createPurchaseOrder(input))
  },

  update(id: string, input: PurchaseOrderInput): Promise<PurchaseOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.update, { id, ...input }, () => mock.updatePurchaseOrder(id, input))
  },

  /** Place a draft order or cancel an order with no receipts. */
  setStatus(id: string, status: 'ORDERED' | 'CANCELLED'): Promise<PurchaseOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.setStatus, { id, status }, () => mock.setPurchaseOrderStatus(id, status))
  },

  remove(id: string): Promise<void> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.setStatus, { id, status: 'DELETED' }, () => mock.deletePurchaseOrder(id))
  },

  /** Records a goods receipt (GRN): creates batches and increases stock. */
  receive(req: ReceiveGoodsRequest): Promise<PurchaseOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.purchases.receive, req, () => mock.receiveGoods(req))
  },
}
