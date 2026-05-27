import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Wallet } from '@/types'
import { calculateFreeCapital, calculateRiskExposure } from '@/lib/calculations'

interface WalletStore {
  wallet: Wallet | null
  isLoading: boolean
  // Derived
  freeCapital: number
  riskExposure: number
  // Actions
  setWallet: (wallet: Wallet) => void
  setLoading: (loading: boolean) => void
  updateBalance: (totalBalance: number, tradingBalance: number) => void
  updateUsedCapital: (usedCapital: number) => void
  applyPnL: (pnl: number) => void
}

export const useWalletStore = create<WalletStore>()((set, get) => ({
  wallet: null,
  isLoading: false,
  freeCapital: 0,
  riskExposure: 0,

  setWallet: (wallet) => set({
    wallet,
    freeCapital: calculateFreeCapital(wallet.totalBalance, wallet.usedCapital ?? 0),
    riskExposure: calculateRiskExposure(wallet.usedCapital ?? 0, wallet.totalBalance),
  }),

  setLoading: (isLoading) => set({ isLoading }),

  updateBalance: (totalBalance, tradingBalance) =>
    set((state) => {
      const usedCapital = state.wallet?.usedCapital ?? 0
      return {
        wallet: state.wallet ? { ...state.wallet, totalBalance, tradingBalance } : null,
        freeCapital: calculateFreeCapital(totalBalance, usedCapital),
        riskExposure: calculateRiskExposure(usedCapital, totalBalance),
      }
    }),

  updateUsedCapital: (usedCapital) =>
    set((state) => {
      const totalBalance = state.wallet?.totalBalance ?? 0
      return {
        wallet: state.wallet ? { ...state.wallet, usedCapital } : null,
        freeCapital: calculateFreeCapital(totalBalance, usedCapital),
        riskExposure: calculateRiskExposure(usedCapital, totalBalance),
      }
    }),

  applyPnL: (pnl) =>
    set((state) => {
      if (!state.wallet) return {}
      const newTotal = state.wallet.totalBalance + pnl
      const newTrading = Math.max(0, state.wallet.tradingBalance + pnl)
      const usedCapital = state.wallet.usedCapital ?? 0
      return {
        wallet: { ...state.wallet, totalBalance: newTotal, tradingBalance: newTrading },
        freeCapital: calculateFreeCapital(newTotal, usedCapital),
        riskExposure: calculateRiskExposure(usedCapital, newTotal),
      }
    }),
}))
