/**
 * Domain entities for Saraswati Medicines Store.
 *
 * These interfaces are the contract between the UI and the service layer.
 * When Decisions BPM integration is implemented, Decisions data structures /
 * case types should map 1:1 onto these shapes (see docs/SERVICE_CONTRACTS.md).
 *
 * Conventions
 *  - All ids are strings (Decisions entity ids are strings).
 *  - All dates are ISO-8601 strings. Date-only values use `YYYY-MM-DD`.
 *  - All money values are in Indian Rupees, rounded to 2 decimals (paise precision).
 */

export type ISODate = string
export type ISODateTime = string

// ─────────────────────────────── Users & roles ───────────────────────────────

export type RoleId = 'ADMIN' | 'PHARMACIST' | 'STORE_MANAGER' | 'SALES_OPERATOR' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'BILLING_OPERATOR'

export type Permission =
  | 'dashboard.view'
  | 'medicines.view'
  | 'medicines.manage'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'inventory.approve'
  | 'inventory.transfer'
  | 'sales.pos'
  | 'sales.view'
  | 'sales.overrideFefo'
  | 'sales.discount.extended'
  | 'returns.request'
  | 'returns.approve'
  | 'purchases.view'
  | 'purchases.manage'
  | 'purchases.receive'
  | 'suppliers.view'
  | 'suppliers.manage'
  | 'suppliers.payments'
  | 'customers.view'
  | 'customers.manage'
  | 'reports.view'
  | 'orders.view'
  | 'orders.manage'
  | 'orders.verifyRx'
  // Healthcare
  | 'doctors.view'
  | 'doctors.manage'
  | 'appointments.view'
  | 'appointments.manage'
  | 'consultations.conduct'
  | 'prescriptions.view'
  | 'prescriptions.issue'
  | 'prescriptions.fulfil'
  | 'patients.view'
  | 'patients.manage'
  | 'admissions.view'
  | 'admissions.manage'
  | 'admissions.approve'
  | 'beds.view'
  | 'beds.manage'
  | 'clinical.view'
  | 'clinical.record'
  | 'clinical.notes'
  | 'discharge.request'
  | 'discharge.approve'
  | 'billing.view'
  | 'billing.manage'
  | 'admin.users'
  | 'admin.settings'
  | 'demo.reset'

export interface Role {
  id: RoleId
  name: string
  description: string
  permissions: Permission[]
  /** Maximum line/bill discount this role may apply at POS (percentage). */
  maxDiscountPct: number
}

export interface AppUser {
  id: string
  name: string
  email: string
  phone?: string
  roleId: RoleId
  /** Doctor profile this user signs in as (Doctor role only). */
  doctorId?: string
  isActive: boolean
  lastActiveAt?: ISODateTime
  createdAt: ISODateTime
}

// ───────────────────────────────── Catalogue ─────────────────────────────────

export type DosageForm =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Suspension'
  | 'Injection'
  | 'Ointment'
  | 'Cream'
  | 'Gel'
  | 'Drops'
  | 'Inhaler'
  | 'Powder'
  | 'Sachet'
  | 'Spray'
  | 'Device'

export interface Medicine {
  id: string
  /** Unique medicine code / SKU. */
  code: string
  name: string
  genericName: string
  manufacturer: string
  category: string
  composition: string
  strength: string
  dosageForm: DosageForm
  /** Pack description, e.g. "Strip of 10 tablets". */
  packSize: string
  barcode: string
  hsnCode: string
  gstRate: number
  /** Default purchase price per selling unit (batches may override). */
  purchasePrice: number
  /** Default selling price / MRP per selling unit (batches may override). */
  sellingPrice: number
  minStockLevel: number
  reorderQuantity: number
  primarySupplierId?: string
  storageInstructions: string
  prescriptionRequired: boolean
  isActive: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

// ───────────────────────────────── Inventory ─────────────────────────────────

export interface Batch {
  id: string
  medicineId: string
  batchNumber: string
  mfgDate: ISODate
  expiryDate: ISODate
  purchasePrice: number
  sellingPrice: number
  /** Sellable quantity (excludes reserved & damaged). */
  quantity: number
  /** Quantity held for pending orders / returns awaiting approval. */
  reserved: number
  /** Quantity marked damaged, not sellable. */
  damaged: number
  location: string
  supplierId?: string
  purchaseOrderId?: string
  receivedAt: ISODateTime
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
export type ExpiryStatus = 'OK' | 'NEAR_EXPIRY' | 'CRITICAL' | 'EXPIRED'

export type MovementType =
  | 'OPENING'
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGED'
  | 'EXPIRED_WRITE_OFF'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'

export interface StockMovement {
  id: string
  medicineId: string
  batchId: string
  batchNumber: string
  type: MovementType
  /** Signed quantity: positive = stock in, negative = stock out. */
  quantity: number
  balanceAfter: number
  referenceType?: 'SALE' | 'RETURN' | 'PURCHASE_RECEIPT' | 'ADJUSTMENT' | 'TRANSFER' | 'SEED'
  referenceId?: string
  referenceNumber?: string
  reason?: string
  performedBy: string
  authorizedBy?: string
  timestamp: ISODateTime
}

export type AdjustmentType = 'INCREASE' | 'DECREASE' | 'DAMAGED' | 'EXPIRED_WRITE_OFF'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface StockAdjustment {
  id: string
  adjustmentNumber: string
  medicineId: string
  batchId: string
  type: AdjustmentType
  quantity: number
  reason: string
  status: ApprovalStatus
  requestedBy: string
  requestedAt: ISODateTime
  decidedBy?: string
  decidedAt?: ISODateTime
  decisionNote?: string
  /** Decisions workflow instance id, once integrated. */
  workflowId?: string
}

export interface StockTransfer {
  id: string
  transferNumber: string
  medicineId: string
  batchId: string
  fromLocation: string
  toLocation: string
  quantity: number
  performedBy: string
  timestamp: ISODateTime
  note?: string
}

// ─────────────────────────────────── People ──────────────────────────────────

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
}

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  email?: string
  gstin: string
  drugLicenseNo?: string
  address: Address
  paymentTermsDays: number
  openingBalance: number
  notes?: string
  isActive: boolean
  createdAt: ISODateTime
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  dateOfBirth?: ISODate
  notes?: string
  createdAt: ISODateTime
}

// ──────────────────────────────────── Sales ──────────────────────────────────

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'OTHER'

export interface SaleItem {
  lineId: string
  medicineId: string
  medicineName: string
  medicineCode: string
  hsnCode: string
  batchId: string
  batchNumber: string
  expiryDate: ISODate
  quantity: number
  unitPrice: number
  discountPct: number
  gstRate: number
  /** Line amounts, computed by lib/pricing. */
  grossAmount: number
  discountAmount: number
  taxableAmount: number
  gstAmount: number
  lineTotal: number
  /** Cost of goods for profit analysis. */
  unitCost: number
  returnedQuantity: number
  fefoOverridden?: boolean
}

export type SaleStatus = 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED'

export interface Sale {
  id: string
  invoiceNumber: string
  date: ISODateTime
  customerId?: string
  customerName: string
  customerPhone?: string
  items: SaleItem[]
  billDiscountPct: number
  subtotal: number
  discountTotal: number
  taxableTotal: number
  gstTotal: number
  cgstTotal: number
  sgstTotal: number
  roundOff: number
  grandTotal: number
  costTotal: number
  paymentMethod: PaymentMethod
  paymentReference?: string
  amountTendered?: number
  changeReturned?: number
  status: SaleStatus
  cashierId: string
  cashierName: string
  prescriptionRef?: string
  notes?: string
  /** Healthcare links: dispensed against an e-prescription / charged to a patient account. */
  prescriptionId?: string
  patientId?: string
  patientAccountId?: string
}

export interface SaleReturnItem {
  lineId: string
  medicineId: string
  medicineName: string
  batchId: string
  batchNumber: string
  quantity: number
  refundAmount: number
  restock: boolean
}

export interface SaleReturn {
  id: string
  returnNumber: string
  saleId: string
  invoiceNumber: string
  date: ISODateTime
  customerName: string
  items: SaleReturnItem[]
  totalRefund: number
  refundMethod: PaymentMethod
  reason: string
  status: ApprovalStatus
  requestedBy: string
  decidedBy?: string
  decidedAt?: ISODateTime
  decisionNote?: string
  workflowId?: string
}

// ────────────────────────────────── Purchases ────────────────────────────────

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export interface PurchaseOrderItem {
  id: string
  medicineId: string
  medicineName: string
  orderedQty: number
  receivedQty: number
  freeQty: number
  purchasePrice: number
  discountPct: number
  gstRate: number
  taxableAmount: number
  gstAmount: number
  lineTotal: number
}

export interface PurchaseCharge {
  label: string
  amount: number
}

export interface GoodsReceiptLine {
  poItemId: string
  medicineId: string
  batchId: string
  batchNumber: string
  mfgDate: ISODate
  expiryDate: ISODate
  quantity: number
  sellingPrice: number
}

export interface GoodsReceipt {
  id: string
  receiptNumber: string
  date: ISODateTime
  supplierInvoiceNumber: string
  receivedBy: string
  lines: GoodsReceiptLine[]
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplierName: string
  orderDate: ISODate
  expectedDate?: ISODate
  supplierInvoiceNumber?: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  charges: PurchaseCharge[]
  subtotal: number
  discountTotal: number
  gstTotal: number
  chargesTotal: number
  grandTotal: number
  amountPaid: number
  paymentStatus: PaymentStatus
  receipts: GoodsReceipt[]
  notes?: string
  createdBy: string
  createdAt: ISODateTime
}

export interface SupplierPayment {
  id: string
  paymentNumber: string
  supplierId: string
  purchaseOrderId?: string
  date: ISODateTime
  amount: number
  method: PaymentMethod | 'BANK_TRANSFER' | 'CHEQUE'
  reference?: string
  note?: string
  recordedBy: string
}

// ──────────────────────────────── Online orders ──────────────────────────────

export type OnlineOrderStatus = 'PLACED' | 'CONFIRMED' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED'
export type FulfilmentType = 'PICKUP' | 'DELIVERY'

export interface OnlineOrderAllocation {
  batchId: string
  batchNumber: string
  expiryDate: ISODate
  quantity: number
}

export interface OnlineOrderItem {
  lineId: string
  medicineId: string
  medicineName: string
  packSize: string
  prescriptionRequired: boolean
  quantity: number
  /** MRP shown to the customer when ordering (final price is set at billing). */
  unitPrice: number
  lineTotal: number
  /** Stock reserved for this line (set when staff confirm the order). */
  allocations: OnlineOrderAllocation[]
}

export interface OnlineOrderEvent {
  status: OnlineOrderStatus | 'RX_VERIFIED' | 'NOTE'
  at: ISODateTime
  by: string
  note?: string
}

export interface OnlineOrder {
  id: string
  orderNumber: string
  placedAt: ISODateTime
  customerId?: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  fulfilment: FulfilmentType
  deliveryAddress?: string
  preferredSlot?: string
  items: OnlineOrderItem[]
  estimatedTotal: number
  status: OnlineOrderStatus
  /** Prescription details supplied by the customer. */
  prescriptionRequired: boolean
  prescriptionRef?: string
  doctorName?: string
  prescriptionFileName?: string
  prescriptionVerified: boolean
  prescriptionVerifiedBy?: string
  customerNote?: string
  paymentPreference: 'PAY_AT_STORE' | 'CASH_ON_DELIVERY' | 'UPI_ON_DELIVERY'
  saleId?: string
  invoiceNumber?: string
  cancelReason?: string
  timeline: OnlineOrderEvent[]
}

// ─────────────────────────────────── Settings ────────────────────────────────

export interface StoreProfile {
  name: string
  tagline: string
  addressLine: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  gstin: string
  drugLicenseNo: string
}

export interface AppSettings {
  store: StoreProfile
  /** Batches expiring within this many days are "near expiry". */
  nearExpiryDays: number
  /** Batches expiring within this many days are "critical". */
  criticalExpiryDays: number
  /** Selling prices are GST-inclusive (MRP model) when true. */
  pricesIncludeGst: boolean
  /** Round invoice grand total to the nearest rupee. */
  roundOffInvoice: boolean
  gstRates: number[]
  categories: string[]
  dosageForms: DosageForm[]
  locations: string[]
  enableStockTransfers: boolean
  /** Adjustments larger than this (units) require approval. 0 = always require. */
  adjustmentApprovalThreshold: number
  /** Returns above this value (₹) require approval. 0 = always require. */
  returnApprovalThreshold: number
  invoicePrefix: string
  poPrefix: string
  defaultPaymentTermsDays: number
  lowStockAlertsEnabled: boolean
  expiryAlertsEnabled: boolean
  /** Customer storefront accepts orders. */
  onlineOrdersEnabled: boolean
  onlineDeliveryEnabled: boolean
  /** Minimum estimated order value (₹) for online orders; 0 = none. */
  onlineMinOrderValue: number
  /** Maximum units of one medicine per online order. */
  onlineMaxQtyPerItem: number
  deliveryAreaNote: string
}
