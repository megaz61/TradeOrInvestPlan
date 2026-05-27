/**
 * types/index.ts — Updated for major refactor
 */

export type Currency = 'USD' | 'USDT' | 'IDR' | 'BTC'
export type AssetType = 'Crypto' | 'Forex' | 'Stock' | 'Commodity' | 'Reksadana'
export type TransactionType = 'Spot' | 'Margin'
export type AssetStatus =
  | 'planned'
  | 'active'
  | 'partial_take_profit'
  | 'closed_profit'
  | 'closed_loss'
  | 'liquidated'
export type AssetEventType = 'entry' | 'add' | 'reduce' | 'close' | 'liquidation' | 'withdrawal'
export type TradeStatus = 'open' | 'closed'
export type Emotion = 'Fear' | 'Greed' | 'FOMO' | 'Neutral' | 'Confident'

export interface Wallet {
  id: number
  userId: number
  name: string
  currency: Currency
  totalBalance: number
  tradingBalance: number
  usedCapital: number
  createdAt: string
  updatedAt: string
}

export interface Asset {
  id: number
  userId: number
  symbol: string
  productName: string
  name: string
  assetType: AssetType
  transactionType: TransactionType
  platform: string
  entryPrice: number
  takeProfit: number | null
  stopLoss: number | null
  volume: number
  leverage: number
  capitalUsed: number
  fee: number
  currentCapital: number
  realizedPnl: number
  unrealizedPnl: number
  entryDate: string
  notes: string
  status: AssetStatus
  createdAt: string
  updatedAt: string
  events?: AssetEvent[]
  trades?: Trade[]
}

export interface AssetEvent {
  id: number
  assetId: number
  eventType: AssetEventType
  price: number
  volume: number
  capitalBefore: number
  capitalAfter: number
  pnlRealized: number
  notes: string
  createdAt: string
}

export interface Trade {
  id: number
  userId: number
  assetId: number | null
  symbol: string
  entryPrice: number
  exitPrice: number | null
  entryDate: string
  exitDate: string | null
  entryAmount: number
  leverage: number
  positionSize: number
  pnl: number | null
  pnlPercent: number | null
  emotion: Emotion
  notes: string
  strategy: string
  status: TradeStatus
  createdAt: string
  updatedAt: string
  journal?: TradeJournal | null
  asset?: Asset | null
}

export interface TradeJournal {
  id: number
  tradeId: number
  emotion: Emotion
  mistakes: string
  analysis: string
  createdAt: string
  updatedAt: string
}

export interface Watchlist {
  id: number
  userId: number
  symbol: string
  targetPrice: number | null
  currentNote: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface RiskProfile {
  id: number
  userId: number
  maxRiskPercent: number
  preferredLeverage: number
  maxDrawdown: number
  currency: Currency
  theme: string
}

export interface CompoundSimulation {
  id: number
  userId: number
  name: string
  initialCapital: number
  dailyPercent: number
  durationDays: number
  finalValue: number
  createdAt: string
}

export interface DashboardStats {
  totalBalance: number
  tradingBalance: number
  usedCapital: number
  freeCapital: number
  riskExposure: number
  totalPnl: number
  portfolioPnl: number
  winRate: number
  activePositions: number
  activeAssets: number
  openTrades: number
  totalTrades: number
  currency: Currency
  recentTrades: Trade[]
  watchlistSummary: Watchlist[]
  pnlHistory: { date: string; pnl: number }[]
  stats: {
    winTrades: number
    lossTrades: number
    avgPnl: number
    profitFactor: number
  }
}

// Portfolio Simulator types
export interface SimulatorAssetRow {
  id: string
  assetName: string
  capitalUsed: number
  entryPrice: number
  pnlPercent: number       // user input: +/- percent
  isLinked: boolean        // imported from DB
  assetId?: number
}

export interface SimulatorResult {
  rows: SimulatorAssetResultRow[]
  totalCapitalUsed: number
  totalPnlNominal: number
  totalPnlPercent: number
  totalCapitalAfter: number
  walletAfter: number
  bestAsset: string
  worstAsset: string
}

export interface SimulatorAssetResultRow {
  assetName: string
  capitalUsed: number
  pnlPercent: number
  pnlNominal: number
  capitalAfter: number
  allocationPercent: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Platform options
export const PLATFORM_OPTIONS = [
  'Binance', 'Bybit', 'OKX', 'Indodax', 'Tokocrypto',
  'MetaTrader 4', 'MetaTrader 5', 'TradingView',
  'Bibit', 'Ajaib', 'IPOT', 'Pluang', 'Stockbit',
  'Manual / Custom',
] as const

export type Platform = typeof PLATFORM_OPTIONS[number]
