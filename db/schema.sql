-- db/schema.sql
-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Core Tables
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(3) CHECK (currency IN ('USD', 'PKR')) NOT NULL,
    tax_inclusive BOOLEAN DEFAULT FALSE,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('pay_on_site', 'online_only', 'hybrid')) DEFAULT 'pay_on_site',
    stripe_connect_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('owner', 'manager', 'staff')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(5,4) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    table_number VARCHAR(20),
    order_type VARCHAR(20) CHECK (order_type IN ('dine-in', 'pickup')) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    subtotal INTEGER NOT NULL,
    total_tax INTEGER NOT NULL,
    grand_total INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'new',
    special_instructions TEXT,
    queue_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID,
    name_snapshot VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    special_instructions TEXT
);

-- 3. Row-Level Security (RLS) Configuration
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Generic Policy Templates
CREATE POLICY tenant_isolation_policy ON menu_items
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_policy ON menu_categories
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_policy ON orders
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4. Indexes for Performance
CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);

-- 5. Seed Data - Sample Tenant
INSERT INTO tenants (slug, name, currency, tax_inclusive, payment_mode) 
VALUES ('demo', 'Demo Restaurant', 'PKR', false, 'hybrid')
ON CONFLICT (slug) DO NOTHING;

-- Get the inserted tenant ID for seeding
DO $$
DECLARE
  demo_tenant_id UUID;
BEGIN
  SELECT id INTO demo_tenant_id FROM tenants WHERE slug = 'demo';
  
  -- Seed categories
  INSERT INTO menu_categories (tenant_id, name, sort_order, is_active)
  VALUES 
    (demo_tenant_id, 'Appetizers', 1, true),
    (demo_tenant_id, 'Main Courses', 2, true),
    (demo_tenant_id, 'Desserts', 3, true),
    (demo_tenant_id, 'Beverages', 4, true)
  ON CONFLICT DO NOTHING;
  
  -- Seed menu items
  INSERT INTO menu_items (tenant_id, category_id, name, description, price, is_available)
  SELECT 
    demo_tenant_id,
    (SELECT id FROM menu_categories WHERE tenant_id = demo_tenant_id AND name = 'Appetizers' LIMIT 1),
    'Samosas (4pcs)',
    'Crispy pastry with spiced potato filling',
    30000,
    true
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Samosas (4pcs)' AND tenant_id = demo_tenant_id);
  
  INSERT INTO menu_items (tenant_id, category_id, name, description, price, is_available)
  SELECT 
    demo_tenant_id,
    (SELECT id FROM menu_categories WHERE tenant_id = demo_tenant_id AND name = 'Main Courses' LIMIT 1),
    'Chicken Biryani',
    'Fragrant rice with tender chicken pieces',
    65000,
    true
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chicken Biryani' AND tenant_id = demo_tenant_id);
  
  INSERT INTO menu_items (tenant_id, category_id, name, description, price, is_available)
  SELECT 
    demo_tenant_id,
    (SELECT id FROM menu_categories WHERE tenant_id = demo_tenant_id AND name = 'Beverages' LIMIT 1),
    'Mango Lassi',
    'traditional yogurt drink',
    20000,
    true
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Mango Lassi' AND tenant_id = demo_tenant_id);
  
  -- Seed tax rate
  INSERT INTO tenant_tax_rates (tenant_id, name, rate, is_active)
  VALUES (demo_tenant_id, 'GST', 0.1800, true)
  ON CONFLICT DO NOTHING;
END $$;
