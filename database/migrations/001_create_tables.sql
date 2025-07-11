-- Create customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    address TEXT,
    emergency_contacts JSONB,
    medical_alerts JSONB,
    subscription_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create devices table
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'offline',
    battery_level INTEGER DEFAULT 100,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create operators table
CREATE TABLE operators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    language_skills TEXT[],
    center_location VARCHAR(100),
    shift_schedule JSONB,
    performance_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create emergencies table
CREATE TABLE emergencies (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    type VARCHAR(50) NOT NULL,
    description TEXT,
    location_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create emergency_responses table
CREATE TABLE emergency_responses (
    id SERIAL PRIMARY KEY,
    emergency_id INTEGER REFERENCES emergencies(id) ON DELETE CASCADE,
    operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    response_time INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create refresh_tokens table for JWT management
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_devices_customer_id ON devices(customer_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_emergencies_customer_id ON emergencies(customer_id);
CREATE INDEX idx_emergencies_status ON emergencies(status);
CREATE INDEX idx_emergencies_created_at ON emergencies(created_at);
CREATE INDEX idx_emergency_responses_emergency_id ON emergency_responses(emergency_id);
CREATE INDEX idx_refresh_tokens_customer_id ON refresh_tokens(customer_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON operators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergencies_updated_at BEFORE UPDATE ON emergencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();