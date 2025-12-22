import { useState, useEffect } from 'react'
import { Row, Col, Card, Form, Table, Badge, Spinner, Alert, Button, Dropdown } from 'react-bootstrap'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchComprasDashboard, sortProductsByStandardOrder, normalizeProductName } from '../../services/dashboardApi'
import MockDataBadge, { MockDataCard } from '../MockDataBadge'

const Compras = () => {
  const [selectedProducts, setSelectedProducts] = useState([]) // Empty array = all products
  const [selectedFornecedor, setSelectedFornecedor] = useState('todos')
  // Initialize dates from localStorage or use defaults
  const [startDate, setStartDate] = useState(() => {
    return localStorage.getItem('compras_startDate') || '2025-09-01'
  })
  const [endDate, setEndDate] = useState(() => {
    return localStorage.getItem('compras_endDate') || '2025-12-03'
  })
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [selectedChartFuels, setSelectedChartFuels] = useState({
  gasolinaComum: true,
  gasolinaAditivada: true,
  etanol: true,
  dieselS10: true,
  dieselS500: true,
  custoMedioGeral: true
  })

  // API data state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)

  // Fetch data from API
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchComprasDashboard(startDate, endDate)
      setDashboardData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial data load only
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build product list from API data
  const availableProducts = dashboardData?.products?.map(p => ({
    code: p.product_code,
    name: p.product_name
  })) || []

  // Handle product selection
  const handleProductToggle = (productCode) => {
    setSelectedProducts(prev => {
      if (prev.includes(productCode)) {
        return prev.filter(code => code !== productCode)
      } else {
        return [...prev, productCode]
      }
    })
  }

  const handleSelectAllProducts = () => {
    if (selectedProducts.length === availableProducts.length) {
      setSelectedProducts([]) // Deselect all
    } else {
      setSelectedProducts(availableProducts.map(p => p.code)) // Select all
    }
  }

  const getComprasStatusBadge = (variacaoCusto) => {
    // Zero or null variation means stable prices (single purchase or same price) - show Otimo
    if (variacaoCusto == null || variacaoCusto <= 2) return <Badge bg="success">Otimo</Badge>
    if (variacaoCusto <= 3.5) return <Badge bg="info">Bom</Badge>
    if (variacaoCusto <= 5) return <Badge bg="warning" text="dark">Alerta</Badge>
    return <Badge bg="danger">Critico</Badge>
  }

  // Mock freight data - NOT IN DATABASE
  const freteData = [
    { nf: 'NF-1001', data: '13/01/2025', volume: 50000, frete: 2500, fretePorLitro: 0.05, fornecedor: 'Distribuidora Petróleo Ltda' },
    { nf: 'NF-1002', data: '15/01/2025', volume: 30000, frete: 1800, fretePorLitro: 0.06, fornecedor: 'Distribuidora Petróleo Ltda' },
    { nf: 'NF-1003', data: '17/01/2025', volume: 38000, frete: 2280, fretePorLitro: 0.06, fornecedor: 'Combustíveis Nacional S/A' },
    { nf: 'NF-1004', data: '19/01/2025', volume: 22000, frete: 1540, fretePorLitro: 0.07, fornecedor: 'Energia Fuel Distribuidora' }
  ]

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="mt-3">Carregando dados de compras...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Erro ao carregar dados</Alert.Heading>
        <p>{error}</p>
      </Alert>
    )
  }

  // No data state
  if (!dashboardData) {
    return (
      <Alert variant="info">
        <Alert.Heading>Sem dados</Alert.Heading>
        <p>Nenhum dado de compras disponível para o período selecionado.</p>
      </Alert>
    )
  }

  // Filter data by selected products
  const filteredProducts = selectedProducts.length > 0
    ? dashboardData.products?.filter(p => selectedProducts.includes(p.product_code))
    : dashboardData.products

  // Calculate filtered metrics
  const filteredTotalVolume = filteredProducts?.reduce((sum, p) => sum + parseFloat(p.volume || 0), 0) || 0
  const filteredTotalCost = filteredProducts?.reduce((sum, p) => sum + parseFloat(p.total_cost || 0), 0) || 0
  const filteredAvgCost = filteredTotalVolume > 0 ? filteredTotalCost / filteredTotalVolume : 0

  // Note: Evolution data shows overall trends regardless of product selection
  // Backend returns daily avg_cost across all products, not per-product daily data
  // To filter evolution by product would require backend changes to include per-product daily costs
  const displayEvolution = dashboardData.evolution || []

  // Calculate metrics from filtered data
  const metrics = {
    volumeTotal: `${filteredTotalVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`,
    custoTotal: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(filteredTotalCost),
    custoMedio: `R$ ${filteredAvgCost.toFixed(2)}/L`,
    fornecedores: dashboardData.suppliers?.length || 0
  }

  // Use filtered data for all visualizations
  const displayProducts = filteredProducts || []

  // Original metrics calculation (now replaced above)
  const _unused_metrics = {
    volumeTotal: `${parseFloat(dashboardData.total_volume || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`,
    custoTotal: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseFloat(dashboardData.total_cost || 0)),
    custoMedio: `R$ ${parseFloat(dashboardData.avg_cost || 0).toFixed(2)}/L`,
    fornecedores: dashboardData.suppliers?.length || 0
  }

  // Prepare data for charts - products (always show all products for context)
  const volumePorProduto = dashboardData.products?.map((product, index) => {
    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FFA500', '#FF8042', '#8884D8']
    return {
      produto: normalizeProductName(product.product_name),
      volume: parseFloat(product.volume_purchased || product.volume || 0),
      color: colors[index % colors.length]
    }
  }) || []

  // Custom Tooltip to show day of week (same as Vendas tab)
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Get the full date from the first payload item
      const fullDate = payload[0]?.payload?.fullDate

      // Calculate day of week
      let dayOfWeek = ''
      if (fullDate) {
        const date = new Date(fullDate + 'T00:00:00') // Add time to avoid timezone issues
        const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        dayOfWeek = daysOfWeek[date.getDay()]
      }

      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '8px' }}>
            {dayOfWeek && `${dayOfWeek}, `}{label}
          </p>
          {payload.filter(entry => entry.value != null).map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {entry.name}: R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L
            </p>
          ))}
        </div>
      )
    }
    return null
  }

// Prepare evolution data for line chart with per-product costs
// Forward-fill prices: carry the last purchase price until a new purchase is made
// Calculate Média Geral as average of all known fuel prices (not from backend)
const custoMedioData = (() => {
  if (!displayEvolution || displayEvolution.length === 0) return []
  
  // Track last known price for each product
  const lastKnownPrice = {
    gasolinaComum: null,
    gasolinaAditivada: null,
    etanol: null,
    dieselS10: null,
    dieselS500: null
  }
  
  return displayEvolution.map(day => {
    const [year, month, dayNum] = day.date.split('-')
    const formattedDate = `${dayNum}/${month}`
    
    // Update last known price only when there's a new purchase (non-null value)
    if (day.GC != null) lastKnownPrice.gasolinaComum = parseFloat(day.GC)
    if (day.GA != null) lastKnownPrice.gasolinaAditivada = parseFloat(day.GA)
    if (day.ET != null) lastKnownPrice.etanol = parseFloat(day.ET)
    if (day.DS10 != null) lastKnownPrice.dieselS10 = parseFloat(day.DS10)
    if (day.DS500 != null) lastKnownPrice.dieselS500 = parseFloat(day.DS500)
    
    // Calculate Média Geral as average of all known fuel prices (excluding Etanol for fuel average)
    const fuelPrices = [
      lastKnownPrice.gasolinaComum,
      lastKnownPrice.gasolinaAditivada,
      lastKnownPrice.dieselS10,
      lastKnownPrice.dieselS500
    ].filter(price => price != null)
    
    const custoMedioGeral = fuelPrices.length > 0 
      ? fuelPrices.reduce((sum, price) => sum + price, 0) / fuelPrices.length 
      : null
    
    return {
      dia: formattedDate,
      fullDate: day.date,
      gasolinaComum: lastKnownPrice.gasolinaComum,
      gasolinaAditivada: lastKnownPrice.gasolinaAditivada,
      etanol: lastKnownPrice.etanol,
      dieselS10: lastKnownPrice.dieselS10,
      dieselS500: lastKnownPrice.dieselS500,
      custoMedioGeral
    }
  })
})()

  // All fuel products that should always appear when "todos os produtos" is selected
  // Note: EA (Etanol Aditivado) excluded - this company doesn't sell it
  const allFuelProducts = [
    { product_code: 'GC', product_name: 'GASOLINA COMUM' },
    { product_code: 'GA', product_name: 'GASOLINA ADITIVADA' },
    { product_code: 'ET', product_name: 'ETANOL' },
    { product_code: 'DS10', product_name: 'DIESEL S10' },
    { product_code: 'DS500', product_name: 'DIESEL S500' }
  ]

  // Prepare table data with cost variation (using filtered data)
  // When no filter is applied (todos os produtos), show all fuels including those with 0 purchases
  const comprasPorProduto = (() => {
    const productsFromApi = displayProducts || []

    // If no product filter is applied, merge with all fuel products to show zeros
    if (selectedProducts.length === 0) {
      const apiProductCodes = new Set(productsFromApi.map(p => p.product_code))

      // Add missing products with zero values
      const missingProducts = allFuelProducts
        .filter(fp => !apiProductCodes.has(fp.product_code))
        .map(fp => ({
          product_code: fp.product_code,
          product_name: fp.product_name,
          volume_purchased: 0,
          volume: 0,
          avg_cost: 0,
          total_cost: 0,
          cost_std_dev: 0
        }))

      return [...productsFromApi, ...missingProducts].map((product, index) => {
        const volumeComprado = parseFloat(product.volume_purchased || product.volume || 0)
        const custoMedio = parseFloat(product.avg_cost || 0)
        const custoTotal = parseFloat(product.total_cost || 0)
        const costStdDev = parseFloat(product.cost_std_dev || 0)

        // Calculate cost variation as percentage (coefficient of variation)
        // If no purchases (volume = 0), variation is null (will show Otimo)
        const variacaoCusto = volumeComprado > 0 && custoMedio > 0 ? (costStdDev / custoMedio) * 100 : null

        return {
            id: index + 1,
            produto: normalizeProductName(product.product_name),
            productCode: product.product_code,
            volumeComprado: volumeComprado,
            custoMedio: custoMedio,
            custoTotal: custoTotal,
            variacaoCusto: variacaoCusto,
            fornecedor: product.main_supplier || 'N/A',
            hasPurchases: volumeComprado > 0
          }
      })
    }

    // When filter is applied, only show filtered products
    return productsFromApi.map((product, index) => {
      const volumeComprado = parseFloat(product.volume_purchased || product.volume || 0)
      const custoMedio = parseFloat(product.avg_cost || 0)
      const custoTotal = parseFloat(product.total_cost || 0)
      const costStdDev = parseFloat(product.cost_std_dev || 0)

      const variacaoCusto = custoMedio > 0 ? (costStdDev / custoMedio) * 100 : null

      return {
        id: index + 1,
        produto: normalizeProductName(product.product_name),
        productCode: product.product_code,
        volumeComprado: volumeComprado,
        custoMedio: custoMedio,
        custoTotal: custoTotal,
        variacaoCusto: variacaoCusto,
        fornecedor: product.main_supplier || 'N/A',
        hasPurchases: volumeComprado > 0
      }
    })
  })()

  // Sort comprasPorProduto by standard order
  const sortedComprasPorProduto = sortProductsByStandardOrder(comprasPorProduto, 'productCode')

  // Prepare suppliers data from API
  const fornecedoresData = dashboardData.suppliers?.map((supplier, index) => ({
    id: index + 1,
    razaoSocial: supplier.supplier_name,
    cnpj: supplier.cnpj || 'N/A',
    volume: parseFloat(supplier.volume_purchased || supplier.volume || 0),
    custoMedio: parseFloat(supplier.avg_cost || 0),
    custoTotal: parseFloat(supplier.total_cost || 0)
  })) || []

  // Create supplier dropdown options from API data
  const fornecedores = [
    { value: 'todos', label: 'Todos os Fornecedores' },
    ...(dashboardData.suppliers?.map(s => ({
      value: s.supplier_name.toLowerCase().replace(/ /g, '-'),
      label: s.supplier_name
    })) || [])
  ]

  return (
    <div>
      {/* Header with Filters */}
      <div className="mb-4">
        <Row className="align-items-center">
          <Col md={3}>
            <h2>Compras</h2>
          </Col>
          <Col md={9}>
            {/* First Row: Dates and Update Button */}
            <Row className="align-items-center mb-2">
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
                        localStorage.setItem('compras_startDate', newDate)
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
                        localStorage.setItem('compras_endDate', newDate)
                      }
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-end">
                <Button
                  variant="primary"
                  className="w-100"
                  onClick={fetchData}
                  disabled={loading}
                >
                  {loading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </Col>
            </Row>
            {/* Second Row: Product and Supplier Filters */}
            <Row className="align-items-center">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small mb-1">Produtos</Form.Label>
                  <Dropdown show={showProductDropdown} onToggle={(isOpen) => setShowProductDropdown(isOpen)}>
                    <Dropdown.Toggle variant="outline-secondary" className="w-100 text-start">
                      {selectedProducts.length === 0 ? 'Todos os Produtos' : `${selectedProducts.length} produto(s) selecionado(s)`}
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="w-100" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Form.Check
                          type="checkbox"
                          label={<strong>Selecionar Todos</strong>}
                          checked={selectedProducts.length === availableProducts.length && availableProducts.length > 0}
                          onChange={handleSelectAllProducts}
                          className="mb-2"
                        />
                        <hr className="my-2" />
                        {availableProducts.map(product => (
                          <Form.Check
                            key={product.code}
                            type="checkbox"
                            label={product.name}
                            checked={selectedProducts.includes(product.code)}
                            onChange={() => handleProductToggle(product.code)}
                            className="mb-1"
                          />
                        ))}
                        {availableProducts.length === 0 && (
                          <small className="text-muted">Nenhum produto disponível</small>
                        )}
                      </div>
                    </Dropdown.Menu>
                  </Dropdown>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small mb-1">Fornecedor</Form.Label>
                  <Form.Select
                    value={selectedFornecedor}
                    onChange={(e) => setSelectedFornecedor(e.target.value)}
                  >
                    {fornecedores.map(fornecedor => (
                      <option key={fornecedor.value} value={fornecedor.value}>
                        {fornecedor.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>

      {/* Diagnostic Table - Purchase Performance per Product */}
      <Row className="mb-4">
        <Col lg={12}>
          <Card>
            <Card.Body>
              <Card.Title>
                Análise de Compras por Produto
                <small className="text-success ms-2">✓ Dados Reais</small>
              </Card.Title>
              <p className="small text-muted mb-3">
                Variação de Custo calculada como coeficiente de variação (desvio padrão / média × 100%)
              </p>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Volume Comprado (L)</th>
                    <th>Custo Médio (R$/L)</th>
                    <th>Custo Total</th>
                    <th>Variação de Custo (%)</th>
                    <th>Fornecedor Principal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComprasPorProduto.map(item => {
                    const noPurchases = !item.hasPurchases
                    return (
                      <tr key={item.id} className={noPurchases ? 'text-muted' : ''}>
                        <td><strong>{item.produto}</strong></td>
                        <td>{noPurchases ? '-' : `${Math.round(item.volumeComprado).toLocaleString('pt-BR')} L`}</td>
                        <td>{noPurchases ? '-' : `R$ ${item.custoMedio.toFixed(2)}/L`}</td>
                        <td>
                          {noPurchases ? '-' : new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(item.custoTotal)}
                        </td>
                        <td>
                          {noPurchases ? (
                            <span className="text-muted">-</span>
                          ) : (
                            <span className={
                              item.variacaoCusto > 10 ? 'text-danger' :
                              item.variacaoCusto > 5 ? 'text-warning' :
                              'text-success'
                            }>
                              {item.variacaoCusto != null ? `${item.variacaoCusto.toFixed(2)}%` : '0.00%'}
                            </span>
                          )}
                        </td>
                        <td>
							<span className={item.fornecedor !== 'N/A' && item.fornecedor !== 'Unknown' ? 'text-success' : 'text-muted'}>
							  {item.fornecedor}
							</span>
						</td>
                        <td>{noPurchases ? <Badge bg="secondary">Sem Compras</Badge> : getComprasStatusBadge(item.variacaoCusto)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Metrics Cards - Real Data */}
      <Row className="mb-4">
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Volume Total</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">{metrics.volumeTotal}</Card.Text>
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Custo Total (NF)</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">{metrics.custoTotal}</Card.Text>
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Custo Médio Ponderado</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">{metrics.custoMedio}</Card.Text>
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Fornecedores Ativos</Card.Title>
              <Card.Text className="fs-4 fw-bold text-success">{metrics.fornecedores}</Card.Text>
              <small className="text-success">✓ Dados Reais</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts - Real Data */}
<Row className="mb-4">
  <Col lg={12} className="mb-3">
    <Card className="border-success">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <Card.Title className="mb-0">
              Evolutivo de Preço de Compra (R$/L)
              <small className="text-success ms-2">✓ Dados Reais</small>
            </Card.Title>
            <p className="text-muted small mb-0">Custo por litro de cada produto e média geral ao longo do tempo</p>
          </div>
          <div className="d-flex flex-wrap gap-3">
            <Form.Check
              inline
              type="checkbox"
              id="chart-filter-gc"
              label={<span style={{ color: '#0088FE' }}>Gasolina Comum</span>}
              checked={selectedChartFuels.gasolinaComum}
              onChange={(e) => setSelectedChartFuels({ ...selectedChartFuels, gasolinaComum: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="chart-filter-ga"
              label={<span style={{ color: '#00C49F' }}>Gasolina Aditivada</span>}
              checked={selectedChartFuels.gasolinaAditivada}
              onChange={(e) => setSelectedChartFuels({ ...selectedChartFuels, gasolinaAditivada: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="chart-filter-et"
              label={<span style={{ color: '#FFBB28' }}>Etanol</span>}
              checked={selectedChartFuels.etanol}
              onChange={(e) => setSelectedChartFuels({ ...selectedChartFuels, etanol: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="chart-filter-ds10"
              label={<span style={{ color: '#FF8042' }}>Diesel S10</span>}
              checked={selectedChartFuels.dieselS10}
              onChange={(e) => setSelectedChartFuels({ ...selectedChartFuels, dieselS10: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="chart-filter-ds500"
              label={<span style={{ color: '#8884D8' }}>Diesel S500</span>}
              checked={selectedChartFuels.dieselS500}
              onChange={(e) => setSelectedChartFuels({ ...selectedChartFuels, dieselS500: e.target.checked })}
            />
            <Form.Check
              inline
              type="checkbox"
              id="chart-filter-media"
              label={<span style={{ color: '#000000', fontWeight: 'bold' }}>Média Geral</span>}
              checked={selectedChartFuels.custoMedioGeral}
              onChange={(e) => setSelectedChartFuels({ ...selectedChartFuels, custoMedioGeral: e.target.checked })}
            />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={custoMedioData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedChartFuels.gasolinaComum && <Line type="stepAfter" dataKey="gasolinaComum" stroke="#0088FE" strokeWidth={2} name="Gasolina Comum (R$/L)" dot={false} connectNulls />}
            {selectedChartFuels.gasolinaAditivada && <Line type="stepAfter" dataKey="gasolinaAditivada" stroke="#00C49F" strokeWidth={2} name="Gasolina Aditivada (R$/L)" dot={false} connectNulls />}
            {selectedChartFuels.etanol && <Line type="stepAfter" dataKey="etanol" stroke="#FFBB28" strokeWidth={2} name="Etanol (R$/L)" dot={false} connectNulls />}
            {selectedChartFuels.dieselS10 && <Line type="stepAfter" dataKey="dieselS10" stroke="#FF8042" strokeWidth={2} name="Diesel S10 (R$/L)" dot={false} connectNulls />}
            {selectedChartFuels.dieselS500 && <Line type="stepAfter" dataKey="dieselS500" stroke="#8884D8" strokeWidth={2} name="Diesel S500 (R$/L)" dot={false} connectNulls />}
            {selectedChartFuels.custoMedioGeral && <Line type="stepAfter" dataKey="custoMedioGeral" stroke="#000000" strokeWidth={3} name="Média Geral (R$/L)" dot={false} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  </Col>
</Row>

      <Row className="mb-4">
  <Col lg={5} className="mb-3">
    <Card className="h-100 border-success">
      <Card.Body>
        <Card.Title>
          Participação por Produto (%)
          <small className="text-success ms-2">✓ Dados Reais</small>
        </Card.Title>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={volumePorProduto}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => {
                const total = volumePorProduto.reduce((sum, item) => sum + item.volume, 0)
                const percent = ((entry.volume / total) * 100).toFixed(1)
                return `${percent}% - ${entry.produto}`
              }}
              outerRadius={100}
              fill="#8884d8"
              dataKey="volume"
              nameKey="produto"
            >
              {volumePorProduto.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => {
                const total = volumePorProduto.reduce((sum, item) => sum + item.volume, 0)
                const percent = ((value / total) * 100).toFixed(1)
                return `${Math.round(value).toLocaleString('pt-BR')} L (${percent}%)`
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  </Col>
  <Col lg={7} className="mb-3">
    <Card className="h-100 border-success">
      <Card.Body>
        <Card.Title>
          Análise por Fornecedor
          <small className="text-success ms-2">✓ Dados Reais</small>
        </Card.Title>
        <p className="small text-muted mb-3">
          CNPJ extraído automaticamente dos dados de fornecedores
        </p>
        <Table responsive hover size="sm">
          <thead>
            <tr>
              <th>Razão Social</th>
              <th>CNPJ</th>
              <th>Volume Total (L)</th>
              <th>Custo Médio (R$/L)</th>
              <th>Custo Total</th>
            </tr>
          </thead>
          <tbody>
            {fornecedoresData.map(fornecedor => (
              <tr key={fornecedor.id}>
                <td><strong>{fornecedor.razaoSocial}</strong></td>
                <td>{fornecedor.cnpj}</td>
                <td>{Math.round(fornecedor.volume).toLocaleString('pt-BR')} L</td>
                <td>R$ {fornecedor.custoMedio.toFixed(2)}/L</td>
                <td>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(fornecedor.custoTotal)}
                </td>
              </tr>
            ))}
            <tr className="table-secondary">
              <td colSpan="2"><strong>Total</strong></td>
              <td>
                <strong>
                  {Math.round(fornecedoresData.reduce((sum, f) => sum + f.volume, 0)).toLocaleString('pt-BR')} L
                </strong>
              </td>
              <td>-</td>
              <td>
                <strong>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(fornecedoresData.reduce((sum, f) => sum + f.custoTotal, 0))}
                </strong>
              </td>
            </tr>
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  </Col>
</Row>

      {/* Freight Costs Table - Mock Data */}
      <Row className="mb-4">
        <Col lg={12}>
          <MockDataCard title="Custo do Frete por Nota Fiscal">
            <p className="small text-muted mb-3">
              Estes dados são simulados - não há campo de frete na tabela de compras.
              Considere adicionar este campo para tracking detalhado de custos logísticos.
            </p>
            <Table responsive hover>
              <thead>
                <tr>
                  <th>NF</th>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th>Volume (L)</th>
                  <th>Frete Total</th>
                  <th>Frete por Litro</th>
                </tr>
              </thead>
              <tbody>
                {freteData.map(item => (
                  <tr key={item.nf}>
                    <td><strong>{item.nf}</strong></td>
                    <td>{item.data}</td>
                    <td>{item.fornecedor}</td>
                    <td>{item.volume.toLocaleString('pt-BR')} L</td>
                    <td>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(item.frete)}
                    </td>
                    <td>R$ {item.fretePorLitro.toFixed(2)}/L</td>
                  </tr>
                ))}
                <tr className="table-secondary">
                  <td colSpan="3"><strong>Total</strong></td>
                  <td>
                    <strong>
                      {freteData.reduce((sum, f) => sum + f.volume, 0).toLocaleString('pt-BR')} L
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(freteData.reduce((sum, f) => sum + f.frete, 0))}
                    </strong>
                  </td>
                  <td>-</td>
                </tr>
              </tbody>
            </Table>
          </MockDataCard>
        </Col>
      </Row>

      {/* Legend */}
      <Card bg="light" className="mt-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>✓ Dados Reais (Fonte: API)</h6>
              <ul className="small mb-0">
                <li>Volume Total e Custo Total</li>
                <li>Custo Médio Ponderado</li>
                <li>Volumes e Custos por Produto</li>
                <li>Análise por Fornecedor (com CNPJ)</li>
                <li>Evolução de Custo Médio Diário</li>
              </ul>
            </Col>
            <Col md={6}>
              <h6>
                <MockDataBadge /> Dados Simulados (Não no BD)
              </h6>
              <ul className="small mb-0">
                <li>Fornecedor Principal por Produto</li>
                <li>Custos de Frete por NF</li>
              </ul>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Compras
