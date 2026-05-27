import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Currency } from '@/types'

interface SettingsStore {
  currency: Currency
  theme: 'dark' | 'light'
  maxRiskPercent: number
  preferredLeverage: number
  maxDrawdown: number
  setCurrency: (currency: Currency) => void
  setTheme: (theme: 'dark' | 'light') => void
  setRiskSettings: (settings: {
    maxRiskPercent?: number
    preferredLeverage?: number
    maxDrawdown?: number
  }) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      currency: 'USD',
      theme: 'dark',
      maxRiskPercent: 2,
      preferredLeverage: 1,
      maxDrawdown: 20,
      setCurrency: (currency) => set({ currency }),
      setTheme: (theme) => set({ theme }),
      setRiskSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'trading-planner-settings',
    }
  )
)
