import {
  BarChart3,
  BedDouble,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileHeart,
  Globe,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Pill,
  ReceiptIndianRupee,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Truck,
  UserPlus,
  Users,
  Video,
  Hospital,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '../types/domain'

export type BadgeKey = 'alerts' | 'approvals' | 'orders' | 'appointments' | 'admissions' | 'discharges' | 'rx'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Any one of these permissions shows the item. */
  permission: Permission | Permission[]
  /** Highlight for nested paths too. */
  matchPrefix?: boolean
  badgeKey?: BadgeKey
}

export interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

export const NAVIGATION: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard.view' }],
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    items: [
      { label: 'Point of Sale', to: '/pos', icon: ScanBarcode, permission: 'sales.pos' },
      { label: 'Sales & Billing', to: '/sales', icon: ReceiptText, permission: 'sales.view', matchPrefix: true, badgeKey: 'approvals' },
      { label: 'Online Orders', to: '/orders', icon: Globe, permission: 'orders.view', matchPrefix: true, badgeKey: 'orders' },
      { label: 'Medicines', to: '/medicines', icon: Pill, permission: 'medicines.view', matchPrefix: true },
      { label: 'Inventory', to: '/inventory', icon: Boxes, permission: 'inventory.view', matchPrefix: true, badgeKey: 'alerts' },
      { label: 'Purchases', to: '/purchases', icon: ShoppingCart, permission: 'purchases.view', matchPrefix: true },
      { label: 'Suppliers', to: '/suppliers', icon: Truck, permission: 'suppliers.view', matchPrefix: true },
      { label: 'Customers', to: '/customers', icon: Users, permission: 'customers.view', matchPrefix: true },
    ],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    items: [
      { label: 'Doctor Directory', to: '/doctors', icon: Stethoscope, permission: 'doctors.view', matchPrefix: true },
      { label: 'Appointments', to: '/appointments', icon: CalendarClock, permission: 'appointments.view', matchPrefix: true, badgeKey: 'appointments' },
      { label: 'Online Consultations', to: '/consultations', icon: Video, permission: ['consultations.conduct', 'appointments.view'], matchPrefix: true },
      { label: 'Prescriptions', to: '/prescriptions', icon: FileHeart, permission: 'prescriptions.view', matchPrefix: true, badgeKey: 'rx' },
      { label: 'Patient Registration', to: '/patients', icon: UserPlus, permission: 'patients.view', matchPrefix: true },
      { label: 'Patient Admissions', to: '/admissions', icon: Hospital, permission: 'admissions.view', matchPrefix: true, badgeKey: 'admissions' },
      { label: 'Inpatient Dashboard', to: '/inpatients', icon: HeartPulse, permission: 'admissions.view' },
      { label: 'Rooms & Beds', to: '/rooms', icon: BedDouble, permission: 'beds.view' },
      { label: 'Clinical Records', to: '/clinical', icon: ClipboardList, permission: 'clinical.view', matchPrefix: true },
      { label: 'Discharge Management', to: '/discharges', icon: LogOut, permission: 'admissions.view', matchPrefix: true, badgeKey: 'discharges' },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    items: [
      { label: 'Patient Billing', to: '/billing', icon: ReceiptIndianRupee, permission: 'billing.view', matchPrefix: true },
      { label: 'Reports & Analytics', to: '/reports', icon: BarChart3, permission: 'reports.view', matchPrefix: true },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    items: [
      { label: 'Users & Roles', to: '/admin/users', icon: ShieldCheck, permission: 'admin.users', matchPrefix: true },
      { label: 'Settings', to: '/admin/settings', icon: Settings, permission: 'admin.settings' },
    ],
  },
]
