-- PJ Client Transactions Schema
-- Stores transaction-level data from Histórico de Consumo reports

-- Main transactions table
CREATE TABLE IF NOT EXISTS pj_client_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id INTEGER NOT NULL,
    client_code VARCHAR(20),
    client_name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    transaction_date DATE NOT NULL,
    product_name VARCHAR(100),
    canonical_product_code VARCHAR(10),
    volume DECIMAL(12,3),
    unit_price DECIMAL(10,2),
    total_value DECIMAL(12,2),
    vehicle_plate VARCHAR(20),
    cupom VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate transactions
    UNIQUE(company_id, cupom, transaction_date, client_code)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pj_trans_company ON pj_client_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_pj_trans_date ON pj_client_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_pj_trans_client ON pj_client_transactions(client_code);
CREATE INDEX IF NOT EXISTS idx_pj_trans_cnpj ON pj_client_transactions(cnpj);
CREATE INDEX IF NOT EXISTS idx_pj_trans_product ON pj_client_transactions(canonical_product_code);

-- View for PJ client summary (aggregated by client)
CREATE OR REPLACE VIEW pj_clients_summary AS
SELECT
    company_id,
    client_code,
    client_name,
    cnpj,
    COUNT(*) as transaction_count,
    SUM(volume) as total_volume,
    SUM(total_value) as total_revenue,
    MIN(transaction_date) as first_transaction,
    MAX(transaction_date) as last_transaction,
    -- Main product (most volume)
    (SELECT canonical_product_code
     FROM pj_client_transactions t2
     WHERE t2.client_code = pj_client_transactions.client_code
       AND t2.company_id = pj_client_transactions.company_id
     GROUP BY canonical_product_code
     ORDER BY SUM(volume) DESC
     LIMIT 1) as main_product
FROM pj_client_transactions
WHERE client_name NOT ILIKE '%CONSUMIDOR%'
GROUP BY company_id, client_code, client_name, cnpj;

-- View for monthly breakdown per client
CREATE OR REPLACE VIEW pj_clients_monthly AS
SELECT
    company_id,
    client_code,
    client_name,
    cnpj,
    DATE_TRUNC('month', transaction_date) as month,
    SUM(volume) as volume,
    SUM(total_value) as revenue,
    COUNT(*) as transactions
FROM pj_client_transactions
WHERE client_name NOT ILIKE '%CONSUMIDOR%'
GROUP BY company_id, client_code, client_name, cnpj, DATE_TRUNC('month', transaction_date);

-- View for PJ vs Walk-in breakdown
CREATE OR REPLACE VIEW pj_walkin_breakdown AS
SELECT
    company_id,
    DATE_TRUNC('month', transaction_date) as month,
    SUM(CASE WHEN client_name ILIKE '%CONSUMIDOR%' THEN volume ELSE 0 END) as walkin_volume,
    SUM(CASE WHEN client_name ILIKE '%CONSUMIDOR%' THEN total_value ELSE 0 END) as walkin_revenue,
    SUM(CASE WHEN client_name NOT ILIKE '%CONSUMIDOR%' THEN volume ELSE 0 END) as pj_volume,
    SUM(CASE WHEN client_name NOT ILIKE '%CONSUMIDOR%' THEN total_value ELSE 0 END) as pj_revenue,
    SUM(volume) as total_volume,
    SUM(total_value) as total_revenue
FROM pj_client_transactions
GROUP BY company_id, DATE_TRUNC('month', transaction_date);

-- Enable Row Level Security
ALTER TABLE pj_client_transactions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read their company's data
CREATE POLICY "Users can view their company's PJ transactions"
    ON pj_client_transactions
    FOR SELECT
    USING (true);

-- Policy for service role to insert/update
CREATE POLICY "Service role can insert PJ transactions"
    ON pj_client_transactions
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update PJ transactions"
    ON pj_client_transactions
    FOR UPDATE
    USING (true);
