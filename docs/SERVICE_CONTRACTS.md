# Service contracts: methods to connect to Decisions flows

Every method below currently uses the demo mock provider. Each needs a Decisions flow that accepts the request type and returns the response type. All types are in `src/types/` (`domain.ts`, `api.ts`, `views.ts`). The flow paths are placeholders, kept in `src/services/core/flows.ts`.

Conventions: ids are strings; dates are ISO-8601 (`YYYY-MM-DD` for date-only); amounts are ₹ with 2 decimals. Lists accept `ListQuery<Filters>` `{ page, pageSize, search, sortBy, sortDir, filters }` and return `PagedResult<T>` `{ items, total, page, pageSize }`. Errors should return a readable message.

## medicineService
| Method | Flow (placeholder) | Request | Response |
| --- | --- | --- | --- |
| `list(query)` | `Medicines/List` | `ListQuery<MedicineFilters>` (category, manufacturer, availability, expiry) | `PagedResult<MedicineListItem>` (medicine + `StockSummary`) |
| `get(id)` | `Medicines/Get` | `{ id }` | `MedicineDetail` (medicine, stock, FEFO-sorted `BatchView[]`, movements, supplier, 30-day and monthly sales) |
| `create(input)` | `Medicines/Create` | `MedicineInput` | `Medicine`; rejects duplicate code or barcode |
| `update(id, input)` | `Medicines/Update` | `{ id, ...MedicineInput }` | `Medicine` |
| `remove(id)` | `Medicines/Deactivate` | `{ id }` | `{ deleted: boolean }`; deactivates if the medicine has history |
| `lookups()` | `Medicines/Lookups` | `{}` | `{ categories[], manufacturers[] }` |
| `suggestCode()` | `Medicines/Lookups` | `{ suggestCode: true }` | `string` |
| `searchForSale(term)` | `Medicines/SearchForSale` | `{ term }` (name, generic, SKU, barcode) | `SaleableMedicine[]` (expired batches included but flagged) |
| `getSaleable(medicineId)` | `Medicines/SearchForSale` | `{ medicineId }` | `SaleableMedicine` |

## inventoryService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `overview()` | `Inventory/Overview` | `{}` | `InventoryOverview` (values, units, buckets, by category and location) |
| `batches(query)` | `Inventory/ListBatches` | `ListQuery<BatchFilters>` (medicineId, location, expiry, includeEmpty) | `PagedResult<BatchView>` |
| `addBatch(input)` | `Inventory/AddBatch` | `BatchInput` | `BatchView`; direct stock-in plus a `PURCHASE_IN` movement |
| `movements(query)` | `Inventory/ListMovements` | `ListQuery<MovementFilters>` (medicineId, type, range) | `PagedResult<StockMovement & { medicineName }>` |
| `adjustments(status?)` | `Inventory/ListAdjustments` | `{ status }` | `AdjustmentView[]` |
| `requestAdjustment(req)` | `Inventory/RequestAdjustment` ⟶ **starts approval workflow** | `AdjustmentRequest` (type INCREASE, DECREASE, DAMAGED or EXPIRED_WRITE_OFF) | `AdjustmentView` (APPROVED or PENDING) |
| `decideAdjustment(id, approve, note)` | `Inventory/DecideAdjustment` | `{ id, approve, note }` | `StockAdjustment` |
| `transfers()` | `Inventory/ListTransfers` | `{}` | `StockTransfer[]` |
| `transfer(req)` | `Inventory/TransferStock` | `TransferRequest` | `StockTransfer` (TRANSFER_OUT and TRANSFER_IN movements) |
| `alerts()` | `Inventory/Alerts` | `{}` | `InventoryAlert[]` (out of stock, low stock, expired, near expiry) |

## salesService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `list(query)` | `Sales/List` | `ListQuery<SaleFilters>` (range, paymentMethod, status, customerId) | `PagedResult<SaleListItem>` |
| `get(idOrInvoice)` | `Sales/Get` | `{ id }` | `SaleDetail` (`sale`, `returns[]`) |
| `create(req)` | `Sales/CreateSale` | `CreateSaleRequest` (lines `{medicineId, batchId, quantity, discountPct}`, bill discount, payment, customer, Rx) | `Sale`; **must re-validate stock, expiry, FEFO, discounts, prices and GST server-side** |
| `returns(status?)` | `Sales/ListReturns` | `{ status }` | `SaleReturn[]` |
| `returnableLines(saleId)` | `Sales/Get` | `{ id, returnable: true }` | `{ lineId, returnable }[]` |
| `requestReturn(req)` | `Sales/RequestReturn` ⟶ **starts approval workflow** | `CreateReturnRequest` | `SaleReturn` |
| `decideReturn(id, approve, note)` | `Sales/DecideReturn` | `{ id, approve, note }` | `SaleReturn` |

## purchaseService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `list(query)` | `Purchases/List` | `ListQuery<PurchaseFilters>` (status incl. OPEN, supplierId, range, paymentStatus) | `PagedResult<PurchaseOrderListItem>` |
| `get(id)` | `Purchases/Get` | `{ id }` | `PurchaseOrder` (items, charges, receipts) |
| `create(input)` | `Purchases/Create` | `PurchaseOrderInput` (status DRAFT or ORDERED) | `PurchaseOrder` |
| `update(id, input)` | `Purchases/Update` | `{ id, ...PurchaseOrderInput }` | `PurchaseOrder`; only DRAFT or ORDERED with no receipts |
| `setStatus(id, status)` | `Purchases/SetStatus` | `{ id, status: ORDERED or CANCELLED }` | `PurchaseOrder` |
| `remove(id)` | `Purchases/SetStatus` | `{ id, status: DELETED }` | `void` (drafts only) |
| `receive(req)` | `Purchases/ReceiveGoods` | `ReceiveGoodsRequest` (supplier invoice no., lines with batch, mfg, expiry, qty, MRP) | `PurchaseOrder`; creates or merges batches and adds `PURCHASE_IN` movements |

## supplierService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `list(query)` | `Suppliers/List` | `ListQuery<{ status, withDues }>` | `PagedResult<SupplierListItem>` |
| `get(id)` | `Suppliers/Get` | `{ id }` | `SupplierDetail` (POs, payments, outstanding, medicines supplied) |
| `create(input)` | `Suppliers/Create` | `SupplierInput` | `Supplier`; unique GSTIN |
| `update(id, input)` | `Suppliers/Update` | `{ id, ...SupplierInput }` | `Supplier` |
| `recordPayment(input)` | `Suppliers/RecordPayment` | `SupplierPaymentInput` | `SupplierPayment[]` (allocated to the opening balance, then the oldest POs) |

## customerService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `list(query)` | `Customers/List` | `ListQuery<{ segment }>` | `PagedResult<CustomerListItem>` |
| `get(id)` | `Customers/Get` | `{ id }` | `CustomerDetail` |
| `create(input)` | `Customers/Create` | `CustomerInput` | `Customer`; unique phone |
| `update(id, input)` | `Customers/Update` | `{ id, ...CustomerInput }` | `Customer` |
| `remove(id)` | `Customers/Delete` | `{ id }` | `void`; refused if the customer has sales history |

## shopService (customer storefront — public)
These run for customers, not staff: expose them anonymously or behind customer OTP login, and return only public fields (no cost price, no exact stock).

| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `info()` | `Shop/Info` | `{}` | `ShopInfo` (store contact, ordering/delivery switches, limits, categories) |
| `catalog(query)` | `Shop/Catalog` | `ShopQuery` (search, category) | `ShopProduct[]` (price, Rx flag, availability IN_STOCK / LIMITED / OUT_OF_STOCK, maxQty) |
| `placeOrder(req)` | `Shop/PlaceOrder` ⟶ **starts the Online Order workflow** | `PlaceOrderRequest` | `OrderTracking`; validates stock, limits, delivery address, Rx details; does **not** reserve stock |
| `track(orderNumber, phone)` | `Shop/TrackOrder` | `{ orderNumber, phone }` | `OrderTracking`; phone must match the order |

## onlineOrderService (staff fulfilment)
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `list(filters)` | `Orders/List` | `OrderFilters` + search | `OnlineOrder[]` |
| `counts()` | `Orders/Counts` | `{}` | count per status |
| `get(id)` | `Orders/Get` | `{ id }` | `OnlineOrderDetail` (order, current availability, linked customer) |
| `verifyPrescription(id, note)` | `Orders/VerifyPrescription` | `{ id, note }` | `OnlineOrder`; needs `orders.verifyRx` |
| `confirm(id)` | `Orders/Confirm` | `{ id }` | `OnlineOrder`; reserves stock FEFO (`Batch.quantity` → `Batch.reserved`); requires verified Rx |
| `advance(id, status)` | `Orders/UpdateStatus` | `{ id, status: READY or OUT_FOR_DELIVERY }` | `OnlineOrder` |
| `complete(req)` | `Orders/Complete` | `CompleteOrderRequest` (payment method, reference, cash) | `OnlineOrder` with `saleId`/`invoiceNumber`; releases the reservation into a normal sale (`SALE_OUT` movements); registers the customer if new |
| `cancel(id, reason)` | `Orders/Cancel` | `{ id, reason }` | `OnlineOrder`; releases reserved stock |

## dashboardService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `summary(range)` | `Dashboard/Summary` | `DateRange` | `DashboardSummary` (KPIs vs previous period, trend, top medicines, mixes, health, recent activity, alerts) |

## reportService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `sales(range, granularity)` | `Reports/Sales` | `{ from, to, granularity: day or month }` | `SalesReport` (rows, totals, payment breakdown, GST by rate) |
| `medicineSales(range)` | `Reports/MedicineSales` | `DateRange` | `MedicineSalesRow[]` |
| `purchases(range)` | `Reports/Purchases` | `DateRange` | `PurchaseReport` |

The inventory valuation, low-stock and expiry reports reuse `inventoryService.overview`, `alerts` and `batches`.

## userService
| Method | Flow | Request | Response |
| --- | --- | --- | --- |
| `current()` | template `GetCurrentUserAccount` + `Users/Current` | `{ email }` | `AppUser` (with `roleId`) |
| `list()` | `Users/List` | `{}` | `AppUser[]` |
| `save(input, id?)` | `Users/Save` | `{ id?, ...UserInput }` | `AppUser` |
| `roles()` | `Users/Roles` | `{}` | `Role[]` (permissions, maxDiscountPct) |
| `saveRole(role)` | `Users/SaveRole` | `Role` | `Role` |
| `settings()` | `Settings/Get` | `{}` | `AppSettings` |
| `saveSettings(s)` | `Settings/Save` | `AppSettings` | `AppSettings` |
| `workflowStatus(id)` | `Workflows/Status` | `{ workflowId }` | `WorkflowStatus` |
| `resetDemoData()` | demo only | — | — |

**Total: 67 methods to connect** (medicines 9, inventory 10, sales 7, purchases 7, suppliers 5, customers 5, online orders 12, dashboard 1, reports 3, users/settings 8). `resetDemoData` is demo-only and does not need a flow.

---

# Healthcare services (clinic)

Flow paths are in `src/services/core/clinicFlows.ts` (prefix `SaraswatiClinic/`). Types are in `src/types/clinic.ts` and `src/types/clinicApi.ts`. **All of these flows handle sensitive health data.** Each one must authorise the caller by role (and, for doctors, by the linked doctor profile), write an audit record, and return only the fields the caller is allowed to see.

## doctorService
| Method | Flow | Request → Response | Notes |
| --- | --- | --- | --- |
| `list(filters)` | `Doctors/List` | `DoctorFilters` → `DoctorListItem[]` | search, specialisation, language, type, max fee, min experience, availability |
| `get(id)` | `Doctors/Get` | `{id}` → `DoctorDetail` | reviews only when they exist |
| `save(input, id?)` | `Doctors/Save` | `DoctorInput` → `Doctor` | `doctors.manage`; unique registration no. |
| `setOnline(id, online)` | `Doctors/SetAvailability` | → `Doctor` | the doctor themself or `doctors.manage` |
| `slots(doctorId, date)` | `Doctors/AvailableSlots` | → `SlotView[]` | booked and past slots flagged |

## appointmentService / patientPortalService
| Method | Flow | Request → Response | Notes |
| --- | --- | --- | --- |
| `list(filters)` | `Appointments/List` | `AppointmentFilters` → `AppointmentView[]` | `mine` = the caller's doctor |
| `get(id)` | `Appointments/Get` | → `AppointmentDetail` | |
| `book(req)` | `Appointments/Book` | `BookAppointmentRequest` → `AppointmentView` | **server-side slot lock**; no overlap per doctor or patient |
| `reschedule(id, date, start)` | `Appointments/Reschedule` | → `AppointmentView` | |
| `cancel(id, reason)` | `Appointments/Cancel` | → `AppointmentView` | |
| `setStatus(id, status)` | `Appointments/SetStatus` | CONFIRMED / SCHEDULED / NO_SHOW | |
| portal `doctors()` | `Portal/Doctors` | → public `DoctorListItem[]` | anonymous |
| portal `slots(doctorId, date)` | `Portal/Slots` | → `SlotView[]` | anonymous |
| portal `book(patient, req)` | `Portal/BookAppointment` | `PortalPatientRequest` + booking → `PortalBooking` | match/create patient by mobile + DOB; status PENDING; add OTP in production |
| portal `myAppointments(phone, dob)` | `Portal/MyAppointments` | → `PortalBooking[]` | OTP-verified in production |
| portal `cancel(no, phone, dob)` | `Portal/CancelAppointment` | → `PortalBooking` | |

## consultationService
| Method | Flow | Notes |
| --- | --- | --- |
| `start(appointmentId)` | `Consultations/Start` | only the appointment's doctor, on the day. Creates the provider meeting (Jitsi/Zoom) |
| `get(id)` | `Consultations/Get` | returns `ConsultationRoom` incl. `video.url` when a provider is configured |
| `postMessage(id, text, file?)` | `Consultations/PostMessage` | files via the FileReference service |
| `saveNotes(id, notes)` | `Consultations/SaveNotes` | |
| `end(id, notes?)` | `Consultations/End` | completes the appointment and posts the fee to an OPD account |

## prescriptionService
| Method | Flow | Notes |
| --- | --- | --- |
| `list(filters)` | `Prescriptions/List` | drafts visible to the author only |
| `get(id)` | `Prescriptions/Get` | `PrescriptionDetail` incl. live pharmacy availability per item |
| `saveDraft(input, id?)` | `Prescriptions/SaveDraft` | **Doctor role + linked doctor only** |
| `finalise(id, confirmName)` | `Prescriptions/Finalise` | signature = name + registration no. + time; immutable afterwards |
| `deleteDraft(id)` | `Prescriptions/DeleteDraft` | author only |
| `recordDispense(rec)` | `Prescriptions/RecordDispense` | links the POS sale; updates fulfilment (Pending / Partial / Fulfilled / Unavailable) |

## patientService
| Method | Flow | Notes |
| --- | --- | --- |
| `search(q)` | `Patients/Search` | add paging server-side |
| `profile(id)` | `Patients/Profile` | sections filtered by role |
| `findDuplicates(input)` | `Patients/FindDuplicates` | same mobile + DOB, or same name + DOB |
| `register(input, confirmDuplicate?)` | `Patients/Register` | auto patient ID |
| `update(id, input)` | `Patients/Update` | |

## admissionService / roomService / bedService
| Method | Flow | Notes |
| --- | --- | --- |
| `list(filters)` / `get(id)` | `Admissions/List`, `/Get` | filters: status, department, doctor, room type, dates |
| `request(input)` | `Admissions/Request` | starts the **Admission** workflow; emergency is auto-approved |
| `approve(id)` | `Admissions/Approve` | `admissions.approve` |
| `confirm(id)` | `Admissions/Confirm` | needs an allocated bed; occupies the bed, opens the account |
| `cancel(id, reason)` | `Admissions/Cancel` | releases a reserved bed |
| `dashboard(filters)` | `Admissions/Dashboard` | `InpatientDashboard` |
| `roomService.list()` / `summary()` | `Rooms/List`, `/Summary` | |
| `bedService.allocate(admId, bedId)` | `Beds/Allocate` | **row lock** — one active patient per bed |
| `bedService.transfer(admId, bedId, reason)` | `Beds/Transfer` | posts room nights for the previous room |
| `bedService.setMaintenance(bedId, on, note?)` | `Beds/SetMaintenance` | free beds only |

## clinicalRecordService / dischargeService
| Method | Flow | Notes |
| --- | --- | --- |
| `list(patientId, admissionId?, kinds?)` | `Clinical/List` | `clinical.view` |
| `add(input)` | `Clinical/AddEntry` | notes and plans need `clinical.notes` (doctor); vitals, medication, progress and documents need `clinical.record` |
| `discharge.list(status?)` | `Discharge/List` | |
| `request(admId)` | `Discharge/Request` | doctor or nurse |
| `saveSummary(admId, input)` | `Discharge/SaveSummary` | doctor, moves to Under review |
| `approve(admId, input)` | `Discharge/Approve` | **doctor only** — clinical sign-off |
| `complete(admId)` | `Discharge/Complete` | requires a settled bill; releases the bed |

## patientBillingService
| Method | Flow | Notes |
| --- | --- | --- |
| `list(filters)` / `get(id)` | `Billing/ListAccounts`, `/GetAccount` | `AccountView` with totals and the accrued room estimate |
| `addCharge`, `removeCharge` | `Billing/AddCharge`, `/RemoveCharge` | open accounts; system and pharmacy charges are locked |
| `setDiscount(id, amount)` | `Billing/SetDiscount` | within the role's discount limit |
| `recordPayment(id, input)` | `Billing/RecordPayment` | advance / partial / final / refund |
| `finalise(id)` | `Billing/FinaliseBill` | posts room nights; IPD requires an approved discharge |
| `linkPharmacySale(id, sale)` | `Billing/LinkPharmacySale` | pharmacy invoice charged to the inpatient account |
| `activeInpatientAccounts()` | `Billing/ActiveInpatientAccounts` | for the POS "bill to account" option |

## clinicSettingsService
| `get()` / `save(settings)` | `Settings/Get`, `/Save` | departments, video provider, booking window, tariff |
| `snapshot()` | `Admissions/Dashboard` (snapshot) | counts for badges and the dashboard |

**Healthcare total: 64 methods** (doctors 5, appointments 6, portal 5, consultations 5, prescriptions 6, patients 5, admissions 6, rooms 2, beds 3, clinical 2, discharge 5, billing 9, settings 3, dashboard 2 including `admissions.dashboard`). Together with the pharmacy and online-order methods, the application has **131 service methods** to connect.
