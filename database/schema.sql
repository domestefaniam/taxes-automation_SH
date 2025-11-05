-- Property Tax Management System Database Schema
-- Supabase PostgreSQL Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Counties table
CREATE TABLE IF NOT EXISTS counties (
    id SERIAL PRIMARY KEY,
    county_name VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    descriptor VARCHAR(100),
    county VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modify the name of the columns: county to base name  and descriptor to specific 



-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY, --Unique identifier for each property
    group_code VARCHAR(50),
    co VARCHAR(100),
    brand VARCHAR(100),
    store_number VARCHAR(50),
    address TEXT NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip VARCHAR(10),
    vendor_id VARCHAR(100),
    landlord VARCHAR(255),
    open_closed VARCHAR(20) DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Add lease end date




-- Parcels table
CREATE TABLE IF NOT EXISTS parcels (
    id SERIAL PRIMARY KEY, -- Unique ID created by Supabase
    parcel_id VARCHAR(100) UNIQUE NOT NULL,   -- configure it for it could clean the parcel
    property INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    county_id INTEGER REFERENCES counties(id) ON DELETE CASCADE,
    payable_to VARCHAR(255), -- 
    account VARCHAR(100),
    parcel VARCHAR(100), --
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change parcel to parcel detail (details of the parcel (GEO ID, Parcel, etc)
-- Add Type of Tax (RE/BPP)



-- Taxes information table (RE taxes details)
CREATE TABLE IF NOT EXISTS taxes_information (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    tenancy_type VARCHAR(50),
    lease_type VARCHAR(100),
    responsible_of_payment VARCHAR(100),
    responsibility VARCHAR(50),
    reimbursement BOOLEAN DEFAULT FALSE,
    lease_clauses TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add assessed_value
-- Add sq_ft 
-- Add market
-- Add acquired-new
---Add predecessor_name



-- Parcel taxes table (bills)
CREATE TABLE IF NOT EXISTS parcel_taxes (
    id SERIAL PRIMARY KEY,
    parcel_taxes_id VARCHAR(100) UNIQUE NOT NULL,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add statement link to upload the statement (sharepoint)
-- Add Document reference, status of the information of the bill
-- Add Bill Number
-- Add Soure of the information ('county statement', 'county web page', 'ryan')
-- Add discount_date


-- Add a Table for Scrapping website information (Web Page Link, Amount), last_checked, last_status 


-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(100) UNIQUE NOT NULL,
    parcel_taxes_id INTEGER REFERENCES parcel_taxes(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    confirmation_number VARCHAR(100),
    paid_by VARCHAR(255),
    late_fees DECIMAL(10,2) DEFAULT 0,
    transaction_fees DECIMAL(10,2) DEFAULT 0,
    base_amount DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

--Add comments field




-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_open_closed ON properties(open_closed);
CREATE INDEX IF NOT EXISTS idx_parcels_property ON parcels(property);
CREATE INDEX IF NOT EXISTS idx_parcels_county_id ON parcels(county_id);
CREATE INDEX IF NOT EXISTS idx_parcel_taxes_parcel_id ON parcel_taxes(parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcel_taxes_status ON parcel_taxes(status);
CREATE INDEX IF NOT EXISTS idx_parcel_taxes_year ON parcel_taxes(year);
CREATE INDEX IF NOT EXISTS idx_payments_parcel_taxes_id ON payments(parcel_taxes_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_counties_updated_at BEFORE UPDATE ON counties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parcels_updated_at BEFORE UPDATE ON parcels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_taxes_information_updated_at BEFORE UPDATE ON taxes_information FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parcel_taxes_updated_at BEFORE UPDATE ON parcel_taxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO counties (county_name, state, descriptor, county) VALUES
('Harris County', 'TX', 'Harris', 'Harris'),
('Dallas County', 'TX', 'Dallas', 'Dallas'),
('Travis County', 'TX', 'Travis', 'Travis'),
('Bexar County', 'TX', 'Bexar', 'Bexar')
ON CONFLICT DO NOTHING;

-- Insert sample properties
INSERT INTO properties (group_code, co, brand, store_number, address, state, zip, vendor_id, landlord, open_closed) VALUES
('A02', 'Company1', 'BrandX', '001', '123 Main St, Houston TX', 'TX', '77001', 'VEND001', 'John Doe', 'Open'),
('A03', 'Company2', 'BrandY', '002', '456 Oak Ave, Houston TX', 'TX', '77002', 'VEND002', 'Jane Smith', 'Closed'),
('A04', 'Company3', 'BrandZ', '003', '789 Pine Rd, Houston TX', 'TX', '77003', 'VEND003', 'Bob Johnson', 'Open')
ON CONFLICT DO NOTHING;

-- Insert sample parcels
INSERT INTO parcels (parcel_id, property, county_id, payable_to, account, parcel) VALUES
('PARCEL001', 1, 1, 'Harris Tax Office', 'ACC001', 'PARCEL001'),
('PARCEL002', 1, 2, 'Dallas Tax Office', 'ACC002', 'PARCEL002'),
('PARCEL003', 2, 1, 'Harris Tax Office', 'ACC003', 'PARCEL003'),
('PARCEL004', 3, 3, 'Travis Tax Office', 'ACC004', 'PARCEL004')
ON CONFLICT (parcel_id) DO NOTHING;

-- Insert sample parcel taxes
INSERT INTO parcel_taxes (parcel_taxes_id, parcel_id, year, amount_due, due_date, status) VALUES
('TAX001', 1, 2024, 3500.00, '2024-12-31', 'pending'),
('TAX002', 2, 2024, 2800.00, '2024-11-30', 'pending'),
('TAX003', 3, 2024, 4200.00, '2024-10-15', 'pending'),
('TAX004', 1, 2023, 3200.00, '2023-12-31', 'paid'),
('TAX005', 4, 2024, 1900.00, '2024-09-30', 'pending')
ON CONFLICT (parcel_taxes_id) DO NOTHING;

-- Insert sample payments
INSERT INTO payments (payment_id, parcel_taxes_id, amount_paid, payment_date, confirmation_number, paid_by, late_fees, transaction_fees, base_amount) VALUES
('PAY001', 4, 3200.00, '2023-12-15', 'TXN001', 'John Doe', 0.00, 0.00, 3200.00),
('PAY002', 1, 3500.00, '2024-11-15', 'TXN002', 'John Doe', 0.00, 25.00, 3475.00),
('PAY003', 2, 2850.00, '2024-10-20', 'TXN003', 'Jane Smith', 50.00, 0.00, 2800.00),
('PAY004', 3, 4200.00, '2024-09-10', 'TXN004', 'Bob Johnson', 0.00, 0.00, 4200.00)
ON CONFLICT (payment_id) DO NOTHING;
