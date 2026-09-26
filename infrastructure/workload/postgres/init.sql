-- ==============================================================================
-- RunSafe Demo Workload: PostgreSQL Database Schema
-- Database: checkout_db
-- ==============================================================================

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 1000,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    synthetic_request_id VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    version VARCHAR(16) NOT NULL,
    replica_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_version ON orders(version);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Seed deterministic synthetic products
INSERT INTO products (id, name, price, stock, active) VALUES
    ('prod-001', 'Cloud Compute Micro Instance', 15.00, 500, true),
    ('prod-002', 'Enterprise Database Replica', 120.00, 200, true),
    ('prod-003', 'Network Load Balancer License', 45.00, 350, true),
    ('prod-fail', 'Fault Trigger Synthetic SKU', 99.00, 100, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    active = EXCLUDED.active;
