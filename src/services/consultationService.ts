import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/schedulingHandlers'
import type { ChatMessage, Consultation, FileMeta } from '../types/clinic'
import type { ConsultationRoom } from '../types/clinicApi'

/**
 * Consultation lifecycle. Video/audio is provided by an external provider
 * (Jitsi/Zoom/etc.) configured in clinic settings; none is connected in demo mode.
 */
export const consultationService = {
  /** Doctor starts (or re-opens) the consultation for an appointment. */
  start(appointmentId: string): Promise<ConsultationRoom> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (consultation lifecycle + provider meeting creation).
    return invoke(F.consultations.start, { appointmentId }, () => mock.startConsultation(appointmentId))
  },
  get(id: string): Promise<ConsultationRoom> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.consultations.get, { id }, () => mock.getConsultationRoom(id))
  },
  postMessage(id: string, text: string, file?: Omit<FileMeta, 'uploadedAt' | 'uploadedBy'>): Promise<ChatMessage> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (files via FileReferenceService).
    return invoke(F.consultations.message, { id, text, file }, () => mock.postMessage(id, text, file))
  },
  saveNotes(id: string, notes: string): Promise<Consultation> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.consultations.notes, { id, notes }, () => mock.saveConsultationNotes(id, notes))
  },
  end(id: string, notes?: string): Promise<ConsultationRoom> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.consultations.end, { id, notes }, () => mock.endConsultation(id, notes))
  },
}
