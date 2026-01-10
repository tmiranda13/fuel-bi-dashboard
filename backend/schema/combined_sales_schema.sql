-- Combined Sales Table
-- Stores transaction-level data from Vendas por Bico + Cupons por Período reports
-- This provides pump-level, employee-level, and time-level granularity

CREATE TABLE IF NOT EXISTS combined_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id INTEGER NOT NULL,

    -- From Vendas por Bico
    pump_number VARCHAR(10),
    product_code VARCHAR(10) NOT NULL,  -- GC, GA, ET, DS10, DS500
    product_name VARCHAR(100),
    sale_date DATE NOT NULL,
    client VARCHAR(255),
    volume DECIMAL(12, 3) NOT NULL,
    value DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(100),

    -- From Cupons por Período
    cupom_number VARCHAR(20),
    sale_time TIME,
    employee VARCHAR(255),
    unit_price DECIMAL(10, 4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate imports
    UNIQUE(company_id, sale_date, pump_number, product_code, volume, value, cupom_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_combined_sales_company ON combined_sales(company_id);
CREATE INDEX IF NOT EXISTS idx_combined_sales_date ON combined_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_combined_sales_product ON combined_sales(product_code);
CREATE INDEX IF NOT EXISTS idx_combined_sales_employee ON combined_sales(employee);
CREATE INDEX IF NOT EXISTS idx_combined_sales_pump ON combined_sales(pump_number);
CREATE INDEX IF NOT EXISTS idx_combined_sales_company_date ON combined_sales(company_id, sale_date);

-- RLS Policies
ALTER TABLE combined_sales ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their company's data
CREATE POLICY "Users can view own company combined_sales" ON combined_sales
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Grant permissions
GRANT SELECT ON combined_sales TO authenticated;
GRANT INSERT, UPDATE, DELETE ON combined_sales TO service_role;
