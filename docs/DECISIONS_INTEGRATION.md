# Decisions BPM integration guide

## 1. Hosting as a Custom Web App

1. Build the package: `npm run build:prod`. This produces `deployPackage.zip` with `index.html` and `assets/` at the zip root, the same layout as the template.
2. In Decisions, open the project's **Custom Web Apps** folder (`FolderId` / `WebAppId` are in `ai-agent-known-values.txt`), upload the zip, and run **Deploy**.
3. The app is built with base path **`/saraswatimedicines/`** (from the template's `vite.config.prod.ts` and `vite.config.dev.ts`). If the web app is published under a different path, change `base` in those files and rebuild.

### Why it works inside Decisions

- **Hash routing** (`HashRouter`): deep links such as `…/saraswatimedicines/index.html#/purchases/po_001` resolve entirely on the client, so the host needs no rewrite rules.
- **Everything is bundled locally**: fonts come from `@fontsource`, icons are inline SVG, and there are no CDN calls. Only `fetch` to the Decisions portal is used at runtime.
- **CSS isolation**: Tailwind's reset applies inside the app's own document (Custom Web Apps run as their own page), and `#root` creates a new stacking context. No global class names are shared with Decisions pages.
- **Embedded-safe browser APIs**: `localStorage`, `print` and downloads are all wrapped in try/catch. If the host blocks them, the app degrades instead of crashing.

## 2. Authentication (preserved from the template)

The app does **not** have its own login. When `VITE_REQUIRE_DECISIONS_AUTH=true`:

1. `AuthGuard` calls `POST {VITE_DEC_PORTAL_BASE}/REST/AccountService/GetJWT` using the Decisions session.
2. The JWT is stored in the `itportal_auth` cookie (`Auth.tsx`) and sent as `Authorization: Bearer …` by `decisionsClient` and the generated `apiclient.ts`.
3. If that fails, or any flow returns 401, the user is sent to the Decisions login with a return URL.

For local development against a real instance, use `npm run localdev`. It proxies `/decisionsproxy` to `VITE_DEC_PORTAL_FOR_PROXY`, and you can paste a developer JWT into `VITE_DEC_FORCE_SESSION_ID` (the script prints the curl command).

## 3. Environment variables

| Variable | Purpose | demo | development / production |
| --- | --- | --- | --- |
| `VITE_DEMO_MODE` | `true` = mock provider, `false` = Decisions flows | true | true until flows exist |
| `VITE_REQUIRE_DECISIONS_AUTH` | Run the GetJWT handshake | false | true |
| `VITE_DEC_PORTAL_BASE` | Portal base, e.g. `/Primary` (no trailing slash) | `/Primary` | `/Primary` |
| `VITE_DEC_PROJECT_API_BASE_URL` | Appended to the portal base for flow calls | `/` | `/` |
| `VITE_DEC_PORTAL_FOR_PROXY` | Dev proxy target (localdevelopment only) | — | — |
| `VITE_DEC_FORCE_SESSION_ID` | Developer JWT override (localdevelopment only) | — | — |
| `VITE_API_TIMEOUT_MS` | Flow call timeout | 20000 | 20000 |
| `VITE_MOCK_LATENCY_MS` | Simulated latency in demo mode | 180 | 60–150 |

Files: `.env.demo`, `.env.development`, `.env.localdevelopment`, `.env.production`. All of them are read only in `src/config/env.ts`.

## 4. Switching a service to Decisions

Every service method looks like this:

```ts
list(query: ListQuery<MedicineFilters>): Promise<PagedResult<MedicineListItem>> {
  // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
  return invoke(FLOWS.medicines.list, query, () => mock.listMedicines(query))
}
```

Steps:

1. In Decisions, create a flow (or a rule or case-type service) that accepts the documented request model and returns the documented response model (see `SERVICE_CONTRACTS.md`). Expose it as a REST service.
2. Put its REST path in `src/services/core/flows.ts`, for example `SaraswatiPharmacy/Medicines/List`. `decisionsClient` posts to `{portalBase}{projectApiBase}REST/{path}` with `outputtype: "Json"`, and unwraps `{ "<Name>Result": … }` or `{ "Done": … }` responses.
3. Set `VITE_DEMO_MODE=false` and rebuild. While you migrate one service at a time, you can replace `invoke(...)` in just that method with `decisionsClient.runFlow(...)`, or with a method generated in `src/api/apiclient.ts`.
4. Errors: a non-2xx response becomes a `ServiceError` (`HTTP_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `TIMEOUT`, `NETWORK_ERROR`). Screens show `error.message` in toasts and error states, so return user-readable messages from flows (for example in an `ErrorMessage` field).

### Server-side responsibilities (must be implemented in Decisions)

- **Authorisation**: check the caller's role or permission on every flow. The `Role.permissions` matrix in the Admin screen is an editable *proposal* of the model.
- **Re-validation on save**: stock availability per batch, expiry, FEFO (and who may override it), maximum discount per role, prices, GST, totals, and duplicate codes, barcodes, GSTINs and phone numbers.
- **Atomic stock updates**: a sale or receipt must update batch quantities and append ledger movements in one transaction, with concurrency control (row versioning) because several counters may sell the same batch.
- **Document numbering** for invoices, POs, GRNs, returns, adjustments, transfers and payments (the client-side counters exist only in demo mode).

### Workflows

| Workflow | Trigger (service) | Approver permission | Completes by |
| --- | --- | --- | --- |
| Sales return approval | `salesService.requestReturn` (above `returnApprovalThreshold`, or requester lacks `returns.approve`) | `returns.approve` | `salesService.decideReturn` |
| Stock adjustment approval | `inventoryService.requestAdjustment` (above `adjustmentApprovalThreshold`) | `inventory.approve` | `inventoryService.decideAdjustment` |
| Online order fulfilment | `shopService.placeOrder` | `orders.verifyRx` (Rx), `orders.manage` | `onlineOrderService.complete` or `cancel` |
| (optional) Purchase order approval | `purchaseService.setStatus(id,'ORDERED')` | `purchases.manage` | — |

Return `workflowId` on `SaleReturn` and `StockAdjustment`, and implement `userService.workflowStatus(workflowId)` so the UI can track progress (`WorkflowStatus` in `types/api.ts`). Pending items appear in the **Returns** tab, in **Inventory → Adjustments**, and in the dashboard's *Pending approvals* count.

### Online ordering (customer storefront)

The storefront lives at `#/shop` (catalogue, cart, checkout) and `#/shop/track`. Staff handle orders under **Online Orders** (`#/orders`). To go live:

- **Public access.** Customers have no Decisions account. Either deploy the storefront as a separate public Custom Web App (same build, `#/shop` as the landing route) with `VITE_REQUIRE_DECISIONS_AUTH=false`, backed by anonymous `Shop/*` flows, or add customer OTP login through a Decisions flow. `Orders/*` flows must stay staff-only.
- **Public data only.** `Shop/Catalog` must never return cost price, supplier or exact stock. It returns availability bands only.
- **Workflow.** Model an *Online Order* case: Placed → Rx verified → Confirmed (reserve stock) → Ready / Out for delivery → Completed (create sale) or Cancelled (release stock). Add an auto-cancel timer for orders not collected, and customer notifications (SMS / WhatsApp / email) on each status change.
- **Prescriptions.** Upload the attached file with `uploadFileThroughFileReferenceService` and store the FileReference id on the order. A pharmacist must verify it before confirmation.
- **Payments.** Only pay-at-store and cash/UPI on delivery are offered. Online payment would need a payment-gateway integration in Decisions.
- Settings: *Online orders* section (enable ordering, delivery, minimum order value, max units per medicine, delivery-area note).

### File uploads

The template's `uploadFileThroughFileReferenceService` (in `apiclient.ts`) handles chunked uploads with progress. Use it for supplier invoice scans or prescription images, and store the returned `FileReference.Id` on the entity.

## 5. Current user and roles

`userService.current()` in integrated mode calls `GetCurrentUserAccount()` (template) and then the `Users/Current` flow, which should map the Decisions account (or its group membership) to an `AppUser` with a `roleId`. Roles and permissions come from `Users/Roles`. Hide the "Act as" and "Reset demo data" menu items by setting `VITE_DEMO_MODE=false`; this happens automatically.

## 6. Checklist before go-live

- [ ] All flows from `SERVICE_CONTRACTS.md` are published and their paths entered in `flows.ts`.
- [ ] `VITE_DEMO_MODE=false` and `VITE_REQUIRE_DECISIONS_AUTH=true` in `.env.production`.
- [ ] Server-side permission checks and re-validation are in place.
- [ ] GST and pricing settings reviewed by an accountant; returns and Rx policy reviewed by the pharmacist in charge.
- [ ] Store profile (GSTIN, drug licence) entered under Settings.
- [ ] Optionally remove `src/mock` from the bundle by lazy-loading it.

## 7. Healthcare modules

The clinic flows live under `SaraswatiClinic/…` in `src/services/core/clinicFlows.ts`. Their contracts are in `SERVICE_CONTRACTS.md` → *Healthcare services*, and the module behaviour is described in `HEALTHCARE.md`.

- **Workflows to model in Decisions:**
  - *Appointment* (Pending → Confirmed → Scheduled → In progress → Completed / Cancelled / No-show)
  - *Admission* (Requested → Approved → bed allocated → Admitted → Under treatment → Discharge requested → Discharged)
  - *Discharge approval* (Requested → Under review → Approved by doctor → Completed after the bill is settled)
  - *Prescription approval* (Draft → Finalised by the prescribing doctor)
- **Server-side rules that must not rely on the UI:** slot locking (no overlapping bookings), one active patient per bed, doctor-only prescription issuing and discharge approval (also check the doctor ↔ user link), immutable finalised prescriptions, role-filtered patient profiles, audit records for clinical and financial actions, and file-upload type, size and access checks.
- **Data protection:** store clinical data only in Decisions with encryption at rest and in transit, apply least-privilege access, log access to patient records, and never return clinical fields to the public portal flows (`Portal/*`, `Shop/*`).
- **Video consultations:** integrate an approved provider. Create the meeting in `Consultations/Start` and return its join URL; configure the provider and base URL in Settings → Clinic.
- **Pharmacy link:** sales carry `prescriptionId`, `patientId` and `patientAccountId`. After `Sales/CreateSale`, call `Prescriptions/RecordDispense` and, for inpatients, `Billing/LinkPharmacySale`, ideally inside one Decisions flow so the steps are atomic.
