/**
 * QUICK REFERENCE - Enterprise Inventory System
 * 
 * Quick lookup for common tasks and API usage
 */

# Quick Reference Card

## Core Principle
```
Current Stock = SUM(quantity_in) - SUM(quantity_out) 
                from stock_ledger WHERE product_id = X
```

---

## API Endpoints (4 Main)

### 1️⃣ GET /api/products
```bash
curl http://localhost:3000/api/products
```
Returns: Array of products with `current_stock` and `is_low_stock`

### 2️⃣ POST /api/purchases
```bash
curl -X POST http://localhost:3000/api/purchases \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Supplier A",
    "invoice_number": "INV-001",
    "purchase_date": "2025-01-20",
    "items": [{ "product_id": 1, "quantity": 50, "unit_price": 100 }]
  }'
```

### 3️⃣ POST /api/sales
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Customer B",
    "invoice_number": "SAL-001",
    "sale_date": "2025-01-21",
    "items": [{ "product_id": 1, "quantity": 20, "unit_price": 150 }]
  }'
```

### 4️⃣ GET /api/purchases & GET /api/sales
```bash
curl http://localhost:3000/api/purchases
curl http://localhost:3000/api/sales
```

---

## Stock_Ledger Format

| Field | Type | Note |
|-------|------|------|
| product_id | int | FK to products |
| transaction_type | string | 'purchase', 'sale', 'adjustment', etc |
| quantity_in | int | Stock increase amount |
| quantity_out | int | Stock decrease amount |
| transaction_date | date | YYYY-MM-DD |
| transaction_id | string | References purchase_id, sale_id |

### Entry Types
```
PURCHASE:      qty_in = amount,  qty_out = 0
SALE:          qty_in = 0,       qty_out = amount
ADJUSTMENT UP: qty_in = amount,  qty_out = 0
ADJUSTMENT DOWN: qty_in = 0,     qty_out = amount
RETURN IN:     qty_in = amount,  qty_out = 0
RETURN OUT:    qty_in = 0,       qty_out = amount
```

---

## Utility Functions

### Get Stock for One Product
```typescript
import { getCurrentStock } from '@/app/api/lib/stock-ledger';

const stock = await getCurrentStock(supabase, productId);
// Returns: number (e.g., 45)
```

### Get Stock for Multiple Products
```typescript
import { getCurrentStockBatch } from '@/app/api/lib/stock-ledger';

const stocks = await getCurrentStockBatch(supabase, [1, 2, 3]);
// Returns: Map { 1 => 45, 2 => 20, 3 => 0 }
```

### Validate Stock Before Sale
```typescript
import { validateStockBatch } from '@/app/api/lib/stock-ledger';

const validations = await validateStockBatch(supabase, [
  { product_id: 1, quantity: 20 },
  { product_id: 2, quantity: 10 }
]);
// Returns: [
//   { product_id: 1, available: 45, required: 20, valid: true },
//   { product_id: 2, available: 8, required: 10, valid: false }
// ]
```

---

## React Component Examples

### Display Products with Stock
```typescript
import { useEffect, useState } from 'react';

export function Products() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(setProducts);
  }, []);

  return (
    <table>
      <tbody>
        {products.map(p => (
          <tr key={p.id}>
            <td>{p.name}</td>
            <td>{p.current_stock}</td>
            <td>{p.is_low_stock ? '🔴' : '🟢'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Create Purchase
```typescript
async function handlePurchase(vendor, items) {
  const res = await fetch('/api/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendor_name: vendor,
      invoice_number: `INV-${Date.now()}`,
      purchase_date: new Date().toISOString().split('T')[0],
      items
    })
  });

  if (res.ok) {
    const result = await res.json();
    alert(`Purchase #${result.data.id} created!`);
    // Refresh products
    window.location.reload();
  } else {
    alert(`Error: ${(await res.json()).message}`);
  }
}
```

### Create Sale with Validation
```typescript
async function handleSale(customer, items) {
  const res = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: customer,
      invoice_number: `SAL-${Date.now()}`,
      sale_date: new Date().toISOString().split('T')[0],
      items
    })
  });

  const result = await res.json();

  if (res.ok) {
    alert(`Sale #${result.data.id} created!`);
    window.location.reload();
  } else {
    // Show detailed error (e.g., "Insufficient stock: Product 1: available 10, required 20")
    alert(`Sale failed: ${result.message}`);
  }
}
```

---

## Error Messages (What They Mean)

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing required fields" | Missing vendor/customer, invoice #, or items | Check payload |
| "Product id X not found" | Invalid product_id | Verify product exists |
| "Insufficient stock: ..." | Not enough stock for sale | Reduce qty or reorder |
| "Failed to fetch stock ledger" | Database error | Check Supabase status |
| "Failed to record stock ledger" | Ledger insert failed | Rollback occurred |

---

## Testing: One-Liner Commands

### Reset Test Data
```typescript
const reset = async () => {
  const db = createServerSupabase();
  await db.from('stock_ledger').delete().neq('id', 0);
  await db.from('sale_items').delete().neq('id', 0);
  await db.from('sales').delete().neq('id', 0);
  await db.from('purchase_items').delete().neq('id', 0);
  await db.from('purchases').delete().neq('id', 0);
};
```

### Add Test Stock
```typescript
const addStock = async (productId, qty) => {
  const db = createServerSupabase();
  await db.from('stock_ledger').insert({
    product_id: productId,
    transaction_type: 'initialization',
    transaction_id: `test-${Date.now()}`,
    quantity_in: qty,
    quantity_out: 0,
    transaction_date: new Date().toISOString().split('T')[0]
  });
};
```

### Verify Stock
```typescript
const checkStock = async (productId) => {
  const res = await fetch('/api/products');
  const products = await res.json();
  const product = products.find(p => p.id === productId);
  return product?.current_stock ?? 0;
};
```

---

## Common Scenarios

### Scenario: Purchase arrived, add to inventory
```typescript
// Stock: 0 → 50
POST /api/purchases {
  vendor_name: "Supplier",
  invoice_number: "INV-001",
  items: [{ product_id: 1, quantity: 50, unit_price: 100 }]
}
// Result: stock_ledger entry with qty_in: 50
```

### Scenario: Customer buys, reduce inventory
```typescript
// Stock: 50 → 30
POST /api/sales {
  customer_name: "Client A",
  invoice_number: "SAL-001",
  items: [{ product_id: 1, quantity: 20, unit_price: 150 }]
}
// Result: stock_ledger entry with qty_out: 20
```

### Scenario: Try to sell but insufficient stock
```typescript
// Stock: 10, Try to sell 15
POST /api/sales {
  items: [{ product_id: 1, quantity: 15, ... }]
}
// Result: 400 error, no sale created, stock unchanged
```

### Scenario: Batch purchase multiple items
```typescript
POST /api/purchases {
  items: [
    { product_id: 1, quantity: 50, unit_price: 100 },
    { product_id: 2, quantity: 30, unit_price: 200 },
    { product_id: 3, quantity: 20, unit_price: 150 }
  ]
}
// Result: 3 ledger entries created, all stock updated
```

---

## Database Queries (Reference)

### Get Stock for All Products
```sql
SELECT 
  p.id,
  p.name,
  COALESCE(SUM(sl.quantity_in) - SUM(sl.quantity_out), 0) AS current_stock
FROM products p
LEFT JOIN stock_ledger sl ON p.id = sl.product_id
GROUP BY p.id, p.name
ORDER BY p.name;
```

### Get Low Stock Products
```sql
SELECT 
  p.id,
  p.name,
  p.reorder_point,
  COALESCE(SUM(sl.quantity_in) - SUM(sl.quantity_out), 0) AS current_stock
FROM products p
LEFT JOIN stock_ledger sl ON p.id = sl.product_id
GROUP BY p.id
HAVING COALESCE(SUM(sl.quantity_in) - SUM(sl.quantity_out), 0) <= p.reorder_point
ORDER BY current_stock ASC;
```

### Get Stock Movement History
```sql
SELECT 
  sl.transaction_date,
  sl.transaction_type,
  p.name,
  sl.quantity_in,
  sl.quantity_out,
  sl.notes
FROM stock_ledger sl
JOIN products p ON sl.product_id = p.id
ORDER BY sl.transaction_date DESC, sl.id DESC;
```

### Get Total In/Out per Product
```sql
SELECT 
  p.name,
  SUM(sl.quantity_in) AS total_in,
  SUM(sl.quantity_out) AS total_out,
  SUM(sl.quantity_in) - SUM(sl.quantity_out) AS net
FROM products p
LEFT JOIN stock_ledger sl ON p.id = sl.product_id
GROUP BY p.id, p.name
ORDER BY p.name;
```

---

## File Locations

| File | Purpose |
|------|---------|
| [stock-ledger.ts](frontend/app/api/lib/stock-ledger.ts) | Core utility functions |
| [products/route.ts](frontend/app/api/products/route.ts) | GET products endpoint |
| [purchases/route.ts](frontend/app/api/purchases/route.ts) | Purchase endpoints |
| [sales/route.ts](frontend/app/api/sales/route.ts) | Sales endpoints |
| [API_REFERENCE.md](frontend/app/api/lib/API_REFERENCE.md) | Full API docs |
| [IMPLEMENTATION_GUIDE.md](frontend/app/api/lib/IMPLEMENTATION_GUIDE.md) | Architecture guide |
| [TESTING_GUIDE.md](frontend/app/api/lib/TESTING_GUIDE.md) | Test procedures |
| [DATABASE_SCHEMA.md](frontend/app/api/lib/DATABASE_SCHEMA.md) | Schema reference |
| [IMPLEMENTATION_SUMMARY.md](frontend/app/api/lib/IMPLEMENTATION_SUMMARY.md) | Overview summary |

---

## Status Check

```typescript
async function healthCheck() {
  console.log('✅ Stock Ledger System Status:');
  
  // Check products
  const products = await fetch('/api/products').then(r => r.json());
  console.log(`  - Products: ${products.length}`);
  
  // Check purchases
  const purchases = await fetch('/api/purchases').then(r => r.json());
  console.log(`  - Purchases: ${purchases.length}`);
  
  // Check sales
  const sales = await fetch('/api/sales').then(r => r.json());
  console.log(`  - Sales: ${sales.length}`);
  
  // Check ledger
  const db = createServerSupabase();
  const ledger = await db.from('stock_ledger').select('*', { count: 'exact' });
  console.log(`  - Ledger entries: ${ledger.count}`);
  
  console.log('✅ System ready!');
}
```

---

## Migration Checklist

- [ ] Backup existing stock table
- [ ] Run `migrateStockToLedger()`
- [ ] Verify with `verifyMigration()`
- [ ] Delete old stock table
- [ ] Deploy API code
- [ ] Test with sample data
- [ ] Monitor logs

---

## Performance Tips

✅ **What's Fast**
- Computing stock (SUM query on indexed column)
- Validating stock (batch query)
- Creating purchases/sales (atomic inserts)

⚠️ **Watch Out For**
- Ledger queries on unindexed product_id
- N+1 queries (use batch functions)
- Concurrent sales (add pessimistic locking if needed)

📈 **Optimization**
```sql
CREATE INDEX idx_stock_ledger_product_id ON stock_ledger(product_id);
CREATE INDEX idx_stock_ledger_transaction_type ON stock_ledger(transaction_type);
```

---

**Version**: 1.0
**Last Updated**: 2025-01-28
**Status**: ✅ Production Ready
