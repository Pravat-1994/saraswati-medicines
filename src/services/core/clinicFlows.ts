/** Decisions flow paths for the healthcare modules (placeholders until published). */
const B = 'SaraswatiClinic'
export const CLINIC_FLOWS = {
  doctors: { list: `${B}/Doctors/List`, get: `${B}/Doctors/Get`, save: `${B}/Doctors/Save`, setOnline: `${B}/Doctors/SetAvailability`, slots: `${B}/Doctors/AvailableSlots` },
  appointments: { list: `${B}/Appointments/List`, get: `${B}/Appointments/Get`, book: `${B}/Appointments/Book`, reschedule: `${B}/Appointments/Reschedule`, cancel: `${B}/Appointments/Cancel`, status: `${B}/Appointments/SetStatus` },
  portal: { doctors: `${B}/Portal/Doctors`, slots: `${B}/Portal/Slots`, book: `${B}/Portal/BookAppointment`, myAppointments: `${B}/Portal/MyAppointments`, cancel: `${B}/Portal/CancelAppointment` },
  consultations: { start: `${B}/Consultations/Start`, get: `${B}/Consultations/Get`, message: `${B}/Consultations/PostMessage`, notes: `${B}/Consultations/SaveNotes`, end: `${B}/Consultations/End` },
  prescriptions: { list: `${B}/Prescriptions/List`, get: `${B}/Prescriptions/Get`, saveDraft: `${B}/Prescriptions/SaveDraft`, finalise: `${B}/Prescriptions/Finalise`, deleteDraft: `${B}/Prescriptions/DeleteDraft`, dispense: `${B}/Prescriptions/RecordDispense` },
  patients: { list: `${B}/Patients/Search`, get: `${B}/Patients/Profile`, register: `${B}/Patients/Register`, update: `${B}/Patients/Update`, duplicates: `${B}/Patients/FindDuplicates` },
  admissions: { list: `${B}/Admissions/List`, get: `${B}/Admissions/Get`, request: `${B}/Admissions/Request`, approve: `${B}/Admissions/Approve`, confirm: `${B}/Admissions/Confirm`, cancel: `${B}/Admissions/Cancel`, dashboard: `${B}/Admissions/Dashboard` },
  rooms: { list: `${B}/Rooms/List`, summary: `${B}/Rooms/Summary` },
  beds: { allocate: `${B}/Beds/Allocate`, transfer: `${B}/Beds/Transfer`, maintenance: `${B}/Beds/SetMaintenance` },
  clinical: { list: `${B}/Clinical/List`, add: `${B}/Clinical/AddEntry` },
  discharge: { list: `${B}/Discharge/List`, request: `${B}/Discharge/Request`, saveSummary: `${B}/Discharge/SaveSummary`, approve: `${B}/Discharge/Approve`, complete: `${B}/Discharge/Complete` },
  billing: { list: `${B}/Billing/ListAccounts`, get: `${B}/Billing/GetAccount`, addCharge: `${B}/Billing/AddCharge`, removeCharge: `${B}/Billing/RemoveCharge`, discount: `${B}/Billing/SetDiscount`, payment: `${B}/Billing/RecordPayment`, finalise: `${B}/Billing/FinaliseBill`, linkSale: `${B}/Billing/LinkPharmacySale`, activeAccounts: `${B}/Billing/ActiveInpatientAccounts` },
  settings: { get: `${B}/Settings/Get`, save: `${B}/Settings/Save` },
} as const
