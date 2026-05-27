/**
 * utils/format.ts
 * Semua fungsi formatting terpusat di sini
 */

export type Currency = 'USD' | 'USDT' | 'IDR' | 'BTC'

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  USDT: '₮',
  IDR: 'Rp',
  BTC: '₿',
}

/**
 * Format angka sebagai mata uang
 */
export function formatCurrency(
  value: number,
  currency: Currency = 'USD',
  compact: boolean = false
): string {
  if (currency === 'BTC') {
    return `₿${value.toFixed(8)}`
  }

  if (currency === 'IDR') {
    if (compact && Math.abs(value) >= 1_000_000) {
      return `Rp${(value / 1_000_000).toFixed(2)}jt`
    }
    return `Rp${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
  }

  if (compact && Math.abs(value) >= 1_000_000) {
    return `${CURRENCY_SYMBOLS[currency]}${(value / 1_000_000).toFixed(2)}M`
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `${CURRENCY_SYMBOLS[currency]}${(value / 1_000).toFixed(2)}K`
  }

  return `${CURRENCY_SYMBOLS[currency]}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format persentase dengan tanda + atau -
 */
export function formatPercent(
  value: number,
  decimals: number = 2,
  showSign: boolean = true
): string {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Format angka besar dengan koma ribuan
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format tanggal
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format tanggal dengan waktu
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Warna untuk nilai profit/loss
 */
export function getPnLColor(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

/**
 * Warna untuk badge status
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'open':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'closed':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    case 'planned':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

/**
 * Warna untuk emotion tag
 */
export function getEmotionColor(emotion: string): string {
  switch (emotion.toLowerCase()) {
    case 'fear':
      return 'bg-purple-500/20 text-purple-400'
    case 'greed':
      return 'bg-orange-500/20 text-orange-400'
    case 'fomo':
      return 'bg-red-500/20 text-red-400'
    case 'confident':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'neutral':
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}
