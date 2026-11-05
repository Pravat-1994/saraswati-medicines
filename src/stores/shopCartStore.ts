/** Customer storefront cart (kept on this device only). */
import { create } from 'zustand'
import { safeStorage } from '../lib/storage'
import type { ShopProduct } from '../types/views'

const KEY = 'saraswati-medicines.shop-cart'
const RECENT_KEY = 'saraswati-medicines.shop-recent-orders'

export interface ShopCartLine {
  product: ShopProduct
  quantity: number
}

function load(): ShopCartLine[] {
  try {
    const raw = safeStorage.get(KEY)
    return raw ? (JSON.parse(raw) as ShopCartLine[]) : []
  } catch {
    return []
  }
}

interface ShopCartState {
  lines: ShopCartLine[]
  open: boolean
  setOpen: (open: boolean) => void
  add: (p: ShopProduct, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
}

export const useShopCart = create<ShopCartState>((set, get) => {
  const persist = (lines: ShopCartLine[]) => {
    safeStorage.set(KEY, JSON.stringify(lines))
    set({ lines })
  }
  return {
    lines: load(),
    open: false,
    setOpen: (open) => set({ open }),
    add: (p, qty = 1) => {
      const lines = get().lines.map((l) => ({ ...l }))
      const existing = lines.find((l) => l.product.id === p.id)
      if (existing) {
        existing.quantity = Math.min(p.maxQty, existing.quantity + qty)
        existing.product = p
      } else lines.push({ product: p, quantity: Math.min(p.maxQty, qty) })
      persist(lines)
    },
    setQty: (id, qty) => persist(get().lines.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, Math.min(l.product.maxQty, Math.floor(qty) || 1)) } : l))),
    remove: (id) => persist(get().lines.filter((l) => l.product.id !== id)),
    clear: () => persist([]),
  }
})

/** Order numbers placed from this device (convenience for tracking). */
export const recentOrders = {
  list(): string[] {
    try {
      return JSON.parse(safeStorage.get(RECENT_KEY) ?? '[]') as string[]
    } catch {
      return []
    }
  },
  add(orderNumber: string) {
    safeStorage.set(RECENT_KEY, JSON.stringify([orderNumber, ...this.list().filter((o) => o !== orderNumber)].slice(0, 5)))
  },
}
