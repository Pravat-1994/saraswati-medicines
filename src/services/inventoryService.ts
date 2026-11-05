import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/inventoryHandlers'
import type { AdjustmentRequest, BatchInput, ListQuery, MovementFilters, PagedResult, TransferRequest } from '../types/api'
import type { ApprovalStatus, StockAdjustment, StockMovement, StockTransfer } from '../types/domain'
import type { BatchView, InventoryAlert, InventoryOverview } from '../types/views'

export type { BatchFilters, AdjustmentView } from '../mock/handlers/inventoryHandlers'

/** Stock, batches, movements, adjustments and transfers. */
export const inventoryService = {
  overview(): Promise<InventoryOverview> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.overview, {}, () => mock.inventoryOverview())
  },

  batches(query: ListQuery<mock.BatchFilters>): Promise<PagedResult<BatchView>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.batches, query, () => mock.listBatches(query))
  },

  /** Direct stock-in of a batch without a purchase order. */
  addBatch(input: BatchInput): Promise<BatchView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.addBatch, input, () => mock.addBatch(input))
  },

  movements(query: ListQuery<MovementFilters>): Promise<PagedResult<StockMovement & { medicineName: string }>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.movements, query, () => mock.listMovements(query))
  },

  adjustments(status?: ApprovalStatus | 'ALL'): Promise<mock.AdjustmentView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.adjustments, { status }, () => mock.listAdjustments(status))
  },

  /**
   * Starts a stock adjustment. In Decisions this should initiate the
   * "Stock Adjustment Approval" workflow and return its status.
   */
  requestAdjustment(req: AdjustmentRequest): Promise<mock.AdjustmentView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.requestAdjustment, req, () => mock.requestAdjustment(req))
  },

  decideAdjustment(id: string, approve: boolean, note?: string): Promise<StockAdjustment> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.decideAdjustment, { id, approve, note }, () => mock.decideAdjustment(id, approve, note))
  },

  transfers(): Promise<(StockTransfer & { medicineName: string; batchNumber: string })[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.transfers, {}, () => mock.listTransfers())
  },

  transfer(req: TransferRequest): Promise<StockTransfer> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.transfer, req, () => mock.transferStock(req))
  },

  /** Low-stock, out-of-stock, near-expiry and expired alerts. */
  alerts(): Promise<InventoryAlert[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.inventory.alerts, {}, () => mock.inventoryAlerts())
  },
}
