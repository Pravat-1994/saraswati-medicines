import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/inpatientHandlers'
import type { AccountFilters, AccountView, ChargeInput, PaymentInput } from '../types/clinicApi'

/** Patient (OPD/IPD) accounts — separate from pharmacy sales, with optional linking of pharmacy invoices. */
export const patientBillingService = {
  list(filters: AccountFilters = {}): Promise<AccountView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.list, filters, () => mock.listAccounts(filters))
  },
  get(id: string): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.get, { id }, () => mock.getAccount(id))
  },
  addCharge(accountId: string, input: ChargeInput): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.addCharge, { accountId, ...input }, () => mock.addCharge(accountId, input))
  },
  removeCharge(accountId: string, chargeId: string): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.removeCharge, { accountId, chargeId }, () => mock.removeCharge(accountId, chargeId))
  },
  setDiscount(accountId: string, amount: number): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.discount, { accountId, amount }, () => mock.setDiscount(accountId, amount))
  },
  recordPayment(accountId: string, input: PaymentInput): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (patient payment flow).
    return invoke(F.billing.payment, { accountId, ...input }, () => mock.recordPayment(accountId, input))
  },
  finalise(accountId: string): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (final bill generation).
    return invoke(F.billing.finalise, { accountId }, () => mock.finaliseBill(accountId))
  },
  linkPharmacySale(accountId: string, sale: { saleId: string; invoiceNumber: string; amount: number }): Promise<AccountView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.linkSale, { accountId, ...sale }, () => mock.linkPharmacySale(accountId, sale))
  },
  activeInpatientAccounts(): Promise<{ accountId: string; accountNo: string; patientName: string; patientCode: string; admissionNo: string; bed?: string }[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.billing.activeAccounts, {}, () => mock.activeAdmissionAccounts())
  },
}
