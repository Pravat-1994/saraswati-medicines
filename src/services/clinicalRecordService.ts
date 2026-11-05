import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/recordsHandlers'
import type { ClinicalEntry, ClinicalEntryKind } from '../types/clinic'
import type { ClinicalEntryInput } from '../types/clinicApi'

/** Clinical record-keeping (not a diagnostic system). Every entry is time-stamped and attributed. */
export const clinicalRecordService = {
  list(patientId: string, admissionId?: string, kinds?: ClinicalEntryKind[]): Promise<ClinicalEntry[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.clinical.list, { patientId, admissionId, kinds }, () => mock.listClinical(patientId, admissionId, kinds))
  },
  /** Doctor notes/assessments need clinical.notes; vitals, medication, progress and documents need clinical.record. */
  add(input: ClinicalEntryInput): Promise<ClinicalEntry> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (clinical record management flow + audit log).
    return invoke(F.clinical.add, input, () => mock.addClinicalEntry(input))
  },
}
