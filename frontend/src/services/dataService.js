/**
 * Data Service
 *
 * Direct Supabase queries for all data operations.
 * Replaces Flask API endpoints.
 */

import { supabase } from './supabase'

// Company ID for Posto PCL
const COMPANY_ID = 2

// ============================================================
// SALES SERVICE
// ============================================================

export const salesService = {
  async getSales(startDate, endDate) {
    // Fetch all records with pagination (Supabase defaults to 1000 rows)
    const allData = []
    let from = 0
    const pageSize = 1000

    while (true) {
      // Build query with filters BEFORE range
      let query = supabase
        .from('pump_sales_intraday')
        .select('*')
        .eq('company_id', COMPANY_ID)

      if (startDate) query = query.gte('sale_date', startDate)
      if (endDate) query = query.lte('sale_date', endDate)

      // Apply order and range AFTER filters
      query = query.order('sale_date', { ascending: true }).range(from, from + pageSize - 1)

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) break

      allData.push(...data)

      // If we got less than pageSize, we've reached the end
      if (data.length < pageSize) break

      from += pageSize
    }

    return allData
  },
  
  async getSalesByProduct(startDate, endDate) {
    const sales = await this.getSales(startDate, endDate)
    
    const byProduct = sales.reduce((acc, sale) => {
      const code = sale.product_code
      if (!acc[code]) {
        acc[code] = {
          product_code: code,
          product_name: sale.product_name,
          volume: 0,
          revenue: 0,
          count: 0
        }
      }
      acc[code].volume += parseFloat(sale.volume_sold || 0)
      acc[code].revenue += parseFloat(sale.total_revenue || 0)
      acc[code].count++
      return acc
    }, {})
    
    return Object.values(byProduct).map(p => ({
      ...p,
      avg_price: p.volume > 0 ? p.revenue / p.volume : 0
    }))
  },
  
  async getDailyEvolution(startDate, endDate) {
    const sales = await this.getSales(startDate, endDate)

    // Map product names to canonical codes
    const nameToCode = {
      'GASOLINA COMUM': 'GC',
      'GASOLINA COMUM.': 'GC',
      'GASOLINA ADITIVADA': 'GA',
      'GASOLINA ADITIVADA.': 'GA',
      'ETANOL': 'ET',
      'ETANOL.': 'ET',
      'DIESEL S10': 'DS10',
      'DIESEL S10.': 'DS10',
      'DIESEL S-10': 'DS10',
      'DIESEL S500': 'DS500',
      'DIESEL S500.': 'DS500',
      'DIESEL S-500': 'DS500',
      'DIESEL COMUM': 'DS500'
    }

    const byDate = sales.reduce((acc, sale) => {
      const date = sale.sale_date
      if (!date) return acc

      if (!acc[date]) {
        acc[date] = {
          date,
          volume: 0,
          revenue: 0,
          total: 0,
          GC: 0, GA: 0, ET: 0, DS10: 0, DS500: 0
        }
      }

      const volume = parseFloat(sale.volume_sold || 0)
      acc[date].volume += volume
      acc[date].total += volume
      acc[date].revenue += parseFloat(sale.total_revenue || 0)

      // Map product name to canonical code
      const productName = (sale.product_name || '').toUpperCase().trim()
      const canonicalCode = nameToCode[productName]
      if (canonicalCode && acc[date][canonicalCode] !== undefined) {
        acc[date][canonicalCode] += volume
      }

      return acc
    }, {})

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }
}

// ============================================================
// PURCHASES SERVICE
// ============================================================

export const purchasesService = {
  async getPurchases(startDate, endDate) {
    // Fetch all records with pagination (Supabase defaults to 1000 rows)
    const allData = []
    let from = 0
    const pageSize = 1000

    while (true) {
      // Build query with filters BEFORE range
      let query = supabase
        .from('purchases')
        .select('*')
        .eq('company_id', COMPANY_ID)

      if (startDate) query = query.gte('receipt_date', startDate)
      if (endDate) query = query.lte('receipt_date', endDate)

      // Apply order and range AFTER filters
      query = query.order('receipt_date', { ascending: true }).range(from, from + pageSize - 1)

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) break

      allData.push(...data)

      if (data.length < pageSize) break

      from += pageSize
    }

    return allData
  },
  
  async getFIFOBatches() {
    const { data, error } = await supabase
      .from('fuel_purchases')
      .select('*')
      .eq('batch_status', 'active')
      .gt('remaining_volume', 0)
      .order('purchase_date', { ascending: true })
    
    if (error) throw error
    return data || []
  },
  
  async getAllFuelPurchases() {
    const { data, error } = await supabase
      .from('fuel_purchases')
      .select('*')
      .order('purchase_date', { ascending: true })
    
    if (error) throw error
    return data || []
  },
  
  async getPurchasesByProduct(startDate, endDate) {
    const purchases = await this.getPurchases(startDate, endDate)

    // Map product names to canonical codes for proper grouping
    const nameToCode = {
      'GASOLINA COMUM': 'GC',
      'GASOLINA COMUM.': 'GC',
      'GASOLINA ADITIVADA': 'GA',
      'GASOLINA ADITIVADA.': 'GA',
      'ETANOL': 'ET',
      'ETANOL.': 'ET',
      'DIESEL S10': 'DS10',
      'DIESEL S10.': 'DS10',
      'DIESEL S-10': 'DS10',
      'DIESEL S500': 'DS500',
      'DIESEL S500.': 'DS500',
      'DIESEL S-500': 'DS500',
      'DIESEL COMUM': 'DS500'
    }

    const codeToName = {
      'GC': 'GASOLINA COMUM',
      'GA': 'GASOLINA ADITIVADA',
      'ET': 'ETANOL',
      'DS10': 'DIESEL S10',
      'DS500': 'DIESEL S500'
    }

    // Track suppliers per product for main supplier calculation
    const productSuppliers = {}

    const byProduct = purchases.reduce((acc, p) => {
      // Normalize product name to canonical code
      const productName = (p.product_name || p.source_product_name || '').toUpperCase().trim()
      const code = nameToCode[productName] || p.canonical_product_code || p.product_code

      if (!acc[code]) {
        acc[code] = {
          product_code: code,
          product_name: codeToName[code] || productName,
          volume: 0,
          total_cost: 0,
          count: 0,
          cost_prices: [] // Track individual prices for std dev calculation
        }
      }
      const quantity = parseFloat(p.quantity || 0)
      const costPrice = parseFloat(p.cost_price || 0)

      acc[code].volume += quantity
      acc[code].total_cost += parseFloat(p.subtotal || 0)
      acc[code].count++
      if (costPrice > 0) {
        acc[code].cost_prices.push(costPrice)
      }

      // Track suppliers per product
      const supplier = p.supplier_name || 'Unknown'
      if (!productSuppliers[code]) productSuppliers[code] = {}
      if (!productSuppliers[code][supplier]) productSuppliers[code][supplier] = 0
      productSuppliers[code][supplier] += quantity

      return acc
    }, {})

    // Helper function to calculate standard deviation
    const calcStdDev = (values) => {
      if (values.length < 2) return 0
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1)
      return Math.sqrt(avgSquaredDiff)
    }

    return Object.values(byProduct).map(p => {
      // Find main supplier for this product (highest volume)
      let mainSupplier = 'N/A'
      if (productSuppliers[p.product_code]) {
        const suppliers = Object.entries(productSuppliers[p.product_code])
        if (suppliers.length > 0) {
          mainSupplier = suppliers.reduce((a, b) => a[1] > b[1] ? a : b)[0]
        }
      }

      return {
        product_code: p.product_code,
        product_name: p.product_name,
        volume: p.volume,
        total_cost: p.total_cost,
        avg_cost: p.volume > 0 ? p.total_cost / p.volume : 0,
        cost_std_dev: calcStdDev(p.cost_prices),
        main_supplier: mainSupplier
      }
    })
  },
  
  async getPurchasesBySupplier(startDate, endDate) {
    const purchases = await this.getPurchases(startDate, endDate)
    
    const bySupplier = purchases.reduce((acc, p) => {
      const supplier = p.supplier_name || 'Unknown'
      if (!acc[supplier]) {
        acc[supplier] = {
          supplier_name: supplier,
          supplier_cnpj: p.supplier_cnpj,
          volume: 0,
          total_cost: 0,
          count: 0
        }
      }
      acc[supplier].volume += parseFloat(p.quantity || 0)
      acc[supplier].total_cost += parseFloat(p.subtotal || 0)
      acc[supplier].count++
      return acc
    }, {})
    
    return Object.values(bySupplier).map(s => ({
      ...s,
      avg_cost: s.volume > 0 ? s.total_cost / s.volume : 0
    }))
  },
  
  async getPurchasesEvolution(startDate, endDate) {
    const purchases = await this.getPurchases(startDate, endDate)

    // Map product names to canonical codes
    const nameToCode = {
      'GASOLINA COMUM': 'GC',
      'GASOLINA COMUM.': 'GC',
      'GASOLINA ADITIVADA': 'GA',
      'GASOLINA ADITIVADA.': 'GA',
      'ETANOL': 'ET',
      'ETANOL.': 'ET',
      'DIESEL S10': 'DS10',
      'DIESEL S10.': 'DS10',
      'DIESEL S-10': 'DS10',
      'DIESEL S500': 'DS500',
      'DIESEL S500.': 'DS500',
      'DIESEL S-500': 'DS500',
      'DIESEL COMUM': 'DS500'
    }

    const byDate = {}

    purchases.forEach(p => {
      const date = p.receipt_date
      if (!date) return

      if (!byDate[date]) {
        byDate[date] = {
          date,
          GC: null, GA: null, ET: null, DS10: null, DS500: null,
          totalCost: 0,
          totalVolume: 0
        }
      }

      // Normalize product name to canonical code
      const productName = (p.product_name || p.source_product_name || '').toUpperCase().trim()
      const code = nameToCode[productName]
      const cost = parseFloat(p.cost_price || 0)
      const volume = parseFloat(p.quantity || 0)

      if (code && cost > 0 && byDate[date][code] !== undefined) {
        byDate[date][code] = cost
      }

      byDate[date].totalCost += parseFloat(p.subtotal || 0)
      byDate[date].totalVolume += volume
    })

    Object.values(byDate).forEach(day => {
      day.avg_cost = day.totalVolume > 0 ? day.totalCost / day.totalVolume : 0
    })

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }
}

// ============================================================
// INVENTORY SERVICE
// ============================================================

export const inventoryService = {
  async getTankLevels() {
    const { data, error } = await supabase
      .from('current_tank_levels')
      .select('*')
      .order('product_code')
    
    if (error) throw error
    return data || []
  },
  
  async getAdjustments(startDate, endDate) {
    let query = supabase
      .from('inventory_adjustments')
      .select('*')
      .order('adjustment_date', { ascending: false })
    
    if (startDate) query = query.gte('adjustment_date', startDate)
    if (endDate) query = query.lte('adjustment_date', endDate)
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  },
  
  async getLossesSummary(startDate, endDate) {
    const adjustments = await this.getAdjustments(startDate, endDate)
    
    const losses = adjustments.filter(a => a.adjustment_type === 'loss')
    const gains = adjustments.filter(a => a.adjustment_type === 'gain')
    
    const groupByProduct = (items) => {
      return items.reduce((acc, item) => {
        const code = item.product_code
        if (!acc[code]) acc[code] = { volume: 0, cost: 0 }
        acc[code].volume += parseFloat(item.volume || 0)
        acc[code].cost += parseFloat(item.total_cost || 0)
        return acc
      }, {})
    }
    
    return {
      totalLossVolume: losses.reduce((sum, l) => sum + parseFloat(l.volume || 0), 0),
      totalLossCost: losses.reduce((sum, l) => sum + parseFloat(l.total_cost || 0), 0),
      totalGainVolume: gains.reduce((sum, g) => sum + parseFloat(g.volume || 0), 0),
      lossesByProduct: groupByProduct(losses),
      gainsByProduct: groupByProduct(gains)
    }
  }
}

// ============================================================
// KPIS SERVICE
// ============================================================

export const kpisService = {
  async getKpis(status = 'active') {
    let query = supabase
      .from('kpis')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (status) query = query.eq('status', status)
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  },
  
  getTarget(kpis, kpiType, productCode = null) {
    const kpi = kpis.find(k => 
      k.kpi_type === kpiType && 
      (productCode ? k.product_code === productCode : !k.product_code)
    )
    return kpi ? parseFloat(kpi.target_value) : null
  },
  
async createKpi(kpiData, companyId) {
    // companyId is required - must be passed from auth context
    if (!companyId) {
      throw new Error('Company ID is required. Please login again.')
    }

    const { data, error } = await supabase
      .from('kpis')
      .insert({ ...kpiData, company_id: companyId })
      .select()
      .single()

    if (error) throw error
    return data
  },
  
  async updateKpi(kpiId, updates) {
    const { data, error } = await supabase
      .from('kpis')
      .update(updates)
      .eq('id', kpiId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },
  
  async deleteKpi(kpiId) {
    const { error } = await supabase
      .from('kpis')
      .delete()
      .eq('id', kpiId)
    
    if (error) throw error
  }
}

// ============================================================
// COMPANY SERVICE
// ============================================================

export const companyService = {
  async getCompany() {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .single()
    
    if (error) return null
    return data
  },
  
  async getSettings() {
    const { data, error } = await supabase
      .from('company_settings')
      .select('settings_data')
      .single()
    
    if (error) {
      return {
        monthly_sales_targets: {
          GC: 200000, GA: 150000, ET: 100000, DS10: 180000, DS500: 80000
        },
        minimum_margin_percent: 10,
        critical_stock_days: 3,
        low_stock_days: 7
      }
    }
    
    return data?.settings_data || {}
  }
}

// ============================================================
// VARIANCE SERVICE (Inventory Variance / Sobra-Falta)
// ============================================================

export const varianceService = {
  async getVarianceData(startDate, endDate) {
    let query = supabase
      .from('daily_inventory_variance')
      .select('*')
      .order('variance_date', { ascending: true })
    
    if (startDate) query = query.gte('variance_date', startDate)
    if (endDate) query = query.lte('variance_date', endDate)
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  },
  
  async getVarianceEvolution(startDate, endDate) {
    const variance = await this.getVarianceData(startDate, endDate)
    
    // Group by date, showing variance per product
    const byDate = variance.reduce((acc, v) => {
      const date = v.variance_date
      if (!date) return acc
      
      if (!acc[date]) {
        acc[date] = {
          date,
          GC: null, GA: null, ET: null, DS10: null, DS500: null,
          total: 0
        }
      }
      
      const code = v.product_code
      const varianceValue = parseFloat(v.variance || 0)
      
      if (code && acc[date][code] !== undefined) {
        acc[date][code] = varianceValue
      }
      acc[date].total += varianceValue
      
      return acc
    }, {})
    
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  },
  
  async getVarianceSummary(startDate, endDate) {
    const variance = await this.getVarianceData(startDate, endDate)
    
    // Group by product, calculating totals
    const byProduct = variance.reduce((acc, v) => {
      const code = v.product_code
      if (!code) return acc
      
      if (!acc[code]) {
        acc[code] = {
          product_code: code,
          product_name: v.product_name,
          total_gain: 0,
          total_loss: 0,
          net: 0,
          count: 0
        }
      }
      
      const varianceValue = parseFloat(v.variance || 0)
      
      if (varianceValue > 0) {
        acc[code].total_gain += varianceValue
      } else {
        acc[code].total_loss += Math.abs(varianceValue)
      }
      acc[code].net += varianceValue
      acc[code].count++
      
      return acc
    }, {})
    
    return Object.values(byProduct)
  }
}