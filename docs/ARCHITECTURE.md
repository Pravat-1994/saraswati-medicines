# Architecture

## Goals

- Keep UI components out of the data layer. **Screens only call services**, and services return Promises of typed models.
- Have a single switch point between demo data and Decisions BPM (`src/services/core/invoke.ts`).
- Run every business calculation (pricing, GST, FEFO, stock status) through one shared engine in `src/lib`. The live POS preview, the mock backend and the seed generator all use it, so a figure is identical everywhere it appears.
- Keep Decisions template compatibility: the same Vite configs and base path, `Auth.tsx`, `apiclient.ts`, and the env file names.

## Folder structure

```
src/
  App.tsx                 Root: ErrorBoundary → AuthGuard → Boot → HashRouter
  Auth.tsx                Decisions JWT cookie helpers (from template)
  api/                    Template: generated Decisions api client (DO NOT EDIT) + coretypes
  app/
    AuthGuard.tsx         Decisions GetJWT handshake (template logic), skipped in pure demo
    Boot.tsx              Loads session (user/role) + settings before rendering
    routes.tsx            All routes (lazy-loaded pages) + permission guards
    navigation.ts         Sidebar groups, icons and required permissions
    RequirePermission.tsx Presentation-level route guard
    ErrorBoundary.tsx
  config/env.ts           The ONLY place that reads import.meta.env
  types/
    domain.ts             Entities (Medicine, Batch, Sale, PurchaseOrder, …)
    api.ts                Request/response models, ListQuery/PagedResult, ServiceError
    views.ts              Read models returned by services (entity + aggregates)
  lib/                    Pure business logic & formatting (no React)
    money.ts              Paise-precision arithmetic, ₹ formatting (en-IN)
    pricing.ts            Line / invoice / purchase pricing, GST inclusive/exclusive, CGST/SGST
    inventory.ts          Expiry & stock status, FEFO sort/allocation, stock summary
    sales.ts              priceSale() shared by POS preview, mock backend & seed
    purchases.ts          PO pricing, received value, outstanding, payment status
    dates.ts, export.ts, storage.ts, utils.ts
  services/               Public service layer (one file per domain)
    core/invoke.ts        demo → mock handler | integrated → Decisions flow
    core/decisionsClient.ts  fetch wrapper: Bearer JWT, timeout, 401/403 handling, result unwrapping
    core/flows.ts         Registry of Decisions flow paths (placeholders)
    core/actor.ts         Current user for audit stamps & permission emulation
    medicineService.ts … userService.ts
  mock/                   Demo backend (never imported by UI code)
    catalog.ts            Static reference data (medicines, suppliers, customers, roles, settings)
    seed.ts               Simulates ~75 days of operations → consistent dataset
    db.ts                 In-memory DB + localStorage persistence, atomic mutate()
    helpers.ts            Paging, sorting, ledger writes (non-negative stock rule)
    handlers/*.ts         Mock implementations of every service method
  stores/                 Zustand: session, settings, ui, posStore (cart)
  hooks/                  useQuery/useMutation (tag invalidation), useTableState
  components/
    ui/                   Design system: Button, Form controls, Badge, Card/StatCard,
                          DataTable+Pagination, FilterBar, DateRangeFilter, Modal/ConfirmDialog,
                          Tabs, Menu, Feedback (Empty/Error/Skeleton/Alert/Progress), PageHeader
    charts/Charts.tsx     TrendChart, ColumnChart, RankedBars, SegmentedBar, Legend
    layout/               AppShell, Sidebar, Topbar, CommandPalette (Ctrl+K), BrandLogo
  pages/<module>/         Feature screens, each split into focused components
```

## Data flow

```
Page component ──useQuery(() => service.method(query))──► service ──invoke(FLOW, payload, mockFn)──┐
     ▲                                                                                            │
     │  data / error / loading                         demo mode: mockFn() on mock/db (+ latency)  │
     └─────────────────────────────────────────────── integrated: decisionsClient.runFlow(FLOW) ◄──┘

Mutation: useMutation(service.create…) → success toast → invalidate(tags) → affected queries refetch
```

- `useQuery` keeps the previous data while it refetches, so screens don't flash. `loading` is true only on the first load.
- List screens use **server-style paging**: `useTableState` produces a `ListQuery {page, pageSize, search, sortBy, sortDir, filters}` and the service returns `PagedResult<T>`. Decisions flows can do the filtering on the server with no UI changes.
- In demo mode, mock handlers return `structuredClone` copies, so the UI can never mutate stored data. `mutate()` works on a draft and throws everything away if a rule is broken, which keeps it atomic.

## State

| Store | Holds |
| --- | --- |
| `sessionStore` | Current user, role and permissions (`useCan()`), plus the demo "act as" user |
| `settingsStore` | Store profile, GST, expiry windows, thresholds, locations (loaded at boot) |
| `posStore` | The POS draft bill. Client-only; the sale is priced authoritatively by `salesService.create` |
| `uiStore` | Sidebar collapse (stored locally), mobile nav, command palette |

Server data does not live in Zustand. It comes from services through `useQuery`.

## Business rules (where they live)

| Rule | Implementation |
| --- | --- |
| Unique medicine code / barcode | `medicineHandlers.validateMedicine` |
| Batch-wise stock; stock never negative | `mock/helpers.recordMovement` (throws `INSUFFICIENT_STOCK`) |
| Expired stock cannot be sold | `salesHandlers.createSale`; POS never offers expired batches |
| FEFO allocation, override only with `sales.overrideFefo` | `lib/inventory.allocateFefo/fefoBatch`, `posStore.addMedicine`, `createSale` |
| Sales reduce / receipts increase batch qty | `SALE_OUT` / `PURCHASE_IN` ledger movements |
| Discount limits per role | `Role.maxDiscountPct`, checked in POS and `createSale` |
| Consistent GST & discounts, paise precision | `lib/pricing.ts` (integer paise, CGST = ⌊GST/2⌋, SGST = remainder) |
| Configurable GST rates, inclusive/exclusive pricing, round-off | `AppSettings` |
| Configurable expiry alerts | `nearExpiryDays`, `criticalExpiryDays`, `expiryAlertsEnabled` |
| Low stock uses each medicine's own minimum | `lib/inventory.stockStatus(sellable, minStockLevel)` |
| Returns reference the original sale; can't exceed sold minus returned minus pending | `salesHandlers.requestReturn` |
| Returns and large adjustments need authorisation | `returnApprovalThreshold`, `adjustmentApprovalThreshold`, `returns.approve`, `inventory.approve` |
| Available vs reserved vs expired vs damaged | `Batch.quantity/reserved/damaged` + expiry → `summariseStock` |

**Ledger convention:** `StockMovement.balanceAfter` is the usable on-hand quantity of the batch (available plus reserved). Damaged units leave the balance through a `DAMAGED` movement and are tracked in `Batch.damaged`.

## Design system

- **Brand**: deep healthcare emerald (`brand-*`), navy ink (`ink-*`) for text, warm neutral canvas `#f4f6f5`, and a marigold accent (`accent-*`) for primary attention. The marigold is a nod to Saraswati's traditional yellow. The logo is a text wordmark plus an SVG pharmacy cross (`BrandLogo.tsx`).
- **Type**: Plus Jakarta Sans for display and headings, Inter for UI text. Both are bundled locally with `@fontsource`, and `tabular-nums` is applied through the `.num` class on figures.
- **Charts**: the categorical order `#0b8a64, #2a78d6, #eb6834, #6250d6, #eda100, #e87ba4` was checked with a colour-vision-deficiency palette validator (adjacent pairs ΔE ≥ 16). Charts use a single y-axis, show a legend for 2 or more series, have hover tooltips, and use SegmentedBar for part-to-whole.
- **Tokens** live in `src/index.css` under `@theme` (Tailwind v4), together with motion keyframes and print styles (`.no-print`, `.print-area`).
- **Accessibility**: labelled controls; dialogs with a focus trap, Esc to close and focus restored afterwards; keyboard-operable tabs and menus; `aria-sort` on sortable headers; status never conveyed by colour alone (badges always carry text).
- **Responsive**: sidebar becomes a drawer below `lg`, tables hide secondary columns with `hideBelow`, and the POS stacks on mobile. E2E tests check there is no horizontal page scroll at 375 px.

## Testing

`scripts/e2e.mjs` (Playwright, headless Chromium) runs 61 checks:

- All 34 routes render with no error state and no console errors.
- POS end to end: search, Enter to add, quantity change, UPI payment, complete, invoice number.
- Business rules called directly through the service layer: expired-sale block, negative stock, GST maths, discount + GST reconciliation, role discount limit, FEFO override block, approval permissions, return limits, GRN stock increase, over-receipt block, unique code, adjustment approval routing.
- Medicine form validation.
- Mobile layouts (375 px) with no horizontal overflow.

Screenshots go to `e2e-screenshots/`.
