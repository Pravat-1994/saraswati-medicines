/**
 * Read models returned by services (entity + derived/aggregated fields).
 * Decisions flows should return the same shapes so the UI needs no changes.
 */
import type { StockSummary } from '../lib/inventory'
import type {
  Batch,
  Customer,
  ExpiryStatus,
  Medicine,
  PaymentMethod,
  PurchaseOrder,
  Sale,
  SaleReturn,
  StockMovement,
  Supplier,
  SupplierPayment,
} from './domain'

export type { StockSummary }

export interface MedicineListItem extends Medicine {
  stock: StockSummary
  supplierName?: string
}

export interface BatchView extends Batch {
  medicineName: string
  medicineCode: string
  category: string
  expiryStatus: ExpiryStatus
  daysToExpiry: number
  stockValue: number
}

export interface MedicineDetail {
  medicine: Medicine
  stock: StockSummary
  batches: BatchView[]
  movements: StockMovement[]
  supplier?: Supplier
  unitsSold30d: number
  revenue30d: number
  monthlySales: { month: string; units: number; revenue: number }[]
}

export interface SaleableMedicine {
  medicine: Medicine
  stock: StockSummary
  /** All batches with stock, FEFO-sorted. Expired batches are included but flagged. */
  batches: BatchView[]
}

export interface MedicineLookups {
  categories: string[]
  manufacturers: string[]
}

export type AlertKind = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'EXPIRED' | 'NEAR_EXPIRY'

export interface InventoryAlert {
  id: string
  kind: AlertKind
  severity: 'critical' | 'warning' | 'info'
  medicineId: string
  medicineName: string
  medicineCode: string
  batchId?: string
  batchNumber?: string
  quantity: number
  minStockLevel?: number
  expiryDate?: string
  daysToExpiry?: number
  value: number
}

export interface InventoryOverview {
  skuCount: number
  sellableUnits: number
  reservedUnits: number
  damagedUnits: number
  expiredUnits: number
  stockValueCost: number
  stockValueRetail: number
  expiredValue: number
  lowStockCount: number
  outOfStockCount: number
  nearExpiryBatches: number
  byCategory: { category: string; units: number; value: number; skus: number }[]
  byLocation: { location: string; units: number; value: number }[]
  expiryBuckets: { label: string; batches: number; units: number; value: number }[]
}

export interface SaleListItem extends Omit<Sale, 'items'> {
  itemCount: number
  unitCount: number
}

export interface SaleDetail {
  sale: Sale
  returns: SaleReturn[]
}

export interface PurchaseOrderListItem extends Omit<PurchaseOrder, 'items' | 'receipts'> {
  itemCount: number
  outstanding: number
  receivedPct: number
}

export interface SupplierListItem extends Supplier {
  totalPurchases: number
  outstanding: number
  orderCount: number
  openOrders: number
  lastOrderDate?: string
}

export interface SupplierDetail {
  supplier: Supplier
  purchaseOrders: PurchaseOrderListItem[]
  payments: SupplierPayment[]
  totalPurchases: number
  totalPaid: number
  outstanding: number
  medicinesSupplied: { medicineId: string; medicineName: string; units: number; value: number }[]
}

export interface CustomerListItem extends Customer {
  totalSpent: number
  visits: number
  lastVisit?: string
}

export interface CustomerDetail {
  customer: Customer
  sales: SaleListItem[]
  totalSpent: number
  visits: number
  averageBill: number
  lastVisit?: string
  topMedicines: { medicineId: string; medicineName: string; units: number; spent: number }[]
}

/** Public product view for the customer storefront — no cost or exact stock. */
export interface ShopProduct {
  id: string
  name: string
  genericName: string
  manufacturer: string
  category: string
  strength: string
  dosageForm: string
  packSize: string
  composition: string
  price: number
  prescriptionRequired: boolean
  availability: 'IN_STOCK' | 'LIMITED' | 'OUT_OF_STOCK'
  maxQty: number
}

export interface ShopInfo {
  storeName: string
  tagline: string
  address: string
  phone: string
  email: string
  ordersEnabled: boolean
  deliveryEnabled: boolean
  minOrderValue: number
  maxQtyPerItem: number
  deliveryAreaNote: string
  categories: string[]
}

/** What a customer sees when tracking an order. */
export interface OrderTracking {
  orderNumber: string
  placedAt: string
  status: import('./domain').OnlineOrderStatus
  fulfilment: 'PICKUP' | 'DELIVERY'
  customerName: string
  items: { medicineName: string; packSize: string; quantity: number; lineTotal: number }[]
  estimatedTotal: number
  prescriptionRequired: boolean
  prescriptionVerified: boolean
  invoiceNumber?: string
  cancelReason?: string
  timeline: { status: string; at: string; note?: string }[]
}

export interface OnlineOrderDetail {
  order: import('./domain').OnlineOrder
  /** Current sellable stock per medicine (excluding this order's reservation). */
  availability: Record<string, number>
  customer?: Customer
}

export interface KpiValue {
  value: number
  previous: number
}

export interface DashboardSummary {
  range: { from: string; to: string }
  salesTotal: KpiValue
  billCount: KpiValue
  averageBill: KpiValue
  grossProfit: KpiValue
  salesToday: number
  billsToday: number
  monthRevenue: number
  monthRevenuePrevious: number
  totalMedicines: number
  activeMedicines: number
  lowStockCount: number
  outOfStockCount: number
  nearExpiryCount: number
  expiredCount: number
  totalCustomers: number
  newCustomers: number
  pendingSupplierPayments: number
  pendingSupplierCount: number
  pendingApprovals: number
  salesTrend: { date: string; revenue: number; profit: number; bills: number }[]
  topMedicines: { medicineId: string; name: string; units: number; revenue: number }[]
  categoryMix: { category: string; revenue: number }[]
  paymentMix: { method: PaymentMethod; amount: number; count: number }[]
  inventoryHealth: { label: string; key: string; count: number }[]
  recentSales: SaleListItem[]
  recentPurchases: PurchaseOrderListItem[]
  alerts: InventoryAlert[]
}

export interface SalesReportRow {
  period: string
  bills: number
  units: number
  gross: number
  discount: number
  taxable: number
  gst: number
  net: number
  cost: number
  profit: number
  returns: number
}

export interface MedicineSalesRow {
  medicineId: string
  medicineName: string
  medicineCode: string
  category: string
  units: number
  revenue: number
  cost: number
  profit: number
  marginPct: number
  bills: number
}

export interface PurchaseReportRow {
  supplierId: string
  supplierName: string
  orders: number
  received: number
  value: number
  gst: number
  paid: number
  outstanding: number
}

export interface PaymentBreakdownRow {
  method: PaymentMethod
  bills: number
  amount: number
  share: number
}

export interface SalesReport {
  rows: SalesReportRow[]
  totals: SalesReportRow
  payments: PaymentBreakdownRow[]
  gstByRate: { rate: number; taxable: number; gst: number }[]
}

export interface PurchaseReport {
  rows: PurchaseReportRow[]
  monthly: { month: string; value: number; orders: number }[]
  totals: { orders: number; value: number; gst: number; paid: number; outstanding: number }
}
