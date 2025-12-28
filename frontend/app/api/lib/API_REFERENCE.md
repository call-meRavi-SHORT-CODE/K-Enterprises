/**
 * INVENTORY API REFERENCE
 * 
 * Complete API documentation for the enterprise inventory system
 */

# API Endpoints Reference

## 1. GET /api/products
Get all products with real-time stock information

### Request
```
GET /api/products
```

### Response (200 OK)
```json
[
  {
    "id": 1,
    "name": "Premium Coffee Beans",
    "quantity_with_unit": "1kg",
    "price_per_unit": 850,
    "reorder_point": 10,
    "current_stock": 45,
    "is_low_stock": false,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Tea Leaves",
    "quantity_with_unit": "500g",
    "price_per_unit": 450,
    "reorder_point": 20,
    "current_stock": 8,
    "is_low_stock": true,
    "created_at": "2025-01-02T00:00:00.000Z",
    "updated_at": "2025-01-02T00:00:00.000Z"
  }
]
```

### Response (500 Internal Server Error)
```json
{
  "status": "error",
  "message": "Failed to fetch products"
}
```

### Notes
- `current_stock` is computed from stock_ledger in real-time
- `is_low_stock` is true when `current_stock <= reorder_point`
- Results ordered by creation date (newest first)

---

## 2. POST /api/purchases
Record a purchase from a vendor

### Request
```
POST /api/purchases
Content-Type: application/json

{
  "vendor_name": "ABC Wholesale Supply",
  "invoice_number": "INV-2025-001",
  "purchase_date": "2025-01-20",
  "notes": "Rush delivery",
  "items": [
    {
      "product_id": 1,
      "quantity": 50,
      "unit_price": 800
    },
    {
      "product_id": 2,
      "quantity": 30,
      "unit_price": 400
    }
  ]
}
```

### Request Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vendor_name | string | ✅ | Name of the vendor |
| invoice_number | string | ✅ | Unique invoice identifier |
| purchase_date | string (YYYY-MM-DD) | ✅ | Date of purchase |
| notes | string | ❌ | Additional notes |
| items | array | ✅ | Array of items being purchased |
| items[].product_id | number | ✅ | Product ID |
| items[].quantity | number | ✅ | Quantity purchased |
| items[].unit_price | number | ✅ | Price per unit |

### Response (200 OK)
```json
{
  "status": "success",
  "message": "Purchase created successfully",
  "data": {
    "id": 42,
    "total_amount": 52000
  }
}
```

### Response (400 Bad Request)
```json
{
  "status": "error",
  "message": "Missing required fields"
}
```

```json
{
  "status": "error",
  "message": "Product id 99 not found"
}
```

### Response (500 Internal Server Error)
```json
{
  "status": "error",
  "message": "Failed to record stock ledger"
}
```

### Side Effects
- Creates entry in `purchases` table
- Creates entry in `purchase_items` for each item
- Creates entry in `stock_ledger` with `quantity_in` for each item
- Updates real-time product stock

### Rollback Triggers
- Product ID doesn't exist → deletes purchase
- purchase_items insert fails → deletes purchase
- stock_ledger insert fails → deletes purchase and items

---

## 3. GET /api/purchases
Get all purchases with line items

### Request
```
GET /api/purchases
```

### Response (200 OK)
```json
[
  {
    "id": 42,
    "vendor_name": "ABC Wholesale Supply",
    "invoice_number": "INV-2025-001",
    "purchase_date": "2025-01-20",
    "total_amount": 52000,
    "notes": "Rush delivery",
    "created_at": "2025-01-20T10:30:00.000Z",
    "purchase_items": [
      {
        "id": 1,
        "purchase_id": 42,
        "product_id": 1,
        "product_name": "Premium Coffee Beans",
        "quantity": 50,
        "unit_price": 800,
        "total_price": 40000
      },
      {
        "id": 2,
        "purchase_id": 42,
        "product_id": 2,
        "product_name": "Tea Leaves",
        "quantity": 30,
        "unit_price": 400,
        "total_price": 12000
      }
    ]
  }
]
```

### Response (500 Internal Server Error)
```json
{
  "status": "error",
  "message": "Failed to fetch purchases"
}
```

### Notes
- Results ordered by purchase_date (newest first)
- Includes nested purchase_items for each purchase

---

## 4. POST /api/sales
Record a sale to a customer (WITH STOCK VALIDATION)

### Request
```
POST /api/sales
Content-Type: application/json

{
  "customer_name": "John's Retail Store",
  "invoice_number": "SAL-2025-001",
  "sale_date": "2025-01-21",
  "notes": "Bulk order - net 30",
  "items": [
    {
      "product_id": 1,
      "quantity": 20,
      "unit_price": 1200
    },
    {
      "product_id": 2,
      "quantity": 10,
      "unit_price": 600
    }
  ]
}
```

### Request Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_name | string | ✅ | Name of the customer |
| invoice_number | string | ✅ | Unique invoice identifier |
| sale_date | string (YYYY-MM-DD) | ✅ | Date of sale |
| notes | string | ❌ | Additional notes |
| items | array | ✅ | Array of items being sold |
| items[].product_id | number | ✅ | Product ID |
| items[].quantity | number | ✅ | Quantity sold |
| items[].unit_price | number | ✅ | Price per unit |

### Response (200 OK)
```json
{
  "status": "success",
  "message": "Sale created successfully",
  "data": {
    "id": 99,
    "total_amount": 30000
  }
}
```

### Response (400 Bad Request - Missing Fields)
```json
{
  "status": "error",
  "message": "Missing required fields"
}
```

### Response (400 Bad Request - Product Not Found)
```json
{
  "status": "error",
  "message": "Product id 99 not found"
}
```

### Response (400 Bad Request - Insufficient Stock)
```json
{
  "status": "error",
  "message": "Insufficient stock: Product 1: available 10, required 20; Product 2: available 5, required 10"
}
```

⚠️ **CRITICAL**: Sale is **rejected entirely** if ANY product has insufficient stock. No partial sales.

### Response (500 Internal Server Error)
```json
{
  "status": "error",
  "message": "Failed to record stock ledger"
}
```

### Side Effects (on success)
- Creates entry in `sales` table
- Creates entry in `sale_items` for each item
- Creates entry in `stock_ledger` with `quantity_out` for each item
- Decreases product stock in real-time

### Validation Steps (EXECUTED BEFORE CREATING SALE)
1. All product IDs validated
2. For each item: current_stock computed from stock_ledger
3. For each item: check if quantity <= current_stock
4. If ANY item fails validation → REJECT and RETURN error (no sale created)
5. If ALL items pass → proceed with sale creation

### Rollback Triggers
- Product ID doesn't exist
- Any product has insufficient stock (prevents sale creation)
- sale_items insert fails → deletes sale
- stock_ledger insert fails → deletes sale and items

---

## 5. GET /api/sales
Get all sales with line items

### Request
```
GET /api/sales
```

### Response (200 OK)
```json
[
  {
    "id": 99,
    "customer_name": "John's Retail Store",
    "invoice_number": "SAL-2025-001",
    "sale_date": "2025-01-21",
    "total_amount": 30000,
    "notes": "Bulk order - net 30",
    "created_at": "2025-01-21T14:45:00.000Z",
    "sale_items": [
      {
        "id": 1,
        "sale_id": 99,
        "product_id": 1,
        "product_name": "Premium Coffee Beans",
        "quantity": 20,
        "unit_price": 1200,
        "total_price": 24000
      },
      {
        "id": 2,
        "sale_id": 99,
        "product_id": 2,
        "product_name": "Tea Leaves",
        "quantity": 10,
        "unit_price": 600,
        "total_price": 6000
      }
    ]
  }
]
```

### Response (500 Internal Server Error)
```json
{
  "status": "error",
  "message": "Failed to fetch sales"
}
```

### Notes
- Results ordered by sale_date (newest first)
- Includes nested sale_items for each sale

---

# Utility Functions

## getCurrentStock(supabase, product_id)
Get current stock for a single product

```typescript
import { getCurrentStock } from '@/app/api/lib/stock-ledger';

const stock = await getCurrentStock(supabase, 1);
// Returns: 45
```

## getCurrentStockBatch(supabase, product_ids)
Get current stock for multiple products

```typescript
import { getCurrentStockBatch } from '@/app/api/lib/stock-ledger';

const stocks = await getCurrentStockBatch(supabase, [1, 2, 3]);
// Returns: Map { 1 => 45, 2 => 8, 3 => 0 }
```

## validateStockBatch(supabase, items)
Validate stock availability for multiple items

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

# Error Handling

All endpoints return standardized error responses:

```json
{
  "status": "error",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes
| Code | Meaning | Examples |
|------|---------|----------|
| 200 | Success | Purchase/sale created, products fetched |
| 400 | Bad Request | Missing fields, product not found, insufficient stock |
| 500 | Server Error | Database error, unexpected exception |

### Best Practices
```typescript
const response = await fetch('/api/sales', { method: 'POST', body: JSON.stringify(data) });

if (response.status === 200) {
  const result = await response.json();
  console.log('Sale created:', result.data.id);
} else if (response.status === 400) {
  const error = await response.json();
  showAlert(`Cannot create sale: ${error.message}`);
  // e.g., "Insufficient stock: Product 1: available 10, required 20"
} else {
  showAlert('Server error, please try again');
}
```

---

# Concurrency & Safety

### Stock Computation
- ✅ SAFE: Multiple reads of stock_ledger see consistent data
- ✅ SAFE: Stock never goes negative (validation before sale)
- ⚠️ EDGE CASE: Two sales simultaneously against same stock
  - Both read ledger, both validate OK, both commit
  - Result: stock may go slightly negative
  - **Mitigation**: Accept edge case for MVP, monitor logs

### Transaction Atomicity
- ✅ ATOMIC: Insert purchase + insert items + insert ledger (all or nothing)
- ✅ ATOMIC: Insert sale + insert items + insert ledger (all or nothing)
- ✅ ATOMIC: Delete on failure (automatic rollback)

---

# Integration Examples

## React Component
```typescript
import { useEffect, useState } from 'react';

export function InventoryDashboard() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => setProducts(data));
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Stock</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {products.map(p => (
          <tr key={p.id}>
            <td>{p.name}</td>
            <td>{p.current_stock}</td>
            <td>{p.is_low_stock ? '🔴 Low Stock' : '🟢 OK'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Create Purchase
```typescript
async function createPurchase(vendor, items) {
  const response = await fetch('/api/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendor_name: vendor,
      invoice_number: `INV-${Date.now()}`,
      purchase_date: new Date().toISOString().split('T')[0],
      items: items
    })
  });

  if (response.ok) {
    const result = await response.json();
    console.log(`Purchase #${result.data.id} created`);
  } else {
    const error = await response.json();
    console.error(`Error: ${error.message}`);
  }
}
```

## Create Sale (with validation feedback)
```typescript
async function createSale(customer, items) {
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: customer,
      invoice_number: `SAL-${Date.now()}`,
      sale_date: new Date().toISOString().split('T')[0],
      items: items
    })
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`Sale #${result.data.id} created successfully`);
  } else {
    // Show detailed stock error
    console.error(`Sale failed: ${result.message}`);
    // e.g., "Insufficient stock: Product 1: available 10, required 20"
  }
}
```
