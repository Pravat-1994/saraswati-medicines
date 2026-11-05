/**
 * Registry of Decisions flow endpoints used by the service layer.
 *
 * Each value is the REST path of the flow inside the Decisions project
 * (relative to `{portalBase}/REST/`). Replace the placeholder paths with the
 * real flow ids / service names when the flows are published. Keeping them
 * here means no UI or service code changes are needed at integration time.
 */
export const FLOWS = {
  medicines: {
    list: 'SaraswatiPharmacy/Medicines/List',
    get: 'SaraswatiPharmacy/Medicines/Get',
    create: 'SaraswatiPharmacy/Medicines/Create',
    update: 'SaraswatiPharmacy/Medicines/Update',
    remove: 'SaraswatiPharmacy/Medicines/Deactivate',
    lookups: 'SaraswatiPharmacy/Medicines/Lookups',
    searchForSale: 'SaraswatiPharmacy/Medicines/SearchForSale',
  },
  inventory: {
    overview: 'SaraswatiPharmacy/Inventory/Overview',
    batches: 'SaraswatiPharmacy/Inventory/ListBatches',
    addBatch: 'SaraswatiPharmacy/Inventory/AddBatch',
    movements: 'SaraswatiPharmacy/Inventory/ListMovements',
    adjustments: 'SaraswatiPharmacy/Inventory/ListAdjustments',
    requestAdjustment: 'SaraswatiPharmacy/Inventory/RequestAdjustment',
    decideAdjustment: 'SaraswatiPharmacy/Inventory/DecideAdjustment',
    transfers: 'SaraswatiPharmacy/Inventory/ListTransfers',
    transfer: 'SaraswatiPharmacy/Inventory/TransferStock',
    alerts: 'SaraswatiPharmacy/Inventory/Alerts',
  },
  sales: {
    list: 'SaraswatiPharmacy/Sales/List',
    get: 'SaraswatiPharmacy/Sales/Get',
    create: 'SaraswatiPharmacy/Sales/CreateSale',
    returns: 'SaraswatiPharmacy/Sales/ListReturns',
    requestReturn: 'SaraswatiPharmacy/Sales/RequestReturn',
    decideReturn: 'SaraswatiPharmacy/Sales/DecideReturn',
  },
  purchases: {
    list: 'SaraswatiPharmacy/Purchases/List',
    get: 'SaraswatiPharmacy/Purchases/Get',
    create: 'SaraswatiPharmacy/Purchases/Create',
    update: 'SaraswatiPharmacy/Purchases/Update',
    setStatus: 'SaraswatiPharmacy/Purchases/SetStatus',
    receive: 'SaraswatiPharmacy/Purchases/ReceiveGoods',
  },
  suppliers: {
    list: 'SaraswatiPharmacy/Suppliers/List',
    get: 'SaraswatiPharmacy/Suppliers/Get',
    create: 'SaraswatiPharmacy/Suppliers/Create',
    update: 'SaraswatiPharmacy/Suppliers/Update',
    recordPayment: 'SaraswatiPharmacy/Suppliers/RecordPayment',
  },
  customers: {
    list: 'SaraswatiPharmacy/Customers/List',
    get: 'SaraswatiPharmacy/Customers/Get',
    create: 'SaraswatiPharmacy/Customers/Create',
    update: 'SaraswatiPharmacy/Customers/Update',
    remove: 'SaraswatiPharmacy/Customers/Delete',
  },
  /** Public storefront flows must be callable anonymously (or via customer OTP auth). */
  shop: {
    info: 'SaraswatiPharmacy/Shop/Info',
    catalog: 'SaraswatiPharmacy/Shop/Catalog',
    placeOrder: 'SaraswatiPharmacy/Shop/PlaceOrder',
    track: 'SaraswatiPharmacy/Shop/TrackOrder',
  },
  orders: {
    list: 'SaraswatiPharmacy/Orders/List',
    counts: 'SaraswatiPharmacy/Orders/Counts',
    get: 'SaraswatiPharmacy/Orders/Get',
    verifyRx: 'SaraswatiPharmacy/Orders/VerifyPrescription',
    confirm: 'SaraswatiPharmacy/Orders/Confirm',
    advance: 'SaraswatiPharmacy/Orders/UpdateStatus',
    complete: 'SaraswatiPharmacy/Orders/Complete',
    cancel: 'SaraswatiPharmacy/Orders/Cancel',
  },
  dashboard: {
    summary: 'SaraswatiPharmacy/Dashboard/Summary',
  },
  reports: {
    sales: 'SaraswatiPharmacy/Reports/Sales',
    medicineSales: 'SaraswatiPharmacy/Reports/MedicineSales',
    purchases: 'SaraswatiPharmacy/Reports/Purchases',
    inventory: 'SaraswatiPharmacy/Reports/Inventory',
  },
  users: {
    current: 'SaraswatiPharmacy/Users/Current',
    list: 'SaraswatiPharmacy/Users/List',
    save: 'SaraswatiPharmacy/Users/Save',
    roles: 'SaraswatiPharmacy/Users/Roles',
    saveRole: 'SaraswatiPharmacy/Users/SaveRole',
  },
  settings: {
    get: 'SaraswatiPharmacy/Settings/Get',
    save: 'SaraswatiPharmacy/Settings/Save',
  },
  workflows: {
    status: 'SaraswatiPharmacy/Workflows/Status',
  },
} as const
