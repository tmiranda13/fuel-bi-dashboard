import { salesService, purchasesService, inventoryService, kpisService } from './dataService'

export const PRODUCT_ORDER = ['GC', 'GA', 'ET', 'DS10', 'DS500']

export const PRODUCT_NAMES = {
  GC: 'GASOLINA COMUM',
  GA: 'GASOLINA ADITIVADA',
  ET: 'ETANOL',
  DS10: 'DIESEL S10',
  DS500: 'DIESEL S500'
}

const NAME_TO_CODE = {
  'GASOLINA COMUM': 'GC',
  'GASOLINA ADITIVADA': 'GA',
  'ETANOL': 'ET',
  'DIESEL S10': 'DS10',
  'DIESEL S-10': 'DS10',
  'DIESEL S500': 'DS500',
  'DIESEL S-500': 'DS500',
  'DIESEL COMUM': 'DS500'
}

export function normalizeProductName(name) {
  if (!name) return name
  let normalized = name.replace(/[.\s]+$/, '').trim().toUpperCase()
  const fixes = {
    'DIESEL COMUM': 'DIESEL S500',
    'DIESEL S-500': 'DIESEL S500',
    'DIESEL S-10': 'DIESEL S10'
  }
  return fixes[normalized] || normalized
}

export function getProductCode(name) {
  if (!name) return null
  const normalized = normalizeProductName(name)
  return NAME_TO_CODE[normalized] || null
}

export function sortProductsByStandardOrder(products, codeField = 'product_code') {
  if (!products) return []
  return [...products].sort((a, b) => {
    const codeA = a[codeField] || getProductCode(a.product_name) || 'ZZZ'
    const codeB = b[codeField] || getProductCode(b.product_name) || 'ZZZ'
    const indexA = PRODUCT_ORDER.indexOf(codeA)
    const indexB = PRODUCT_ORDER.indexOf(codeB)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatVolume(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value) + ' L'
}

export function formatPercent(value, decimals = 1) {
  return value.toFixed(decimals) + '%'
}

async function getAverageCosts() {
  try {
    const purchases = await purchasesService.getPurchases(null, null)
    const costsByProduct = {}
    
    purchases.forEach(p => {
      const code = p.canonical_product_code || p.product_code
      if (!code) return
      if (!costsByProduct[code]) {
        costsByProduct[code] = { totalCost: 0, totalVolume: 0 }
      }
      const volume = parseFloat(p.quantity || 0)
      const cost = parseFloat(p.subtotal || 0)
      costsByProduct[code].totalCost += cost
      costsByProduct[code].totalVolume += volume
    })
    
    const avgCosts = {}
    Object.entries(costsByProduct).forEach(([code, data]) => {
      avgCosts[code] = data.totalVolume > 0 ? data.totalCost / data.totalVolume : 0
    })
    return avgCosts
  } catch (err) {
    console.error('Error getting average costs:', err)
    return {}
  }
}

export async function fetchVendasDashboard(startDate, endDate) {
  const [sales, kpis, avgCosts] = await Promise.all([
    salesService.getSales(startDate, endDate),
    kpisService.getKpis(),
    getAverageCosts()
  ])
  
  const salesByProduct = {}
  sales.forEach(sale => {
    const code = sale.product_code
    if (!code) return
    if (!salesByProduct[code]) {
      salesByProduct[code] = {
        product_code: code,
        product_name: sale.product_name || PRODUCT_NAMES[code],
        volume: 0,
        revenue: 0
      }
    }
    salesByProduct[code].volume += parseFloat(sale.volume_sold || 0)
    salesByProduct[code].revenue += parseFloat(sale.total_revenue || 0)
  })
  
  const products = Object.values(salesByProduct).map(p => {
    const volume = p.volume
    const revenue = p.revenue
    const avgPrice = volume > 0 ? revenue / volume : 0
    const avgCost = avgCosts[p.product_code] || 0
    const grossProfit = (avgPrice - avgCost) * volume
    const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const marginPerLiter = volume > 0 ? grossProfit / volume : 0
    
    return {
      product_code: p.product_code,
      product_name: normalizeProductName(p.product_name) || PRODUCT_NAMES[p.product_code],
      volume_sold: volume,
      revenue: revenue,
      cogs: avgCost * volume,
      gross_profit: grossProfit,
      margin_percent: marginPercent,
      margin_per_liter: marginPerLiter,
      avg_price: avgPrice,
      avg_cost: avgCost
    }
  })
  
  const totals = products.reduce((acc, p) => ({
    totalVolume: acc.totalVolume + p.volume_sold,
    totalRevenue: acc.totalRevenue + p.revenue,
    totalCogs: acc.totalCogs + p.cogs,
    totalProfit: acc.totalProfit + p.gross_profit
  }), { totalVolume: 0, totalRevenue: 0, totalCogs: 0, totalProfit: 0 })
  
  totals.marginPercent = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0
  totals.marginPerLiter = totals.totalVolume > 0 ? totals.totalProfit / totals.totalVolume : 0
  
  const volumeByProduct = {}
  products.forEach(p => { volumeByProduct[p.product_code] = p.volume_sold })
  
  const totalGasolina = (volumeByProduct.GC || 0) + (volumeByProduct.GA || 0)
  const gasolinaAditivadaMix = totalGasolina > 0 ? ((volumeByProduct.GA || 0) / totalGasolina) * 100 : 0
  
  const totalDiesel = (volumeByProduct.DS10 || 0) + (volumeByProduct.DS500 || 0)
  const dieselS10Mix = totalDiesel > 0 ? ((volumeByProduct.DS10 || 0) / totalDiesel) * 100 : 0
  
  const evolution = await salesService.getDailyEvolution(startDate, endDate)
  
  return {
    start_date: startDate,
    end_date: endDate,
    total_volume: totals.totalVolume,
    total_revenue: totals.totalRevenue,
    total_cogs: totals.totalCogs,
    total_profit: totals.totalProfit,
    margin_percent: totals.marginPercent,
    margin_per_liter: totals.marginPerLiter,
    avg_price: totals.totalVolume > 0 ? totals.totalRevenue / totals.totalVolume : 0,
    products: sortProductsByStandardOrder(products),
    evolution,
    mix: { gasolinaAditivadaMix, dieselS10Mix, byProduct: volumeByProduct, totalVolume: totals.totalVolume },
    kpis
  }
}

export async function fetchComprasDashboard(startDate, endDate) {
  const [productData, supplierData, evolution, kpis] = await Promise.all([
    purchasesService.getPurchasesByProduct(startDate, endDate),
    purchasesService.getPurchasesBySupplier(startDate, endDate),
    purchasesService.getPurchasesEvolution(startDate, endDate),
    kpisService.getKpis()
  ])
  
  const totals = productData.reduce((acc, p) => ({
    volume: acc.volume + p.volume,
    cost: acc.cost + p.total_cost
  }), { volume: 0, cost: 0 })
  
  const products = productData.map(p => ({
    ...p,
    product_code: p.product_code || getProductCode(p.product_name),
    product_name: normalizeProductName(p.product_name)
  }))
  
  return {
    start_date: startDate,
    end_date: endDate,
    total_volume: totals.volume,
    total_cost: totals.cost,
    avg_cost: totals.volume > 0 ? totals.cost / totals.volume : 0,
    products: sortProductsByStandardOrder(products),
    suppliers: supplierData,
    evolution,
    kpis
  }
}

export async function fetchEstoqueDashboard(startDate, endDate) {
  const [tankLevels, losses, kpis, sales, purchases, avgCosts] = await Promise.all([
    inventoryService.getTankLevels(),
    inventoryService.getLossesSummary(startDate, endDate),
    kpisService.getKpis(),
    salesService.getSales(startDate, endDate),
    purchasesService.getPurchases(startDate, endDate),
    getAverageCosts()
  ])
  
  const entriesByProduct = {}
  purchases.forEach(p => {
    const code = p.canonical_product_code || p.product_code
    if (!code) return
    if (!entriesByProduct[code]) entriesByProduct[code] = 0
    entriesByProduct[code] += parseFloat(p.quantity || 0)
  })
  
  const exitsByProduct = {}
  sales.forEach(s => {
    const code = s.product_code
    if (!code) return
    if (!exitsByProduct[code]) exitsByProduct[code] = 0
    exitsByProduct[code] += parseFloat(s.volume_sold || 0)
  })
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1)
  
  const inventory = tankLevels.map(tank => {
    const code = tank.product_code
    const currentStock = parseFloat(tank.current_stock || 0)
    const tankCapacity = parseFloat(tank.tank_capacity || 0)
    const entries = entriesByProduct[code] || 0
    const exits = exitsByProduct[code] || 0
    const avgCost = avgCosts[code] || 0
    const vmd = exits / daysDiff
    const daysAutonomy = vmd > 0 ? currentStock / vmd : 0
    const stockCost = currentStock * avgCost
    
    return {
      product_code: code,
      product_name: normalizeProductName(tank.product_name),
      current_stock: currentStock,
      tank_capacity: tankCapacity,
      occupancy_percent: tankCapacity > 0 ? (currentStock / tankCapacity) * 100 : 0,
      last_measurement: tank.last_measurement,
      period_entries: entries,
      period_exits: exits,
      vmd: vmd,
      days_autonomy: daysAutonomy,
      stock_cost: stockCost,
      avg_cost: avgCost
    }
  })
  
  const totalStockCost = inventory.reduce((sum, i) => sum + (i.stock_cost || 0), 0)
  
  return {
    start_date: startDate,
    end_date: endDate,
    inventory: sortProductsByStandardOrder(inventory),
    losses,
    kpis,
    total_stock_cost: totalStockCost
  }
}

export async function fetchEstoqueEvolution(startDate, endDate) {
  const evolution = await salesService.getDailyEvolution(startDate, endDate)
  return { evolution }
}

export async function fetchKpis(kpiType = null) {
  const kpis = await kpisService.getKpis()
  if (kpiType) return kpis.filter(k => k.kpi_type === kpiType)
  return kpis
}

export function getKpiTarget(kpis, kpiType, productCode = null) {
  return kpisService.getTarget(kpis, kpiType, productCode)
}

export async function createKpi(kpiData) {
  return kpisService.createKpi(kpiData)
}

export async function updateKpi(kpiId, updates) {
  return kpisService.updateKpi(kpiId, updates)
}

export async function deleteKpi(kpiId) {
  return kpisService.deleteKpi(kpiId)
}

export async function fetchSettings() {
  const { companyService } = await import('./dataService')
  return companyService.getSettings()
}

export default {
  fetchVendasDashboard,
  fetchComprasDashboard,
  fetchEstoqueDashboard,
  fetchEstoqueEvolution,
  fetchKpis,
  fetchSettings,
  createKpi,
  updateKpi,
  deleteKpi,
  getKpiTarget,
  sortProductsByStandardOrder,
  normalizeProductName,
  formatCurrency,
  formatVolume,
  formatPercent,
  PRODUCT_ORDER,
  PRODUCT_NAMES
}