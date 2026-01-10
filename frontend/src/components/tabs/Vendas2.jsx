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
      let offset = 0
      const batchSize = 5000

      while (true) {
        const { data: batch, error: fetchError } = await supabase
          .from('combined_sales')
          .select('*')
          .gte('sale_date', startDate)
          .lte('sale_date', endDate)
          .eq('company_id', 2)
          .range(offset, offset + batchSize - 1)

        if (fetchError) throw fetchError

        if (!batch || batch.length === 0) break

        allData = [...allData, ...batch]
        offset += batchSize

        // If we got less than batchSize, we've reached the end
        if (batch.length < batchSize) break
      }

      const data = allData

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
          byEmployee[emp] = { name: emp, volume: 0, revenue: 0, transactions: 0 }
        }
        byEmployee[emp].volume += parseFloat(row.volume || 0)
        byEmployee[emp].revenue += parseFloat(row.value || 0)
        byEmployee[emp].transactions += 1
      })
      setEmployeeData(Object.values(byEmployee).sort((a, b) => b.revenue - a.revenue))

      // Aggregate by pump
      const byPump = {}
      data.forEach(row => {
        const pump = row.pump_number || 'N/A'
        const product = row.product_code || 'N/A'
        const key = `${pump}-${product}`
        if (!byPump[key]) {
          byPump[key] = { pump, product, productName: productNames[product] || product, volume: 0, revenue: 0, transactions: 0 }
        }
        byPump[key].volume += parseFloat(row.volume || 0)
        byPump[key].revenue += parseFloat(row.value || 0)
        byPump[key].transactions += 1
      })
      setPumpData(Object.values(byPump).sort((a, b) => b.volume - a.volume))

      // Aggregate by payment method
      const byPayment = {}
      data.forEach(row => {
        const payment = row.payment_method || 'Outros'
        if (!byPayment[payment]) {
          byPayment[payment] = { method: payment, volume: 0, revenue: 0, transactions: 0 }
        }
        byPayment[payment].volume += parseFloat(row.volume || 0)
        byPayment[payment].revenue += parseFloat(row.value || 0)
        byPayment[payment].transactions += 1
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
            <h2>Vendas 2.0 <Badge bg="warning" text="dark">Beta</Badge></h2>
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
        <Row>
          <Col lg={8}>
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Transações</th>
                  <th>Volume (L)</th>
                  <th>Faturamento</th>
                  <th>Ticket Médio</th>
                  <th>% do Total</th>
                </tr>
              </thead>
              <tbody>
                {employeeData.map((emp, index) => (
                  <tr key={index}>
                    <td><strong>{emp.name}</strong></td>
                    <td>{emp.transactions.toLocaleString('pt-BR')}</td>
                    <td>{Math.round(emp.volume).toLocaleString('pt-BR')} L</td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.revenue)}</td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.revenue / emp.transactions)}</td>
                    <td>
                      <Badge bg="primary">{((emp.revenue / totalRevenue) * 100).toFixed(1)}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Col>
          <Col lg={4}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={employeeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${((entry.revenue / totalRevenue) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                  nameKey="name"
                >
                  {employeeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </CollapsibleSection>

      {/* Payment Methods */}
      <CollapsibleSection
        title="Formas de Pagamento"
        storageKey="payment"
        defaultOpen={false}
        headerBg="info"
      >
        <Row>
          <Col lg={6}>
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
          </Col>
          <Col lg={6}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`} />
                <YAxis dataKey="method" type="category" width={100} />
                <Tooltip formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Bar dataKey="revenue" fill="#0088FE" name="Faturamento" />
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </CollapsibleSection>

      {/* Pump Performance */}
      <CollapsibleSection
        title="Desempenho por Bomba"
        storageKey="pump"
        defaultOpen={false}
        headerBg="warning"
      >
        <Table responsive hover size="sm">
          <thead>
            <tr>
              <th>Bomba</th>
              <th>Produto</th>
              <th>Volume (L)</th>
              <th>Faturamento</th>
              <th>Transações</th>
            </tr>
          </thead>
          <tbody>
            {pumpData.slice(0, 15).map((pump, index) => (
              <tr key={index}>
                <td><strong>{pump.pump}</strong></td>
                <td>
                  <span className="badge" style={{ backgroundColor: productColors[pump.product] || '#6c757d' }}>
                    {pump.productName}
                  </span>
                </td>
                <td>{Math.round(pump.volume).toLocaleString('pt-BR')} L</td>
                <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pump.revenue)}</td>
                <td>{pump.transactions}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {pumpData.length > 15 && (
          <small className="text-muted">Mostrando top 15 de {pumpData.length} combinações bomba/produto</small>
        )}
      </CollapsibleSection>

      {/* Daily Evolution */}
      <CollapsibleSection
        title="Evolução Diária de Volume"
        storageKey="evolution"
        defaultOpen={false}
        headerBg="secondary"
      >
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" />
            <YAxis />
            <Tooltip formatter={(value) => `${Math.round(value).toLocaleString('pt-BR')} L`} />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#000000" strokeWidth={3} name="Total (L)" />
            <Line type="monotone" dataKey="GC" stroke="#0088FE" strokeWidth={2} name="Gasolina Comum" />
            <Line type="monotone" dataKey="GA" stroke="#00C49F" strokeWidth={2} name="Gasolina Aditivada" />
            <Line type="monotone" dataKey="ET" stroke="#FFBB28" strokeWidth={2} name="Etanol" />
            <Line type="monotone" dataKey="DS10" stroke="#FF8042" strokeWidth={2} name="Diesel S10" />
            <Line type="monotone" dataKey="DS500" stroke="#8884D8" strokeWidth={2} name="Diesel S500" />
          </LineChart>
        </ResponsiveContainer>
      </CollapsibleSection>

      <div style={{ paddingBottom: '2rem' }} />
    </div>
  )
}

export default Vendas2
