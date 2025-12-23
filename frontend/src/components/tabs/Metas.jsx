import { useState, useEffect, useCallback, memo } from 'react'
import { Row, Col, Card, Badge, Form, Button, Table, Alert, Spinner } from 'react-bootstrap'
import { sortProductsByStandardOrder, PRODUCT_ORDER, PRODUCT_NAMES } from '../../services/dashboardApi'
import { kpisService } from '../../services/dataService'
import { useAuth } from '../../App'

// Input cell component
const InputCell = memo(({ kpiType, productCode, unit, value, onChange, placeholder, existingKpi }) => {
  return (
    <div className="d-flex align-items-center gap-1">
      <Form.Control
        type="number"
        size="sm"
        min="0"
        value={value}
        onChange={(e) => {
          const newValue = e.target.value
          // Prevent negative values
          if (newValue === '' || parseFloat(newValue) >= 0) {
            onChange(kpiType, productCode, newValue)
          }
        }}
        onKeyDown={(e) => {
          // Block minus sign and 'e' for scientific notation
          if (e.key === '-' || e.key === 'e' || e.key === 'E') {
            e.preventDefault()
          }
        }}
        onPaste={(e) => {
          // Check pasted content for negative values
          const pastedText = e.clipboardData.getData('text')
          if (pastedText.includes('-')) {
            e.preventDefault()
          }
        }}
        placeholder={placeholder}
        style={{ width: '120px' }}
      />
      <span className="text-muted small">
        {unit === 'liters' ? 'L' : unit === 'percent' ? '%' : 'R$'}
      </span>
      {existingKpi && (
        <Badge bg="success" className="ms-1" title="Meta salva">
          <small>OK</small>
        </Badge>
      )}
    </div>
  )
})

const Metas = () => {
  const { companyId } = useAuth()
  const [kpis, setKpis] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Month/Year selection
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())

  // Calculate start/end of selected month
  const getMonthDates = (year, month) => {
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endOfMonth = new Date(year, month + 1, 0)
    const endOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`
    return { startOfMonth, endOfMonthStr }
  }

  const { startOfMonth, endOfMonthStr } = getMonthDates(selectedYear, selectedMonth)

  // KPI types for configuration
  const kpiTypes = [
    { value: 'sales_volume', label: 'Volume Mensal', unit: 'liters', description: 'Meta de volume de vendas em litros' },
    { value: 'margin', label: 'Margem Bruta', unit: 'percent', description: 'Meta de margem bruta em %' },
    { value: 'cost', label: 'Mix de Aditivados', unit: 'percent', description: 'Meta de % de vendas de aditivados' },
    { value: 'revenue', label: 'Lucro Bruto', unit: 'reais', description: 'Meta de lucro bruto em R$' }
  ]

  // Local state for editing values
  const [editValues, setEditValues] = useState({})
  const [modifiedKeys, setModifiedKeys] = useState(new Set())

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                     'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  // Generate year options (current year - 1 to current year + 2)
  const yearOptions = []
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    yearOptions.push(y)
  }

  // Fetch products - use standard product list
  const fetchProducts = async () => {
    try {
      const productList = PRODUCT_ORDER.map(code => ({
        product_code: code,
        product_name: PRODUCT_NAMES[code]
      }))
      setProducts(productList)
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  // Fetch KPIs from Supabase filtered by selected month
  const fetchKpis = async () => {
    try {
      setLoading(true)
      setError(null)

      const allKpis = await kpisService.getKpis('active')
      
      // Filter KPIs by selected month's start_date
      const filteredKpis = (allKpis || []).filter(kpi => {
        if (!kpi.start_date) return false
        return kpi.start_date === startOfMonth
      })

      setKpis(filteredKpis)

      // Initialize edit values from existing KPIs for this month
      const values = {}
      filteredKpis.forEach(kpi => {
        const key = `${kpi.kpi_type}_${kpi.product_code || 'total'}`
        values[key] = kpi.target_value
      })
      setEditValues(values)
      setModifiedKeys(new Set())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchProducts()
  }, [])

  // Reload KPIs when month/year changes
  useEffect(() => {
    fetchKpis()
  }, [selectedYear, selectedMonth])

  // Get KPI key for a cell
  const getKpiKey = (kpiType, productCode) => `${kpiType}_${productCode || 'total'}`

  // Get existing KPI for a cell
  const getExistingKpi = (kpiType, productCode) => {
    return kpis.find(k => k.kpi_type === kpiType && (k.product_code || 'total') === (productCode || 'total'))
  }

  // Handle value change
  const handleValueChange = useCallback((kpiType, productCode, value) => {
    const key = `${kpiType}_${productCode || 'total'}`
    setEditValues(prev => ({ ...prev, [key]: value }))
    setModifiedKeys(prev => new Set([...prev, key]))
  }, [])

  // Save a single KPI
  const saveKpi = async (kpiType, productCode, targetValue) => {
    if (!targetValue || targetValue === '' || parseFloat(targetValue) === 0) {
      return null
    }

    const existingKpi = getExistingKpi(kpiType, productCode)
    const kpiTypeInfo = kpiTypes.find(t => t.value === kpiType)
    const product = products.find(p => p.product_code === productCode)

    const kpiName = productCode && productCode !== 'total'
      ? `${kpiTypeInfo.label} - ${product?.product_name || productCode} (${monthNames[selectedMonth]}/${selectedYear})`
      : `${kpiTypeInfo.label} - Total (${monthNames[selectedMonth]}/${selectedYear})`

    const payload = {
      kpi_name: kpiName,
      kpi_type: kpiType,
      product_code: productCode === 'total' ? null : productCode,
      product_name: product?.product_name || null,
      target_value: parseFloat(targetValue),
      current_value: existingKpi?.current_value || 0,
      unit: kpiTypeInfo.unit,
      period_type: 'monthly',
      start_date: startOfMonth,
      end_date: endOfMonthStr,
      status: 'active',
      description: kpiTypeInfo.description
    }

    if (existingKpi) {
      return await kpisService.updateKpi(existingKpi.id, payload)
    } else {
      // Use companyId from auth context
      return await kpisService.createKpi(payload, companyId)
    }
  }

// Save all modified KPIs
  const handleSaveAll = async () => {
    if (modifiedKeys.size === 0) {
      setError('Nenhuma meta foi modificada')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

try {
      // Use companyId from auth context
      if (!companyId) {
        throw new Error('Session expired. Please login again.')
      }

      const savePromises = []

      for (const key of modifiedKeys) {
        const value = editValues[key]
        if (!value || value === '' || parseFloat(value) === 0) continue

        let kpiType, productCode
        if (key.startsWith('sales_volume_')) {
          kpiType = 'sales_volume'
          productCode = key.replace('sales_volume_', '')
        } else if (key.startsWith('margin_')) {
          kpiType = 'margin'
          productCode = key.replace('margin_', '')
        } else if (key.startsWith('cost_')) {
          kpiType = 'cost'
          productCode = key.replace('cost_', '')
        } else if (key.startsWith('revenue_')) {
          kpiType = 'revenue'
          productCode = key.replace('revenue_', '')
        } else {
          continue
        }

        const actualProductCode = productCode === 'total' ? null : productCode
        
        // Wrap each save in its own try-catch
        const saveWithCatch = async () => {
          try {
            return await saveKpi(kpiType, actualProductCode, value)
          } catch (err) {
            console.error(`Error saving ${kpiType} for ${productCode}:`, err)
            throw err
          }
        }
        
        savePromises.push(saveWithCatch())
      }

      if (savePromises.length === 0) {
        setError('Nenhuma meta válida para salvar')
        setSaving(false)
        return
      }

      // Use Promise.allSettled to handle partial failures
      const results = await Promise.allSettled(savePromises)
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason?.message || 'Unknown error')
        setError(`${failed} meta(s) falharam: ${errors.join(', ')}`)
      }
      
      if (succeeded > 0) {
        setSuccess(`${succeeded} meta(s) salva(s) com sucesso!`)
        await fetchKpis()
      }
    } catch (err) {
      console.error('Save error:', err)
      setError(err.message || 'Erro desconhecido ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // Copy from another month
  const handleCopyFromMonth = async (sourceYear, sourceMonth) => {
    try {
      setLoading(true)
      const allKpis = await kpisService.getKpis('active')
      const { startOfMonth: sourceStart } = getMonthDates(sourceYear, sourceMonth)
      
      const sourceKpis = (allKpis || []).filter(kpi => kpi.start_date === sourceStart)
      
      if (sourceKpis.length === 0) {
        setError(`Nenhuma meta encontrada em ${monthNames[sourceMonth]}/${sourceYear}`)
        return
      }

      // Copy values to edit state
      const values = { ...editValues }
      const newModified = new Set(modifiedKeys)
      
      sourceKpis.forEach(kpi => {
        const key = `${kpi.kpi_type}_${kpi.product_code || 'total'}`
        values[key] = kpi.target_value
        newModified.add(key)
      })
      
      setEditValues(values)
      setModifiedKeys(newModified)
      setSuccess(`${sourceKpis.length} meta(s) copiada(s) de ${monthNames[sourceMonth]}/${sourceYear}. Clique em Salvar para confirmar.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Format placeholder
  const getPlaceholder = (kpiType) => {
    const type = kpiTypes.find(t => t.value === kpiType)
    if (type?.unit === 'liters') return 'Ex: 100000'
    if (type?.unit === 'percent') return 'Ex: 15'
    if (type?.unit === 'reais') return 'Ex: 50000'
    return ''
  }

  // Loading state
  if (loading && kpis.length === 0 && Object.keys(editValues).length === 0) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="mt-3">Carregando metas...</p>
      </div>
    )
  }

  const renderInputCell = (kpiType, productCode, unit) => {
    const key = getKpiKey(kpiType, productCode)
    const value = editValues[key] || ''
    const existingKpi = getExistingKpi(kpiType, productCode)
    const placeholder = getPlaceholder(kpiType)

    return (
      <InputCell
        key={key}
        kpiType={kpiType}
        productCode={productCode}
        unit={unit}
        value={value}
        onChange={handleValueChange}
        placeholder={placeholder}
        existingKpi={existingKpi}
      />
    )
  }

  // Previous month for copy feature
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear

  return (
    <div>
      {/* Header with Month/Year Selector */}
      <Row className="mb-4 align-items-center">
        <Col md={6}>
          <h2>Configurar Metas</h2>
          <p className="text-muted mb-0">
            Configure as metas mensais por produto. Deixe em branco para ignorar.
          </p>
        </Col>
        <Col md={6}>
          <Row className="align-items-center justify-content-end">
            <Col xs="auto">
              <Form.Group className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 fw-bold">Mês:</Form.Label>
                <Form.Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  style={{ width: '140px' }}
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs="auto">
              <Form.Group className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 fw-bold">Ano:</Form.Label>
                <Form.Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  style={{ width: '100px' }}
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Action Buttons Row */}
      <Row className="mb-4">
        <Col className="d-flex gap-2 justify-content-end">
          <Button
            variant="outline-secondary"
            onClick={() => handleCopyFromMonth(prevYear, prevMonth)}
            disabled={loading}
          >
            Copiar de {monthNames[prevMonth]}/{prevYear}
          </Button>
          <Button
            variant="success"
            size="lg"
            onClick={handleSaveAll}
            disabled={saving || modifiedKeys.size === 0}
          >
            {saving ? 'Salvando...' : modifiedKeys.size > 0 ? `Salvar ${modifiedKeys.size} Meta(s)` : 'Nenhuma Alteração'}
          </Button>
        </Col>
      </Row>

      {/* Current Period Badge */}
      <Row className="mb-3">
        <Col>
          <Badge bg="primary" className="fs-6 p-2">
            Período: {monthNames[selectedMonth]} {selectedYear}
          </Badge>
          {kpis.length > 0 && (
            <Badge bg="success" className="fs-6 p-2 ms-2">
              {kpis.length} meta(s) salva(s) neste mês
            </Badge>
          )}
          {kpis.length === 0 && (
            <Badge bg="warning" text="dark" className="fs-6 p-2 ms-2">
              Nenhuma meta configurada para este mês
            </Badge>
          )}
        </Col>
      </Row>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Row>
        {/* Left Column */}
        <Col lg={6}>
          {/* Volume Mensal Table */}
          <Card className="mb-4">
            <Card.Header className="bg-primary text-white py-2">
              <strong>Volume Mensal (L)</strong>
            </Card.Header>
            <Card.Body className="p-2">
              <Table hover size="sm" className="mb-0">
                <tbody>
                  <tr className="table-light">
                    <td><strong>TOTAL</strong></td>
                    <td>{renderInputCell('sales_volume', 'total', 'liters')}</td>
                  </tr>
                  {products.map(product => (
                    <tr key={product.product_code}>
                      <td>{product.product_name}</td>
                      <td>{renderInputCell('sales_volume', product.product_code, 'liters')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Margem Bruta Table */}
          <Card className="mb-4">
            <Card.Header className="bg-success text-white py-2">
              <strong>Margem Bruta (%)</strong>
            </Card.Header>
            <Card.Body className="p-2">
              <Table hover size="sm" className="mb-0">
                <tbody>
                  <tr className="table-light">
                    <td><strong>TOTAL</strong></td>
                    <td>{renderInputCell('margin', 'total', 'percent')}</td>
                  </tr>
                  {products.map(product => (
                    <tr key={product.product_code}>
                      <td>{product.product_name}</td>
                      <td>{renderInputCell('margin', product.product_code, 'percent')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Column */}
        <Col lg={6}>
          {/* Lucro Bruto Table */}
          <Card className="mb-4">
            <Card.Header className="bg-warning py-2">
              <strong>Lucro Bruto (R$)</strong>
            </Card.Header>
            <Card.Body className="p-2">
              <Table hover size="sm" className="mb-0">
                <tbody>
                  <tr className="table-light">
                    <td><strong>TOTAL</strong></td>
                    <td>{renderInputCell('revenue', 'total', 'reais')}</td>
                  </tr>
                  {products.map(product => (
                    <tr key={product.product_code}>
                      <td>{product.product_name}</td>
                      <td>{renderInputCell('revenue', product.product_code, 'reais')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Mix de Aditivados Table */}
          <Card className="mb-4">
            <Card.Header className="bg-info text-white py-2">
              <strong>Mix de Aditivados (%)</strong>
            </Card.Header>
            <Card.Body className="p-2">
              <Table hover size="sm" className="mb-0">
                <tbody>
                  <tr>
                    <td><strong>Gasolina Aditivada</strong></td>
                    <td>{renderInputCell('cost', 'gasolina', 'percent')}</td>
                  </tr>
                </tbody>
              </Table>
              <small className="text-muted">% de GA sobre total de gasolinas (GC + GA)</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Summary of saved KPIs for this month */}
      {kpis.length > 0 && (
        <Card className="bg-light">
          <Card.Body>
            <h6>Metas Salvas para {monthNames[selectedMonth]} {selectedYear}: {kpis.length}</h6>
            <div className="d-flex flex-wrap gap-2">
              {kpis.map(kpi => (
                <Badge key={kpi.id} bg="secondary" className="p-2">
                  {kpi.kpi_name}
                </Badge>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}

export default Metas