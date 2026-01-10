import { useState, useEffect } from 'react'
import { Row, Col, Card, Badge, Button, Spinner, Alert, ProgressBar, Modal, Form } from 'react-bootstrap'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { usePinnedWidgets, AVAILABLE_WIDGETS } from '../../contexts/PinnedWidgetsContext'
import { fetchVendasDashboard, fetchComprasDashboard, sortProductsByStandardOrder, normalizeProductName } from '../../services/dashboardApi'

const Home = ({ onNavigateToTab }) => {
  const { pinnedWidgets, unpinWidget, availableWidgets, pinWidget, resetToDefault } = usePinnedWidgets()
  const [loading, setLoading] = useState(true)
  const [vendasData, setVendasData] = useState(null)
  const [comprasData, setComprasData] = useState(null)
  const [currentMonthData, setCurrentMonthData] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState(null)

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

        setCurrentMonthData({
          vmd: Math.round(vmd),
          projected,
          daysElapsed,
          daysInMonth,
          monthName: new Date(year, month).toLocaleDateString('pt-BR', { month: 'long' }),
          year
        })

        // Fetch compras data
        const compras = await fetchComprasDashboard(monthStart, todayStr)
        setComprasData(compras)

      } catch (err) {
        console.error('Error fetching home data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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
          <small className="text-muted">Seus widgets favoritos em um só lugar</small>
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
