import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/partyHandlers'
import type { ListQuery, PagedResult } from '../types/api'
import type { Customer } from '../types/domain'
import type { CustomerDetail, CustomerListItem } from '../types/views'

export type { CustomerInput } from '../mock/handlers/partyHandlers'
export type CustomerFilters = { segment?: 'ALL' | 'REGULAR' | 'NEW' | 'INACTIVE' }

/** Customer directory. Registration is optional — walk-in sales need no customer. */
export const customerService = {
  list(query: ListQuery<CustomerFilters>): Promise<PagedResult<CustomerListItem>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.customers.list, query, () => mock.listCustomers(query))
  },

  get(id: string): Promise<CustomerDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.customers.get, { id }, () => mock.getCustomer(id))
  },

  create(input: mock.CustomerInput): Promise<Customer> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.customers.create, input, () => mock.createCustomer(input))
  },

  update(id: string, input: mock.CustomerInput): Promise<Customer> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.customers.update, { id, ...input }, () => mock.updateCustomer(id, input))
  },

  remove(id: string): Promise<void> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.customers.remove, { id }, () => mock.deleteCustomer(id))
  },
}
