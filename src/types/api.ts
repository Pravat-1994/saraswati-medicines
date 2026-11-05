/**
 * Request / response models shared by every service.
 * These mirror the shapes the Decisions flows are expected to accept and return.
 */
import type {
  AdjustmentType,
  ExpiryStatus,
  ISODate,
  PaymentMethod,
  PurchaseCharge,
  PurchaseOrderStatus,
  StockStatus,
} from './domain'

export type SortDirection = 'asc' | 'desc'

export interface ListQuery<TFilters = Record<string, unknown>> {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: SortDirection
  filters?: TFilters
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface DateRange {
  from: ISODate
  to: ISODate
}

export type DatePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'CUSTOM'

export interface DateFilterValue {
  preset: DatePreset
  range: DateRange
}

/** Standard error returned by all services. */
export class ServiceError extends Error {
  readonly code: string
  readonly status?: number
  readonly details?: unknown

  constructor(message: string, code = 'SERVICE_ERROR', status?: number, details?: unknown) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.status = status
    this.details = details
  }
}

/** Workflow tracking for long-running Decisions processes (approvals etc). */
export interface WorkflowStatus {
  workflowId: string
  name: string
  status: 'NOT_STARTED' | 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED'
  startedAt: string
  updatedAt: string
  assignedTo?: string
  message?: string
}

// ─── Medicines ───

export interface MedicineFilters {
  category?: string
  manufacturer?: string
  availability?: StockStatus | 'ALL'
  expiry?: ExpiryStatus | 'ALL'
}

export interface MedicineInput {
  code: string
  name: string
  genericName: string
  manufacturer: string
  category: string
  composition: string
  strength: string
  dosageForm: string
  packSize: string
  barcode: string
  hsnCode: string
  gstRate: number
  purchasePrice: number
  sellingPrice: number
  minStockLevel: number
  reorderQuantity: number
  primarySupplierId?: string
  storageInstructions: string
  prescriptionRequired: boolean
  isActive: boolean
}

export interface BatchInput {
  medicineId: string
  batchNumber: string
  mfgDate: ISODate
  expiryDate: ISODate
  purchasePrice: number
  sellingPrice: number
  quantity: number
  location: string
  supplierId?: string
}

// ─── Inventory ───

export interface AdjustmentRequest {
  medicineId: string
  batchId: string
  type: AdjustmentType
  quantity: number
  reason: string
}

export interface TransferRequest {
  medicineId: string
  batchId: string
  toLocation: string
  quantity: number
  note?: string
}

export interface MovementFilters {
  medicineId?: string
  type?: string
  range?: DateRange
}

// ─── Sales ───

export interface CartLineInput {
  medicineId: string
  batchId: string
  quantity: number
  discountPct: number
  fefoOverridden?: boolean
}

export interface CreateSaleRequest {
  customerId?: string
  customerName?: string
  customerPhone?: string
  lines: CartLineInput[]
  billDiscountPct: number
  paymentMethod: PaymentMethod
  paymentReference?: string
  amountTendered?: number
  prescriptionRef?: string
  notes?: string
  prescriptionId?: string
  patientId?: string
  /** Charge to an inpatient account instead of collecting payment at the counter. */
  patientAccountId?: string
}

export interface SaleFilters {
  range?: DateRange
  paymentMethod?: PaymentMethod | 'ALL'
  status?: string
  customerId?: string
}

export interface ReturnRequestLine {
  lineId: string
  quantity: number
  restock: boolean
}

export interface CreateReturnRequest {
  saleId: string
  lines: ReturnRequestLine[]
  refundMethod: PaymentMethod
  reason: string
}

// ─── Purchases ───

export interface PurchaseOrderItemInput {
  medicineId: string
  orderedQty: number
  freeQty: number
  purchasePrice: number
  discountPct: number
  gstRate: number
}

export interface PurchaseOrderInput {
  supplierId: string
  orderDate: ISODate
  expectedDate?: ISODate
  items: PurchaseOrderItemInput[]
  charges: PurchaseCharge[]
  notes?: string
  status: Extract<PurchaseOrderStatus, 'DRAFT' | 'ORDERED'>
}

export interface ReceiveLineInput {
  poItemId: string
  batchNumber: string
  mfgDate: ISODate
  expiryDate: ISODate
  quantity: number
  sellingPrice: number
}

export interface ReceiveGoodsRequest {
  purchaseOrderId: string
  supplierInvoiceNumber: string
  lines: ReceiveLineInput[]
}

// ─── Online orders (customer storefront) ───

export interface ShopQuery {
  search?: string
  category?: string
}

export interface PlaceOrderRequest {
  customerName: string
  customerPhone: string
  customerEmail?: string
  fulfilment: 'PICKUP' | 'DELIVERY'
  deliveryAddress?: string
  preferredSlot?: string
  items: { medicineId: string; quantity: number }[]
  prescriptionRef?: string
  doctorName?: string
  /** File name only in demo mode; Decisions would store a FileReference id. */
  prescriptionFileName?: string
  customerNote?: string
  paymentPreference: 'PAY_AT_STORE' | 'CASH_ON_DELIVERY' | 'UPI_ON_DELIVERY'
}

export interface OrderFilters {
  status?: 'ACTIVE' | 'ALL' | 'PLACED' | 'CONFIRMED' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED'
}

export interface CompleteOrderRequest {
  orderId: string
  paymentMethod: PaymentMethod
  paymentReference?: string
  amountTendered?: number
}

export interface SupplierPaymentInput {
  supplierId: string
  purchaseOrderId?: string
  amount: number
  method: PaymentMethod | 'BANK_TRANSFER' | 'CHEQUE'
  reference?: string
  note?: string
}
