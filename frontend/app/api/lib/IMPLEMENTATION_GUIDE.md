/**
 * ENTERPRISE INVENTORY SYSTEM - IMPLEMENTATION GUIDE
 * 
 * This guide explains the architecture, key principles, and how to use the system.
 */

# Architecture Overview

## Core Principle: Single Source of Truth
- **stock_ledger** is the ONLY source of truth for inventory
- Products table contains METADATA ONLY (no stock fields)
- Current stock is ALWAYS computed at query time
- No race conditions possible (ledger entries are append-only)

## Stock Computation Formula
```
Current Stock for Product X = SUM(quantity_in) - SUM(quantity_out) 
                              from stock_ledger WHERE product_id = X
```

## Transaction Types in stock_ledger
| Type | quantity_in | quantity_out | Use Case |
|------|------------|-------------|----------|
| purchase | ✅ qty | 0 | Buying from vendor |
| sale | 0 | ✅ qty | Selling to customer |
| adjustment | ✅ qty | 0 | Manual stock increase |
| adjustment | 0 | ✅ qty | Manual stock decrease |
| return_in | ✅ qty | 0 | Returned from customer |
| return_out | 0 | ✅ qty | Returned to vendor |

---

# API Endpoints

## 1. GET /api/products
**Purpose**: Fetch all products with real-time stock information

**Response**:
```json
[
  {
    "id": 1,
    "name": "Product A",
    "quantity_with_unit": "1kg",
    "price_per_unit": 100,
    "reorder_point": 10,
    "current_stock": 45,           // Computed from stock_ledger
    "is_low_stock": false,         // current_stock <= reorder_point
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

**Implementation**:
```typescript
const enriched = (products || []).map((p: any) => {
  const current_stock = stockMap.get(p.id) || 0;
  const is_low_stock = p.reorder_point !== null && current_stock <= Number(p.reorder_point);
  return { ...p, current_stock, is_low_stock };
});
```

---

## 2. POST /api/purchases
**Purpose**: Record a purchase from a vendor (ATOMIC)

**Request**:
```json
{
  "vendor_name": "ABC Supplier",
  "invoice_number": "INV-001",
  "purchase_date": "2025-01-20",
  "notes": "Express delivery",
  "items": [
    { "product_id": 1, "quantity": 50, "unit_price": 80 },
    { "product_id": 2, "quantity": 30, "unit_price": 120 }
  ]
}
```

**Atomic Steps**:
1. INSERT into purchases → get purchase_id
2. INSERT into purchase_items (one row per item)
3. INSERT into stock_ledger (one row per item with quantity_in = item qty, quantity_out = 0)

**Automatic Rollback On**:
- Product ID doesn't exist
- Any INSERT fails
- Any database error

**Response on Success**:
```json
{
  "status": "success",
  "message": "Purchase created successfully",
  "data": { "id": 1, "total_amount": 5400 }
}
```

---

## 3. POST /api/sales
**Purpose**: Record a sale to a customer (ATOMIC + STOCK VALIDATION)

**Request**:
```json
{
  "customer_name": "John Corp",
  "invoice_number": "SAL-001",
  "sale_date": "2025-01-20",
  "notes": "Bulk order",
  "items": [
    { "product_id": 1, "quantity": 20, "unit_price": 150 },
    { "product_id": 2, "quantity": 15, "unit_price": 200 }
  ]
}
```

**Atomic Steps**:
1. **VALIDATE STOCK** - Check if current_stock >= requested qty for EACH product
   - If ANY product insufficient → REJECT with detailed error
   - Example: `Product 1: available 10, required 20`
2. INSERT into sales → get sale_id
3. INSERT into sale_items (one row per item)
4. INSERT into stock_ledger (one row per item with quantity_in = 0, quantity_out = item qty)

**Stock Validation Logic**:
```typescript
const stockValidations = await validateStockBatch(supabase, items);
const insufficientStock = stockValidations.filter(v => !v.valid);
if (insufficientStock.length > 0) {
  return error "Insufficient stock: Product X: available Y, required Z"
}
```

**Automatic Rollback On**:
- Product ID doesn't exist
- Insufficient stock (rejects BEFORE creating sale)
- Any INSERT fails
- Any database error

**Response on Success**:
```json
{
  "status": "success",
  "message": "Sale created successfully",
  "data": { "id": 1, "total_amount": 6000 }
}
```

**Response on Stock Error**:
```json
{
  "status": "error",
  "message": "Insufficient stock: Product 1: available 10, required 20; Product 2: available 8, required 15"
}
```

---

# Real-Time Updates

After a purchase or sale succeeds:

**Option 1: Frontend Re-fetch**
```typescript
// After sale/purchase POST succeeds
const response = await fetch('/api/products');
const updatedProducts = await response.json();
setProducts(updatedProducts); // Updates UI with new stock
```

**Option 2: Supabase Real-time Subscription** (Recommended)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(URL, KEY);

supabase
  .channel('stock_ledger_changes')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'stock_ledger' },
    (payload) => {
      console.log('Stock updated:', payload);
      refetchProducts(); // Refresh product list
    }
  )
  .subscribe();
```

---

# Common Scenarios & Expected Behavior

## Scenario 1: Purchase 20 units of Product X
```
Initial stock: 0
Purchase 20 units
Ledger entry: { quantity_in: 20, quantity_out: 0 }
Final stock: 20
```

## Scenario 2: Sell 15 units when stock is 20
```
Current stock: 20
Sale 15 units
Validation: 15 <= 20 ✅ ALLOWED
Ledger entry: { quantity_in: 0, quantity_out: 15 }
Final stock: 5
```

## Scenario 3: Try to sell 25 units when stock is 20
```
Current stock: 20
Sale 25 units (requested)
Validation: 25 <= 20 ❌ REJECTED
Error: "Insufficient stock: Product X: available 20, required 25"
Final stock: 20 (unchanged)
```

## Scenario 4: Two concurrent sales (no race condition)
```
Initial stock: 30
Sale A: 20 units (concurrently)
Sale B: 15 units (concurrently)

Both transactions:
1. Read current stock via ledger → both see 30 ✅
2. Validate: 20 <= 30 ✅, 15 <= 30 ✅
3. Both create sales and insert ledger entries

Result: 
- Stock = 30 - 20 - 15 = -5 ❌ INVALID

SOLUTION: Use database-level constraints or implement pessimistic locking.
For MVP, accept this edge case and monitor in production.
```

---

# Utility Functions

## getCurrentStock(supabase, product_id)
```typescript
// Get current stock for a single product
const stock = await getCurrentStock(supabase, 1);
console.log(stock); // 45
```

## getCurrentStockBatch(supabase, product_ids)
```typescript
// Get current stock for multiple products
const stocks = await getCurrentStockBatch(supabase, [1, 2, 3]);
// Map { 1 => 45, 2 => 20, 3 => 0 }
```

## validateStockBatch(supabase, items)
```typescript
// Validate stock for multiple products
const validations = await validateStockBatch(supabase, [
  { product_id: 1, quantity: 20 },
  { product_id: 2, quantity: 15 }
]);
// [
//   { product_id: 1, available: 45, required: 20, valid: true },
//   { product_id: 2, available: 8, required: 15, valid: false }
// ]
```

---

# Error Handling

All API endpoints return standardized error responses:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

HTTP Status Codes:
- **400**: Bad request (missing fields, product not found, insufficient stock)
- **500**: Server error (database error, unexpected exception)

Always check response.status before processing.

---

# Testing Checklist

- [ ] Purchase creates sale_items and stock_ledger entries correctly
- [ ] Sale validates stock before creating entry
- [ ] Sale rejects when stock is insufficient
- [ ] GET /api/products returns correct current_stock (SUM logic)
- [ ] GET /api/products returns correct is_low_stock flag
- [ ] Concurrent purchases increase stock correctly
- [ ] Concurrent sales decrease stock correctly
- [ ] Rollback works: if ledger insert fails, purchase/sale is deleted
- [ ] Low stock alerts trigger correctly when stock <= reorder_point
- [ ] Stock never goes negative

---

# Migration Checklist

- [ ] Create stock_ledger table in database
- [ ] If migrating from old stock table:
  - [ ] Insert initial stock as ledger entries
  - [ ] Verify ledger entries match old stock amounts
  - [ ] Delete old stock table
- [ ] Deploy new API code (products, purchases, sales)
- [ ] Deploy utility functions (stock-ledger.ts)
- [ ] Test all endpoints with sample data
- [ ] Monitor for race conditions
- [ ] Enable real-time subscriptions in frontend
