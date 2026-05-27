'use client'

import { useEffect } from 'react'
import { useWalletStore } from '@/store/walletStore'

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { setWallet, setLoading, wallet } = useWalletStore()

  useEffect(() => {
    // Skip if wallet already populated (e.g. by dashboard page)
    if (wallet) return

    let cancelled = false

    async function fetchWallet() {
      setLoading(true)
      try {
        const res = await fetch('/api/wallet')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data.data) setWallet(data.data)
        }
      } catch (e) {
        console.error('Failed to fetch wallet:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchWallet()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
