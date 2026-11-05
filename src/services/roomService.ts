import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/inpatientHandlers'
import type { BedSummary, RoomView } from '../types/clinicApi'

/** Room directory with live bed status. */
export const roomService = {
  list(): Promise<RoomView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.rooms.list, {}, () => mock.listRooms())
  },
  summary(): Promise<BedSummary> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.rooms.summary, {}, () => mock.bedSummary())
  },
}
