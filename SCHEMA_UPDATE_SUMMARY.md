# Product Schema Update - Dual Price Model Implementation

## Overview
Successfully updated the entire system to support separate pricing for purchases and sales operations. The `price_per_unit` field has been replaced with two distinct fields: `purchase_unit_price` (for vendor purchases) and `sales_unit_price` (for customer sales).

## Changes Made

### 1. **Backend - Models Update** (`backend/models.py`)
**Changed:**
- `price_per_unit: float` → `purchase_unit_price: float` and `sales_unit_price: float`
- Removed `default_price: float | None = None`

**Affected Classes:**
- `ProductCreate`: Now accepts both purchase and sales prices
- `ProductUpdate`: Updated to include both price fields

### 2. **Backend - Database Schema** (`backend/database.py`)
**Table Structure Update:**
```sql
-- OLD:
price_per_unit REAL NOT NULL

-- NEW:
purchase_unit_price REAL NOT NULL
sales_unit_price REAL NOT NULL
```

**Function Updates:**
- `create_product()`: Updated to accept `purchase_unit_price` and `sales_unit_price` parameters
- All other database operations automatically support the new schema

### 3. **Backend - Product Operations** (`backend/products.py`)
**Updated:**
- `append_product()`: Now passes both price fields to database creation

### 4. **Backend - API Endpoints** (`backend/main.py`)
**Product Creation Endpoint (`POST /products/`):**
- Updated to accept `purchase_unit_price` and `sales_unit_price` in request payload

**Purchase Endpoint (`POST /purchases/`):**
- Changed price lookup from `product.get("default_price", product.get("price_per_unit", 0))`
- Now uses: `product.get("purchase_unit_price", 0)`
- **Behavior:** Pre-fills purchase price with `purchase_unit_price`, but allows user to modify

**Sales Endpoint (`POST /sales/`):**
- Changed price lookup from `product.get("price_per_unit", 0)`
- Now uses: `product.get("sales_unit_price", 0)`
- **Behavior:** Pre-fills sales price with `sales_unit_price`, but allows user to modify

### 5. **Frontend - Product Management** (`frontend/app/admin/products/page.tsx`)
**Form Fields Updated:**
- Replaced `price_per_unit` input field with two separate fields:
  - `purchase_unit_price`: Price for purchasing from vendors
  - `sales_unit_price`: Price for selling to customers

**Product Table Display:**
- Updated to show both prices instead of single price
- Table columns: Name, Units, **Purchase Price/Unit**, **Sales Price/Unit**, Current Stock, etc.

**Product Interface:**
```typescript
interface Product {
  purchase_unit_price: number;  // NEW
  sales_unit_price: number;      // NEW
  // price_per_unit: number;     // REMOVED
}
```

### 6. **Frontend - Purchase Page** (`frontend/app/admin/purchase/page.tsx`)
**Updates:**
- Product interface updated to use `purchase_unit_price`
- `handleProductChange()`: Now uses `purchase_unit_price` as default price
- **User Experience:** Shows purchase_unit_price pre-filled, fully editable during purchase entry

### 7. **Frontend - Sales Page** (`frontend/app/admin/sales/page.tsx`)
**Updates:**
- All price references changed from `price_per_unit` to `sales_unit_price`
- `calculateTotal()`: Uses `product.sales_unit_price`
- Sales item pricing: Uses `sales_unit_price` as default
- **User Experience:** Shows sales_unit_price pre-filled, fully editable during sales entry

### 8. **Frontend - API Routes**

**Product Creation Route** (`frontend/app/api/products/route.ts`)
- `POST /api/products/`: Updated to handle `purchase_unit_price` and `sales_unit_price`
- Validates both prices are provided and numeric

**Product Update Route** (`frontend/app/api/products/[id]/route.ts`)
- `PUT /api/products/{id}`: Added both price fields to allowed columns
- Properly converts string inputs to numbers

### 9. **Documentation Updates**
**Files Updated:**
- `INVENTORY_IMPLEMENTATION_COMPLETE.md`: Updated product schema description
- `frontend/app/api/lib/DATABASE_SCHEMA.md`: Updated SQL schema documentation
- `frontend/app/api/lib/DEPLOYMENT_CHECKLIST.md`: Updated deployment requirements
- `frontend/app/api/lib/IMPLEMENTATION_SUMMARY.md`: Updated architecture diagram

## Data Flow Examples

### Adding a Product
```json
POST /api/products/
{
  "name": "Coffee Beans",
  "quantity_with_unit": "1kg",
  "purchase_unit_price": 250,    // Price from vendor
  "sales_unit_price": 400,       // Price to customer
  "reorder_point": 10
}
```

### Creating a Purchase
```json
POST /api/purchases/
{
  "vendor_name": "ABC Suppliers",
  "invoice_number": "INV-001",
  "purchase_date": "2025-01-15",
  "items": [
    {
      "product_id": 1,
      "quantity": 5,
      "unit_price": 250  // Pre-filled from purchase_unit_price, user can modify
    }
  ]
}
```

### Creating a Sale
```json
POST /api/sales/
{
  "customer_name": "John Doe",
  "sale_date": "2025-01-15",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price": 400  // Pre-filled from sales_unit_price, user can modify
    }
  ]
}
```

## Key Features
✅ **Separate Purchase & Sales Pricing**: Products can have different prices for buying and selling
✅ **User Editable**: Both purchase and sales prices can be modified during transaction entry
✅ **No Data Loss**: Old price data can be migrated to the appropriate field during deployment
✅ **Backward Compatible**: API endpoints properly handle optional price overrides
✅ **Consistent UI**: Both purchase and sales pages follow the same pattern

## Testing Checklist
- [ ] Create a new product with both purchase and sales prices
- [ ] Edit a product and verify both prices update correctly
- [ ] Create a purchase and verify purchase_unit_price is pre-filled
- [ ] Create a purchase and verify price can be modified
- [ ] Create a sale and verify sales_unit_price is pre-filled
- [ ] Create a sale and verify price can be modified
- [ ] Verify products table shows both prices
- [ ] Check calculations use correct prices in purchases and sales

## Migration Notes
If migrating from old schema:
1. `price_per_unit` → can map to `purchase_unit_price` (buying price)
2. `default_price` → can map to `sales_unit_price` (selling price)
3. SQL migration example:
   ```sql
   ALTER TABLE products 
   ADD COLUMN purchase_unit_price REAL NOT NULL DEFAULT price_per_unit,
   ADD COLUMN sales_unit_price REAL NOT NULL DEFAULT COALESCE(default_price, price_per_unit);
   
   ALTER TABLE products DROP COLUMN price_per_unit, DROP COLUMN default_price;
   ```
