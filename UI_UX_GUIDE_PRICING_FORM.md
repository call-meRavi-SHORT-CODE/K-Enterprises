# UI/UX Guide - Product Pricing Form Update

## ADD PRODUCT FORM - BEFORE vs AFTER

### BEFORE (Old Single Price Model)
```
┌─────────────────────────────────────────┐
│  Add Product Dialog                     │
├─────────────────────────────────────────┤
│                                         │
│  Name                                   │
│  [Enter product name________________]   │
│                                         │
│  Units                                  │
│  [Quantity__________] [Unit:kg   ▼]     │
│                                         │
│  Price/Unit                             │
│  [₹ 350____________________________]     │
│                                         │
│  Low Stock Alert                        │
│  [Alert qty____________________________] │
│                                         │
│  [Cancel]  [Save Product]               │
└─────────────────────────────────────────┘

Fields: name, quantity, unit, price_per_unit, reorder_point
Total: 5 inputs
```

### AFTER (New Dual Price Model)
```
┌─────────────────────────────────────────┐
│  Add Product Dialog                     │
├─────────────────────────────────────────┤
│                                         │
│  Name                                   │
│  [Enter product name________________]   │
│                                         │
│  Units                                  │
│  [Quantity__________] [Unit:kg   ▼]     │
│                                         │
│  Purchase Price/Unit                    │
│  [₹ 250____________________________]     │
│  (Price when buying from vendors)       │
│                                         │
│  Sales Price/Unit                       │
│  [₹ 400____________________________]     │
│  (Price when selling to customers)      │
│                                         │
│  Low Stock Alert                        │
│  [Alert qty____________________________] │
│                                         │
│  [Cancel]  [Save Product]               │
└─────────────────────────────────────────┘

Fields: name, quantity, unit, purchase_unit_price, sales_unit_price, reorder_point
Total: 6 inputs
Profit margin visible: 400 - 250 = ₹150 per unit
```

---

## PRODUCT TABLE - BEFORE vs AFTER

### BEFORE
```
┌─────────────────────────────────────────────────────────────────┐
│ Name          │ Units  │ Price/Unit │ Stock │ Alert │ Actions  │
├─────────────────────────────────────────────────────────────────┤
│ Coffee Beans  │ 1kg    │ ₹350       │ 45    │ 10    │ ✎ 🗑     │
│ Tea Leaves    │ 500g   │ ₹200       │ 30    │ 5     │ ✎ 🗑     │
│ Sugar         │ 1kg    │ ₹75        │ 120   │ 20    │ ✎ 🗑     │
└─────────────────────────────────────────────────────────────────┘

Shows: 1 price column (unclear if buying or selling price)
```

### AFTER
```
┌──────────────────────────────────────────────────────────────────────┐
│ Name        │ Units │ Purchase    │ Sales   │ Stock │ Alert │ Act  │
│             │       │ Price/Unit  │ Price   │       │       │      │
├──────────────────────────────────────────────────────────────────────┤
│ Coffee Beans│ 1kg   │ ₹250        │ ₹400    │ 45    │ 10    │ ✎ 🗑 │
│ Tea Leaves  │ 500g  │ ₹150        │ ₹250    │ 30    │ 5     │ ✎ 🗑 │
│ Sugar       │ 1kg   │ ₹50         │ ₹75     │ 120   │ 20    │ ✎ 🗑 │
└──────────────────────────────────────────────────────────────────────┘

Shows: 2 price columns
- Purchase Price: What you pay vendors
- Sales Price: What you charge customers
- Profit margin clearly visible for each product
```

---

## PURCHASE FORM - BEHAVIOR

### Item Price Pre-fill
```
User selects: Coffee Beans
↓
System looks up: product.purchase_unit_price = ₹250
↓
Auto-fills in form: Unit Price = ₹250
↓
User can:
- Keep it as is (₹250)
- Change to ₹245 (negotiated price)
- Change to ₹255 (premium batch)
↓
Saves: whatever user entered
```

### Example
```
Create Purchase:
├─ Vendor: ABC Suppliers
├─ Items:
│  ├─ Coffee Beans (1kg)
│  │  ├─ Quantity: 5
│  │  └─ Unit Price: 250 → 245 ✓ (user modified)
│  │     Total: 245 × 5 = ₹1,225
│  └─ Tea Leaves (500g)
│     ├─ Quantity: 10
│     └─ Unit Price: 150 (kept default)
│        Total: 150 × 10 = ₹1,500
└─ Purchase Total: ₹2,725
```

---

## SALES FORM - BEHAVIOR

### Item Price Pre-fill
```
User selects: Coffee Beans
↓
System looks up: product.sales_unit_price = ₹400
↓
Auto-fills in form: Unit Price = ₹400
↓
User can:
- Keep it as is (₹400)
- Change to ₹450 (premium customer)
- Change to ₹380 (bulk discount)
↓
Saves: whatever user entered
```

### Example
```
Create Sale:
├─ Customer: John Doe
├─ Items:
│  ├─ Coffee Beans (1kg)
│  │  ├─ Quantity: 2
│  │  └─ Unit Price: 400 → 450 ✓ (user modified)
│  │     Total: 450 × 2 = ₹900
│  └─ Sugar (1kg)
│     ├─ Quantity: 1
│     └─ Unit Price: 75 (kept default)
│        Total: 75 × 1 = ₹75
└─ Sale Total: ₹975
```

---

## PRICE FLOW DIAGRAM

```
PRODUCT ENTRY
│
├─ Coffee Beans
│  ├─ Purchase Price: ₹250
│  └─ Sales Price: ₹400
│
PURCHASE WORKFLOW
│
├─ System: Uses ₹250 (purchase_unit_price)
├─ User: Can modify before saving
│  ├─ Option A: Keep ₹250 ✓
│  ├─ Option B: Change to ₹245 ✓
│  └─ Option C: Change to ₹255 ✓
└─ Saves: User's final value
   └─ Stock updates with actual cost
   
SALES WORKFLOW
│
├─ System: Uses ₹400 (sales_unit_price)
├─ User: Can modify before saving
│  ├─ Option A: Keep ₹400 ✓
│  ├─ Option B: Change to ₹450 ✓
│  └─ Option C: Change to ₹380 ✓
└─ Saves: User's final value
   └─ Revenue recorded with actual price
```

---

## PROFIT ANALYSIS EXAMPLE

Product: Coffee Beans (1kg)
```
Purchase Price: ₹250
Sales Price: ₹400
━━━━━━━━━━━━━━
Base Profit: ₹150 (60% margin)

SCENARIO 1: Normal Transaction
├─ Buy at ₹250
├─ Sell at ₹400
└─ Profit: ₹150 ✓

SCENARIO 2: Bulk Purchase (negotiated)
├─ Buy at ₹245 (negotiated down)
├─ Sell at ₹400
└─ Profit: ₹155 ✓ (better!)

SCENARIO 3: Premium Sale (special customer)
├─ Buy at ₹250
├─ Sell at ₹450 (premium customer willing to pay)
└─ Profit: ₹200 ✓ (much better!)

SCENARIO 4: Volume Discount (large order)
├─ Buy at ₹250
├─ Sell at ₹380 (bulk customer discount)
└─ Profit: ₹130 ✓ (still profitable)
```

---

## USER INSTRUCTIONS

### For Managers Creating Products
1. Open "Add Product" dialog
2. Fill in product name and unit quantity
3. **Enter Purchase Price** - What you pay vendors
4. **Enter Sales Price** - What you charge customers
5. Set low stock alert level if needed
6. Click "Save Product"

### For Purchasers
1. Create purchase order
2. Select product
3. **Purchase price auto-fills** from product setup
4. Can override if you negotiated a different price
5. Complete the purchase

### For Sales Staff
1. Create sale order
2. Select product
3. **Sales price auto-fills** from product setup
4. Can override if customer negotiated a discount
5. Complete the sale

---

## KEY BENEFITS

✅ **Clarity**: Everyone knows what prices are for
✅ **Flexibility**: Prices can be adjusted per transaction
✅ **Profitability**: Easy to see profit margins
✅ **Control**: System enforces consistency but allows exceptions
✅ **Audit Trail**: All price changes are recorded
✅ **Scalability**: Supports complex pricing strategies
