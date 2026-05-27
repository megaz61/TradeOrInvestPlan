import { create } from 'zustand'
import type { Asset, AssetStatus, AssetType, TransactionType } from '@/types'
import { calculatePortfolioPnL, calculateAssetAllocation } from '@/lib/calculations'

interface AssetStore {
  assets: Asset[]
  isLoading: boolean

  // Derived (recomputed on setAssets)
  totalUsedCapital: number
  portfolioPnl: { realized: number; unrealized: number; total: number }
  activeAssets: Asset[]
  allocationData: { name: string; value: number; percent: number }[]

  // Actions
  setAssets: (assets: Asset[]) => void
  setLoading: (loading: boolean) => void
  addAsset: (asset: Asset) => void
  updateAsset: (asset: Asset) => void
  removeAsset: (id: number) => void

  // Async fetch
  fetchAssets: () => Promise<void>
}

function deriveAssetStats(assets: Asset[]) {
  const active = assets.filter(a => ['active', 'partial_take_profit'].includes(a.status))
  const totalUsedCapital = active.reduce((sum, a) => sum + a.capitalUsed + (a.fee || 0), 0)
  const portfolioPnl = calculatePortfolioPnL(
    assets.map(a => ({ realizedPnl: a.realizedPnl, unrealizedPnl: a.unrealizedPnl }))
  )
  const allocationData = calculateAssetAllocation(
    active.map(a => ({
      id: a.id,
      name: a.symbol || a.productName || a.name,
      capitalUsed: a.capitalUsed + (a.fee || 0),
    }))
  )
  return { totalUsedCapital, portfolioPnl, activeAssets: active, allocationData }
}

export const useAssetStore = create<AssetStore>()((set, get) => ({
  assets: [],
  isLoading: false,
  totalUsedCapital: 0,
  portfolioPnl: { realized: 0, unrealized: 0, total: 0 },
  activeAssets: [],
  allocationData: [],

  setAssets: (assets) => set({ assets, ...deriveAssetStats(assets) }),

  setLoading: (isLoading) => set({ isLoading }),

  addAsset: (asset) => {
    const assets = [...get().assets, asset]
    set({ assets, ...deriveAssetStats(assets) })
  },

  updateAsset: (asset) => {
    const assets = get().assets.map(a => a.id === asset.id ? asset : a)
    set({ assets, ...deriveAssetStats(assets) })
  },

  removeAsset: (id) => {
    const assets = get().assets.filter(a => a.id !== id)
    set({ assets, ...deriveAssetStats(assets) })
  },

  fetchAssets: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/assets')
      const data = await res.json()
      const assets: Asset[] = data.data ?? []
      set({ assets, ...deriveAssetStats(assets), isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
}))
