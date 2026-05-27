/**
 * lib/calculations.ts — Refactored + Extended
 * Semua logika kalkulasi matematika terpusat di sini.
 * TIDAK ada React/komponen di file ini.
 */

// ============================================================
// TYPES
// ============================================================

export interface PnLRow {
  percent: number
  newCapital: number
  newWallet: number
  nominalChange: number
  walletGrowthPercent: number
}

export interface LeverageResult {
  positionSize: number
  marginUsed: number
  potentialProfit: number
  potentialLoss: number
  walletRiskPercent: number
  roi: number
  liquidationPrice: number
}

export interface RiskCalcResult {
  maxLossAmount: number
  recommendedPositionSize: number
  safeLeverage: number
  riskRewardRatio: number
  estimatedDrawdown: number
  stopLossPercent: number
}

export interface CompoundRow {
  day: number
  startBalance: number
  gainAmount: number
  endBalance: number
  totalGrowthPercent: number
}

export interface CompoundResult {
  rows: CompoundRow[]
  finalValue: number
  totalGrowthPercent: number
  totalGain: number
}

export interface BacktestResult {
  totalTrades: number
  wins: number
  losses: number
  expectedReturn: number
  expectedDrawdown: number
  finalCapital: number
  equityCurve: { trade: number; capital: number }[]
  peakCapital: number
  maxDrawdown: number
}

export interface TradeStats {
  totalTrades: number
  closedTrades: number
  winTrades: number
  lossTrades: number
  winRate: number
  totalPnl: number
  avgPnl: number
  bestTrade: number
  worstTrade: number
  avgWin: number
  avgLoss: number
  profitFactor: number
}

// Portfolio Simulator
export interface PortfolioAssetInput {
  id: string
  assetName: string
  capitalUsed: number
  pnlPercent: number  // user input %, can be negative
}

export interface PortfolioAssetResult {
  id: string
  assetName: string
  capitalUsed: number
  pnlPercent: number
  pnlNominal: number
  capitalAfter: number
  allocationPercent: number
}

export interface PortfolioSimResult {
  assets: PortfolioAssetResult[]
  totalCapitalUsed: number
  totalPnlNominal: number
  totalPnlPercent: number
  totalCapitalAfter: number
  walletAfter: number
  bestAsset: PortfolioAssetResult | null
  worstAsset: PortfolioAssetResult | null
  allocationData: { name: string; value: number; percent: number }[]
}

// ============================================================
// PORTFOLIO CALCULATIONS (NEW)
// ============================================================

/**
 * Hitung free capital dari modal trading dan used capital
 */
export function calculateFreeCapital(tradingBalance: number, usedCapital: number): number {
  return Math.max(0, tradingBalance - usedCapital)
}

/**
 * Hitung risk exposure percentage
 */
export function calculateRiskExposure(usedCapital: number, totalBalance: number): number {
  if (totalBalance <= 0) return 0
  return (usedCapital / totalBalance) * 100
}

/**
 * Hitung sisa capital setelah PnL
 */
export function calculateRemainingCapital(capitalUsed: number, pnl: number): number {
  return capitalUsed + pnl
}

/**
 * Hitung unrealized PnL (estimasi) dari harga masuk vs sekarang
 */
export function calculateUnrealizedPnL(
  capitalUsed: number,
  entryPrice: number,
  currentPrice: number,
  leverage: number = 1
): number {
  if (entryPrice <= 0 || capitalUsed <= 0) return 0
  const priceChangePct = (currentPrice - entryPrice) / entryPrice
  return capitalUsed * leverage * priceChangePct
}

/**
 * Hitung PnL dari % perubahan harga dengan leverage
 */
export function calculateLeveragePnL(
  capitalUsed: number,
  leverage: number,
  priceChangePercent: number
): number {
  const positionSize = capitalUsed * leverage
  return positionSize * (priceChangePercent / 100)
}

/**
 * Hitung liquidation risk distance (% dari entry ke harga likuidasi)
 */
export function calculateLiquidationRisk(
  entryPrice: number,
  leverage: number,
  isLong: boolean = true
): { liquidationPrice: number; distancePercent: number } {
  if (leverage <= 1) return { liquidationPrice: 0, distancePercent: 100 }
  const liqPrice = calculateLiquidationPrice(entryPrice, leverage, isLong)
  const distancePercent = Math.abs((entryPrice - liqPrice) / entryPrice) * 100
  return { liquidationPrice: liqPrice, distancePercent }
}

/**
 * Hitung alokasi aset sebagai persentase dari total portfolio
 */
export function calculateAssetAllocation(
  assets: { id: string | number; name: string; capitalUsed: number }[]
): { name: string; value: number; percent: number }[] {
  const total = assets.reduce((sum, a) => sum + a.capitalUsed, 0)
  if (total === 0) return []
  return assets.map(a => ({
    name: a.name,
    value: a.capitalUsed,
    percent: (a.capitalUsed / total) * 100,
  }))
}

/**
 * Hitung total realized PnL dari array event
 */
export function calculateRealizedPnL(
  events: { pnlRealized: number }[]
): number {
  return events.reduce((sum, e) => sum + e.pnlRealized, 0)
}

/**
 * Portfolio Simulator — hitung semua output sekaligus
 */
export function calculatePortfolioSimulation(
  assets: PortfolioAssetInput[],
  walletTotal: number
): PortfolioSimResult {
  const totalCapitalUsed = assets.reduce((sum, a) => sum + a.capitalUsed, 0)

  const assetResults: PortfolioAssetResult[] = assets.map(a => {
    const pnlNominal = a.capitalUsed * (a.pnlPercent / 100)
    const capitalAfter = a.capitalUsed + pnlNominal
    const allocationPercent = totalCapitalUsed > 0 ? (a.capitalUsed / totalCapitalUsed) * 100 : 0
    return {
      id: a.id,
      assetName: a.assetName,
      capitalUsed: a.capitalUsed,
      pnlPercent: a.pnlPercent,
      pnlNominal,
      capitalAfter,
      allocationPercent,
    }
  })

  const totalPnlNominal = assetResults.reduce((sum, r) => sum + r.pnlNominal, 0)
  const totalCapitalAfter = assetResults.reduce((sum, r) => sum + r.capitalAfter, 0)
  const totalPnlPercent = totalCapitalUsed > 0 ? (totalPnlNominal / totalCapitalUsed) * 100 : 0
  const walletAfter = walletTotal + totalPnlNominal

  const sorted = [...assetResults].sort((a, b) => b.pnlPercent - a.pnlPercent)
  const bestAsset = sorted[0] ?? null
  const worstAsset = sorted[sorted.length - 1] ?? null

  const allocationData = assets.map(a => ({
    name: a.assetName,
    value: a.capitalUsed,
    percent: totalCapitalUsed > 0 ? (a.capitalUsed / totalCapitalUsed) * 100 : 0,
  }))

  return {
    assets: assetResults,
    totalCapitalUsed,
    totalPnlNominal,
    totalPnlPercent,
    totalCapitalAfter,
    walletAfter,
    bestAsset,
    worstAsset,
    allocationData,
  }
}

/**
 * Hitung total portfolio PnL dari daftar aset
 */
export function calculatePortfolioPnL(
  assets: { realizedPnl: number; unrealizedPnl: number }[]
): { realized: number; unrealized: number; total: number } {
  const realized = assets.reduce((sum, a) => sum + a.realizedPnl, 0)
  const unrealized = assets.reduce((sum, a) => sum + a.unrealizedPnl, 0)
  return { realized, unrealized, total: realized + unrealized }
}

// ============================================================
// PnL SIMULATOR TABLE (utility — moved to Calculator tab)
// ============================================================

export function simulatePnL(
  capital: number,
  walletTotal: number,
  percent: number
): PnLRow {
  const change = capital * (percent / 100)
  const newCapital = capital + change
  const newWallet = walletTotal + change
  const walletGrowthPercent = walletTotal > 0 ? (change / walletTotal) * 100 : 0
  return { percent, newCapital, newWallet, nominalChange: change, walletGrowthPercent }
}

export function generateProfitTable(capital: number, walletTotal: number, maxPercent: number = 1000): PnLRow[] {
  const rows: PnLRow[] = []
  for (let p = 1; p <= maxPercent; p++) rows.push(simulatePnL(capital, walletTotal, p))
  return rows
}

export function generateLossTable(capital: number, walletTotal: number): PnLRow[] {
  const rows: PnLRow[] = []
  for (let p = 1; p <= 100; p++) rows.push(simulatePnL(capital, walletTotal, -p))
  return rows
}

export function calculateProfit(capital: number, percent: number): number {
  return capital * (percent / 100)
}

export function calculateLoss(capital: number, percent: number): number {
  return capital * (percent / 100) * -1
}

// ============================================================
// LEVERAGE SIMULATOR
// ============================================================

export function calculateLeverage(
  capital: number,
  leverage: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  isLong: boolean = true,
  walletTotal: number = 0
): LeverageResult {
  const positionSize = capital * leverage
  const marginUsed = capital

  const tpPercent = isLong
    ? ((takeProfit - entryPrice) / entryPrice) * 100
    : ((entryPrice - takeProfit) / entryPrice) * 100

  const slPercent = isLong
    ? ((entryPrice - stopLoss) / entryPrice) * 100
    : ((stopLoss - entryPrice) / entryPrice) * 100

  const potentialProfit = positionSize * (tpPercent / 100)
  const potentialLoss = positionSize * (slPercent / 100)
  const walletRiskPercent = walletTotal > 0 ? (potentialLoss / walletTotal) * 100 : 0
  const roi = (potentialProfit / marginUsed) * 100
  const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, isLong)

  return { positionSize, marginUsed, potentialProfit, potentialLoss, walletRiskPercent, roi, liquidationPrice }
}

export function calculateLiquidationPrice(entryPrice: number, leverage: number, isLong: boolean = true): number {
  if (leverage <= 0) return 0
  if (leverage < 1) return 0  // sub-1x leverage: no liquidation risk
  return isLong
    ? entryPrice * (1 - 1 / leverage)
    : entryPrice * (1 + 1 / leverage)
}

export function generateLeverageScenarios(
  capital: number,
  leverage: number,
  maxPercent: number = 50
): { percent: number; pnl: number; pnlPercent: number; newCapital: number }[] {
  const positionSize = capital * leverage
  const rows = []
  for (let p = -maxPercent; p <= maxPercent; p++) {
    if (p === 0) continue
    const pnl = positionSize * (p / 100)
    const pnlPercent = (pnl / capital) * 100
    rows.push({ percent: p, pnl, pnlPercent, newCapital: capital + pnl })
  }
  return rows
}

// ============================================================
// RISK MANAGEMENT
// ============================================================

export function calculateRiskManagement(
  walletSize: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number = 0,
  leverage: number = 1
): RiskCalcResult {
  const maxLossAmount = walletSize * (riskPercent / 100)
  const stopLossPercent = Math.abs((entryPrice - stopLoss) / entryPrice) * 100
  const stopLossDecimal = stopLossPercent / 100
  const recommendedPositionSize = stopLossDecimal > 0 ? maxLossAmount / stopLossDecimal : 0
  const safeLeverage = walletSize > 0 ? recommendedPositionSize / walletSize : 0
  const tpDistance = takeProfit > 0 ? Math.abs(takeProfit - entryPrice) : 0
  const slDistance = Math.abs(entryPrice - stopLoss)
  const riskRewardRatio = slDistance > 0 && tpDistance > 0 ? tpDistance / slDistance : 0
  const estimatedDrawdown = maxLossAmount > 0 ? (walletSize * 0.2) / maxLossAmount : 0

  return {
    maxLossAmount,
    recommendedPositionSize,
    safeLeverage: Math.min(safeLeverage, 100),
    riskRewardRatio,
    estimatedDrawdown,
    stopLossPercent,
  }
}

export function calculatePositionSize(walletSize: number, riskPercent: number, entryPrice: number, stopLoss: number): number {
  const maxLoss = walletSize * (riskPercent / 100)
  const slPercent = Math.abs((entryPrice - stopLoss) / entryPrice)
  return slPercent > 0 ? maxLoss / slPercent : 0
}

export function calculateRiskReward(entryPrice: number, takeProfit: number, stopLoss: number): number {
  const reward = Math.abs(takeProfit - entryPrice)
  const risk = Math.abs(entryPrice - stopLoss)
  return risk > 0 ? reward / risk : 0
}

// ============================================================
// COMPOUND GROWTH
// ============================================================

export function calculateCompoundGrowth(initialCapital: number, dailyPercent: number, days: number): CompoundResult {
  const rows: CompoundRow[] = []
  let balance = initialCapital

  for (let day = 1; day <= days; day++) {
    const startBalance = balance
    const gainAmount = startBalance * (dailyPercent / 100)
    balance = startBalance + gainAmount
    const totalGrowthPercent = ((balance - initialCapital) / initialCapital) * 100
    rows.push({ day, startBalance, gainAmount, endBalance: balance, totalGrowthPercent })
  }

  return {
    rows,
    finalValue: balance,
    totalGrowthPercent: ((balance - initialCapital) / initialCapital) * 100,
    totalGain: balance - initialCapital,
  }
}

// ============================================================
// DRAWDOWN
// ============================================================

export function calculateDrawdown(equityValues: number[]): number {
  if (equityValues.length === 0) return 0
  let maxDrawdown = 0
  let peak = equityValues[0]
  for (const value of equityValues) {
    if (value > peak) peak = value
    const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  return maxDrawdown
}

// ============================================================
// FEE CALCULATOR
// ============================================================

export function calculateFee(
  positionSize: number,
  makerFee: number,
  takerFee: number,
  isMarket: boolean = true
): { fee: number; feePercent: number; netPosition: number } {
  const feeRate = isMarket ? takerFee : makerFee
  const fee = positionSize * (feeRate / 100)
  return { fee, feePercent: feeRate, netPosition: positionSize - fee }
}

// ============================================================
// BACKTEST SIMULATOR
// ============================================================

export function simulateBacktest(
  winrate: number,
  riskReward: number,
  numberOfTrades: number,
  initialCapital: number,
  riskPerTradePercent: number = 2
): BacktestResult {
  const equityCurve: { trade: number; capital: number }[] = [{ trade: 0, capital: initialCapital }]
  let capital = initialCapital
  let wins = 0
  let losses = 0
  let peakCapital = initialCapital
  let maxDrawdown = 0

  for (let i = 1; i <= numberOfTrades; i++) {
    const riskAmount = capital * (riskPerTradePercent / 100)
    const isWin = (i * 7 + Math.floor(winrate)) % 100 < winrate
    if (isWin) { capital += riskAmount * riskReward; wins++ }
    else { capital -= riskAmount; losses++ }
    if (capital > peakCapital) peakCapital = capital
    const dd = peakCapital > 0 ? ((peakCapital - capital) / peakCapital) * 100 : 0
    if (dd > maxDrawdown) maxDrawdown = dd
    equityCurve.push({ trade: i, capital })
  }

  return {
    totalTrades: numberOfTrades,
    wins,
    losses,
    expectedReturn: ((capital - initialCapital) / initialCapital) * 100,
    expectedDrawdown: maxDrawdown,
    finalCapital: capital,
    equityCurve,
    peakCapital,
    maxDrawdown,
  }
}

// ============================================================
// STATISTICS
// ============================================================

export function calculateTradeStats(
  trades: { pnl: number | null; status: string }[]
): TradeStats {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null)
  const pnls = closed.map(t => t.pnl as number)
  const wins = pnls.filter(p => p > 0)
  const losses = pnls.filter(p => p < 0)
  const totalPnl = pnls.reduce((a, b) => a + b, 0)
  const totalWin = wins.reduce((a, b) => a + b, 0)
  const totalLoss = Math.abs(losses.reduce((a, b) => a + b, 0))

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    winTrades: wins.length,
    lossTrades: losses.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    totalPnl,
    avgPnl: closed.length > 0 ? totalPnl / closed.length : 0,
    bestTrade: wins.length > 0 ? Math.max(...wins) : 0,
    worstTrade: losses.length > 0 ? Math.min(...losses) : 0,
    avgWin: wins.length > 0 ? totalWin / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
    profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
  }
}
