/**
 * Data Service
 * 
 * Direct Supabase queries for all data operations.
 * Replaces Flask API endpoints.
 */

import { supabase } from './supabase'

// ============================================================
// SALES SERVICE
// ============================================================

export const salesService = {
  async getSales(startDate, endDate) {
    let query = supabase
      .from('pump_sales_intraday')
      .select('*')
      .order('sale_date', { ascending: true })
    
    if (startDate) query = query.gte('sale_date', startDate)
    if (endDate) query = query.lte('sale_date', endDate)
    
    const { data, error } = await query
    if (error) throw error
    return data || []
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
      
      const code = sale.product_code
      if (acc[date][code] !== undefined) {
        acc[date][code] += volume
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
    let query = supabase
      .from('purchases')
      .select('*')
      .order('receipt_date', { ascending: true })
    
    if (startDate) query = query.gte('receipt_date', startDate)
    if (endDate) query = query.lte('receipt_date', endDate)
    
    const { data, error } = await query
    if (error) throw error
    return data || []
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
    
    const byProduct = purchases.reduce((acc, p) => {
      const code = p.canonical_product_code || p.product_code
      if (!acc[code]) {
        acc[code] = {
          product_code: code,
          product_name: p.product_name,
          volume: 0,
          total_cost: 0,
          count: 0
        }
      }
      acc[code].volume += parseFloat(p.quantity || 0)
      acc[code].total_cost += parseFloat(p.subtotal || 0)
      acc[code].count++
      return acc
    }, {})
    
    return Object.values(byProduct).map(p => ({
      ...p,
      avg_cost: p.volume > 0 ? p.total_cost / p.volume : 0
    }))
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
      
      const code = p.canonical_product_code || p.product_code
      const cost = parseFloat(p.cost_price || 0)
      const volume = parseFloat(p.quantity || 0)
      
      if (code && cost > 0) {
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
  
async createKpi(kpiData, companyId = null) {
    // Use provided companyId or get from session
    if (!companyId) {
      const { data: { session } } = await supabase.auth.getSession()
      companyId = session?.user?.app_metadata?.company_id
    }

    if (!companyId) {
      throw new Error('Company ID not found in session')
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