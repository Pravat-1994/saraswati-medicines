import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/salesHandlers'
import type { CreateReturnRequest, CreateSaleRequest, ListQuery, PagedResult, SaleFilters } from '../types/api'
import type { ApprovalStatus, Sale, SaleReturn } from '../types/domain'
import type { SaleDetail, SaleListItem } from '../types/views'

/** Billing, sales history and returns. */
export const salesService = {
  list(query: ListQuery<SaleFilters>): Promise<PagedResult<SaleListItem>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.list, query, () => mock.listSales(query))
  },

  /** Sale by id or invoice number, including its returns. */
  get(idOrInvoice: string): Promise<SaleDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.get, { id: idOrInvoice }, () => mock.getSale(idOrInvoice))
  },

  /**
   * Completes a sale. The backend must re-validate stock, expiry, FEFO,
   * discounts and prices — the client-side preview is not authoritative.
   */
  create(req: CreateSaleRequest): Promise<Sale> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.create, req, () => mock.createSale(req))
  },

  returns(status?: ApprovalStatus | 'ALL'): Promise<SaleReturn[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.returns, { status }, () => mock.listReturns(status))
  },

  returnableLines(saleId: string): Promise<{ lineId: string; returnable: number }[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.get, { id: saleId, returnable: true }, () => mock.returnableLines(saleId))
  },

  /** Starts the "Sales Return Approval" workflow (auto-approves within policy). */
  requestReturn(req: CreateReturnRequest): Promise<SaleReturn> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.requestReturn, req, () => mock.requestReturn(req))
  },

  decideReturn(id: string, approve: boolean, note?: string): Promise<SaleReturn> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.sales.decideReturn, { id, approve, note }, () => mock.decideReturn(id, approve, note))
  },
}
