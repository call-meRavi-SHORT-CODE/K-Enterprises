/**
 * INVENTORY STOCK MANAGEMENT - DATABASE SCHEMA
 * 
 * This document describes the required database tables for the enterprise-grade
 * inventory system. Stock is ALWAYS derived from stock_ledger.
 */

/**
 * PRODUCTS TABLE
 * 
 * Metadata-only table. Does NOT store stock quantities.
 * Stock is computed dynamically from stock_ledger at query time.
 */
-- CREATE TABLE products (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   quantity_with_unit VARCHAR(100) NOT NULL,  -- e.g., "1kg", "500g", "2pack"
--   price_per_unit DECIMAL(10, 2) NOT NULL,
--   reorder_point INT,  -- Trigger low stock alert when current_stock <= this
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

/**
 * STOCK_LEDGER TABLE (SINGLE SOURCE OF TRUTH)
 * 
 * Every stock change is recorded here. Never directly store stock in products.
 * 
 * Rules:
 * - For PURCHASE: quantity_in = purchased qty, quantity_out = 0
 * - For SALE: quantity_in = 0, quantity_out = sold qty
 * - For ADJUSTMENT: quantity_in > 0 for increases, quantity_out > 0 for decreases
 * - For RETURN_IN: quantity_in = returned qty, quantity_out = 0
 * - For RETURN_OUT: quantity_in = 0, quantity_out = returned qty
 */
-- CREATE TABLE stock_ledger (
--   id SERIAL PRIMARY KEY,
--   product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
--   transaction_type VARCHAR(50) NOT NULL,  -- 'purchase', 'sale', 'adjustment', 'return_in', 'return_out'
--   transaction_id VARCHAR(255),  -- References purchase_id, sale_id, or adjustment_id
--   quantity_in INT DEFAULT 0,
--   quantity_out INT DEFAULT 0,
--   transaction_date DATE NOT NULL,
--   notes TEXT,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   INDEX idx_product_id (product_id),
--   INDEX idx_transaction_date (transaction_date),
--   INDEX idx_transaction_type (transaction_type)
-- );

/**
 * COMPUTE CURRENT STOCK (Reference Query)
 * 
 * Use this pattern to get current stock for a product:
 */
-- SELECT
--   product_id,
--   COALESCE(SUM(quantity_in) - SUM(quantity_out), 0) AS current_stock
-- FROM stock_ledger
-- WHERE product_id = ?
-- GROUP BY product_id;

/**
 * PURCHASES TABLE
 */
-- CREATE TABLE purchases (
--   id SERIAL PRIMARY KEY,
--   vendor_name VARCHAR(255) NOT NULL,
--   invoice_number VARCHAR(100) NOT NULL UNIQUE,
--   purchase_date DATE NOT NULL,
--   notes TEXT,
--   total_amount DECIMAL(12, 2),
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

/**
 * PURCHASE_ITEMS TABLE
 */
-- CREATE TABLE purchase_items (
--   id SERIAL PRIMARY KEY,
--   purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
--   product_id INT NOT NULL REFERENCES products(id),
--   product_name VARCHAR(255),
--   quantity INT NOT NULL,
--   unit_price DECIMAL(10, 2),
--   total_price DECIMAL(12, 2)
-- );

/**
 * SALES TABLE
 */
-- CREATE TABLE sales (
--   id SERIAL PRIMARY KEY,
--   customer_name VARCHAR(255) NOT NULL,
--   invoice_number VARCHAR(100) NOT NULL UNIQUE,
--   sale_date DATE NOT NULL,
--   notes TEXT,
--   total_amount DECIMAL(12, 2),
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

/**
 * SALE_ITEMS TABLE
 */
-- CREATE TABLE sale_items (
--   id SERIAL PRIMARY KEY,
--   sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
--   product_id INT NOT NULL REFERENCES products(id),
--   product_name VARCHAR(255),
--   quantity INT NOT NULL,
--   unit_price DECIMAL(10, 2),
--   total_price DECIMAL(12, 2)
-- );

/**
 * API ENDPOINTS IMPLEMENTED
 * 
 * 1. GET /api/products
 *    - Fetches all products with computed current_stock and is_low_stock fields
 *    - current_stock = SUM(quantity_in) - SUM(quantity_out) from stock_ledger
 *    - is_low_stock = current_stock <= reorder_point
 *    - Response includes: id, name, quantity_with_unit, price_per_unit, reorder_point, 
 *                        current_stock, is_low_stock, created_at, updated_at
 * 
 * 2. POST /api/purchases
 *    - Create atomic purchase transaction
 *    - Inserts: purchases → purchase_items → stock_ledger (with quantity_in)
 *    - All operations rollback on any failure
 *    - Validates all product_ids exist
 *    - Request body: { vendor_name, invoice_number, purchase_date, notes?, items }
 *    - items: [{ product_id, quantity, unit_price }]
 * 
 * 3. GET /api/purchases
 *    - Fetch all purchases with items
 *    - Returns purchase_items nested under each purchase
 * 
 * 4. POST /api/sales
 *    - Create atomic sale transaction with STOCK VALIDATION
 *    - CRITICAL: Validates stock availability BEFORE creating sale
 *    - Inserts: sales → sale_items → stock_ledger (with quantity_out)
 *    - Rejects sale if any product has insufficient stock
 *    - All operations rollback on any failure
 *    - Request body: { customer_name, invoice_number, sale_date, notes?, items }
 *    - items: [{ product_id, quantity, unit_price }]
 * 
 * 5. GET /api/sales
 *    - Fetch all sales with items
 *    - Returns sale_items nested under each sale
 */

/**
 * MIGRATION STEPS FOR EXISTING DATABASES
 * 
 * 1. Create stock_ledger table if it doesn't exist
 * 2. If you have existing stock table with direct stock amounts:
 *    - For each product with stock: INSERT INTO stock_ledger
 *      (product_id, transaction_type, transaction_id, quantity_in, quantity_out, transaction_date, notes)
 *      VALUES (product_id, 'initialization', 'init-' + product_id, available_stock, 0, CURRENT_DATE, 'Initial stock')
 * 3. Remove the old stock table
 * 4. Deploy new API endpoints
 * 
 * IMPORTANT: Do not keep both stock and stock_ledger tables. They will conflict.
 */
