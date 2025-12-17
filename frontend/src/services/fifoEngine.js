/**
 * FIFO Engine - Frontend Implementation
 * 
 * Calculates Cost of Goods Sold (COGS) using First-In-First-Out method.
 * Easy to modify formulas - just refresh browser, no deployment needed.
 */

export class FIFOEngine {
  constructor(batches = [], fifoStartDate = null) {
    this.originalBatches = batches
    this.fifoStartDate = fifoStartDate
    this.reset()
  }
  
  reset() {
    this.batches = this.originalBatches
      .filter(b => {
        if (this.fifoStartDate) {
          return b.purchase_date >= this.fifoStartDate
        }
        return true
      })
      .map(b => ({
        ...b,
        remaining: parseFloat(b.remaining_volume || 0)
      }))
      .sort((a, b) => {
        const dateCompare = new Date(a.purchase_date) - new Date(b.purchase_date)
        if (dateCompare !== 0) return dateCompare
        return (a.id || 0) - (b.id || 0)
      })
  }
  
  getAvailableBatches(productCode, saleDate) {
    return this.batches.filter(b => 
      b.product_code === productCode &&
      b.remaining > 0 &&
      new Date(b.purchase_date) <= new Date(saleDate)
    )
  }
  
  calculateSaleCOGS(productCode, saleDate, volumeSold, updateBatches = true) {
    const available = this.getAvailableBatches(productCode, saleDate)
    
    if (available.length === 0) {
      return {
        totalCogs: 0,
        avgCostPerLiter: 0,
        allocations: [],
        volumeAllocated: 0,
        volumeShortage: volumeSold,
        error: `No batches available for ${productCode} on ${saleDate}`
      }
    }
    
    const allocations = []
    let remainingToAllocate = volumeSold
    let totalCogs = 0
    
    for (const batch of available) {
      if (remainingToAllocate <= 0) break
      
      const costPerLiter = parseFloat(batch.cost_per_liter || 0)
      const volumeFromBatch = Math.min(remainingToAllocate, batch.remaining)
      const batchCost = volumeFromBatch * costPerLiter
      
      allocations.push({
        batchId: batch.id,
        batchDate: batch.purchase_date,
        invoiceNumber: batch.invoice_number,
        volumeUsed: volumeFromBatch,
        costPerLiter: costPerLiter,
        totalCost: batchCost
      })
      
      totalCogs += batchCost
      remainingToAllocate -= volumeFromBatch
      
      if (updateBatches) {
        batch.remaining -= volumeFromBatch
      }
    }
    
    return {
      totalCogs,
      avgCostPerLiter: volumeSold > 0 ? totalCogs / (volumeSold - remainingToAllocate) : 0,
      volumeAllocated: volumeSold - remainingToAllocate,
      volumeShortage: remainingToAllocate > 0 ? remainingToAllocate : 0,
      allocations
    }
  }
  
  calculateProductCOGS(sales, productCode) {
    this.reset()
    
    const productSales = sales
      .filter(s => s.product_code === productCode)
      .sort((a, b) => {
        const dateCompare = new Date(a.sale_date) - new Date(b.sale_date)
        if (dateCompare !== 0) return dateCompare
        return (a.id || 0) - (b.id || 0)
      })
    
    let totalCogs = 0
    let totalVolume = 0
    let totalRevenue = 0
    let totalShortage = 0
    
    for (const sale of productSales) {
      const volume = parseFloat(sale.volume_sold || 0)
      const revenue = parseFloat(sale.total_revenue || 0)
      
      if (volume <= 0) continue
      
      const result = this.calculateSaleCOGS(productCode, sale.sale_date, volume, true)
      
      totalCogs += result.totalCogs
      totalVolume += result.volumeAllocated
      totalRevenue += revenue
      totalShortage += result.volumeShortage
    }
    
    const grossProfit = totalRevenue - totalCogs
    
    return {
      productCode,
      salesCount: productSales.length,
      totalVolume,
      totalRevenue,
      totalCogs,
      grossProfit,
      marginPercent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      marginPerLiter: totalVolume > 0 ? grossProfit / totalVolume : 0,
      avgCostPerLiter: totalVolume > 0 ? totalCogs / totalVolume : 0,
      avgPricePerLiter: totalVolume > 0 ? totalRevenue / totalVolume : 0,
      volumeShortage: totalShortage
    }
  }
  
  calculateAllProductsCOGS(sales) {
    const productCodes = [...new Set(sales.map(s => s.product_code).filter(Boolean))]
    
    const results = {}
    const totals = {
      totalVolume: 0,
      totalRevenue: 0,
      totalCogs: 0,
      grossProfit: 0
    }
    
    for (const code of productCodes) {
      this.reset()
      results[code] = this.calculateProductCOGS(sales, code)
      
      totals.totalVolume += results[code].totalVolume
      totals.totalRevenue += results[code].totalRevenue
      totals.totalCogs += results[code].totalCogs
      totals.grossProfit += results[code].grossProfit
    }
    
    totals.marginPercent = totals.totalRevenue > 0
      ? (totals.grossProfit / totals.totalRevenue) * 100
      : 0
    
    totals.marginPerLiter = totals.totalVolume > 0
      ? totals.grossProfit / totals.totalVolume
      : 0
    
    return { byProduct: results, totals }
  }
  
  getInventoryStatus() {
    this.reset()
    
    const inventory = {}
    
    for (const batch of this.batches) {
      const code = batch.product_code
      if (!inventory[code]) {
        inventory[code] = {
          productCode: code,
          productName: batch.product_name,
          totalVolume: 0,
          totalValue: 0,
          batchCount: 0,
          oldestBatchDate: null
        }
      }
      
      if (batch.remaining > 0) {
        inventory[code].totalVolume += batch.remaining
        inventory[code].totalValue += batch.remaining * parseFloat(batch.cost_per_liter || 0)
        inventory[code].batchCount++
        
        if (!inventory[code].oldestBatchDate || 
            batch.purchase_date < inventory[code].oldestBatchDate) {
          inventory[code].oldestBatchDate = batch.purchase_date
        }
      }
    }
    
    Object.values(inventory).forEach(inv => {
      inv.avgCostPerLiter = inv.totalVolume > 0 
        ? inv.totalValue / inv.totalVolume 
        : 0
    })
    
    return inventory
  }
}

export function calculateMixPercentages(volumeByProduct) {
  const totalVolume = Object.values(volumeByProduct).reduce((a, b) => a + b, 0)
  
  if (totalVolume === 0) {
    return { byProduct: {}, gasolinaAditivadaMix: 0, dieselS10Mix: 0 }
  }
  
  const byProduct = {}
  Object.entries(volumeByProduct).forEach(([code, volume]) => {
    byProduct[code] = (volume / totalVolume) * 100
  })
  
  const totalGasolina = (volumeByProduct.GC || 0) + (volumeByProduct.GA || 0)
  const gasolinaAditivadaMix = totalGasolina > 0 
    ? ((volumeByProduct.GA || 0) / totalGasolina) * 100 
    : 0
  
  const totalDiesel = (volumeByProduct.DS10 || 0) + (volumeByProduct.DS500 || 0)
  const dieselS10Mix = totalDiesel > 0 
    ? ((volumeByProduct.DS10 || 0) / totalDiesel) * 100 
    : 0
  
  return { byProduct, gasolinaAditivadaMix, dieselS10Mix, totalVolume }
}

export default FIFOEngine