import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { RequirePermission } from './RequirePermission'
import NotFound from '../pages/NotFound'
import type { Permission } from '../types/domain'

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'))
const PosPage = lazy(() => import('../pages/pos/PosPage'))
const SalesPage = lazy(() => import('../pages/sales/SalesPage'))
const SaleDetailPage = lazy(() => import('../pages/sales/SaleDetailPage'))
const MedicinesPage = lazy(() => import('../pages/medicines/MedicinesPage'))
const MedicineFormPage = lazy(() => import('../pages/medicines/MedicineFormPage'))
const MedicineDetailPage = lazy(() => import('../pages/medicines/MedicineDetailPage'))
const InventoryPage = lazy(() => import('../pages/inventory/InventoryPage'))
const PurchasesPage = lazy(() => import('../pages/purchases/PurchasesPage'))
const PurchaseFormPage = lazy(() => import('../pages/purchases/PurchaseFormPage'))
const PurchaseDetailPage = lazy(() => import('../pages/purchases/PurchaseDetailPage'))
const SuppliersPage = lazy(() => import('../pages/suppliers/SuppliersPage'))
const SupplierDetailPage = lazy(() => import('../pages/suppliers/SupplierDetailPage'))
const CustomersPage = lazy(() => import('../pages/customers/CustomersPage'))
const CustomerDetailPage = lazy(() => import('../pages/customers/CustomerDetailPage'))
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'))
const UsersPage = lazy(() => import('../pages/admin/UsersPage'))
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage'))
const OrdersPage = lazy(() => import('../pages/orders/OrdersPage'))
const OrderDetailPage = lazy(() => import('../pages/orders/OrderDetailPage'))
const ShopLayout = lazy(() => import('../pages/shop/ShopLayout'))
const ShopHomePage = lazy(() => import('../pages/shop/ShopHomePage'))
const CheckoutPage = lazy(() => import('../pages/shop/CheckoutPage'))
const TrackOrderPage = lazy(() => import('../pages/shop/TrackOrderPage'))
const DoctorsPage = lazy(() => import('../pages/doctors/DoctorsPage'))
const DoctorProfilePage = lazy(() => import('../pages/doctors/DoctorProfilePage'))
const AppointmentsPage = lazy(() => import('../pages/appointments/AppointmentsPage'))
const AppointmentDetailPage = lazy(() => import('../pages/appointments/AppointmentDetailPage'))
const ConsultationsPage = lazy(() => import('../pages/consultations/ConsultationsPage'))
const ConsultationRoomPage = lazy(() => import('../pages/consultations/ConsultationRoomPage'))
const PrescriptionsPage = lazy(() => import('../pages/prescriptions/PrescriptionsPage'))
const PrescriptionEditorPage = lazy(() => import('../pages/prescriptions/PrescriptionEditorPage'))
const PrescriptionDetailPage = lazy(() => import('../pages/prescriptions/PrescriptionDetailPage'))
const PatientsPage = lazy(() => import('../pages/patients/PatientsPage'))
const PatientProfilePage = lazy(() => import('../pages/patients/PatientProfilePage'))
const AdmissionsPage = lazy(() => import('../pages/admissions/AdmissionsPage'))
const AdmissionRequestPage = lazy(() => import('../pages/admissions/AdmissionRequestPage'))
const AdmissionDetailPage = lazy(() => import('../pages/admissions/AdmissionDetailPage'))
const InpatientDashboardPage = lazy(() => import('../pages/admissions/InpatientDashboardPage'))
const RoomsPage = lazy(() => import('../pages/rooms/RoomsPage'))
const ClinicalRecordsPage = lazy(() => import('../pages/clinical/ClinicalRecordsPage'))
const DischargesPage = lazy(() => import('../pages/discharges/DischargesPage'))
const PatientBillingPage = lazy(() => import('../pages/billing/PatientBillingPage'))
const PatientAccountPage = lazy(() => import('../pages/billing/PatientAccountPage'))
const ShopDoctorsPage = lazy(() => import('../pages/shop/doctors/ShopDoctorsPage'))
const ShopBookingPage = lazy(() => import('../pages/shop/doctors/ShopBookingPage'))
const ShopAppointmentsPage = lazy(() => import('../pages/shop/doctors/ShopAppointmentsPage'))

const guard = (permission: Permission, el: ReactNode) => <RequirePermission permission={permission}>{el}</RequirePermission>

/**
 * Application routes. The app uses HashRouter (see App.tsx) so deep links work
 * when hosted under any Decisions Custom Web App path without server rewrites.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Customer-facing storefront: its own layout, no staff navigation. */}
      <Route
        path="shop"
        element={
          <Suspense fallback={null}>
            <ShopLayout />
          </Suspense>
        }
      >
        <Route index element={<ShopHomePage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="track" element={<TrackOrderPage />} />
        <Route path="doctors" element={<ShopDoctorsPage />} />
        <Route path="doctors/:id" element={<ShopBookingPage />} />
        <Route path="appointments" element={<ShopAppointmentsPage />} />
      </Route>
      <Route element={<AppShell />}>
        <Route index element={guard('dashboard.view', <DashboardPage />)} />
        <Route path="pos" element={guard('sales.pos', <PosPage />)} />
        <Route path="sales" element={guard('sales.view', <SalesPage />)} />
        <Route path="sales/:id" element={guard('sales.view', <SaleDetailPage />)} />
        <Route path="orders" element={guard('orders.view', <OrdersPage />)} />
        <Route path="orders/:id" element={guard('orders.view', <OrderDetailPage />)} />
        <Route path="doctors" element={guard('doctors.view', <DoctorsPage />)} />
        <Route path="doctors/:id" element={guard('doctors.view', <DoctorProfilePage />)} />
        <Route path="appointments" element={guard('appointments.view', <AppointmentsPage />)} />
        <Route path="appointments/:id" element={guard('appointments.view', <AppointmentDetailPage />)} />
        <Route path="consultations" element={guard('appointments.view', <ConsultationsPage />)} />
        <Route path="consultations/:id" element={guard('appointments.view', <ConsultationRoomPage />)} />
        <Route path="prescriptions" element={guard('prescriptions.view', <PrescriptionsPage />)} />
        <Route path="prescriptions/new" element={guard('prescriptions.issue', <PrescriptionEditorPage />)} />
        <Route path="prescriptions/:id" element={guard('prescriptions.view', <PrescriptionDetailPage />)} />
        <Route path="prescriptions/:id/edit" element={guard('prescriptions.issue', <PrescriptionEditorPage />)} />
        <Route path="patients" element={guard('patients.view', <PatientsPage />)} />
        <Route path="patients/:id" element={guard('patients.view', <PatientProfilePage />)} />
        <Route path="admissions" element={guard('admissions.view', <AdmissionsPage />)} />
        <Route path="admissions/new" element={guard('admissions.manage', <AdmissionRequestPage />)} />
        <Route path="admissions/:id" element={guard('admissions.view', <AdmissionDetailPage />)} />
        <Route path="inpatients" element={guard('admissions.view', <InpatientDashboardPage />)} />
        <Route path="rooms" element={guard('beds.view', <RoomsPage />)} />
        <Route path="clinical" element={guard('clinical.view', <ClinicalRecordsPage />)} />
        <Route path="discharges" element={guard('admissions.view', <DischargesPage />)} />
        <Route path="billing" element={guard('billing.view', <PatientBillingPage />)} />
        <Route path="billing/:id" element={guard('billing.view', <PatientAccountPage />)} />
        <Route path="medicines" element={guard('medicines.view', <MedicinesPage />)} />
        <Route path="medicines/new" element={guard('medicines.manage', <MedicineFormPage />)} />
        <Route path="medicines/:id" element={guard('medicines.view', <MedicineDetailPage />)} />
        <Route path="medicines/:id/edit" element={guard('medicines.manage', <MedicineFormPage />)} />
        <Route path="inventory" element={guard('inventory.view', <InventoryPage />)} />
        <Route path="purchases" element={guard('purchases.view', <PurchasesPage />)} />
        <Route path="purchases/new" element={guard('purchases.manage', <PurchaseFormPage />)} />
        <Route path="purchases/:id" element={guard('purchases.view', <PurchaseDetailPage />)} />
        <Route path="purchases/:id/edit" element={guard('purchases.manage', <PurchaseFormPage />)} />
        <Route path="suppliers" element={guard('suppliers.view', <SuppliersPage />)} />
        <Route path="suppliers/:id" element={guard('suppliers.view', <SupplierDetailPage />)} />
        <Route path="customers" element={guard('customers.view', <CustomersPage />)} />
        <Route path="customers/:id" element={guard('customers.view', <CustomerDetailPage />)} />
        <Route path="reports" element={guard('reports.view', <ReportsPage />)} />
        <Route path="admin/users" element={guard('admin.users', <UsersPage />)} />
        <Route path="admin/settings" element={guard('admin.settings', <SettingsPage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
