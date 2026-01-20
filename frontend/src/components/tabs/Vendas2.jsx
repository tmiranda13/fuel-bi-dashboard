import { useState, useEffect } from 'react'
import { Row, Col, Card, Form, Table, Badge, Spinner, Alert, Button, Collapse } from 'react-bootstrap'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../../services/supabase'

// Collapsible Section Component
const CollapsibleSection = ({ title, storageKey, defaultOpen = false, children, headerBg = 'primary' }) => {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(`vendas2_section_${storageKey}`)
    if (stored !== null) return stored === 'true'
    return defaultOpen
  })

  const toggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    localStorage.setItem(`vendas2_section_${storageKey}`, String(newState))
  }

  return (
    <Card className={`mb-4 border-${headerBg}`}>
      <Card.Header
        className={`bg-${headerBg} text-white d-flex justify-content-between align-items-center`}
        style={{ cursor: 'pointer' }}
        onClick={toggle}
      >
        <strong>{title}</strong>
        <span style={{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          fontSize: '1.2rem'
        }}>
          ▼
        </span>
      </Card.Header>
      <Collapse in={isOpen}>
        <div>
          <Card.Body>
            {children}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  )
}

const Vendas2 = () => {
  // Date state - Default to September 2025 (first month with combined_sales data)
  const [startDate, setStartDate] = useState(() => {
    const stored = localStorage.getItem('vendas2_startDate')
    if (stored) return stored
    return '2025-09-01'
  })
  const [endDate, setEndDate] = useState(() => {
    const stored = localStorage.getItem('vendas2_endDate')
    if (stored) return stored
    return '2025-09-30'
  })

  // Data state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [salesData, setSalesData] = useState(null)
  const [employeeData, setEmployeeData] = useState([])
  const [pumpData, setPumpData] = useState([])
  const [paymentData, setPaymentData] = useState([])
  const [dailyData, setDailyData] = useState([])

  // Product colors
  const productColors = {
    'GC': '#0088FE',
    'GA': '#00C49F',
    'ET': '#FFBB28',
    'DS10': '#FF8042',
    'DS500': '#8884D8'
  }

  const productNames = {
    'GC': 'Gasolina Comum',
    'GA': 'Gasolina Aditivada',
    'ET': 'Etanol',
    'DS10': 'Diesel S10',
    'DS500': 'Diesel S500'
  }

  // Fetch data from combined_sales table
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch from combined_sales table - use pagination to get all records
      // Supabase default limit is 1000, so we need to fetch in batches
      let allData = []
      const batchSize = 1000
      let lastId = null

      // First, get total count
      const { count } = await supabase
        .from('combined_sales')
        .select('*', { count: 'exact', head: true })
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .eq('company_id', 2)

      console.log(`Total records to fetch: ${count}`)

      // Fetch in batches using cursor-based pagination
      while (true) {
        let query = supabase
          .from('combined_sales')
          .select('*')
          .gte('sale_date', startDate)
          .lte('sale_date', endDate)
          .eq('company_id', 2)
          .order('id', { ascending: true })
          .limit(batchSize)

        if (lastId) {
          query = query.gt('id', lastId)
        }

        const { data: batch, error: fetchError } = await query

        if (fetchError) throw fetchError

        if (!batch || batch.length === 0) break

        allData = [...allData, ...batch]
        lastId = batch[batch.length - 1].id

        console.log(`Fetched ${allData.length} of ${count} records...`)

        // If we got less than batchSize, we've reached the end
        if (batch.length < batchSize) break
      }

      const data = allData
      console.log(`Total fetched: ${data.length} records`)

      if (!data || data.length === 0) {
        setSalesData({ total_volume: 0, total_revenue: 0, transactions: 0 })
        setEmployeeData([])
        setPumpData([])
        setPaymentData([])
        setDailyData([])
        return
      }

      // Aggregate totals
      const totals = data.reduce((acc, row) => ({
        total_volume: acc.total_volume + parseFloat(row.volume || 0),
        total_revenue: acc.total_revenue + parseFloat(row.value || 0),
        transactions: acc.transactions + 1
      }), { total_volume: 0, total_revenue: 0, transactions: 0 })

      setSalesData(totals)

      // Aggregate by employee
      const byEmployee = {}
      data.forEach(row => {
        const emp = row.employee || 'Não Identificado'
        if (!byEmployee[emp]) {
          byEmployee[emp] = { name: emp, volume: 0, revenue: 0, transactions: 0, volumeGA: 0, volumeGC: 0 }
        }
        const vol = parseFloat(row.volume || 0)
        byEmployee[emp].volume += vol
        byEmployee[emp].revenue += parseFloat(row.value || 0)
        byEmployee[emp].transactions += 1
        // Track GA and GC volumes for mix calculation
        if (row.product_code === 'GA') byEmployee[emp].volumeGA += vol
        if (row.product_code === 'GC') byEmployee[emp].volumeGC += vol
      })
      setEmployeeData(Object.values(byEmployee).sort((a, b) => b.revenue - a.revenue))

      // Aggregate by pump (each bico sells only one fuel type)
      const byPump = {}
      data.forEach(row => {
        const pump = row.pump_number || 'N/A'
        const product = row.product_code || 'N/A'
        if (!byPump[pump]) {
          byPump[pump] = { pump, product, productName: productNames[product] || product, volume: 0, revenue: 0, transactions: 0 }
        }
        byPump[pump].volume += parseFloat(row.volume || 0)
        byPump[pump].revenue += parseFloat(row.value || 0)
        byPump[pump].transactions += 1
      })
      setPumpData(Object.values(byPump).sort((a, b) => a.pump.localeCompare(b.pump)))

      // Aggregate by payment method (supports split payments via payment_breakdown)
      const byPayment = {}
      data.forEach(row => {
        // Check if payment_breakdown exists (new format with split payment support)
        let payments = []
        if (row.payment_breakdown) {
          try {
            // payment_breakdown is JSON string: [{"method": "CARTAO", "amount": 20}, ...]
            const breakdown = typeof row.payment_breakdown === 'string'
              ? JSON.parse(row.payment_breakdown)
              : row.payment_breakdown
            if (Array.isArray(breakdown) && breakdown.length > 0) {
              payments = breakdown
            }
          } catch (e) {
            console.warn('Failed to parse payment_breakdown:', e)
          }
        }

        // Fall back to payment_method field if no breakdown
        if (payments.length === 0) {
          const paymentMethod = row.payment_method || 'Outros'
          const totalValue = parseFloat(row.value || 0)

          // Check if payment_method contains comma (legacy split payment format)
          if (paymentMethod.includes(',')) {
            const methods = paymentMethod.split(',').map(m => m.trim()).filter(m => m)
            const splitAmount = totalValue / methods.length
            methods.forEach(method => {
              payments.push({ method: method, amount: splitAmount })
            })
          } else {
            payments = [{ method: paymentMethod, amount: totalValue }]
          }
        }

        // Add each payment portion to its respective method
        payments.forEach(p => {
          const method = p.method || 'Outros'
          const amount = parseFloat(p.amount || 0)
          if (!byPayment[method]) {
            byPayment[method] = { method: method, volume: 0, revenue: 0, transactions: 0 }
          }
          // Revenue is the payment amount
          byPayment[method].revenue += amount
          // For split payments, each portion counts as a partial transaction
          byPayment[method].transactions += 1
        })
      })
      setPaymentData(Object.values(byPayment).sort((a, b) => b.revenue - a.revenue))

      // Aggregate by date for evolution chart
      const byDate = {}
      data.forEach(row => {
        const date = row.sale_date
        if (!byDate[date]) {
          byDate[date] = { date, total: 0, GC: 0, GA: 0, ET: 0, DS10: 0, DS500: 0 }
        }
        byDate[date].total += parseFloat(row.volume || 0)
        if (row.product_code) {
          byDate[date][row.product_code] = (byDate[date][row.product_code] || 0) + parseFloat(row.volume || 0)
        }
      })
      const dailyArray = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
      setDailyData(dailyArray.map(d => ({
        ...d,
        dia: d.date.split('-').slice(1).reverse().join('/')
      })))

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Loading state
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

  // Error state
  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Erro ao carregar dados</Alert.Heading>
        <p>{error}</p>
        <p className="small text-muted">
          Nota: Esta tab usa a tabela "combined_sales" que precisa ser criada e populada com os dados do parser combinado.
        </p>
      </Alert>
    )
  }

  // Calculate metrics
  const totalVolume = salesData?.total_volume || 0
  const totalRevenue = salesData?.total_revenue || 0
  const totalTransactions = salesData?.transactions || 0
  const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  // Payment method colors
  const paymentColors = {
    'PIX': '#00C49F',
    'CARTAO': '#0088FE',
    'DINHEIRO': '#FFBB28',
    'SEMANAL + 5': '#FF8042',
    'DIARIO + 1': '#8884D8'
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Row className="align-items-center">
          <Col md={4}>
            <h2>Abastecimentos</h2>
            <small className="text-muted">Dados: Cupons + Vendas por Bico</small>
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
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      localStorage.setItem('vendas2_startDate', e.target.value)
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
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      localStorage.setItem('vendas2_endDate', e.target.value)
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small mb-1">&nbsp;</Form.Label>
                  <Button variant="primary" className="w-100 d-block" onClick={fetchData} disabled={loading}>
                    {loading ? 'Carregando...' : 'Atualizar'}
                  </Button>
                </Form.Group>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Volume Total</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">
                {Math.round(totalVolume).toLocaleString('pt-BR')} L
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Faturamento</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-info">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Transações</Card.Title>
              <Card.Text className="fs-4 fw-bold text-info">
                {totalTransactions.toLocaleString('pt-BR')}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-primary">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Ticket Médio</Card.Title>
              <Card.Text className="fs-4 fw-bold text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket)}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Employee Performance */}
      <CollapsibleSection
        title="Desempenho por Funcionário"
        storageKey="employee"
        defaultOpen={true}
        headerBg="success"
      >
        <Table responsive hover>
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Volume (L)</th>
              <th>Faturamento</th>
              <th>Ticket Médio</th>
              <th>Mix GA</th>
              <th>% do Total</th>
            </tr>
          </thead>
          <tbody>
            {employeeData.map((emp, index) => {
              const totalGasoline = emp.volumeGA + emp.volumeGC
              const mixGA = totalGasoline > 0 ? (emp.volumeGA / totalGasoline) * 100 : 0
              return (
                <tr key={index}>
                  <td><strong>{emp.name}</strong></td>
                  <td>{Math.round(emp.volume).toLocaleString('pt-BR')} L</td>
                  <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.revenue)}</td>
                  <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.revenue / emp.transactions)}</td>
                  <td>
                    <Badge bg={mixGA >= 30 ? 'success' : mixGA >= 20 ? 'warning' : 'secondary'}>
                      {mixGA.toFixed(1)}%
                    </Badge>
                  </td>
                  <td>
                    <Badge bg="primary">{((emp.revenue / totalRevenue) * 100).toFixed(1)}%</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </CollapsibleSection>

      {/* Payment Methods */}
      <CollapsibleSection
        title="Formas de Pagamento"
        storageKey="payment"
        defaultOpen={false}
        headerBg="info"
      >
        <Table responsive hover size="sm">
          <thead>
            <tr>
              <th>Forma de Pagamento</th>
              <th>Transações</th>
              <th>Faturamento</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {paymentData.map((pay, index) => (
              <tr key={index}>
                <td>
                  <span className="badge me-2" style={{ backgroundColor: paymentColors[pay.method] || '#6c757d' }}>
                    {pay.method}
                  </span>
                </td>
                <td>{pay.transactions.toLocaleString('pt-BR')}</td>
                <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pay.revenue)}</td>
                <td>{((pay.revenue / totalRevenue) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CollapsibleSection>

      {/* Pump Performance - Grouped by Fuel Type */}
      <CollapsibleSection
        title="Comparativo de Bicos"
        storageKey="pump"
        defaultOpen={false}
        headerBg="warning"
      >
        {(() => {
          // Group bicos by fuel type
          const byFuelType = {}
          pumpData.forEach(pump => {
            const fuel = pump.product
            if (!byFuelType[fuel]) {
              byFuelType[fuel] = { fuel, name: pump.productName, bicos: [] }
            }
            byFuelType[fuel].bicos.push(pump)
          })

          // Calculate average for each fuel type
          Object.values(byFuelType).forEach(group => {
            const totalVolume = group.bicos.reduce((sum, b) => sum + b.volume, 0)
            group.avgVolume = totalVolume / group.bicos.length
            // Sort bicos by volume descending
            group.bicos.sort((a, b) => b.volume - a.volume)
          })

          // Order fuel types: GC, GA, ET, DS10, DS500
          const fuelOrder = ['GC', 'GA', 'ET', 'DS10', 'DS500']
          const sortedGroups = fuelOrder
            .filter(f => byFuelType[f])
            .map(f => byFuelType[f])

          return (
            <Row>
              {sortedGroups.map((group, gIndex) => (
                <Col md={6} lg={4} key={gIndex} className="mb-3">
                  <Card className="h-100">
                    <Card.Header className="py-2" style={{ backgroundColor: productColors[group.fuel] || '#6c757d', color: group.fuel === 'ET' ? '#212529' : 'white' }}>
                      <strong>{group.name}</strong>
                      <small className="ms-2">({group.bicos.length} bicos)</small>
                    </Card.Header>
                    <Card.Body className="p-2">
                      <Table size="sm" className="mb-0">
                        <thead>
                          <tr>
                            <th>Bico</th>
                            <th>Volume</th>
                            <th>vs Média</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.bicos.map((bico, bIndex) => {
                            const diff = ((bico.volume - group.avgVolume) / group.avgVolume) * 100
                            const isLow = diff < -15
                            const isHigh = diff > 15
                            return (
                              <tr key={bIndex} className={isLow ? 'table-danger' : isHigh ? 'table-success' : ''}>
                                <td><strong>{bico.pump}</strong></td>
                                <td>{Math.round(bico.volume).toLocaleString('pt-BR')} L</td>
                                <td>
                                  <Badge bg={isLow ? 'danger' : isHigh ? 'success' : 'secondary'}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(0)}%
                                  </Badge>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </Table>
                      <div className="text-center mt-2">
                        <small className="text-muted">Média: {Math.round(group.avgVolume).toLocaleString('pt-BR')} L</small>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )
        })()}
      </CollapsibleSection>

      <div style={{ paddingBottom: '2rem' }} />
    </div>
  )
}

export default Vendas2
