import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/partyHandlers'
import type { ListQuery, PagedResult, SupplierPaymentInput } from '../types/api'
import type { Supplier, SupplierPayment } from '../types/domain'
import type { SupplierDetail, SupplierListItem } from '../types/views'

export type { SupplierInput } from '../mock/handlers/partyHandlers'
export type SupplierFilters = { status?: 'ACTIVE' | 'INACTIVE' | 'ALL'; withDues?: boolean }

/** Supplier directory, ledger and payments. */
export const supplierService = {
  list(query: ListQuery<SupplierFilters>): Promise<PagedResult<SupplierListItem>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.suppliers.list, query, () => mock.listSuppliers(query))
  },

  get(id: string): Promise<SupplierDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.suppliers.get, { id }, () => mock.getSupplier(id))
  },

  create(input: mock.SupplierInput): Promise<Supplier> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.suppliers.create, input, () => mock.createSupplier(input))
  },

  update(id: string, input: mock.SupplierInput): Promise<Supplier> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.suppliers.update, { id, ...input }, () => mock.updateSupplier(id, input))
  },

  /** Records a payment; allocates to oldest dues when no PO is specified. */
  recordPayment(input: SupplierPaymentInput): Promise<SupplierPayment[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.suppliers.recordPayment, input, () => mock.recordSupplierPayment(input))
  },
}
