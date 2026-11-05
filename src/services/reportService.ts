import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/analyticsHandlers'
import type { DateRange } from '../types/api'
import type { MedicineSalesRow, PurchaseReport, SalesReport } from '../types/views'

/** Reports & analytics. Inventory valuation / low-stock / expiry use inventoryService. */
export const reportService = {
  /** Daily or monthly sales with GST, profit and payment breakdown. */
  sales(range: DateRange, granularity: 'day' | 'month'): Promise<SalesReport> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.reports.sales, { ...range, granularity }, () => mock.salesReport(range, granularity))
  },

  medicineSales(range: DateRange): Promise<MedicineSalesRow[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.reports.medicineSales, range, () => mock.medicineSalesReport(range))
  },

  purchases(range: DateRange): Promise<PurchaseReport> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.reports.purchases, range, () => mock.purchaseReport(range))
  },
}
