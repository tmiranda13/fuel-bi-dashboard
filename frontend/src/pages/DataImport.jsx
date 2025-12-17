/**
 * Data Import Page
 * Upload historical data for one-time setup
 */

import { useState } from 'react';
import api from '../services/api';

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [saleDate, setSaleDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!saleDate) {
      setError('Please select a sale date');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sale_date', saleDate);

      const response = await api.import.dailySales(formData);
      setResult(response.data);

      // Reset form on success
      if (response.data.success) {
        setFile(null);
        setSaleDate('');
        // Reset file input
        document.getElementById('file-input').value = '';
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.error || 'Failed to import file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Import Form */}
      <div className="data-table-container" style={{ marginBottom: '2rem' }}>
        <div className="data-table-header">
          <h2>Import Daily Sales Report</h2>
          <p style={{ fontSize: '0.9rem', color: '#718096', marginTop: '0.5rem' }}>
            Upload RESUMO DO DIA Excel files for historical data setup
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Sale Date
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                width: '300px'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Excel File (RESUMO DO DIA)
            </label>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                width: '100%',
                maxWidth: '500px'
              }}
            />
            {file && (
              <p style={{ fontSize: '0.9rem', color: '#38a169', marginTop: '0.5rem' }}>
                Selected: {file.name}
              </p>
            )}
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c53030',
              marginBottom: '1.5rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{
              padding: '0.75rem 2rem',
              background: uploading ? '#cbd5e0' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Uploading...' : 'Import Data'}
          </button>
        </form>
      </div>

      {/* Import Result */}
      {result && (
        <div className="data-table-container">
          <div className="data-table-header">
            <h2>Import Results</h2>
          </div>
          <div style={{ padding: '2rem' }}>
            {/* Summary */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                padding: '1rem',
                background: result.success ? '#f0fff4' : '#fffaf0',
                border: `1px solid ${result.success ? '#9ae6b4' : '#fbd38d'}`,
                borderRadius: '4px',
                marginBottom: '1rem'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  color: result.success ? '#22543d' : '#7c2d12',
                  marginBottom: '0.5rem'
                }}>
                  {result.message}
                </h3>
                <div style={{ fontSize: '0.95rem', color: '#4a5568' }}>
                  <p><strong>Records Parsed:</strong> {result.records_parsed}</p>
                  <p><strong>Records Imported:</strong> {result.records_imported}</p>
                  <p><strong>Records Skipped:</strong> {result.records_skipped}</p>
                  {result.errors && result.errors.length > 0 && (
                    <p style={{ color: '#c53030' }}>
                      <strong>Errors:</strong> {result.errors.length}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Imported Records */}
            {result.imported_records && result.imported_records.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2d3748' }}>
                  Imported Records ({result.imported_records.length})
                </h3>
                <div style={{ overflowX: 'auto', maxHeight: '400px', overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DB ID</th>
                        <th>Pump</th>
                        <th>Product</th>
                        <th>Volume (L)</th>
                        <th>Price/L</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.imported_records.map((record, idx) => (
                        <tr key={idx}>
                          <td>#{record.id}</td>
                          <td>{record.pump_number}</td>
                          <td>
                            <strong>{record.product_name}</strong>
                            <br />
                            <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                              {record.product_code}
                            </span>
                          </td>
                          <td>{record.volume_sold.toFixed(2)}L</td>
                          <td>R$ {record.sale_price_per_liter.toFixed(4)}</td>
                          <td>R$ {record.total_revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Skipped Records */}
            {result.skipped_records && result.skipped_records.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2d3748' }}>
                  Skipped Records ({result.skipped_records.length})
                </h3>
                <div style={{ overflowX: 'auto', maxHeight: '300px', overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Pump</th>
                        <th>Product</th>
                        <th>Date</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.skipped_records.map((record, idx) => (
                        <tr key={idx}>
                          <td>{record.pump_number}</td>
                          <td>{record.product_name}</td>
                          <td>{record.sale_date}</td>
                          <td style={{ color: '#718096', fontSize: '0.9rem' }}>
                            {record.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#c53030' }}>
                  Errors ({result.errors.length})
                </h3>
                <div style={{ overflowX: 'auto', maxHeight: '300px', overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Pump</th>
                        <th>Product</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td>{err.pump_number}</td>
                          <td>{err.product_name}</td>
                          <td style={{ color: '#c53030', fontSize: '0.9rem' }}>
                            {err.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="data-table-container" style={{ marginTop: '2rem' }}>
        <div className="data-table-header">
          <h2>Instructions</h2>
        </div>
        <div style={{ padding: '2rem' }}>
          <ol style={{ lineHeight: '1.8', color: '#4a5568' }}>
            <li>Select the date the report is for</li>
            <li>Choose the RESUMO DO DIA Excel file</li>
            <li>Click "Import Data" to process the file</li>
            <li>Review the imported records to verify data was loaded correctly</li>
            <li>Check the database tables (Sales tab) to confirm the data is available</li>
          </ol>
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#fef5e7',
            border: '1px solid #f9e79f',
            borderRadius: '6px'
          }}>
            <p style={{ fontSize: '0.9rem', color: '#7d6608', margin: 0 }}>
              <strong>Note:</strong> This is a one-time setup tool. Duplicate records are automatically skipped,
              so you can safely re-upload files if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
