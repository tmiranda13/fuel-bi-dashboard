import { useState, useEffect, useCallback } from 'react'
import { Row, Col, Card, Form, Table, Badge, Spinner, Alert, Button, ProgressBar } from 'react-bootstrap'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchVendasDashboard, fetchKpis, sortProductsByStandardOrder, normalizeProductName } from '../../services/dashboardApi'
import MockDataBadge, { MockDataCard } from '../MockDataBadge'

const Vendas = () => {
  const [startDate, setStartDate] = useState(() => {
    return localStorage.getItem('vendas_startDate') || '2025-09-01'
  })
  const [endDate, setEndDate] = useState(() => {
    return localStorage.getItem('vendas_endDate') || '2025-12-03'
  })
  const [customerFilter, setCustomerFilter] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [kpis, setKpis] = useState([])
  const [appliedStartDate, setAppliedStartDate] = useState(startDate)
  const [appliedEndDate, setAppliedEndDate] = useState(endDate)
  const [currentMonthProjection, setCurrentMonthProjection] = useState(null)
  
  const [selectedFuels, setSelectedFuels] = useState({
  gasolinaComum: true,
  gasolinaAditivada: true,
  etanol: true,
  dieselS10: true,
  dieselS500: true,
  total: true
})
  
  // Fetch current month projection (independent of date pickers)
  const fetchCurrentMonthProjection = async () => {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      const today = now.getDate()
      
      // Current month start and today
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today).padStart(2, '0')}`
      
      // Days elapsed in current month (including today)
      const daysElapsed = today
      
      // Total days in current month
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      
      // Fetch current month's sales
      const data = await fetchVendasDashboard(monthStart, todayStr)
      
      // Calculate VMD and projection
      const totalVolume = data.total_volume || 0
      const vmd = daysElapsed > 0 ? totalVolume / daysElapsed : 0
      const projected = Math.round(vmd * daysInMonth)
      
      setCurrentMonthProjection({
        vmd: Math.round(vmd),
        projected,
        daysElapsed,
        daysInMonth,
        monthName: new Date(year, month).toLocaleDateString('pt-BR', { month: 'long' }),
        year
      })
    } catch (err) {
      console.error('Error fetching current month projection:', err)
    }
  }

 const fetchData = async () => {
  try {
    setLoading(true)
    setError(null)
    const [data, kpisData] = await Promise.all([
      fetchVendasDashboard(startDate, endDate),
      fetchKpis()
    ])
    setDashboardData(data)
    
    // Save applied dates
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
    
    // Store all KPIs (multi-month proration will filter by month when calculating)
    setKpis(kpisData)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}

  useEffect(() => {
    fetchData()
	fetchCurrentMonthProjection()
  }, [])

  // Get all months in the selected date range with their day counts
  const getMonthsInRange = useCallback(() => {
    const start = new Date(appliedStartDate)
    const end = new Date(appliedEndDate)
    const months = []
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    
    while (current <= end) {
      const year = current.getFullYear()
      const month = current.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
      
      // Calculate days selected in this month
      const rangeStart = new Date(Math.max(start.getTime(), current.getTime()))
      const monthEnd = new Date(year, month + 1, 0)
      const rangeEnd = new Date(Math.min(end.getTime(), monthEnd.getTime()))
      
      const daysSelected = Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1
      
      months.push({
        year,
        month,
        monthStart,
        daysInMonth,
        daysSelected,
        factor: daysSelected / daysInMonth
      })
      
      // Move to next month
      current = new Date(year, month + 1, 1)
    }
    
    return months
  }, [appliedStartDate, appliedEndDate])

  // Helper to get KPI target by type, product code, and month
  const getKpiTargetForMonth = (kpiType, productCode, monthStart) => {
    const kpi = kpis.find(k =>
      k.kpi_type === kpiType &&
      (productCode ? k.product_code === productCode : !k.product_code) &&
      k.start_date === monthStart
    )
    return kpi ? parseFloat(kpi.target_value) : 0
  }

 // Helper to get KPI target by type and product code (for non-prorated like margins)
  const getKpiTarget = (kpiType, productCode = null) => {
    // For percentages, get the most recent month's target
    const months = getMonthsInRange()
    if (months.length === 0) return null
    
    const lastMonth = months[months.length - 1]
    const kpi = kpis.find(k =>
      k.kpi_type === kpiType &&
      (productCode ? k.product_code === productCode : !k.product_code) &&
      k.start_date === lastMonth.monthStart
    )
    return kpi ? parseFloat(kpi.target_value) : null
  }

  // Get prorated KPI target summed across all months in range
  const getProratedKpiTarget = (kpiType, productCode = null) => {
    const months = getMonthsInRange()
    let total = 0
    
    for (const m of months) {
      const monthlyTarget = getKpiTargetForMonth(kpiType, productCode, m.monthStart)
      total += monthlyTarget * m.factor
    }
    
    return total > 0 ? total : null
  }

  // Product name to code mapping
  const productNameToCode = {
    'GASOLINA COMUM': 'GC',
    'GASOLINA ADITIVADA': 'GA',
    'ETANOL': 'ET',
    'DIESEL S10': 'DS10',
    'DIESEL S500': 'DS500'
  }

  // Get product code from name
  const getProductCode = (productName) => {
    if (productNameToCode[productName]) return productNameToCode[productName]
    const normalized = normalizeProductName(productName)
    return productNameToCode[normalized] || null
  }

  // Get volume target for product (prorated across months, rounded)
  const getVolumeTarget = (productName) => {
    const code = getProductCode(productName)
    const target = code ? getProratedKpiTarget('sales_volume', code) : null
    return target ? Math.round(target) : null
  }

  // Get margin target for product (not prorated - it's a percentage)
  const getMarginTarget = (productName) => {
    const code = getProductCode(productName)
    return code ? getKpiTarget('margin', code) : null
  }

  // Get mix aditivados target (not prorated - it's a percentage)
  const getMixTarget = (category) => {
    return getKpiTarget('cost', category)
  }

  // Get revenue target for product (prorated across months, rounded)
  const getRevenueTarget = (productName) => {
    const code = getProductCode(productName)
    const target = code ? getProratedKpiTarget('revenue', code) : null
    return target ? Math.round(target) : null
  }

  const clientesPJData = [
    { id: 1, razaoSocial: 'Transportadora ABC Ltda', cnpj: '12.345.678/0001-90', volumeMes: 25000, faturamento: 125000, produto: 'Diesel S10' },
    { id: 2, razaoSocial: 'Logística XYZ S/A', cnpj: '98.765.432/0001-10', volumeMes: 18000, faturamento: 90000, produto: 'Diesel S10' },
    { id: 3, razaoSocial: 'Frota Brasil Transportes', cnpj: '11.222.333/0001-44', volumeMes: 15000, faturamento: 82500, produto: 'Gasolina Comum' },
    { id: 4, razaoSocial: 'Empresa de Ônibus Rápido', cnpj: '44.555.666/0001-77', volumeMes: 22000, faturamento: 110000, produto: 'Diesel S10' },
    { id: 5, razaoSocial: 'Táxi Premium Executivo', cnpj: '77.888.999/0001-22', volumeMes: 8500, faturamento: 50000, produto: 'Gasolina Aditivada' }
  ]

  const filteredClientes = clientesPJData.filter(cliente =>
    cliente.razaoSocial.toLowerCase().includes(customerFilter.toLowerCase()) ||
    cliente.cnpj.includes(customerFilter)
  )

  const getVendasStatusBadge = (volumeVendido, metaVolume) => {
    if (!metaVolume) return <Badge bg="secondary">Sem Meta</Badge>
    const percentual = (volumeVendido / metaVolume) * 100
    if (percentual >= 100) return <Badge bg="success">Atingido</Badge>
    if (percentual >= 90) return <Badge bg="info">Bom</Badge>
    if (percentual >= 80) return <Badge bg="warning" text="dark">Alerta</Badge>
    return <Badge bg="danger">Critico</Badge>
  }

  const calcProgress = (current, target) => {
    if (!target || target === 0) return 0
    return Math.min((current / target) * 100, 100)
  }

  const getProgressVariant = (progress) => {
    if (progress >= 100) return 'success'
    if (progress >= 75) return 'info'
    if (progress >= 50) return 'warning'
    return 'danger'
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="mt-3">Carregando dados de vendas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Erro ao carregar dados</Alert.Heading>
        <p>{error}</p>
      </Alert>
    )
  }

  if (!dashboardData) {
    return (
      <Alert variant="info">
        <Alert.Heading>Sem dados</Alert.Heading>
        <p>Nenhum dado de vendas disponível para o período selecionado.</p>
      </Alert>
    )
  }

  const totalLucroBruto = dashboardData.products?.reduce((sum, product) => {
    const volume = parseFloat(product.volume_sold || 0)
    const price = parseFloat(product.avg_price || 0)
    const cost = parseFloat(product.avg_cost || 0)
    return sum + (price - cost) * volume
  }, 0) || 0

  const metrics = {
    volumeTotal: `${parseFloat(dashboardData.total_volume || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`,
    lucroBruto: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLucroBruto),
    precoMedio: `R$ ${parseFloat(dashboardData.avg_price || 0).toFixed(2)}/L`
  }

  const gasolinaComumProduct = dashboardData.products?.find(p => p.product_name === 'GASOLINA COMUM')
  const gasolinaAditivadaProduct = dashboardData.products?.find(p => p.product_name === 'GASOLINA ADITIVADA')
  const gasolinaComumTotal = parseFloat(gasolinaComumProduct?.volume_sold || 0)
  const gasolinaAditivadaTotal = parseFloat(gasolinaAditivadaProduct?.volume_sold || 0)
  const gasolinaTotal = gasolinaComumTotal + gasolinaAditivadaTotal
  const mixGasolinaAditivada = gasolinaTotal > 0 ? ((gasolinaAditivadaTotal / gasolinaTotal) * 100).toFixed(1) : '0.0'
  const mixGasolinaComum = gasolinaTotal > 0 ? ((gasolinaComumTotal / gasolinaTotal) * 100).toFixed(1) : '0.0'

  const sortedProducts = sortProductsByStandardOrder(dashboardData.products || [])

  const productColors = {
    'GASOLINA COMUM': '#0088FE',
    'GASOLINA ADITIVADA': '#00C49F',
    'ETANOL': '#FFBB28',
    'DIESEL S10': '#FF8042',
    'DIESEL S500': '#8884D8'
  }

  const productBreakdown = sortedProducts.map((product) => {
    const displayName = normalizeProductName(product.product_name)
    return {
      name: displayName,
      value: parseFloat(product.volume_sold),
      color: productColors[displayName] || '#999999'
    }
  })

  const volumeDataPerProduct = dashboardData.evolution?.map(day => {
    const [year, month, dayNum] = day.date.split('-')
    const formattedDate = `${dayNum}/${month}`
    return {
      dia: formattedDate,
      fullDate: day.date,
      gasolinaComum: parseFloat(day.GC || 0),
      gasolinaAditivada: parseFloat(day.GA || 0),
      etanol: parseFloat(day.ET || 0),
      dieselS10: parseFloat(day.DS10 || 0),
      dieselS500: parseFloat(day.DS500 || 0),
      total: parseFloat(day.total || 0)
    }
  }) || []

  const numberOfDays = dashboardData.evolution?.length || 1
  const volumeMedioMTD = currentMonthProjection?.vmd || 0

  const vendasPorProduto = sortedProducts.map((product, index) => {
    const volumeVendido = parseFloat(product.volume_sold)
    const metaVolume = getVolumeTarget(product.product_name)
    const metaMargem = getMarginTarget(product.product_name)
    const metaLucroBruto = getRevenueTarget(product.product_name)
    const precoMedio = parseFloat(product.avg_price)
    const custoMedio = parseFloat(product.avg_cost || 0)
    const margemBruta = precoMedio > 0 ? ((precoMedio - custoMedio) / precoMedio) * 100 : 0
    const lucroBruto = (precoMedio - custoMedio) * volumeVendido
    const vmd = volumeVendido / numberOfDays

    return {
      id: index + 1,
      produto: normalizeProductName(product.product_name),
      volumeVendido,
      vmd,
      precoMedio,
      lucroBruto,
      margemBruta,
      metaVolume,
      metaMargem,
      metaLucroBruto
    }
  }) || []

  const totalVolume = parseFloat(dashboardData.total_volume || 0)

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const fullDate = payload[0]?.payload?.fullDate
      let dayOfWeek = ''
      if (fullDate) {
        const date = new Date(fullDate + 'T00:00:00')
        const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        dayOfWeek = daysOfWeek[date.getDay()]
      }
      return (
        <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '8px' }}>{dayOfWeek && `${dayOfWeek}, `}{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
            </p>
          ))}
        </div>
      )
    }
    return null
  }
  return (
    <div>
      <div className="mb-4">
        <Row className="align-items-center">
          <Col md={4}>
            <h2>Vendas</h2>
          </Col>
          <Col md={8}>
            <Row className="align-items-center">
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small mb-1">Data Início</Form.Label>
                  <Form.Control
                    type="date"
                    value={startDate}
                    max={endDate}
                    onKeyDown={(e) => e.preventDefault()}
                    onChange={(e) => {
                      const newDate = e.target.value
                      if (newDate && newDate <= endDate) {
                        setStartDate(newDate)
                        localStorage.setItem('vendas_startDate', newDate)
                      }
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small mb-1">Data Fim</Form.Label>
                  <Form.Control
                    type="date"
                    value={endDate}
                    min={startDate}
                    onKeyDown={(e) => e.preventDefault()}
                    onChange={(e) => {
                      const newDate = e.target.value
                      if (newDate && newDate >= startDate) {
                        setEndDate(newDate)
                        localStorage.setItem('vendas_endDate', newDate)
                      }
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-end">
                <Button variant="primary" className="w-100" onClick={fetchData} disabled={loading}>
                  {loading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>

      {kpis.length > 0 && (
        <Row className="mb-4">
          <Col lg={12}>
            <Card className="border-primary">
              <Card.Header className="bg-primary text-white">
                <strong>Metas do Mes</strong>
                <small className="ms-2">- Configuradas na aba Metas</small>
              </Card.Header>
              <Card.Body>
                <Row>
                  {getKpiTarget('sales_volume', null) && (
                    <Col md={3} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between mb-2">
                            <small className="text-muted">Volume Total</small>
                            <Badge bg={calcProgress(dashboardData.total_volume, getKpiTarget('sales_volume', null)) >= 100 ? 'success' : 'warning'}>
                              {calcProgress(dashboardData.total_volume, getKpiTarget('sales_volume', null)).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="mb-2">
                            <strong>{Math.round(dashboardData.total_volume).toLocaleString('pt-BR')} L</strong>
                            <small className="text-muted"> / {getKpiTarget('sales_volume', null).toLocaleString('pt-BR')} L</small>
                          </div>
                          <ProgressBar
                            now={calcProgress(dashboardData.total_volume, getKpiTarget('sales_volume', null))}
                            variant={getProgressVariant(calcProgress(dashboardData.total_volume, getKpiTarget('sales_volume', null)))}
                            style={{ height: '8px' }}
                          />
                        </Card.Body>
                      </Card>
                    </Col>
                  )}
                  {getKpiTarget('revenue', null) && (
                    <Col md={3} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between mb-2">
                            <small className="text-muted">Lucro Bruto</small>
                            <Badge bg={calcProgress(totalLucroBruto, getKpiTarget('revenue', null)) >= 100 ? 'success' : 'warning'}>
                              {calcProgress(totalLucroBruto, getKpiTarget('revenue', null)).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="mb-2">
                            <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLucroBruto)}</strong>
                            <small className="text-muted"> / {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getKpiTarget('revenue', null))}</small>
                          </div>
                          <ProgressBar
                            now={calcProgress(totalLucroBruto, getKpiTarget('revenue', null))}
                            variant={getProgressVariant(calcProgress(totalLucroBruto, getKpiTarget('revenue', null)))}
                            style={{ height: '8px' }}
                          />
                        </Card.Body>
                      </Card>
                    </Col>
                  )}
                  {getMixTarget('gasolina') && (
                    <Col md={3} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between mb-2">
                            <small className="text-muted">Mix GA</small>
                            <Badge bg={parseFloat(mixGasolinaAditivada) >= getMixTarget('gasolina') ? 'success' : 'warning'}>
                              {parseFloat(mixGasolinaAditivada) >= getMixTarget('gasolina') ? 'Atingido' : 'Em Progresso'}
                            </Badge>
                          </div>
                          <div className="mb-2">
                            <strong>{mixGasolinaAditivada}%</strong>
                            <small className="text-muted"> / {getMixTarget('gasolina')}%</small>
                          </div>
                          <ProgressBar
                            now={calcProgress(parseFloat(mixGasolinaAditivada), getMixTarget('gasolina'))}
                            variant={getProgressVariant(calcProgress(parseFloat(mixGasolinaAditivada), getMixTarget('gasolina')))}
                            style={{ height: '8px' }}
                          />
                        </Card.Body>
                      </Card>
                    </Col>
                  )}
                  {getKpiTarget('margin', null) && (
                    <Col md={3} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="p-3">
                          {(() => {
                            const avgMargin = vendasPorProduto.length > 0
                              ? vendasPorProduto.reduce((sum, p) => sum + p.margemBruta, 0) / vendasPorProduto.length
                              : 0
                            return (
                              <>
                                <div className="d-flex justify-content-between mb-2">
                                  <small className="text-muted">Margem Bruta Media</small>
                                  <Badge bg={avgMargin >= getKpiTarget('margin', null) ? 'success' : 'warning'}>
                                    {avgMargin >= getKpiTarget('margin', null) ? 'Atingido' : 'Em Progresso'}
                                  </Badge>
                                </div>
                                <div className="mb-2">
                                  <strong>{avgMargin.toFixed(1)}%</strong>
                                  <small className="text-muted"> / {getKpiTarget('margin', null)}%</small>
                                </div>
                                <ProgressBar
                                  now={calcProgress(avgMargin, getKpiTarget('margin', null))}
                                  variant={getProgressVariant(calcProgress(avgMargin, getKpiTarget('margin', null)))}
                                  style={{ height: '8px' }}
                                />
                              </>
                            )
                          })()}
                        </Card.Body>
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Row className="mb-4">
        <Col lg={12}>
          <Card>
            <Card.Body>
              <Card.Title>Desempenho de Vendas por Produto</Card.Title>
              <p className="small text-muted mb-3">
                {kpis.length > 0 ? 'Metas configuradas na aba Metas' : 'Configure metas na aba Metas para ver o progresso'}
              </p>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Volume Vendido (L)</th>
                    <th>VMD (L)</th>
                    <th>Alvo de Volume (L)</th>
                    <th>% da Meta</th>
                    <th>Preco Medio (R$/L)</th>
                    <th>Lucro Bruto</th>
                    <th>Margem Bruta (%)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasPorProduto.map(item => {
                    const percentualMeta = item.metaVolume ? (item.volumeVendido / item.metaVolume) * 100 : null
                    const rowClass = percentualMeta === null ? '' : percentualMeta < 80 ? 'table-danger' : percentualMeta < 90 ? 'table-warning' : percentualMeta < 100 ? 'table-info' : 'table-success'
                    return (
                      <tr key={item.id} className={rowClass}>
                        <td><strong>{item.produto}</strong></td>
                        <td>{Math.round(item.volumeVendido).toLocaleString('pt-BR')} L</td>
                        <td>{Math.round(item.vmd).toLocaleString('pt-BR')} L</td>
                        <td>{item.metaVolume ? `${item.metaVolume.toLocaleString('pt-BR')} L` : <span className="text-muted">-</span>}</td>
                        <td>
                          {percentualMeta !== null ? (
                            <strong className={percentualMeta >= 100 ? 'text-success' : percentualMeta >= 90 ? 'text-info' : 'text-warning'}>
                              {percentualMeta.toFixed(1)}%
                            </strong>
                          ) : <span className="text-muted">-</span>}
                        </td>
                        <td>R$ {item.precoMedio.toFixed(2)}/L</td>
                        <td>
                          <strong className={item.metaLucroBruto ? (item.lucroBruto >= item.metaLucroBruto ? 'text-success' : 'text-danger') : (item.lucroBruto >= 0 ? 'text-success' : 'text-danger')}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.lucroBruto)}
                          </strong>
                          {item.metaLucroBruto && (
                            <small className="text-muted ms-1 d-block">
                              (meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.metaLucroBruto)})
                            </small>
                          )}
                        </td>
                        <td>
                          <strong className={item.metaMargem ? (item.margemBruta >= item.metaMargem ? 'text-success' : 'text-danger') : (item.margemBruta >= 15 ? 'text-success' : item.margemBruta >= 10 ? 'text-warning' : 'text-danger')}>
                            {item.margemBruta.toFixed(2)}%
                          </strong>
                          {item.metaMargem && <small className="text-muted ms-1">(meta: {item.metaMargem}%)</small>}
                        </td>
                        <td>{getVendasStatusBadge(item.volumeVendido, item.metaVolume)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
	  <Row className="mb-4">
        <Col md={4} sm={6} className="mb-3">
          <Card className={`h-100 ${getKpiTarget('sales_volume', null) ? (dashboardData.total_volume >= getKpiTarget('sales_volume', null) ? 'border-success' : 'border-warning') : 'border-success'}`}>
            <Card.Body>
              <Card.Title className="text-muted fs-6">Volume Total</Card.Title>
              <Card.Text className={`fs-4 fw-bold ${getKpiTarget('sales_volume', null) ? (dashboardData.total_volume >= getKpiTarget('sales_volume', null) ? 'text-success' : 'text-warning') : 'text-success'}`}>
                {metrics.volumeTotal}
              </Card.Text>
              {getKpiTarget('sales_volume', null) && (
                <small className="text-muted d-block">Meta: {getKpiTarget('sales_volume', null).toLocaleString('pt-BR')} L</small>
              )}
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} sm={6} className="mb-3">
          <Card className={`h-100 ${getKpiTarget('revenue', null) ? (totalLucroBruto >= getKpiTarget('revenue', null) ? 'border-success' : 'border-warning') : 'border-success'}`}>
            <Card.Body>
              <Card.Title className="text-muted fs-6">Lucro Bruto</Card.Title>
              <Card.Text className={`fs-4 fw-bold ${getKpiTarget('revenue', null) ? (totalLucroBruto >= getKpiTarget('revenue', null) ? 'text-success' : 'text-warning') : 'text-success'}`}>
                {metrics.lucroBruto}
              </Card.Text>
              {getKpiTarget('revenue', null) && (
                <small className="text-muted d-block">Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getKpiTarget('revenue', null))}</small>
              )}
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Preço Médio</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">{metrics.precoMedio}</Card.Text>
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={4} sm={6} className="mb-3">
  <Card className="h-100 border-success">
    <Card.Body>
      <Card.Title className="text-muted fs-6">Volume Médio MTD <small className="text-success ms-2">✓ Real</small></Card.Title>
      <Card.Text className="fs-4 fw-bold text-success">
        {currentMonthProjection ? `${currentMonthProjection.vmd.toLocaleString('pt-BR')} L` : 'Calculando...'}
      </Card.Text>
    </Card.Body>
  </Card>
</Col>
        <Col md={4} sm={6} className="mb-3">
          <Card className="h-100 border-warning">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Clientes PJ/PF <MockDataBadge /></Card.Title>
              <Card.Text className="fs-4 fw-bold text-muted">N/A</Card.Text>
              <small className="text-warning">Sem tracking de clientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} sm={6} className="mb-3">
  <Card className="h-100 border-success">
    <Card.Body>
      <Card.Title className="text-muted fs-6">Volume Projetado <small className="text-success ms-2">✓ Real</small></Card.Title>
      <Card.Text className="fs-4 fw-bold text-success">
        {currentMonthProjection ? `${currentMonthProjection.projected.toLocaleString('pt-BR')} L` : 'Calculando...'}
      </Card.Text>
      {currentMonthProjection && (
        <small className="text-muted">
          {currentMonthProjection.monthName}/{currentMonthProjection.year} • VMD: {currentMonthProjection.vmd.toLocaleString('pt-BR')} L × {currentMonthProjection.daysInMonth} dias
        </small>
      )}
    </Card.Body>
  </Card>
</Col>
      </Row>

      <Row className="mb-4">
  <Col lg={12} className="mb-3">
    <Card className="border-success">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Card.Title className="mb-0">Evolução de Volume Diário <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
          <div className="d-flex flex-wrap gap-3">
            <Form.Check
              inline
              type="checkbox"
              id="filter-gc"
              label={<span style={{ color: '#0088FE' }}>Gasolina Comum</span>}
              checked={selectedFuels.gasolinaComum}
              onChange={(e) => setSelectedFuels({ ...selectedFuels, gasolinaComum: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="filter-ga"
              label={<span style={{ color: '#00C49F' }}>Gasolina Aditivada</span>}
              checked={selectedFuels.gasolinaAditivada}
              onChange={(e) => setSelectedFuels({ ...selectedFuels, gasolinaAditivada: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="filter-et"
              label={<span style={{ color: '#FFBB28' }}>Etanol</span>}
              checked={selectedFuels.etanol}
              onChange={(e) => setSelectedFuels({ ...selectedFuels, etanol: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="filter-ds10"
              label={<span style={{ color: '#FF8042' }}>Diesel S10</span>}
              checked={selectedFuels.dieselS10}
              onChange={(e) => setSelectedFuels({ ...selectedFuels, dieselS10: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="filter-ds500"
              label={<span style={{ color: '#8884D8' }}>Diesel S500</span>}
              checked={selectedFuels.dieselS500}
              onChange={(e) => setSelectedFuels({ ...selectedFuels, dieselS500: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="filter-total"
              label={<span style={{ color: '#000000', fontWeight: 'bold' }}>Total</span>}
              checked={selectedFuels.total}
              onChange={(e) => setSelectedFuels({ ...selectedFuels, total: e.target.checked })}
            />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={volumeDataPerProduct}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedFuels.gasolinaComum && <Line type="monotone" dataKey="gasolinaComum" stroke="#0088FE" strokeWidth={2} name="Gasolina Comum (L)" />}
            {selectedFuels.gasolinaAditivada && <Line type="monotone" dataKey="gasolinaAditivada" stroke="#00C49F" strokeWidth={2} name="Gasolina Aditivada (L)" />}
            {selectedFuels.etanol && <Line type="monotone" dataKey="etanol" stroke="#FFBB28" strokeWidth={2} name="Etanol (L)" />}
            {selectedFuels.dieselS10 && <Line type="monotone" dataKey="dieselS10" stroke="#FF8042" strokeWidth={2} name="Diesel S10 (L)" />}
            {selectedFuels.dieselS500 && <Line type="monotone" dataKey="dieselS500" stroke="#8884D8" strokeWidth={2} name="Diesel S500 (L)" />}
            {selectedFuels.total && <Line type="monotone" dataKey="total" stroke="#000000" strokeWidth={3} name="Total (L)" />}
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  </Col>
</Row>

<Row className="mb-4">
  <Col lg={4} className="mb-3">
    <Card className="h-100 border-success">
      <Card.Body>
        <Card.Title>Breakdown por Produto <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
        <ResponsiveContainer width="100%" height={280}>
  <PieChart>
    <Pie
      data={productBreakdown}
      cx="50%"
      cy="40%"
      labelLine={false}
      label={(entry) => `${((entry.value / totalVolume) * 100).toFixed(0)}%`}
      outerRadius={70}
      fill="#8884d8"
      dataKey="value"
    >
      {productBreakdown.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={entry.color} />
      ))}
    </Pie>
    <Tooltip formatter={(value) => `${Math.round(value).toLocaleString('pt-BR')} L`} />
    <Legend verticalAlign="bottom" height={36} />
  </PieChart>
</ResponsiveContainer>
      </Card.Body>
    </Card>
  </Col>
  <Col lg={4} className="mb-3">
    <Card className="h-100 border-success bg-success bg-opacity-10">
      <Card.Body className="d-flex flex-column justify-content-center">
        <h5 className="text-center mb-1">Mix de Gasolina</h5>
        <p className="text-muted small text-center mb-2">Comum vs Aditivada</p>
        {getMixTarget('gasolina') && (
          <div className="text-center mb-3">
            <Badge bg={parseFloat(mixGasolinaAditivada) >= getMixTarget('gasolina') ? 'success' : 'warning'}>
              Meta: {getMixTarget('gasolina')}% aditivada
            </Badge>
          </div>
        )}
        <Row className="text-center">
          <Col xs={6}>
            <div className="text-muted small">Gasolina Comum</div>
            <div className="fs-3 fw-bold text-primary">{mixGasolinaComum}%</div>
            <div className="small text-muted">{Math.round(gasolinaComumTotal).toLocaleString('pt-BR')} L</div>
          </Col>
          <Col xs={6}>
            <div className="text-muted small">Gasolina Aditivada</div>
            <div className="fs-3 fw-bold text-success">{mixGasolinaAditivada}%</div>
            <div className="small text-muted">{Math.round(gasolinaAditivadaTotal).toLocaleString('pt-BR')} L</div>
          </Col>
        </Row>
        <div className="text-center mt-3">
          <div className="text-muted small">Total Gasolinas</div>
          <div className="fs-4 fw-bold">{Math.round(gasolinaTotal).toLocaleString('pt-BR')} L</div>
        </div>
      </Card.Body>
    </Card>
  </Col>
  <Col lg={4} className="mb-3">
    <Card className="h-100 border-success">
      <Card.Body>
        <Card.Title>Mix de Gasolina <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
        {getMixTarget('gasolina') && (
          <Badge bg={parseFloat(mixGasolinaAditivada) >= getMixTarget('gasolina') ? 'success' : 'warning'} className="mb-2">
            Meta: {getMixTarget('gasolina')}% aditivada
          </Badge>
        )}
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={[
                { name: 'Comum', value: gasolinaComumTotal, color: '#0088FE' },
                { name: 'Aditivada', value: gasolinaAditivadaTotal, color: '#00C49F' }
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.name}: ${((entry.value / gasolinaTotal) * 100).toFixed(1)}%`}
              outerRadius={70}
              fill="#8884d8"
              dataKey="value"
            >
              <Cell fill="#0088FE" />
              <Cell fill="#00C49F" />
            </Pie>
            <Tooltip formatter={(value) => `${Math.round(value).toLocaleString('pt-BR')} L`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center mt-2">
          <small className="text-muted">Total: {Math.round(gasolinaTotal).toLocaleString('pt-BR')} L</small>
        </div>
      </Card.Body>
    </Card>
  </Col>
</Row>
	  <Row className="mb-4">
        <Col lg={12}>
          <MockDataCard title="Clientes Pessoa Jurídica (PJ)">
            <p className="small text-muted mb-3">
              Estes dados são simulados - não há tracking de clientes no banco de dados atual.
              Considere adicionar uma tabela de clientes para habilitar este recurso.
            </p>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Control
                  type="text"
                  placeholder="Buscar por Razão Social ou CNPJ..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                />
              </Col>
            </Row>
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Razão Social</th>
                  <th>CNPJ</th>
                  <th>Produto Principal</th>
                  <th>Volume Mês (L)</th>
                  <th>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.length > 0 ? (
                  filteredClientes.map(cliente => (
                    <tr key={cliente.id}>
                      <td><strong>{cliente.razaoSocial}</strong></td>
                      <td>{cliente.cnpj}</td>
                      <td><Badge bg="info">{cliente.produto}</Badge></td>
                      <td>{cliente.volumeMes.toLocaleString('pt-BR')} L</td>
                      <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.faturamento)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="text-center text-muted">Nenhum cliente encontrado</td></tr>
                )}
              </tbody>
            </Table>
          </MockDataCard>
        </Col>
      </Row>

      <Card bg="light" className="mt-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>Dados Reais (Fonte: API)</h6>
              <ul className="small mb-0">
                <li>Volume Total, Faturamento, Preço Médio</li>
                <li>Volumes por Produto</li>
                <li>VMD (Volume Médio Diário) por Produto</li>
                <li>Mix de Gasolina (Comum vs Aditivada)</li>
                <li>Evolução Diária de Vendas</li>
                <li>Volume Médio MTD (Média Diária)</li>
                <li>Margem Bruta (Calculada)</li>
                <li>Metas de Volume/Margem/Lucro (Aba Metas)</li>
              </ul>
            </Col>
            <Col md={6}>
              <h6><MockDataBadge /> Dados Simulados (Não no BD)</h6>
              <ul className="small mb-0">
                <li>Clientes PJ/PF</li>
                <li>Volume Projetado</li>
              </ul>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Vendas