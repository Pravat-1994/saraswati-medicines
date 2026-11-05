import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/orderHandlers'
import type { CompleteOrderRequest, OrderFilters, PlaceOrderRequest, ShopQuery } from '../types/api'
import type { OnlineOrder, OnlineOrderStatus } from '../types/domain'
import type { OnlineOrderDetail, OrderTracking, ShopInfo, ShopProduct } from '../types/views'

/**
 * Customer-facing storefront. In production these flows run without staff
 * credentials, so they must expose only public fields (no cost, no exact stock).
 */
export const shopService = {
  info(): Promise<ShopInfo> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.shop.info, {}, () => mock.shopInfo())
  },

  catalog(query: ShopQuery): Promise<ShopProduct[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.shop.catalog, query, () => mock.shopCatalog(query))
  },

  /** Places an order (no stock is reserved until staff confirm it). */
  placeOrder(req: PlaceOrderRequest): Promise<OrderTracking> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (start "Online Order" workflow).
    return invoke(FLOWS.shop.placeOrder, req, () => mock.placeOrder(req))
  },

  track(orderNumber: string, phone: string): Promise<OrderTracking> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.shop.track, { orderNumber, phone }, () => mock.trackOrder(orderNumber, phone))
  },
}

/** Staff fulfilment of online orders. */
export const onlineOrderService = {
  list(filters: OrderFilters & { search?: string }): Promise<OnlineOrder[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.list, filters, () => mock.listOrders(filters))
  },

  counts(): Promise<Record<OnlineOrderStatus, number>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.counts, {}, () => mock.orderCounts())
  },

  get(id: string): Promise<OnlineOrderDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.get, { id }, () => mock.getOrder(id))
  },

  verifyPrescription(id: string, note?: string): Promise<OnlineOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.verifyRx, { id, note }, () => mock.verifyPrescription(id, note))
  },

  /** Accepts the order and reserves stock FEFO. */
  confirm(id: string): Promise<OnlineOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.confirm, { id }, () => mock.confirmOrder(id))
  },

  advance(id: string, status: 'READY' | 'OUT_FOR_DELIVERY', note?: string): Promise<OnlineOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.advance, { id, status, note }, () => mock.advanceOrder(id, status, note))
  },

  /** Converts the reservation into a sale/invoice. */
  complete(req: CompleteOrderRequest): Promise<OnlineOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.complete, req, () => mock.completeOrder(req))
  },

  cancel(id: string, reason: string): Promise<OnlineOrder> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.orders.cancel, { id, reason }, () => mock.cancelOrder(id, reason))
  },
}
