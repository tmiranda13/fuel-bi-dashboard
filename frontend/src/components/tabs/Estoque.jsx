import { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Badge, Form, Spinner, Alert, Button } from 'react-bootstrap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchEstoqueDashboard, fetchEstoqueEvolution, sortProductsByStandardOrder, normalizeProductName } from '../../services/dashboardApi'

const Estoque = () => {
  const [startDate, setStartDate] = useState(() => {
    return localStorage.getItem('estoque_startDate') || '2025-09-01'
  })
  const [endDate, setEndDate] = useState(() => {
    return localStorage.getItem('estoque_endDate') || '2025-12-03'
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [evolutionData, setEvolutionData] = useState(null)
  const [evolutionLoading, setEvolutionLoading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setEvolutionLoading(true)
      setError(null)
      const [dashboardResult, evolutionResult] = await Promise.all([
        fetchEstoqueDashboard(startDate, endDate),
        fetchEstoqueEvolution(startDate, endDate)
      ])
      setDashboardData(dashboardResult)
      setEvolutionData(evolutionResult)
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
                    onChange={(e) => {
                      const newDate = e.target.value
                      setStartDate(newDate)
                      localStorage.setItem('estoque_startDate', newDate)
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
                    onChange={(e) => {
                      const newDate = e.target.value
                      setEndDate(newDate)
                      localStorage.setItem('estoque_endDate', newDate)
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

      <Row className="mb-4">
        <Col lg={12}>
          <Card className="border-success">
            <Card.Body>
              <Card.Title>Evolução de Estoque <small className="text-success ms-2">✓ Dados Reais</small></Card.Title>
              <p className="small text-muted mb-3">
                Estoque diário calculado a partir das compras (entradas) e vendas (saídas).
                O estoque atual é baseado na medição física dos tanques.
              </p>
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
                    <Line type="monotone" dataKey="gasolinaComum" stroke="#0088FE" strokeWidth={2} name="Gasolina Comum (L)" />
                    <Line type="monotone" dataKey="gasolinaAditivada" stroke="#00C49F" strokeWidth={2} name="Gasolina Aditivada (L)" />
                    <Line type="monotone" dataKey="etanol" stroke="#FFBB28" strokeWidth={2} name="Etanol (L)" />
                    <Line type="monotone" dataKey="dieselS10" stroke="#FF8042" strokeWidth={2} name="Diesel S10 (L)" />
                    <Line type="monotone" dataKey="dieselS500" stroke="#8884D8" strokeWidth={2} name="Diesel S500 (L)" />
                    <Line type="monotone" dataKey="total" stroke="#000000" strokeWidth={3} name="Total (L)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Alert variant="info">Nenhum dado de evolução disponível para o período selecionado.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

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

      <Card bg="light" className="mt-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>✓ Dados Reais (Fonte: API)</h6>
              <ul className="small mb-0">
                <li>Capacidade do Tanque (medição física)</li>
                <li>Estoque Atual (medição física do tanque)</li>
                <li>Ocupação % (Estoque / Capacidade)</li>
                <li>Entrada no Período Selecionado</li>
                <li>Saída no Período Selecionado</li>
                <li>Dias de Autonomia (Estoque / VMD)</li>
                <li>Custo Médio (R$/L)</li>
                <li>Custo do Estoque (Custo Médio × Estoque)</li>
                <li>Status (baseado em ocupação)</li>
                <li>Alertas de Estoque Baixo/Crítico</li>
              </ul>
            </Col>
            <Col md={6}>
              <h6>✓ Evolução de Estoque (Calculado)</h6>
              <ul className="small mb-0">
                <li>Calculado a partir de compras e vendas</li>
                <li>Ponto final = medição física atual dos tanques</li>
                <li>Estoque anterior = atual + vendas - compras</li>
              </ul>
            </Col>
          </Row>
          <hr />
          <Row>
            <Col md={12}>
              <p className="text-muted mb-2"><strong>Legenda de Status (baseado em ocupação do tanque):</strong></p>
              <ul className="mb-0 text-muted">
                <li><strong className="text-danger">Crítico:</strong> Menos de 40% de ocupação - Compra urgente!</li>
                <li><strong className="text-warning">Baixo:</strong> Entre 40% e 70% de ocupação - Programar compra</li>
                <li><strong className="text-success">Adequado:</strong> Acima de 70% de ocupação - Estoque normal</li>
              </ul>
              <p className="text-muted mt-3 mb-0"><strong>Cálculo:</strong> Ocupação = Estoque Atual / Capacidade do Tanque</p>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Estoque