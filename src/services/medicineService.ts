import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/medicineHandlers'
import type { ListQuery, MedicineFilters, MedicineInput, PagedResult } from '../types/api'
import type { Medicine } from '../types/domain'
import type { MedicineDetail, MedicineListItem, MedicineLookups, SaleableMedicine } from '../types/views'

/** Medicine catalogue operations. */
export const medicineService = {
  /** Paged, filterable medicine list with stock summary. */
  list(query: ListQuery<MedicineFilters>): Promise<PagedResult<MedicineListItem>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.list, query, () => mock.listMedicines(query))
  },

  /** Medicine with batches, movement history and sales stats. */
  get(id: string): Promise<MedicineDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.get, { id }, () => mock.getMedicine(id))
  },

  create(input: MedicineInput): Promise<Medicine> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.create, input, () => mock.createMedicine(input))
  },

  update(id: string, input: MedicineInput): Promise<Medicine> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.update, { id, ...input }, () => mock.updateMedicine(id, input))
  },

  /** Deletes a medicine without history, otherwise deactivates it. */
  remove(id: string): Promise<{ deleted: boolean }> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.remove, { id }, () => mock.removeMedicine(id))
  },

  /** Category and manufacturer pick-lists. */
  lookups(): Promise<MedicineLookups> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.lookups, {}, () => mock.medicineLookups())
  },

  /** Next available medicine code (Decisions should generate this server-side). */
  suggestCode(): Promise<string> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.lookups, { suggestCode: true }, () => mock.suggestMedicineCode())
  },

  /** POS search by name, generic name, SKU or barcode — returns sellable batches. */
  searchForSale(term: string): Promise<SaleableMedicine[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.searchForSale, { term }, () => mock.searchForSale(term))
  },

  /** Fresh batch availability for a single medicine (used before checkout). */
  getSaleable(medicineId: string): Promise<SaleableMedicine> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.medicines.searchForSale, { medicineId }, () => mock.getSaleable(medicineId))
  },
}
