-- ==============================================================================
-- RunSafe Demo Workload: Database Reset Script
-- Restores database to deterministic baseline
-- ==============================================================================

TRUNCATE TABLE order_items, orders CASCADE;

INSERT INTO products (id, name, price, stock, active) VALUES
    ('prod-001', 'Cloud Compute Micro Instance', 15.00, 500, true),
    ('prod-002', 'Enterprise Database Replica', 120.00, 200, true),
    ('prod-003', 'Network Load Balancer License', 45.00, 350, true),
    ('prod-fail', 'Fault Trigger Synthetic SKU', 99.00, 100, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = 1000,
    active = true;
