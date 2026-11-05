import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/analyticsHandlers'
import type { DateRange } from '../types/api'
import type { DashboardSummary } from '../types/views'

/** Executive dashboard KPIs, trends and activity — computed from underlying records. */
export const dashboardService = {
  summary(range: DateRange): Promise<DashboardSummary> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.dashboard.summary, range, () => mock.dashboardSummary(range))
  },
}
