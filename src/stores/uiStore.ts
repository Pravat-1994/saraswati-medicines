import { create } from 'zustand'
import { safeStorage } from '../lib/storage'

const KEY = 'saraswati-medicines.sidebar-collapsed'

interface UiState {
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  commandOpen: boolean
  /** Staff member is previewing the customer storefront. */
  customerPreview: boolean
  setCustomerPreview: (v: boolean) => void
  toggleSidebar: () => void
  setMobileNav: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: safeStorage.get(KEY) === 'true',
  mobileNavOpen: false,
  commandOpen: false,
  customerPreview: false,
  setCustomerPreview: (customerPreview) => set({ customerPreview }),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    safeStorage.set(KEY, String(next))
    set({ sidebarCollapsed: next })
  },
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  setCommandOpen: (open) => set({ commandOpen: open }),
}))
