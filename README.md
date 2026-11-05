# Saraswati Medicines Store — Pharmacy Management System

A React + TypeScript frontend for running a retail pharmacy: medicines, batch-wise inventory with FEFO, point of sale and billing, returns, **online ordering for customers**, purchases, suppliers, customers, reports, and role-based administration.

It also includes a **healthcare layer** for an associated clinic: doctor directory, appointment scheduling, online consultations, e-prescriptions dispensed through the pharmacy, patient registration, admissions, rooms & beds, clinical records, discharge and patient billing, plus a patient booking portal. See [docs/HEALTHCARE.md](docs/HEALTHCARE.md). It is built on the **Decisions Custom Web App template** and is meant to be hosted inside **Decisions BPM**, which will eventually provide the backend logic, workflows and data storage.

Until the Decisions flows exist, the app runs in **demo mode** on a realistic generated dataset kept in the browser: 53 Indian medicines, 110+ batches, about 1,050 sales over 75 days, purchase orders, returns, adjustments, and suppliers in Odisha.

---

## Just want to look? Open the standalone demo

Double-click **`standalone/index.html`**. It is a single self-contained file (about 2.2 MB, with all scripts, styles and fonts inlined) that runs the full demo from your disk, with no install and no web server.

> The `index.html` in the project root is the **source** entry point. It shows a blank page if opened directly, because it must be built first (`npm run dev` / `npm run build:*`). To regenerate the standalone file after changes, run `npm run build:standalone`.

## Quick start

Prerequisite: **Node.js 20.19+ or 22.12+** (developed on Node 26).

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/saraswatimedicines/>. Demo mode needs no Decisions instance and no login.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server in **demo** mode (`.env.demo`: mock data, no auth) |
| `npm run localdev` | Dev server that proxies `/decisionsproxy` to your Decisions instance (`.env.localdevelopment`) |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm run lint` | ESLint (React hooks + fast-refresh rules) |
| `npm run build:prod` | Type-check, build, and write **`deployPackage.zip`** for Decisions |
| `npm run build:dev` | Same, using development env, writes `devDeploy.zip` |
| `npm run package:source` | Writes a clean source ZIP (no `node_modules`/`dist`) |
| `npm run test:e2e` | Playwright smoke, business-rule and online-order tests (needs `npm run dev` running and `npx playwright install chromium` once) |

## Deploy the demo to GitHub Pages

The repository includes a Pages build (`vite.config.pages.ts` + `.env.pages`). It runs entirely on in-browser demo data, with no Decisions login and relative asset paths, so it works at `https://<user>.github.io/<repo>/` under any repository name. Hash routing handles deep links.

1. Create a GitHub repository and push this folder to its `main` branch:

   ```bash
   git init
   git add .
   git commit -m "Saraswati Medicines Store"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

2. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The workflow `.github/workflows/deploy-pages.yml` builds and publishes the site on every push to `main` (or run it manually from the **Actions** tab). The site URL appears in the workflow run.

To build or preview locally: `npm run build:pages`, then `npm run preview:pages`.

> GitHub Pages sites are **public**. The Pages build contains only fictional demo data, and healthcare records stay in memory only. Do not enter real patient or customer data on a public demo.

## Testing

| Check | Result (latest run) |
| --- | --- |
| `npm run typecheck` (strict TypeScript) | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `scripts/e2e.mjs`: pharmacy, POS, online orders, business rules, mobile | 81 / 81 passed |
| `scripts/e2e-healthcare.mjs`: 24 healthcare routes, role homes, appointment / prescription / admission / discharge / billing / portal rules, privacy, mobile | 80 / 80 passed |
| `scripts/smoke-build.mjs` on the **built** Decisions bundle | 34 / 34 routes |
| `scripts/smoke-build.mjs` on the **built** GitHub Pages bundle, served from a sub-path | 34 / 34 routes |

Run the browser tests with `npm run dev` in one terminal and `npm run test:e2e` in another (first run: `npx playwright install chromium`).

## Demo access

- **No credentials are needed in demo mode.** You start as **Administrator** (Pravat Ranjan Parhi).
- To see what other roles can do, open the profile menu (top right) → **Act as…** *Store Manager*, *Pharmacist*, *Sales Operator*, *Doctor* (Dr. Ananya Mishra), *Receptionist*, *Nurse* or *Billing Operator*. Each role gets its own home page and menu.
- **Preview as customer** (profile menu) opens the customer storefront and doctor-booking portal exactly as customers see them, with a banner to return to the staff app. Navigation, actions and limits (for example the maximum discount) change with the role.
- **Reset demo data**: profile menu → *Reset demo data*. This regenerates a fresh dataset relative to today's date.
- Demo data is saved in this browser's `localStorage`. If storage is blocked, the app keeps working in memory and resets on reload.

### Things to try

1. **POS** (`/pos`): search "dolo" or scan a barcode, press Enter, add a few items, apply a discount, choose UPI or Cash, then **Complete sale** (Ctrl+Enter). Then print the invoice.
2. Search **"calpol"** or **"ciplox eye"**. Each has an *expired* batch, and the POS never offers it.
3. Act as **Sales Operator** and try a 20% discount or a different batch. Both are blocked (5% limit, no FEFO override).
4. **Sales → invoice → Return items**. As Sales Operator, returns over ₹500 go to **pending approval**. Approve them as Store Manager under *Sales & Returns → Returns*.
5. **Purchases → an "Ordered" PO → Receive goods**: enter a batch, its dates and a quantity. Stock and the PO status update.
6. **Inventory → Adjustments**: a Pharmacist adjustment above 10 units waits for manager approval.
7. **Reports**: every tab exports CSV and can be printed.
8. **Online ordering**: open the customer storefront at `#/shop` (or *Online Orders → Open storefront*). Add medicines, check out with pickup or delivery, and note the order number. Then, as staff, go to **Online Orders**: verify the prescription (for Rx items), click **Confirm & reserve stock**, mark it ready or out for delivery, and **Complete & invoice**. Customers can follow progress on `#/shop/track` with their order number and mobile number.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Folder structure, layers, state, design system, business rules |
| [docs/DECISIONS_INTEGRATION.md](docs/DECISIONS_INTEGRATION.md) | Hosting, auth, environment, how to switch services to Decisions flows |
| [docs/SERVICE_CONTRACTS.md](docs/SERVICE_CONTRACTS.md) | Every service method, its proposed Decisions flow, and its request/response types |
| [UPDATING_API_CLIENT.md](UPDATING_API_CLIENT.md) | (Template) regenerating `src/api/apiclient.ts` from Decisions |

## Technology

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS 4 · Zustand · React Router (HashRouter) · Recharts · React Hook Form + Zod · Lucide icons · Sonner toasts · locally bundled Inter and Plus Jakarta Sans fonts · Playwright for E2E.

## Known limitations and pending integration

- **Healthcare is a frontend prototype.** Patient and clinical records are kept in memory only in demo mode (they reset on reload, by design, for privacy). Production requires Decisions-side authorisation, secure persistence, audit logging and a review against applicable healthcare and privacy requirements before real patient data is used.
- **No video calls are connected.** The consultation room embeds a provider (Jitsi or custom URL) only when one is configured in Settings → Clinic; otherwise it shows a labelled demo panel.
- **Prescription signatures are typed name + registration number + timestamp**, not a certified digital signature. Use a qualified e-signature service if required.
- **Patient-portal identity** is mobile number + date of birth in demo. Production should add OTP verification. Uploaded files record metadata only until Decisions FileReference storage is connected.

- **Storefront hosting.** In demo mode the storefront (`#/shop`) is part of the same app. Customers must be able to reach it without a Decisions staff login, so production needs either a separate public deployment or anonymous/OTP-authenticated Decisions flows that return only public fields. Online payment gateways, delivery charges, SMS/WhatsApp notifications and real prescription file storage are not implemented; the checkout only records the prescription file *name*.
- **No backend yet.** All services run against the in-browser mock provider. The 67 service methods listed in `docs/SERVICE_CONTRACTS.md` each need a Decisions flow, and the flow paths in `src/services/core/flows.ts` are placeholders.
- **Security is not enforced in the browser.** Roles and permissions only shape the UI. Decisions must authorise every action on the server, and also re-validate stock, expiry, FEFO, discount limits, prices and GST.
- **Tax and regulatory rules are configurable defaults, not compliance guarantees.** Examples are the GST-inclusive MRP pricing, the CGST/SGST split (intra-state only, no IGST), rounding, Rx handling, and the approval thresholds. A qualified accountant or pharmacist must review them before production.
- **Single store.** "Locations" are storage areas inside one store, not separate branches. Stock transfers move stock between those locations.
- **Approval workflows complete synchronously in demo mode.** In Decisions they should become real workflows, using `userService.workflowStatus` and the `workflowId` fields.
- **Invoices print through the browser's print dialog** (there is no PDF generation). CSV export depends on the host allowing downloads.
- **No offline support or multi-user concurrency in demo mode.** Each browser has its own separate dataset.
- **The mock provider and seed generator are in the production bundle** so the deployed package can run in demo mode. Once integration is finished it can be loaded lazily or removed.
- **Fixed base path.** The base path `saraswatimedicines/` comes from the Decisions template. If the Custom Web App path changes, update it in the `vite.config.*.ts` files.
