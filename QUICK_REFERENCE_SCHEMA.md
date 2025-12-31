# Quick Reference - Product Price Schema Update

## Product Form (UI)
When users create/edit a product, they now fill in:
- **Name**: Product name
- **Units**: Quantity with unit (e.g., "1kg", "500g")
- **Purchase Price/Unit**: How much to buy from vendors
- **Sales Price/Unit**: How much to sell to customers
- **Low Stock Alert**: Optional reorder point

## Database Schema
```sql
products table:
- id (int)
- name (text)
- quantity_with_unit (text) -- e.g., "1kg"
- purchase_unit_price (float) -- ← NEW
- sales_unit_price (float)    -- ← NEW
- reorder_point (int, nullable)
- created_at, updated_at
```

## API Changes

### POST /api/products/
**Request:**
```json
{
  "name": "Coffee Beans",
  "quantity_with_unit": "1kg",
  "purchase_unit_price": 250,
  "sales_unit_price": 400,
  "reorder_point": 10
}
```

### POST /api/purchases/
- **Pre-fills** item unit_price from `product.purchase_unit_price`
- User can **modify** the price before saving
- Each purchase item can have a different actual price

### POST /api/sales/
- **Pre-fills** item unit_price from `product.sales_unit_price`
- User can **modify** the price before saving
- Each sale item can have a different actual price

## Frontend Components

### Products Page
- Form: Two separate price fields (purchase & sales)
- Table: Displays both prices for each product

### Purchase Page
- Pre-fills purchase prices from `purchase_unit_price`
- All prices are editable

### Sales Page
- Pre-fills sales prices from `sales_unit_price`
- All prices are editable

## Testing Examples

### Create Product
```
Name: Coffee Beans
Units: 1kg
Purchase Price: 250
Sales Price: 400
Low Stock Alert: 10
```

### Create Purchase
- Selects Coffee Beans (1kg)
- Unit price auto-fills: 250 (from purchase_unit_price)
- User can change to 245 if negotiated
- Quantity: 5
- Total: 245 × 5 = 1225

### Create Sale
- Selects Coffee Beans (1kg)
- Unit price auto-fills: 400 (from sales_unit_price)
- User can change to 450 if premium pricing
- Quantity: 2
- Total: 450 × 2 = 900

## No Breaking Changes
- Old code that referenced `price_per_unit` has been updated
- All endpoints work with the new schema
- Form validation ensures both prices are provided
- Backward compatible with price modification during transactions
