import { useState, useEffect } from 'react'
import { Row, Col, Card, Badge, Button, Spinner, Alert, ProgressBar, Modal, Form, Table } from 'react-bootstrap'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { usePinnedWidgets, AVAILABLE_WIDGETS } from '../../contexts/PinnedWidgetsContext'
import { fetchVendasDashboard, fetchComprasDashboard, fetchEstoqueDashboard, sortProductsByStandardOrder, normalizeProductName } from '../../services/dashboardApi'
import { supabase } from '../../services/supabase'

const Home = ({ onNavigateToTab }) => {
  const { pinnedWidgets, unpinWidget, availableWidgets, pinWidget, resetToDefault } = usePinnedWidgets()
  const [loading, setLoading] = useState(true)
  const [vendasData, setVendasData] = useState(null)
  const [comprasData, setComprasData] = useState(null)
  const [estoqueData, setEstoqueData] = useState(null)
  const [currentMonthData, setCurrentMonthData] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState(null)

  // Insights data
  const [insightsData, setInsightsData] = useState({
    yesterday: null,
    lastWeekSameDay: null,
    thisWeek: null,
    lastWeek: null,
    employeeGAMix: [],
    alerts: []
  })

  // Fetch data for widgets
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current month dates
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth()
        const today = now.getDate()
        const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
        const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today).padStart(2, '0')}`
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        // Fetch vendas data for current month
        const vendas = await fetchVendasDashboard(monthStart, todayStr)
        setVendasData(vendas)

        // Calculate projections
        const daysElapsed = today
        const totalVolume = vendas.total_volume || 0
        const vmd = daysElapsed > 0 ? totalVolume / daysElapsed : 0
        const projected = Math.round(vmd * daysInMonth)

        // Fetch monthly target from kpis table (order by created_at to get most recent)
        const { data: kpiData } = await supabase
          .from('kpis')
          .select('target_value')
          .eq('company_id', 2)
          .eq('kpi_type', 'sales_volume')
          .is('product_code', null)
          .order('created_at', { ascending: false })
          .limit(1)

        const monthlyTarget = kpiData?.[0]?.target_value ? parseFloat(kpiData[0].target_value) : null

        setCurrentMonthData({
          vmd: Math.round(vmd),
          projected,
          monthlyTarget,
          daysElapsed,
          daysInMonth,
          monthName: new Date(year, month).toLocaleDateString('pt-BR', { month: 'long' }),
          year
        })

        // Fetch compras data
        const compras = await fetchComprasDashboard(monthStart, todayStr)
        setComprasData(compras)

        // Fetch estoque data (last 30 days for VMD calculation)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const estoqueStart = thirtyDaysAgo.toISOString().split('T')[0]
        const estoque = await fetchEstoqueDashboard(estoqueStart, todayStr)
        setEstoqueData(estoque)

        // Fetch insights data (pass estoque for alerts)
        await fetchInsightsData(estoque)

      } catch (err) {
        console.error('Error fetching home data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fetch insights data
  const fetchInsightsData = async (estoqueDataParam) => {
    try {
      const now = new Date()

      // Calculate dates
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = formatDateLocal(yesterday)

      const lastWeekSameDay = new Date(now)
      lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 8) // Same day last week (yesterday - 7)
      const lastWeekSameDayStr = formatDateLocal(lastWeekSameDay)

      // This week (Monday to yesterday)
      const thisWeekStart = new Date(now)
      const dayOfWeek = thisWeekStart.getDay() // 0=Sunday, 1=Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      thisWeekStart.setDate(thisWeekStart.getDate() - daysToMonday) // Monday of this week
      const thisWeekStartStr = formatDateLocal(thisWeekStart)

      // Last week (same days as this week for fair comparison)
      // Monday of last week to same day of week as yesterday
      const lastWeekStart = new Date(thisWeekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7) // Monday of last week
      const lastWeekStartStr = formatDateLocal(lastWeekStart)
      const lastWeekEnd = new Date(yesterday)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7) // Same day last week as yesterday
      const lastWeekEndStr = formatDateLocal(lastWeekEnd)

      // Fetch yesterday's data
      const yesterdayData = await fetchVendasDashboard(yesterdayStr, yesterdayStr)

      // Fetch same day last week
      const lastWeekSameDayData = await fetchVendasDashboard(lastWeekSameDayStr, lastWeekSameDayStr)

      // Fetch this week data
      const thisWeekData = await fetchVendasDashboard(thisWeekStartStr, yesterdayStr)

      // Fetch last week data
      const lastWeekData = await fetchVendasDashboard(lastWeekStartStr, lastWeekEndStr)

      // Fetch employee GA mix from combined_sales (last 7 days)
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

      const { data: employeeSales } = await supabase
        .from('combined_sales')
        .select('employee, product_code, volume, value')
        .gte('sale_date', sevenDaysAgoStr)
        .lte('sale_date', yesterdayStr)
        .eq('company_id', 2)

      // Aggregate employee data (GA mix and revenue)
      const empData = {}
      employeeSales?.forEach(row => {
        const emp = row.employee || 'Não Identificado'
        if (!empData[emp]) {
          empData[emp] = { name: emp, volumeGA: 0, volumeGC: 0, revenue: 0 }
        }
        const vol = parseFloat(row.volume || 0)
        const val = parseFloat(row.value || 0)
        empData[emp].revenue += val
        if (row.product_code === 'GA') empData[emp].volumeGA += vol
        if (row.product_code === 'GC') empData[emp].volumeGC += vol
      })

      const employeeGAMix = Object.values(empData)
        .map(e => ({
          ...e,
          totalGasoline: e.volumeGA + e.volumeGC,
          mixGA: (e.volumeGA + e.volumeGC) > 0 ? (e.volumeGA / (e.volumeGA + e.volumeGC)) * 100 : 0
        }))
        .filter(e => e.revenue > 0) // Only employees with sales
        .sort((a, b) => b.revenue - a.revenue)

      // Build alerts array
      const alerts = []

      // Low autonomy alerts (from estoque only)
      const lowAutonomy = estoqueDataParam?.inventory?.filter(item => parseFloat(item.days_autonomy || 0) < 3) || []
      lowAutonomy.forEach(item => {
        alerts.push({
          type: 'stock',
          severity: 'danger',
          message: `${normalizeProductName(item.product_name)}: ${parseFloat(item.days_autonomy).toFixed(1)} dias de autonomia`
        })
      })

      setInsightsData({
        yesterday: yesterdayData,
        lastWeekSameDay: lastWeekSameDayData,
        thisWeek: thisWeekData,
        lastWeek: lastWeekData,
        employeeGAMix,
        alerts: alerts.slice(0, 5) // Limit to 5 alerts
      })

    } catch (err) {
      console.error('Error fetching insights:', err)
    }
  }

  // Product colors
  const productColors = {
    'GASOLINA COMUM': '#0088FE',
    'GASOLINA ADITIVADA': '#00C49F',
    'ETANOL': '#FFBB28',
    'DIESEL S10': '#FF8042',
    'DIESEL S500': '#8884D8'
  }

  // Calculate derived data
  const totalLucroBruto = vendasData?.products?.reduce((sum, product) => {
    const volume = parseFloat(product.volume_sold || 0)
    const price = parseFloat(product.avg_price || 0)
    const cost = parseFloat(product.avg_cost || 0)
    return sum + (price - cost) * volume
  }, 0) || 0

  const gasolinaComumProduct = vendasData?.products?.find(p => p.product_name === 'GASOLINA COMUM')
  const gasolinaAditivadaProduct = vendasData?.products?.find(p => p.product_name === 'GASOLINA ADITIVADA')
  const gasolinaComumTotal = parseFloat(gasolinaComumProduct?.volume_sold || 0)
  const gasolinaAditivadaTotal = parseFloat(gasolinaAditivadaProduct?.volume_sold || 0)
  const gasolinaTotal = gasolinaComumTotal + gasolinaAditivadaTotal
  const mixGasolinaAditivada = gasolinaTotal > 0 ? ((gasolinaAditivadaTotal / gasolinaTotal) * 100).toFixed(1) : '0.0'
  const mixGasolinaComum = gasolinaTotal > 0 ? ((gasolinaComumTotal / gasolinaTotal) * 100).toFixed(1) : '0.0'

  // Render individual widgets
  const renderWidget = (widgetId) => {
    const widget = availableWidgets[widgetId]
    if (!widget) return null

    const handleClick = () => {
      if (onNavigateToTab) {
        onNavigateToTab(widget.sourceTab)
      }
    }

    const handleUnpin = (e) => {
      e.stopPropagation()
      unpinWidget(widgetId)
    }

    // Determine column size based on widget size
    const colSize = widget.size === 'small' ? 3 : widget.size === 'medium' ? 4 : 6

    switch (widgetId) {
      case 'vendas_volume_total':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-success widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Volume Total</Card.Title>
                <Card.Text className="fs-4 fw-bold text-success">
                  {loading ? '...' : `${Math.round(vendasData?.total_volume || 0).toLocaleString('pt-BR')} L`}
                </Card.Text>
                <Badge bg="success" className="mt-1">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'vendas_faturamento':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-success widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Faturamento</Card.Title>
                <Card.Text className="fs-4 fw-bold text-success">
                  {loading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vendasData?.total_revenue || 0)}
                </Card.Text>
                <Badge bg="success" className="mt-1">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'vendas_lucro_bruto':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-success widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Lucro Bruto</Card.Title>
                <Card.Text className="fs-4 fw-bold text-success">
                  {loading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLucroBruto)}
                </Card.Text>
                <Badge bg="success" className="mt-1">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'vendas_vmd':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-info widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">VMD (Mês Atual)</Card.Title>
                <Card.Text className="fs-4 fw-bold text-info">
                  {loading ? '...' : `${(currentMonthData?.vmd || 0).toLocaleString('pt-BR')} L`}
                </Card.Text>
                <Badge bg="info" className="mt-1">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'vendas_projecao':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-primary widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Projeção do Mês</Card.Title>
                <Card.Text className="fs-4 fw-bold text-primary">
                  {loading ? '...' : `${(currentMonthData?.projected || 0).toLocaleString('pt-BR')} L`}
                </Card.Text>
                {currentMonthData && (
                  <small className="text-muted d-block">
                    {currentMonthData.monthName} • {currentMonthData.daysElapsed}/{currentMonthData.daysInMonth} dias
                  </small>
                )}
                <Badge bg="primary" className="mt-1">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'vendas_mix_gasolina':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-success widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Mix de Gasolina</Card.Title>
                {loading ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>
                    <Row className="text-center mt-3">
                      <Col xs={6}>
                        <div className="text-muted small">Comum</div>
                        <div className="fs-4 fw-bold text-primary">{mixGasolinaComum}%</div>
                      </Col>
                      <Col xs={6}>
                        <div className="text-muted small">Aditivada</div>
                        <div className="fs-4 fw-bold text-success">{mixGasolinaAditivada}%</div>
                      </Col>
                    </Row>
                    <div className="text-center mt-2">
                      <small className="text-muted">Total: {Math.round(gasolinaTotal).toLocaleString('pt-BR')} L</small>
                    </div>
                  </>
                )}
                <Badge bg="success" className="mt-2">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'vendas_breakdown_produto':
        const sortedProducts = vendasData?.products ? sortProductsByStandardOrder(vendasData.products) : []
        const productBreakdown = sortedProducts.map((product) => {
          const displayName = normalizeProductName(product.product_name)
          return {
            name: displayName,
            value: parseFloat(product.volume_sold),
            color: productColors[displayName] || '#999999'
          }
        })
        const totalVolume = parseFloat(vendasData?.total_volume || 0)

        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-success widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Breakdown por Produto</Card.Title>
                {loading ? (
                  <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={productBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${((entry.value / totalVolume) * 100).toFixed(0)}%`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {productBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${Math.round(value).toLocaleString('pt-BR')} L`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <Badge bg="success" className="mt-1">Vendas</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'compras_volume_total':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-warning widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Volume Comprado</Card.Title>
                <Card.Text className="fs-4 fw-bold text-warning">
                  {loading ? '...' : `${Math.round(comprasData?.total_volume || 0).toLocaleString('pt-BR')} L`}
                </Card.Text>
                <Badge bg="warning" text="dark" className="mt-1">Compras</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'compras_custo_total':
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-warning widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Custo Total</Card.Title>
                <Card.Text className="fs-4 fw-bold text-warning">
                  {loading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(comprasData?.total_cost || 0)}
                </Card.Text>
                <Badge bg="warning" text="dark" className="mt-1">Compras</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      case 'estoque_alertas':
        const autonomyData = estoqueData?.inventory?.map(item => ({
          produto: normalizeProductName(item.product_name),
          diasAutonomia: parseFloat(item.days_autonomy || 0),
          estoqueAtual: parseFloat(item.current_stock || 0),
          status: item.days_autonomy >= 4 ? 'adequado' : item.days_autonomy >= 3 ? 'baixo' : 'critico'
        })) || []
        const alertItems = autonomyData.filter(item => item.status === 'critico' || item.status === 'baixo')
        const hasAlerts = alertItems.length > 0

        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className={`h-100 border-${hasAlerts ? 'danger' : 'success'} widget-card`} onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">Alertas de Autonomia</Card.Title>
                {loading ? (
                  <Spinner animation="border" size="sm" />
                ) : hasAlerts ? (
                  <div className="mt-2">
                    {alertItems.map((item, idx) => (
                      <div key={idx} className={`mb-2 p-2 rounded ${item.status === 'critico' ? 'bg-danger bg-opacity-10' : 'bg-warning bg-opacity-10'}`}>
                        <div className="d-flex justify-content-between align-items-center">
                          <strong className={item.status === 'critico' ? 'text-danger' : 'text-warning'}>
                            {item.produto}
                          </strong>
                          <Badge bg={item.status === 'critico' ? 'danger' : 'warning'} text={item.status === 'baixo' ? 'dark' : 'white'}>
                            {item.diasAutonomia.toFixed(1)} dias
                          </Badge>
                        </div>
                        <small className="text-muted">
                          {item.status === 'critico' ? 'Compra urgente!' : 'Programar compra'}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <span className="text-success fs-1">✓</span>
                    <p className="text-success mb-0 mt-2"><strong>Tudo OK!</strong></p>
                    <small className="text-muted">Todos os produtos com 4+ dias de autonomia</small>
                  </div>
                )}
                <Badge bg={hasAlerts ? 'danger' : 'success'} className="mt-2">Estoque</Badge>
              </Card.Body>
            </Card>
          </Col>
        )

      default:
        return (
          <Col md={colSize} sm={6} className="mb-3" key={widgetId}>
            <Card className="h-100 border-secondary widget-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <Card.Body className="position-relative">
                <Button variant="link" className="position-absolute top-0 end-0 p-1 text-muted" onClick={handleUnpin} title="Remover">
                  <small>✕</small>
                </Button>
                <Card.Title className="text-muted fs-6">{widget.title}</Card.Title>
                <Card.Text className="text-muted small">{widget.description}</Card.Text>
                <Badge bg="secondary" className="mt-1">{widget.sourceTab}</Badge>
              </Card.Body>
            </Card>
          </Col>
        )
    }
  }

  // Get unpinned widgets for the add modal
  const unpinnedWidgets = Object.keys(availableWidgets).filter(id => !pinnedWidgets.includes(id))

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Erro ao carregar dados</Alert.Heading>
        <p>{error}</p>
      </Alert>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h2>Home</h2>
        </div>
        <div>
          <Button variant="outline-primary" size="sm" className="me-2" onClick={() => setShowAddModal(true)}>
            + Adicionar Widget
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={resetToDefault}>
            Restaurar Padrão
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Carregando...</span>
          </Spinner>
          <p className="mt-3 text-muted">Carregando widgets...</p>
        </div>
      )}

      {/* Insights Section */}
      {!loading && (
        <>
          <Card className="mb-4 border-primary">
            <Card.Header className="bg-primary text-white">
              <strong>Insights do Dia</strong>
            </Card.Header>
            <Card.Body>
              <Row>
                {/* Yesterday's Performance */}
                <Col lg={3} md={6} className="mb-3">
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-muted mb-2">Ontem</h6>
                      {insightsData.yesterday ? (
                        <>
                          <div className="fs-4 fw-bold">
                            {Math.round(insightsData.yesterday.total_volume || 0).toLocaleString('pt-BR')} L
                          </div>
                          {(() => {
                            const yesterdayVol = insightsData.yesterday?.total_volume || 0
                            const lastWeekVol = insightsData.lastWeekSameDay?.total_volume || 0
                            if (lastWeekVol > 0) {
                              const diff = ((yesterdayVol - lastWeekVol) / lastWeekVol) * 100
                              const isUp = diff >= 0
                              return (
                                <div className={`small ${isUp ? 'text-success' : 'text-danger'}`}>
                                  {isUp ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}% vs. semana passada
                                </div>
                              )
                            }
                            return <div className="small text-muted">Sem dados semana passada</div>
                          })()}
                          <small className="text-muted">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insightsData.yesterday.total_revenue || 0)}
                          </small>
                        </>
                      ) : (
                        <span className="text-muted">Sem dados</span>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                {/* MTD Progress */}
                <Col lg={3} md={6} className="mb-3">
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-muted mb-2">Progresso MTD</h6>
                      {currentMonthData && vendasData ? (
                        <>
                          <div className="d-flex justify-content-between align-items-end mb-1">
                            <span className="fs-5 fw-bold">
                              {Math.round(vendasData.total_volume || 0).toLocaleString('pt-BR')} L
                            </span>
                            <Badge bg="info">{currentMonthData.daysElapsed}/{currentMonthData.daysInMonth} dias</Badge>
                          </div>
                          <ProgressBar
                            now={(currentMonthData.daysElapsed / currentMonthData.daysInMonth) * 100}
                            variant="info"
                            style={{ height: '8px' }}
                            className="mb-1"
                          />
                          <div className="mt-1 p-2 bg-primary bg-opacity-10 rounded">
                            <small className="text-muted">Projeção: </small>
                            <strong className="text-primary fs-6">
                              {currentMonthData.projected.toLocaleString('pt-BR')} L
                              {currentMonthData.monthlyTarget && (
                                <span className="text-muted fw-normal"> / {currentMonthData.monthlyTarget.toLocaleString('pt-BR')} L</span>
                              )}
                            </strong>
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">Carregando...</span>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                {/* Weekly Comparison */}
                <Col lg={3} md={6} className="mb-3">
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-muted mb-2">Esta Semana vs. Anterior</h6>
                      {insightsData.thisWeek && insightsData.lastWeek ? (
                        <>
                          {(() => {
                            const thisWeekVol = insightsData.thisWeek.total_volume || 0
                            const lastWeekVol = insightsData.lastWeek.total_volume || 0
                            const diff = lastWeekVol > 0 ? ((thisWeekVol - lastWeekVol) / lastWeekVol) * 100 : 0
                            const isUp = diff >= 0
                            return (
                              <>
                                <div className="d-flex align-items-center">
                                  <span className={`fs-3 fw-bold ${isUp ? 'text-success' : 'text-danger'}`}>
                                    {isUp ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}%
                                  </span>
                                </div>
                                <small className="text-muted d-block">
                                  {Math.round(thisWeekVol).toLocaleString('pt-BR')} L vs. {Math.round(lastWeekVol).toLocaleString('pt-BR')} L
                                </small>
                              </>
                            )
                          })()}
                        </>
                      ) : (
                        <span className="text-muted">Sem dados</span>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                {/* Mix GA Status */}
                <Col lg={3} md={6} className="mb-3">
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-muted mb-2">Mix GA (7 dias)</h6>
                      {insightsData.employeeGAMix.length > 0 ? (
                        <>
                          {(() => {
                            const totalGA = insightsData.employeeGAMix.reduce((sum, e) => sum + e.volumeGA, 0)
                            const totalGC = insightsData.employeeGAMix.reduce((sum, e) => sum + e.volumeGC, 0)
                            const overallMix = (totalGA + totalGC) > 0 ? (totalGA / (totalGA + totalGC)) * 100 : 0
                            const bestEmployee = insightsData.employeeGAMix[0]
                            return (
                              <>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className="fs-4 fw-bold text-success">{overallMix.toFixed(1)}%</span>
                                  <Badge bg={overallMix >= 20 ? 'success' : 'warning'}>
                                    {overallMix >= 20 ? 'Bom' : 'Melhorar'}
                                  </Badge>
                                </div>
                                {bestEmployee && (
                                  <div className="small">
                                    <span className="text-muted">Destaque: </span>
                                    <strong>{bestEmployee.name}</strong>
                                    <Badge bg="success" className="ms-1">{bestEmployee.mixGA.toFixed(1)}%</Badge>
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </>
                      ) : (
                        <span className="text-muted">Sem dados</span>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Alerts Row */}
              {insightsData.alerts.length > 0 && (
                <div className="mt-2 pt-3 border-top">
                  <h6 className="text-muted mb-2">Alertas</h6>
                  <Row>
                    {insightsData.alerts.map((alert, idx) => (
                      <Col key={idx} md={6} lg={4} className="mb-2">
                        <Alert variant={alert.severity} className="py-2 px-3 mb-0 d-flex align-items-center">
                          <span className="me-2">⛽</span>
                          <small>{alert.message}</small>
                        </Alert>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              {insightsData.alerts.length === 0 && (
                <div className="mt-2 pt-3 border-top">
                  <Alert variant="success" className="py-2 px-3 mb-0">
                    <span className="me-2">✓</span>
                    <small>Nenhum alerta - tudo funcionando normalmente!</small>
                  </Alert>
                </div>
              )}

              {/* Employee Rankings */}
              {insightsData.employeeGAMix.length >= 3 && (
                <div className="mt-3 pt-3 border-top">
                  <h6 className="text-muted mb-3">Ranking Frentistas (7 dias)</h6>
                  <Row>
                    {/* Top 3 Employees */}
                    <Col md={6} className="mb-3">
                      <Card className="h-100 border-success">
                        <Card.Header className="bg-success text-white py-2">
                          <strong>Top 3 Frentistas</strong>
                        </Card.Header>
                        <Card.Body className="p-2">
                          <Table size="sm" className="mb-0">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Nome</th>
                                <th>Faturamento</th>
                                <th>Mix GA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {insightsData.employeeGAMix.slice(0, 3).map((emp, idx) => (
                                <tr key={emp.name}>
                                  <td><Badge bg="success">{idx + 1}</Badge></td>
                                  <td><strong>{emp.name}</strong></td>
                                  <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(emp.revenue)}</td>
                                  <td><Badge bg={emp.mixGA >= 20 ? 'success' : 'warning'}>{emp.mixGA.toFixed(1)}%</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Bottom 3 Employees */}
                    <Col md={6} className="mb-3">
                      <Card className="h-100 border-danger">
                        <Card.Header className="bg-danger text-white py-2">
                          <strong>Bottom 3 Frentistas</strong>
                        </Card.Header>
                        <Card.Body className="p-2">
                          <Table size="sm" className="mb-0">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Nome</th>
                                <th>Faturamento</th>
                                <th>Mix GA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {insightsData.employeeGAMix.slice(-3).reverse().map((emp, idx) => (
                                <tr key={emp.name}>
                                  <td><Badge bg="danger">{insightsData.employeeGAMix.length - 2 + idx}</Badge></td>
                                  <td><strong>{emp.name}</strong></td>
                                  <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(emp.revenue)}</td>
                                  <td><Badge bg={emp.mixGA >= 20 ? 'success' : 'danger'}>{emp.mixGA.toFixed(1)}%</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Widgets Grid */}
      {!loading && (
        <Row>
          {pinnedWidgets.map(widgetId => renderWidget(widgetId))}
        </Row>
      )}

      {/* Empty State */}
      {!loading && pinnedWidgets.length === 0 && (
        <Alert variant="info" className="text-center">
          <Alert.Heading>Nenhum widget adicionado</Alert.Heading>
          <p>Clique em "Adicionar Widget" para começar a personalizar sua página inicial.</p>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            Adicionar Widget
          </Button>
        </Alert>
      )}

      {/* Add Widget Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Adicionar Widget</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {unpinnedWidgets.length === 0 ? (
            <p className="text-muted text-center">Todos os widgets já foram adicionados!</p>
          ) : (
            <Row>
              {unpinnedWidgets.map(widgetId => {
                const widget = availableWidgets[widgetId]
                return (
                  <Col md={4} key={widgetId} className="mb-3">
                    <Card
                      className="h-100"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        pinWidget(widgetId)
                        setShowAddModal(false)
                      }}
                    >
                      <Card.Body>
                        <Card.Title className="fs-6">{widget.title}</Card.Title>
                        <Card.Text className="small text-muted">{widget.description}</Card.Text>
                        <Badge bg={
                          widget.sourceTab === 'vendas' ? 'success' :
                          widget.sourceTab === 'compras' ? 'warning' :
                          widget.sourceTab === 'estoque' ? 'info' :
                          'secondary'
                        } className={widget.sourceTab === 'compras' ? 'text-dark' : ''}>
                          {widget.sourceTab}
                        </Badge>
                      </Card.Body>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>

      <div style={{ paddingBottom: '2rem' }} />
    </div>
  )
}

export default Home
