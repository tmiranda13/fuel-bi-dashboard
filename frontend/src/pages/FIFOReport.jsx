/**
 * FIFO Report Page
 * Shows profit/loss analysis with FIFO costing and losses impact
 */

import { useState, useEffect } from 'react';
import api from '../services/api';

export default function FIFOReport() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [settings, setSettings] = useState(null);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');

  useEffect(() => {
    loadFIFOData();
  }, []);

  const loadFIFOData = async () => {
    setLoading(true);
    try {
      const [reportRes, settingsRes] = await Promise.all([
        api.fifo.getReport(),
        api.fifo.getSettings()
      ]);

      setReport(reportRes.data);
      setSettings(settingsRes.data);
      setStartDateInput(settingsRes.data.fifo_start_date || '');
    } catch (error) {
      console.error('Error loading FIFO data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStartDate = async () => {
    try {
      await api.fifo.updateSettings(startDateInput || null);
      setEditingStartDate(false);
      // Reload report with new start date
      loadFIFOData();
    } catch (error) {
      console.error('Error updating start date:', error);
      alert('Failed to update start date');
    }
  };

  if (loading) {
    return <div className="loading">Loading FIFO report...</div>;
  }

  if (!report) {
    return <div className="no-data">No FIFO data available</div>;
  }

  const impactPercentage = report.total_profit > 0
    ? ((report.total_loss_cost / report.total_profit) * 100).toFixed(1)
    : 0;

  return (
    <div>
      {/* Configuration Section */}
      <div className="data-table-container" style={{ marginBottom: '1.5rem' }}>
        <div className="data-table-header">
          <h2>FIFO Configuration</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              FIFO Start Date (Optional)
            </label>
            <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.75rem' }}>
              Only use purchase batches from this date forward. Leave empty to use all batches.
            </p>

            {editingStartDate ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  onClick={handleUpdateStartDate}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingStartDate(false);
                    setStartDateInput(settings.fifo_start_date || '');
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#e2e8f0',
                    color: '#4a5568',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', color: '#2d3748', fontWeight: '500' }}>
                  {settings.fifo_start_date ?
                    new Date(settings.fifo_start_date + 'T00:00:00').toLocaleDateString('pt-BR') :
                    'Not set (using all batches)'}
                </span>
                <button
                  onClick={() => setEditingStartDate(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <div className="value">
            R$ {report.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">From {report.sales_count} sales</div>
        </div>

        <div className="stat-card">
          <h3>Total COGS</h3>
          <div className="value">
            R$ {report.total_cogs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">Cost using FIFO</div>
        </div>

        <div className="stat-card">
          <h3>Profit (Before Losses)</h3>
          <div className="value" style={{ color: '#38a169' }}>
            R$ {report.total_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">{report.overall_margin.toFixed(2)}% margin</div>
        </div>

        <div className="stat-card loss">
          <h3>Losses Impact</h3>
          <div className="value">
            -R$ {report.total_loss_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label">{report.total_loss_volume.toFixed(2)}L lost ({impactPercentage}% of profit)</div>
        </div>

        <div className="stat-card gain">
          <h3>Gains</h3>
          <div className="value">
            {report.total_gain_volume.toFixed(2)}L
          </div>
          <div className="label">Volume gained</div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <h3 style={{ color: 'white' }}>ADJUSTED PROFIT</h3>
          <div className="value" style={{ color: 'white', fontSize: '2rem' }}>
            R$ {report.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="label" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {report.adjusted_margin.toFixed(2)}% real margin
          </div>
        </div>
      </div>

      {/* Losses Breakdown */}
      {report.losses && report.losses.length > 0 && (
        <div className="data-table-container" style={{ marginTop: '1.5rem' }}>
          <div className="data-table-header">
            <h2>Losses Breakdown</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Volume Lost</th>
                <th>Cost Impact</th>
              </tr>
            </thead>
            <tbody>
              {report.losses.map((loss, idx) => (
                <tr key={idx}>
                  <td>{loss.product_name} ({loss.product_code})</td>
                  <td style={{ color: '#e53e3e', fontWeight: '600' }}>
                    {loss.volume.toFixed(2)}L
                  </td>
                  <td style={{ color: '#e53e3e', fontWeight: '600' }}>
                    R$ {loss.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#fee', fontWeight: '700' }}>
                <td>TOTAL LOSSES</td>
                <td style={{ color: '#c53030' }}>
                  {report.total_loss_volume.toFixed(2)}L
                </td>
                <td style={{ color: '#c53030' }}>
                  R$ {report.total_loss_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Gains Breakdown */}
      {report.gains && report.gains.length > 0 && (
        <div className="data-table-container" style={{ marginTop: '1.5rem' }}>
          <div className="data-table-header">
            <h2>Gains Breakdown</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Volume Gained</th>
              </tr>
            </thead>
            <tbody>
              {report.gains.map((gain, idx) => (
                <tr key={idx}>
                  <td>{gain.product_name} ({gain.product_code})</td>
                  <td style={{ color: '#38a169', fontWeight: '600' }}>
                    {gain.volume.toFixed(2)}L
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparison */}
      <div className="data-table-container" style={{ marginTop: '1.5rem' }}>
        <div className="data-table-header">
          <h2>Impact Analysis</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.9rem', color: '#4a5568' }}>
                  Metric
                </th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.9rem', color: '#4a5568' }}>
                  Before Losses
                </th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.9rem', color: '#4a5568' }}>
                  After Losses
                </th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.9rem', color: '#4a5568' }}>
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem', fontWeight: '500' }}>Profit</td>
                <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                  R$ {report.total_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '700', color: '#2d3748' }}>
                  R$ {report.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', padding: '0.75rem', color: '#e53e3e', fontWeight: '600' }}>
                  -R$ {report.total_loss_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem', fontWeight: '500' }}>Margin</td>
                <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                  {report.overall_margin.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '700', color: '#2d3748' }}>
                  {report.adjusted_margin.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'right', padding: '0.75rem', color: '#e53e3e', fontWeight: '600' }}>
                  -{(report.overall_margin - report.adjusted_margin).toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#fef5e7',
            border: '1px solid #f9e79f',
            borderRadius: '6px'
          }}>
            <p style={{ fontSize: '0.9rem', color: '#7d6608', margin: 0 }}>
              <strong>Important:</strong> Without tracking losses, your profit would appear to be{' '}
              <strong>R$ {report.total_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
              ({report.overall_margin.toFixed(2)}%). But the real profit after losses is{' '}
              <strong>R$ {report.adjusted_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
              ({report.adjusted_margin.toFixed(2)}%). Losses are hiding{' '}
              <strong style={{ color: '#c53030' }}>
                {impactPercentage}% of your costs!
              </strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
