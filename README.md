# 1. PRODUCT TABLE (your item list)

Store one record per item, with precomputed default price and unit.

products
---------
product_id      PK
item_name       VARCHAR
unit_name       VARCHAR    -- Example: "1 Kg", "500 g", "1 pc", "1 box"
unit_base_qty   DECIMAL    -- Example: 1Kg = 1, 500g = 0.5 if base = 1kg
default_price   DECIMAL    -- your precomputed cost, ex. 620 for 1Kg, 130 for 500g
low_stock_alert INT

# IMPORTANT

The default_price is the precomputed price you already have.
During purchase/sale:

User enters only quantity

System uses default_price

But user can override price


# 2. PURCHASE ENTRY TABLE

Purchase header:

purchases
---------
purchase_id PK
vendor_name
purchase_date
total_amount
notes

Purchase items:

purchase_items
----------------
id              PK
purchase_id     FK
product_id      FK
quantity        DECIMAL
unit_price      DECIMAL  -- auto-filled from default_price, user may override
total_price     AS (quantity * unit_price)