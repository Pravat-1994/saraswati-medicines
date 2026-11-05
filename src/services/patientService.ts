import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/recordsHandlers'
import type { Patient } from '../types/clinic'
import type { PatientInput, PatientListItem, PatientProfile } from '../types/clinicApi'

/** Central patient registry (minimum necessary personal data). */
export const patientService = {
  search(search?: string): Promise<PatientListItem[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (server-side search + paging).
    return invoke(F.patients.list, { search }, () => mock.listPatients(search))
  },
  profile(id: string): Promise<PatientProfile> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (filter sections by caller role server-side).
    return invoke(F.patients.get, { id }, () => mock.getPatientProfile(id))
  },
  findDuplicates(input: Pick<PatientInput, 'name' | 'phone' | 'dateOfBirth'>, excludeId?: string): Promise<PatientListItem[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.patients.duplicates, { ...input, excludeId }, () => mock.findDuplicates(input, excludeId))
  },
  /** Rejects likely duplicates unless confirmDuplicate is true. */
  register(input: PatientInput, confirmDuplicate = false): Promise<Patient> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (patient registration flow).
    return invoke(F.patients.register, { ...input, confirmDuplicate }, () => mock.registerPatient(input, confirmDuplicate))
  },
  update(id: string, input: PatientInput): Promise<Patient> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.patients.update, { id, ...input }, () => mock.updatePatient(id, input))
  },
}
