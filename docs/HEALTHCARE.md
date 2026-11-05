# Healthcare modules — Doctor consultation & patient admission

This extends the pharmacy system with an outpatient (OPD) and inpatient (IPD) layer for a small clinic linked to Saraswati Medicines Store. It is a **frontend prototype**. Authorisation, secure storage of clinical data, and compliance with applicable healthcare and privacy requirements must be implemented in Decisions BPM and reviewed before any real patient data is entered.

## Modules and screens

| Module | Route | What it does |
| --- | --- | --- |
| Doctor Directory | `#/doctors`, `#/doctors/:id` | Profiles with specialisation, qualifications, registration, fee, languages, affiliation, consultation types, weekly availability, live slot calendar, online status, and reviews (shown only when real reviews exist). Doctors can be added and edited. |
| Appointments | `#/appointments`, `#/appointments/:id` | Book on behalf of a patient, reschedule, cancel, confirm, schedule and mark no-show. Today / upcoming / past views. Overlap-free slot booking. |
| Online Consultations | `#/consultations`, `#/consultations/:id` | Doctor's queue and consultation room: patient, doctor and appointment details, video area, mic/camera controls, timer, chat, file sharing, notes, end consultation. |
| Prescriptions | `#/prescriptions`, `/new`, `/:id`, `/:id/edit` | Doctor-only e-prescriptions (draft → finalise with signature), printable document, pharmacy fulfilment status, and dispensing at the POS. |
| Patient Registration | `#/patients`, `#/patients/:id` | Central registry with an auto-generated patient ID and duplicate detection. Profile shows the patient's consultations, admissions, prescriptions and bills. |
| Patient Admissions | `#/admissions`, `/new`, `/:id` | Guided request → approve → allocate bed → confirm → treatment → discharge workflow, with bed transfers and an audit trail. |
| Inpatient Dashboard | `#/inpatients` | Occupancy, pending requests, awaiting discharge, trends, and lists by department, doctor and room type. |
| Rooms & Beds | `#/rooms` | Visual bed board (available / occupied / reserved / maintenance). Supports allocation, transfer and maintenance. |
| Clinical Records | `#/clinical` | Assessments, doctor notes, treatment plans, progress notes, vitals (with trends), medication administration, documents and follow-up. Every entry is time-stamped and attributed. |
| Discharge Management | `#/discharges` | Request → under review → doctor approval → completion (requires a settled bill). Releases the bed. Printable discharge summary. |
| Patient Billing | `#/billing`, `#/billing/:id` | OPD/IPD accounts: admission, room, consultation, treatment, service and medicine charges, discounts, tax, advances, partial and final payments, refunds, and a printable final bill. |
| Patient portal | `#/shop/doctors`, `#/shop/appointments` | Patients browse doctors, book (registering with name, mobile, DOB and gender only), upload reports, view their appointments and cancel them. |

## Workflows

**Appointment:** `PENDING` (booked online) → `CONFIRMED` (front desk) → `SCHEDULED` (room/link ready) → `IN_PROGRESS` (doctor starts) → `COMPLETED`. Side exits are `CANCELLED` and `NO_SHOW` (no-show only after the slot time). Staff bookings start as `CONFIRMED`. The server re-checks the slot on every booking or reschedule, and overlapping bookings for the same doctor or the same patient are rejected.

**Consultation:** only the doctor who owns the appointment can start it, and only on the appointment day. Ending it completes the appointment and posts the consultation fee to an OPD account.

**Prescription:** a Doctor-role user linked to a doctor profile creates a `DRAFT`, then finalises it by typing their exact name. The app records that name, the registration number and the time as the signature. Finalised prescriptions are immutable. Drafts are visible only to their author. Pharmacy and admin roles can never issue or approve prescriptions, and the role editor refuses to grant those permissions to other roles.

**Pharmacy fulfilment:** the pharmacist sees per-item stock (stocked, available, pending, dispensable). **Dispense at POS** loads the dispensable quantities into the cart and links the sale to the prescription, and optionally to the patient's inpatient account. Status moves through Pending → Partially fulfilled → Fulfilled, or Unavailable when nothing can be dispensed. Substitutes are never added automatically.

**Admission:** request (receptionist) → approve (doctor or manager; emergency requests are auto-approved and flagged for clinical sign-off) → allocate bed (bed becomes `RESERVED`) → confirm (bed becomes `OCCUPIED`, admission charge posted, patient account opened) → the first clinical entry moves the patient to *Under treatment* → request discharge. A bed allocated to an active patient can only be freed by a transfer or a completed discharge.

**Discharge:** `REQUESTED` (doctor or nurse) → `UNDER_REVIEW` (doctor drafts the summary) → `APPROVED` (doctor signs) → the billing operator generates the final bill (room nights posted automatically) and settles it → `COMPLETED` (reception). The bed is released at completion.

## Roles (healthcare)

| Role | Key permissions |
| --- | --- |
| Administrator | Full configuration and access management, all healthcare views, admissions and billing management. Cannot issue prescriptions or approve clinical discharge. |
| Doctor | Own appointments and consultations, prescriptions (issue/finalise), clinical notes, admission approval, discharge approval |
| Pharmacist | View finalised prescriptions, fulfil them at the POS, pharmacy billing |
| Receptionist | Register patients, manage appointments, request admissions, allocate and transfer beds |
| Nurse | View inpatients, record vitals, medication administration, progress notes and documents, request discharge |
| Store Manager | Pharmacy operations plus healthcare oversight: admission approval, beds, billing |
| Billing Operator | Patient accounts, charges, discounts (within role limit), payments, final bills |

In demo mode, use **profile menu → Act as…** to switch between Dr. Ananya Mishra (Doctor), Swati Jena (Receptionist), Sr. Mamata Pradhan (Nurse), Alok Ranjan Das (Billing Operator) and the pharmacy users.

## Privacy and security by design

- **No sensitive records in browser storage.** Healthcare data in demo mode is held in memory only and regenerated (fictional) on reload. Only non-sensitive clinic settings are saved locally.
- **URLs carry only opaque ids.** Names, phone numbers, dates of birth and medical details never appear in URLs. Portal look-ups pass details through in-memory state.
- **Minimum necessary data.** The portal registration asks only for name, mobile, DOB and gender. Lists mask phone numbers. Profiles show sections based on the viewer's role (clinical, prescriptions, billing).
- **Audit trails.** Appointments, prescriptions and admissions keep an action history (who, what, when). Clinical entries, charges and payments record their author.
- **File uploads** are validated for type (PDF or image) and size (configurable). In production they must go through the Decisions FileReference service with access control.
- **Video:** no call is simulated. With provider *None*, the room shows a labelled demo panel. With Jitsi or Custom configured, it embeds the provider URL for that consultation's room.
- **Frontend permissions are for usability only.** Every Decisions flow must authorise the caller and re-validate the request on the server.

## Demo data

The demo data includes 12 doctors across 12 specialisations (with reviews where appointments exist) and 34 fictional patients. There are about 300 appointments covering every status, about 160 consultations and about 80 prescriptions (finalised and draft, including a non-stocked medicine). It also includes 9 rooms with 26 beds (one in maintenance), 13 admissions covering every admission and discharge status, about 140 clinical entries (vitals every 8 hours, medication, progress notes), and about 170 patient accounts (OPD settled, IPD open and settled). **Reset demo data** regenerates everything.

## Testing summary

See the README → *Testing*. The Playwright suite (`npm run test:e2e`) checks every healthcare route at desktop and mobile widths, and exercises the main workflows through the service layer:
- slot overlap prevention
- prescription authority restricted to doctors
- finalised prescriptions immutable
- dispensing updates fulfilment
- the admission → bed → confirm → discharge → bill → release cycle
- double-bed prevention
- the clinical-entry permissions for nurses and doctors
- portal booking and cancellation
- the absence of healthcare data in `localStorage`
