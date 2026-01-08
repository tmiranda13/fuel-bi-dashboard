import { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Badge, Form, Spinner, Alert, Button } from 'react-bootstrap'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fetchEstoqueDashboard, fetchEstoqueEvolution, fetchVarianceData, sortProductsByStandardOrder, normalizeProductName } from '../../services/dashboardApi'

const Estoque = () => {
  const [startDate, setStartDate] = useState(() => {
    const stored = localStorage.getItem('estoque_startDate')
    if (stored) return stored
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const stored = localStorage.getItem('estoque_endDate')
    if (stored) return stored
    return new Date().toISOString().split('T')[0]
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [evolutionData, setEvolutionData] = useState(null)
  const [varianceData, setVarianceData] = useState(null)
  const [evolutionLoading, setEvolutionLoading] = useState(false)

  // Stock evolution chart filter state
  const [selectedStockFuels, setSelectedStockFuels] = useState({
    GC: true,
    GA: true,
    ET: true,
    DS10: true,
    DS500: true,
    total: true
  })

  // Variance chart filter state
  const [selectedVarianceFuels, setSelectedVarianceFuels] = useState({
    GC: true,
    GA: true,
    ET: true,
    DS10: true,
    DS500: true,
    total: true
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      setEvolutionLoading(true)
      setError(null)
      const [dashboardResult, evolutionResult, varianceResult] = await Promise.all([
        fetchEstoqueDashboard(startDate, endDate),
        fetchEstoqueEvolution(startDate, endDate),
        fetchVarianceData(startDate, endDate)
      ])
      setDashboardData(dashboardResult)
      setEvolutionData(evolutionResult)
      setVarianceData(varianceResult)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setEvolutionLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stockEvolutionData = evolutionData?.evolution?.map(day => {
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

  // Prepare variance chart data
  const varianceChartData = varianceData?.evolution?.map(day => {
    const [year, month, dayNum] = day.date.split('-')
    const formattedDate = `${dayNum}/${month}`
    return {
      dia: formattedDate,
      fullDate: day.date,
      GC: parseFloat(day.GC || 0),
      GA: parseFloat(day.GA || 0),
      ET: parseFloat(day.ET || 0),
      DS10: parseFloat(day.DS10 || 0),
      DS500: parseFloat(day.DS500 || 0),
      total: parseFloat(day.total || 0)
    }
  }) || []

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
              {entry.name}: {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} L
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Custom tooltip for variance chart
  const VarianceTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const fullDate = payload[0]?.payload?.fullDate
      let dayOfWeek = ''
      if (fullDate) {
        const date = new Date(fullDate + 'T00:00:00')
        const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        dayOfWeek = daysOfWeek[date.getDay()]
      }
      
      // Get all data from the payload's data point
      const dataPoint = payload[0]?.payload
      
      return (
        <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '8px' }}>{dayOfWeek && `${dayOfWeek}, `}{label}</p>
          {selectedVarianceFuels.GC && (
            <p style={{ margin: '4px 0', color: '#0088FE' }}>
              Gasolina Comum: <span style={{ color: dataPoint?.GC >= 0 ? '#28a745' : '#dc3545' }}>{dataPoint?.GC?.toFixed(1)} L</span>
            </p>
          )}
          {selectedVarianceFuels.GA && (
            <p style={{ margin: '4px 0', color: '#00C49F' }}>
              Gasolina Aditivada: <span style={{ color: dataPoint?.GA >= 0 ? '#28a745' : '#dc3545' }}>{dataPoint?.GA?.toFixed(1)} L</span>
            </p>
          )}
          {selectedVarianceFuels.ET && (
            <p style={{ margin: '4px 0', color: '#FFBB28' }}>
              Etanol: <span style={{ color: dataPoint?.ET >= 0 ? '#28a745' : '#dc3545' }}>{dataPoint?.ET?.toFixed(1)} L</span>
            </p>
          )}
          {selectedVarianceFuels.DS10 && (
            <p style={{ margin: '4px 0', color: '#FF8042' }}>
              Diesel S10: <span style={{ color: dataPoint?.DS10 >= 0 ? '#28a745' : '#dc3545' }}>{dataPoint?.DS10?.toFixed(1)} L</span>
            </p>
          )}
          {selectedVarianceFuels.DS500 && (
            <p style={{ margin: '4px 0', color: '#8884D8' }}>
              Diesel S500: <span style={{ color: dataPoint?.DS500 >= 0 ? '#28a745' : '#dc3545' }}>{dataPoint?.DS500?.toFixed(1)} L</span>
            </p>
          )}
          {selectedVarianceFuels.total && (
            <p style={{ margin: '4px 0', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '4px' }}>
              Total: <span style={{ color: dataPoint?.total >= 0 ? '#28a745' : '#dc3545' }}>{dataPoint?.total?.toFixed(1)} L</span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'critico': return <Badge bg="danger">Crítico</Badge>
      case 'baixo': return <Badge bg="warning" text="dark">Baixo</Badge>
      case 'adequado': return <Badge bg="success">Adequado</Badge>
      default: return <Badge bg="secondary">N/A</Badge>
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="mt-3">Carregando dados de estoque...</p>
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

  if (!dashboardData || !dashboardData.inventory) {
    return (
      <Alert variant="info">
        <Alert.Heading>Sem dados</Alert.Heading>
        <p>Nenhum dado de estoque disponível.</p>
      </Alert>
    )
  }

  const getStatusFromOccupation = (percentOccupation) => {
    if (percentOccupation >= 70) return 'adequado'
    if (percentOccupation >= 40) return 'baixo'
    return 'critico'
  }

  const sortedInventory = sortProductsByStandardOrder(dashboardData.inventory, 'product_code')
  const estoqueData = sortedInventory.map((item, index) => {
    const capacidadeTanque = parseFloat(item.tank_capacity || 0)
    const estoqueAtual = parseFloat(item.current_stock)
    const percentualOcupacao = capacidadeTanque > 0 ? (estoqueAtual / capacidadeTanque * 100) : 0
    return {
      id: index + 1,
      produto: normalizeProductName(item.product_name),
      capacidadeTanque,
      estoqueAtual,
      percentualOcupacao,
      entradas: parseFloat(item.period_entries || 0),
      saidas: parseFloat(item.period_exits || 0),
      diasAutonomia: parseFloat(item.days_autonomy),
      custoEstoque: parseFloat(item.stock_cost || 0),
      custoMedio: parseFloat(item.avg_cost || 0),
      status: getStatusFromOccupation(percentualOcupacao)
    }
  })

  const totalCustoEstoque = estoqueData.reduce((sum, item) => sum + item.custoEstoque, 0)

  // Variance summary data
  const varianceSummary = varianceData?.summary || []
  const varianceTotals = varianceData?.totals || { totalGain: 0, totalLoss: 0, totalNet: 0 }

  // Create cost lookup for variance financial calculation
  const costByProduct = {}
  estoqueData.forEach(item => {
    costByProduct[item.produto] = item.custoMedio
  })

  // Calculate total financial variance
  const totalFinancialVariance = varianceSummary.reduce((sum, item) => {
    const productName = normalizeProductName(item.product_name)
    const cost = costByProduct[productName] || 0
    return sum + (item.net * cost)
  }, 0)

  return (
    <div>
      <div className="mb-4">
        <Row className="align-items-center mb-3">
          <Col md={3}>
            <h2>Estoque</h2>
          </Col>
          <Col md={9}>
            <Row className="align-items-center justify-content-end mb-2">
              <Col md={3}>
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
                        localStorage.setItem('estoque_startDate', newDate)
                      }
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
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
                        localStorage.setItem('estoque_endDate', newDate)
                      }
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={2} className="d-flex align-items-end">
                <Button variant="primary" className="w-100" onClick={fetchData} disabled={loading}>
                  {loading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </Col>
              <Col md={4}>
                <Card bg="success" text="white" className="border-success">
                  <Card.Body className="py-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fs-6">Custo Total Estoque:</span>
                      <span className="fs-5 fw-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCustoEstoque)}
                      </span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>

      {/* 1. Status de Estoque por Produto */}
      <Row className="mb-4">
        <Col lg={12}>
          <Card className="border-success">
            <Card.Body>
              <Card.Title>Status de Estoque por Produto <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
              <p className="small text-muted mb-3">
                Custo calculado com base no custo médio ponderado das compras.
              </p>
              <Table responsive hover>
                <thead>
  <tr>
    <th>Produto</th>
    <th>Capacidade (L)</th>
    <th>Estoque Atual (L)</th>
    <th style={{ width: '12%' }}>Ocupação</th>
    <th>Dias Autonomia</th>
    <th>Custo Médio (R$/L)</th>
    <th>Custo Estoque</th>
    <th>Status</th>
  </tr>
</thead>
                <tbody>
  {estoqueData.map(item => (
    <tr key={item.id} className={item.status === 'critico' ? 'table-danger' : item.status === 'baixo' ? 'table-warning' : ''}>
      <td><strong>{item.produto}</strong></td>
      <td><strong className="text-success">{Math.round(item.capacidadeTanque).toLocaleString('pt-BR')}</strong></td>
      <td><strong className="text-success">{Math.round(item.estoqueAtual).toLocaleString('pt-BR')}</strong></td>
      <td>
        <div className="d-flex align-items-center">
          <div className="progress" style={{ height: '13px', width: '33px' }}>
            <div
              className={`progress-bar ${item.percentualOcupacao < 40 ? 'bg-danger' : item.percentualOcupacao < 70 ? 'bg-warning' : 'bg-success'}`}
              role="progressbar"
              style={{ width: `${Math.min(item.percentualOcupacao, 100)}%` }}
            />
          </div>
          <span className="ms-1 fw-bold" style={{ fontSize: '0.85em' }}>{item.percentualOcupacao.toFixed(0)}%</span>
        </div>
      </td>
      <td><strong className="text-success">{item.diasAutonomia.toFixed(1)} dias</strong></td>
      <td><strong className="text-success">R$ {item.custoMedio.toFixed(2)}/L</strong></td>
      <td><strong className="text-success">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.custoEstoque)}</strong></td>
      <td>{getStatusBadge(item.status)}</td>
    </tr>
  ))}
</tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 2. Evolução de Estoque (MOVED UP) */}
      <Row className="mb-4">
        <Col lg={12}>
          <Card className="border-success">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Card.Title className="mb-0">Evolução de Estoque <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
                  <p className="small text-muted mb-0">
                    Estoque diário calculado a partir das compras (entradas) e vendas (saídas).
                    O estoque atual é baseado na medição física dos tanques.
                  </p>
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <Form.Check
                    inline
                    type="checkbox"
                    id="stock-filter-gc"
                    label={<span style={{ color: '#0088FE' }}>Gasolina Comum</span>}
                    checked={selectedStockFuels.GC}
                    onChange={(e) => setSelectedStockFuels({ ...selectedStockFuels, GC: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="stock-filter-ga"
                    label={<span style={{ color: '#00C49F' }}>Gasolina Aditivada</span>}
                    checked={selectedStockFuels.GA}
                    onChange={(e) => setSelectedStockFuels({ ...selectedStockFuels, GA: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="stock-filter-et"
                    label={<span style={{ color: '#FFBB28' }}>Etanol</span>}
                    checked={selectedStockFuels.ET}
                    onChange={(e) => setSelectedStockFuels({ ...selectedStockFuels, ET: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="stock-filter-ds10"
                    label={<span style={{ color: '#FF8042' }}>Diesel S10</span>}
                    checked={selectedStockFuels.DS10}
                    onChange={(e) => setSelectedStockFuels({ ...selectedStockFuels, DS10: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="stock-filter-ds500"
                    label={<span style={{ color: '#8884D8' }}>Diesel S500</span>}
                    checked={selectedStockFuels.DS500}
                    onChange={(e) => setSelectedStockFuels({ ...selectedStockFuels, DS500: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="stock-filter-total"
                    label={<span style={{ color: '#000000', fontWeight: 'bold' }}>Total</span>}
                    checked={selectedStockFuels.total}
                    onChange={(e) => setSelectedStockFuels({ ...selectedStockFuels, total: e.target.checked })}
                  />
                </div>
              </div>
              {evolutionLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" size="sm" />
                  <span className="ms-2">Carregando evolução...</span>
                </div>
              ) : stockEvolutionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={stockEvolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {selectedStockFuels.GC && <Line type="monotone" dataKey="gasolinaComum" stroke="#0088FE" strokeWidth={2} name="Gasolina Comum (L)" />}
                    {selectedStockFuels.GA && <Line type="monotone" dataKey="gasolinaAditivada" stroke="#00C49F" strokeWidth={2} name="Gasolina Aditivada (L)" />}
                    {selectedStockFuels.ET && <Line type="monotone" dataKey="etanol" stroke="#FFBB28" strokeWidth={2} name="Etanol (L)" />}
                    {selectedStockFuels.DS10 && <Line type="monotone" dataKey="dieselS10" stroke="#FF8042" strokeWidth={2} name="Diesel S10 (L)" />}
                    {selectedStockFuels.DS500 && <Line type="monotone" dataKey="dieselS500" stroke="#8884D8" strokeWidth={2} name="Diesel S500 (L)" />}
                    {selectedStockFuels.total && <Line type="monotone" dataKey="total" stroke="#000000" strokeWidth={3} name="Total (L)" />}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Alert variant="info">Nenhum dado de evolução disponível para o período selecionado.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 3. Variação de Estoque (Sobra/Falta) */}
      <Row className="mb-4">
        <Col lg={12}>
          <Card className="border-success">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Card.Title className="mb-0">
                    Variação de Estoque (Sobra/Falta)
                    <small className="text-success ms-2">✓ Dados Reais</small>
                  </Card.Title>
                  <p className="text-muted small mb-0">Diferença entre estoque calculado e medição física dos tanques</p>
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <Form.Check
                    inline
                    type="checkbox"
                    id="variance-filter-gc"
                    label={<span style={{ color: '#0088FE' }}>Gasolina Comum</span>}
                    checked={selectedVarianceFuels.GC}
                    onChange={(e) => setSelectedVarianceFuels({ ...selectedVarianceFuels, GC: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="variance-filter-ga"
                    label={<span style={{ color: '#00C49F' }}>Gasolina Aditivada</span>}
                    checked={selectedVarianceFuels.GA}
                    onChange={(e) => setSelectedVarianceFuels({ ...selectedVarianceFuels, GA: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="variance-filter-et"
                    label={<span style={{ color: '#FFBB28' }}>Etanol</span>}
                    checked={selectedVarianceFuels.ET}
                    onChange={(e) => setSelectedVarianceFuels({ ...selectedVarianceFuels, ET: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="variance-filter-ds10"
                    label={<span style={{ color: '#FF8042' }}>Diesel S10</span>}
                    checked={selectedVarianceFuels.DS10}
                    onChange={(e) => setSelectedVarianceFuels({ ...selectedVarianceFuels, DS10: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="variance-filter-ds500"
                    label={<span style={{ color: '#8884D8' }}>Diesel S500</span>}
                    checked={selectedVarianceFuels.DS500}
                    onChange={(e) => setSelectedVarianceFuels({ ...selectedVarianceFuels, DS500: e.target.checked })}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="variance-filter-total"
                    label={<span style={{ color: '#000000', fontWeight: 'bold' }}>Total</span>}
                    checked={selectedVarianceFuels.total}
                    onChange={(e) => setSelectedVarianceFuels({ ...selectedVarianceFuels, total: e.target.checked })}
                  />
                </div>
              </div>
              
              {varianceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={varianceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip content={<VarianceTooltip />} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                    {selectedVarianceFuels.GC && <Bar dataKey="GC" fill="#0088FE" name="Gasolina Comum (L)" />}
                    {selectedVarianceFuels.GA && <Bar dataKey="GA" fill="#00C49F" name="Gasolina Aditivada (L)" />}
                    {selectedVarianceFuels.ET && <Bar dataKey="ET" fill="#FFBB28" name="Etanol (L)" />}
                    {selectedVarianceFuels.DS10 && <Bar dataKey="DS10" fill="#FF8042" name="Diesel S10 (L)" />}
                    {selectedVarianceFuels.DS500 && <Bar dataKey="DS500" fill="#8884D8" name="Diesel S500 (L)" />}
                    {selectedVarianceFuels.total && <Bar dataKey="total" fill="#333333" name="Total (L)" />}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Alert variant="info">Nenhum dado de variação disponível para o período selecionado.</Alert>
              )}
              
              {/* Variance Summary Legend */}
              <div className="mt-3 d-flex justify-content-center gap-4">
                <span><span style={{ color: '#28a745', fontWeight: 'bold' }}>● Positivo (Sobra)</span> = Medição física &gt; Estoque calculado</span>
                <span><span style={{ color: '#dc3545', fontWeight: 'bold' }}>● Negativo (Falta)</span> = Medição física &lt; Estoque calculado</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 4. Resumo de Variação por Produto */}
      {varianceSummary.length > 0 && (
        <Row className="mb-4">
          <Col lg={12}>
            <Card className="border-success">
              <Card.Body>
                <Card.Title>Resumo de Variação por Produto <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
                <p className="small text-muted mb-3">
                  Total de sobras e faltas no período selecionado
                </p>
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Total Sobra (L)</th>
                      <th>Total Falta (L)</th>
                      <th>Saldo (L)</th>
                      <th>Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {varianceSummary.map((item, index) => {
                      const productName = normalizeProductName(item.product_name)
                      const cost = costByProduct[productName] || 0
                      const financialValue = item.net * cost
                      return (
                        <tr key={index}>
                          <td><strong>{productName}</strong></td>
                          <td className="text-success">+{item.total_gain.toFixed(1)}</td>
                          <td className="text-danger">{item.total_loss.toFixed(1)}</td>
                          <td className={item.net >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                            {item.net >= 0 ? '+' : ''}{item.net.toFixed(1)}
                          </td>
                          <td className={financialValue >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                            {financialValue >= 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financialValue)}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="table-secondary">
                      <td><strong>TOTAL</strong></td>
                      <td className="text-success fw-bold">+{varianceTotals.totalGain.toFixed(1)}</td>
                      <td className="text-danger fw-bold">{varianceTotals.totalLoss.toFixed(1)}</td>
                      <td className={varianceTotals.totalNet >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                        {varianceTotals.totalNet >= 0 ? '+' : ''}{varianceTotals.totalNet.toFixed(1)}
                      </td>
                      <td className={totalFinancialVariance >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                        {totalFinancialVariance >= 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFinancialVariance)}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* 5. Alertas de Estoque */}
      <Row className="mb-4">
        <Col lg={12}>
          <Card border={estoqueData.filter(item => item.status === 'critico' || item.status === 'baixo').length > 0 ? 'danger' : 'success'}>
            <Card.Header className={estoqueData.filter(item => item.status === 'critico' || item.status === 'baixo').length > 0 ? 'bg-danger text-white' : 'bg-success text-white'}>
              <strong>Alertas de Estoque</strong> <small className="ms-2">✓ Dados Reais</small>
            </Card.Header>
            <Card.Body>
              {estoqueData.filter(item => item.status === 'critico' || item.status === 'baixo').length === 0 ? (
                <p className="mb-0 text-success">
                  <strong>✓ Não há alertas de estoque no momento.</strong> Todos os tanques estão com ocupação adequada (acima de 70%).
                </p>
              ) : (
                <ul className="mb-0">
                  {estoqueData
                    .filter(item => item.status === 'critico' || item.status === 'baixo')
                    .map(item => (
                      <li key={item.id} className={item.status === 'critico' ? 'text-danger fw-bold' : 'text-warning fw-bold'}>
                        <strong>{item.produto}:</strong> {item.percentualOcupacao.toFixed(0)}% de ocupação
                        {item.status === 'critico' && ' - URGENTE: Compra necessária imediatamente!'}
                        {item.status === 'baixo' && ' - Programar compra nos próximos dias.'}
                      </li>
                    ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div style={{ paddingBottom: '2rem' }} />
    </div>
  )
}

export default Estoque
