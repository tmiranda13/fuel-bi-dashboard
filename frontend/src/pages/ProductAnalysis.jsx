/**
 * Product Analysis Page
 * Shows detailed FIFO analysis broken down by product
 */

import { useState, useEffect } from 'react';
import api from '../services/api';

export default function ProductAnalysis() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [sortBy, setSortBy] = useState('product_name');
  const [sortDesc, setSortDesc] = useState(false);

  useEffect(() => {
    loadProductAnalysis();
  }, []);

  const loadProductAnalysis = async () => {
    setLoading(true);
    try {
      const response = await api.fifo.getProductAnalysis();
      setData(response.data);
    } catch (error) {
      console.error('Error loading product analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading product analysis...</div>;
  }

  if (!data || !data.products || data.products.length === 0) {
    return <div className="no-data">No product data available</div>;
  }

  // Sort products
  const sortedProducts = [...data.products].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortDesc) {
      return aVal < bVal ? 1 : -1;
    } else {
      return aVal > bVal ? 1 : -1;
    }
  });

  // Calculate totals
  const totals = data.products.reduce((acc, p) => ({
    revenue: acc.revenue + p.total_revenue,
    cogs: acc.cogs + p.total_cogs,
    profit: acc.profit + p.profit,
    adjusted_profit: acc.adjusted_profit + p.adjusted_profit,
    loss_cost: acc.loss_cost + p.loss_cost,
  }), { revenue: 0, cogs: 0, profit: 0, adjusted_profit: 0, loss_cost: 0 });

  const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue * 100) : 0;
  const overallAdjustedMargin = totals.revenue > 0 ? (totals.adjusted_profit / totals.revenue * 100) : 0;

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return <span style={{ marginLeft: '5px' }}>{sortDesc ? '▼' : '▲'}</span>;
  };

  return (
    <div>
      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <div className="value">
            R$ {totals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">All products</div>
        </div>

        <div className="stat-card">
          <h3>Total FIFO COGS</h3>
          <div className="value">
            R$ {totals.cogs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">Cost of goods sold</div>
        </div>

        <div className="stat-card">
          <h3>Profit (Before Losses)</h3>
          <div className="value" style={{ color: '#38a169' }}>
            R$ {totals.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">{overallMargin.toFixed(2)}% margin</div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <h3 style={{ color: 'white' }}>Adjusted Profit</h3>
          <div className="value" style={{ color: 'white', fontSize: '2rem' }}>
            R$ {totals.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {overallAdjustedMargin.toFixed(2)}% real margin
          </div>
        </div>
      </div>

      {/* Product Analysis Table */}
      <div className="data-table-container">
        <div className="data-table-header">
          <h2>Product-Level Analysis</h2>
          {data.fifo_start_date && (
            <p style={{ fontSize: '0.9rem', color: '#718096', marginTop: '0.5rem' }}>
              FIFO Start Date: {new Date(data.fifo_start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('product_name')} style={{ cursor: 'pointer' }}>
                  Product <SortIcon field="product_name" />
                </th>
                <th onClick={() => handleSort('sales_count')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Sales <SortIcon field="sales_count" />
                </th>
                <th onClick={() => handleSort('total_volume_sold')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Volume Sold <SortIcon field="total_volume_sold" />
                </th>
                <th onClick={() => handleSort('total_revenue')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Revenue <SortIcon field="total_revenue" />
                </th>
                <th onClick={() => handleSort('total_cogs')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  FIFO COGS <SortIcon field="total_cogs" />
                </th>
                <th onClick={() => handleSort('profit')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Profit <SortIcon field="profit" />
                </th>
                <th onClick={() => handleSort('margin')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Margin <SortIcon field="margin" />
                </th>
                <th onClick={() => handleSort('loss_cost')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Losses <SortIcon field="loss_cost" />
                </th>
                <th onClick={() => handleSort('adjusted_profit')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Adj. Profit <SortIcon field="adjusted_profit" />
                </th>
                <th onClick={() => handleSort('adjusted_margin')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Adj. Margin <SortIcon field="adjusted_margin" />
                </th>
                <th onClick={() => handleSort('current_stock')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Stock <SortIcon field="current_stock" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{product.product_name}</strong>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                      {product.product_code}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{product.sales_count}</td>
                  <td style={{ textAlign: 'right' }}>
                    {product.total_volume_sold.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}L
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    R$ {product.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    R$ {product.total_cogs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', color: product.profit >= 0 ? '#38a169' : '#e53e3e', fontWeight: '600' }}>
                    R$ {product.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>
                    {product.margin.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', color: product.loss_cost > 0 ? '#e53e3e' : '#718096' }}>
                    {product.loss_cost > 0 ? (
                      <>
                        R$ {product.loss_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <br />
                        <span style={{ fontSize: '0.85rem' }}>
                          ({product.loss_volume.toFixed(2)}L)
                        </span>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: product.adjusted_profit >= 0 ? '#38a169' : '#e53e3e', fontWeight: '700' }}>
                    R$ {product.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '700' }}>
                    {product.adjusted_margin.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {product.current_stock.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}L
                  </td>
                </tr>
              ))}

              {/* Totals Row */}
              <tr style={{ background: '#f7fafc', fontWeight: '700', borderTop: '2px solid #2d3748' }}>
                <td>TOTAL</td>
                <td style={{ textAlign: 'right' }}>
                  {data.products.reduce((sum, p) => sum + p.sales_count, 0)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {data.products.reduce((sum, p) => sum + p.total_volume_sold, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}L
                </td>
                <td style={{ textAlign: 'right' }}>
                  R$ {totals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right' }}>
                  R$ {totals.cogs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', color: '#38a169' }}>
                  R$ {totals.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {overallMargin.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'right', color: '#e53e3e' }}>
                  R$ {totals.loss_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', color: '#38a169' }}>
                  R$ {totals.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {overallAdjustedMargin.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'right' }}>
                  {data.products.reduce((sum, p) => sum + p.current_stock, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}L
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Insights */}
      <div className="data-table-container" style={{ marginTop: '1.5rem' }}>
        <div className="data-table-header">
          <h2>Key Insights</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#2d3748' }}>
              Most Profitable Product (Adjusted)
            </h3>
            {(() => {
              const mostProfitable = [...data.products].sort((a, b) => b.adjusted_profit - a.adjusted_profit)[0];
              return (
                <p style={{ fontSize: '0.95rem', color: '#4a5568' }}>
                  <strong>{mostProfitable.product_name}</strong> with R$ {mostProfitable.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} profit ({mostProfitable.adjusted_margin.toFixed(2)}% margin)
                </p>
              );
            })()}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#2d3748' }}>
              Highest Margin Product
            </h3>
            {(() => {
              const highestMargin = [...data.products].sort((a, b) => b.adjusted_margin - a.adjusted_margin)[0];
              return (
                <p style={{ fontSize: '0.95rem', color: '#4a5568' }}>
                  <strong>{highestMargin.product_name}</strong> with {highestMargin.adjusted_margin.toFixed(2)}% margin
                </p>
              );
            })()}
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#2d3748' }}>
              Highest Loss Impact
            </h3>
            {(() => {
              const highestLoss = [...data.products].sort((a, b) => b.loss_cost - a.loss_cost)[0];
              return highestLoss.loss_cost > 0 ? (
                <p style={{ fontSize: '0.95rem', color: '#4a5568' }}>
                  <strong>{highestLoss.product_name}</strong> with R$ {highestLoss.loss_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} in losses ({highestLoss.loss_volume.toFixed(2)}L)
                </p>
              ) : (
                <p style={{ fontSize: '0.95rem', color: '#4a5568' }}>No losses recorded</p>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
