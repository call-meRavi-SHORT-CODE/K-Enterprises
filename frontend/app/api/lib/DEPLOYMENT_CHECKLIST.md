/**
 * DEPLOYMENT & LAUNCH CHECKLIST
 * 
 * Complete checklist for deploying the enterprise inventory system
 */

# Deployment Checklist

## 🔍 Pre-Deployment Verification

### Database Setup
- [ ] `stock_ledger` table exists in Supabase
  - [ ] Columns: id, product_id, transaction_type, transaction_id, quantity_in, quantity_out, transaction_date, notes, created_at
  - [ ] Indexes on product_id and transaction_date
- [ ] `products` table exists and has NO stock field
  - [ ] Columns: id, name, quantity_with_unit, price_per_unit, reorder_point
- [ ] `purchases` and `purchase_items` tables exist
- [ ] `sales` and `sale_items` tables exist
- [ ] If migrating: Old `stock` table backed up

### Code Changes Applied
- [ ] [frontend/app/api/products/route.ts](frontend/app/api/products/route.ts) updated with ledger logic
- [ ] [frontend/app/api/purchases/route.ts](frontend/app/api/purchases/route.ts) updated with stock_ledger entries
- [ ] [frontend/app/api/sales/route.ts](frontend/app/api/sales/route.ts) updated with stock validation
- [ ] [frontend/app/api/lib/stock-ledger.ts](frontend/app/api/lib/stock-ledger.ts) created
- [ ] All imports correct and no TypeScript errors
  ```bash
  npm run build
  ```

### Documentation Complete
- [ ] [API_REFERENCE.md](frontend/app/api/lib/API_REFERENCE.md) ✅
- [ ] [IMPLEMENTATION_GUIDE.md](frontend/app/api/lib/IMPLEMENTATION_GUIDE.md) ✅
- [ ] [TESTING_GUIDE.md](frontend/app/api/lib/TESTING_GUIDE.md) ✅
- [ ] [DATABASE_SCHEMA.md](frontend/app/api/lib/DATABASE_SCHEMA.md) ✅
- [ ] [QUICK_REFERENCE.md](frontend/app/api/lib/QUICK_REFERENCE.md) ✅

---

## 🧪 Testing (Before Deployment)

### Unit Tests
- [ ] GET /api/products returns correct current_stock
- [ ] GET /api/products returns correct is_low_stock
- [ ] POST /api/purchases creates purchase record
- [ ] POST /api/purchases creates purchase_items
- [ ] POST /api/purchases creates stock_ledger entry with qty_in
- [ ] POST /api/sales validates stock before creating
- [ ] POST /api/sales creates sale record (on success)
- [ ] POST /api/sales creates sale_items (on success)
- [ ] POST /api/sales creates stock_ledger entry with qty_out

### Integration Tests
- [ ] Purchase 100 units → stock becomes 100
- [ ] Sale 60 units → stock becomes 40
- [ ] Sale with insufficient stock → rejected (400 error)
- [ ] Multiple items in purchase → all updated
- [ ] Multiple items in sale → all updated or all rejected
- [ ] Rollback works: invalid product_id → no purchase created
- [ ] Rollback works: ledger error → no sale created

### Manual Testing
```bash
# Start dev server
npm run dev

# Test GET products
curl http://localhost:3000/api/products

# Test POST purchase
curl -X POST http://localhost:3000/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"vendor_name":"Test","invoice_number":"INV-1","purchase_date":"2025-01-20","items":[{"product_id":1,"quantity":50,"unit_price":100}]}'

# Test POST sale
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Test","invoice_number":"SAL-1","sale_date":"2025-01-21","items":[{"product_id":1,"quantity":20,"unit_price":150}]}'
```

### Error Handling Tests
- [ ] Invalid product_id → 400 error
- [ ] Missing required fields → 400 error
- [ ] Insufficient stock → 400 error with details
- [ ] Database error → 500 error with message
- [ ] All error responses have `status: "error"` and `message`

---

## 📊 Data Migration (If Applicable)

### Backup Existing Data
```bash
# Export current stock data
psql -h db.supabase.co -U postgres -d postgres \
  -c "SELECT * FROM stock;" > stock_backup.csv
```

### Run Migration
```typescript
// In Node.js environment
import { migrateStockToLedger, verifyMigration } from '@/app/api/lib/migration-tools';

const result = await migrateStockToLedger();
console.log(`Migrated ${result.migrated} records`);

const report = await verifyMigration();
console.log(report);
```

### Verify Migration
- [ ] All products have ledger entries
- [ ] Ledger stock matches old stock table
- [ ] No discrepancies reported

### Cleanup
- [ ] Delete old stock table after verification
- [ ] Update any backend code referencing old stock table
- [ ] Confirm no errors in logs

---

## 🚀 Deployment Steps

### Step 1: Build & Test
```bash
cd frontend
npm install
npm run build
npm run lint
```
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds

### Step 2: Environment Variables
- [ ] NEXT_PUBLIC_SUPABASE_URL set
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY set
- [ ] All API keys in .env.local

### Step 3: Deploy to Production
```bash
# Option A: Vercel
vercel deploy --prod

# Option B: Manual
npm run build
# Upload to your hosting
```

- [ ] Deployment succeeds
- [ ] No build warnings
- [ ] API endpoints accessible

### Step 4: Smoke Tests (Production)
```bash
# Test production endpoints
curl https://yourdomain.com/api/products
curl -X POST https://yourdomain.com/api/purchases \
  -H "Content-Type: application/json" \
  -d '...'
```

- [ ] GET /api/products returns data
- [ ] POST /api/purchases succeeds
- [ ] POST /api/sales succeeds
- [ ] Error handling works (invalid product)
- [ ] Stock validation works (insufficient)

---

## 📋 Post-Deployment

### Monitoring
- [ ] Set up error logging (Sentry, LogRocket, etc.)
- [ ] Monitor API response times
- [ ] Set up alerts for 500 errors
- [ ] Track purchases and sales volume

### Logs to Watch
```
API /api/products GET error:
API /api/purchases POST error:
API /api/sales POST error:
Failed to insert stock_ledger:
```

### Health Check (Daily for 1 Week)
```typescript
// Run this daily
const check = async () => {
  const res = await fetch('https://yourdomain.com/api/products');
  const products = await res.json();
  console.log(`✅ ${products.length} products fetched`);
};
```

### Performance Monitoring
- [ ] API response time < 500ms (95th percentile)
- [ ] No N+1 queries
- [ ] Database CPU < 80%
- [ ] Memory usage stable

---

## 🔒 Security Checklist

### API Security
- [ ] Only server-side Supabase client used (no anon key in API code)
- [ ] All inputs validated (product_id, quantities, dates)
- [ ] SQL injection impossible (using Supabase client)
- [ ] Rate limiting considered
- [ ] Error messages don't leak sensitive data

### Database Security
- [ ] Row-level security (RLS) policies set
- [ ] Foreign keys enforced
- [ ] Backups configured
- [ ] Read replicas for analytics (optional)

### Audit Trail
- [ ] All stock changes in stock_ledger with timestamp
- [ ] Purchaser/salesperson info captured (optional field)
- [ ] Transaction reference IDs tracked
- [ ] Cannot delete ledger entries (audit-proof)

---

## 📈 Scaling Considerations

### Current State (Small)
- [ ] Works for < 100k ledger entries
- [ ] Single database instance OK
- [ ] Real-time updates via polling

### If Growing (> 100k entries)
- [ ] Add database indexes
  ```sql
  CREATE INDEX idx_stock_ledger_product_date 
    ON stock_ledger(product_id, transaction_date);
  ```
- [ ] Implement pagination for ledger queries
- [ ] Consider materialized views for reports

### If Large (> 1M entries)
- [ ] Archive old ledger entries
- [ ] Use read replicas for reporting
- [ ] Implement real-time WebSocket subscriptions
- [ ] Cache computed stock values (with TTL)

---

## 🐛 Troubleshooting

### Problem: Stock appears wrong
```
Check: Run SELECT current_stock FROM computed_stock_view
      vs GET /api/products response
```
- [ ] Verify stock_ledger has entries
- [ ] Verify SUM logic: (qty_in - qty_out) per product
- [ ] Check for orphaned entries (product_id doesn't exist)

### Problem: Sale accepted but shouldn't (stock went negative)
```
Likely: Concurrent sales race condition
Fix: Implement database-level row locks or constraints
Monitor: Check if stock ever goes negative in logs
```
- [ ] Review timestamps of ledger entries
- [ ] Identify if concurrent sales happened
- [ ] Plan pessimistic locking for v2

### Problem: Purchase/Sale fails to create
```
Check: Look for ledger insert error in logs
Likely causes:
1. Product_id doesn't exist
2. Database connection issue
3. Constraint violation
```
- [ ] Verify all product_ids exist
- [ ] Check database status
- [ ] Review constraint definitions

### Problem: API timeout
```
Slow: GET /api/products taking > 1s
```
- [ ] Check product count (shouldn't matter, indexed)
- [ ] Check ledger size for specific products
- [ ] Add missing indexes
- [ ] Consider caching if repeated calls

---

## 📞 Communication

### Team Notification
- [ ] Notify team of launch date
- [ ] Share [QUICK_REFERENCE.md](frontend/app/api/lib/QUICK_REFERENCE.md) with developers
- [ ] Training on new API endpoints
- [ ] Share error codes and meanings

### Documentation Links
- [ ] [API_REFERENCE.md](frontend/app/api/lib/API_REFERENCE.md) - Developers
- [ ] [IMPLEMENTATION_GUIDE.md](frontend/app/api/lib/IMPLEMENTATION_GUIDE.md) - Architects
- [ ] [QUICK_REFERENCE.md](frontend/app/api/lib/QUICK_REFERENCE.md) - Quick lookup
- [ ] [DATABASE_SCHEMA.md](frontend/app/api/lib/DATABASE_SCHEMA.md) - DBAs

### Customer Communication (Optional)
- [ ] "Stock accuracy improved with new real-time system"
- [ ] "Low stock alerts now faster and more reliable"
- [ ] "Inventory visibility improved"

---

## ✅ Final Sign-Off

### QA Verification
- [ ] All tests passed
- [ ] No known bugs
- [ ] Performance acceptable
- [ ] Security reviewed
- **QA Sign-off**: _______________ Date: ______

### Product Owner Approval
- [ ] Feature complete
- [ ] Requirements met
- [ ] Ready for production
- **PO Sign-off**: _______________ Date: ______

### DevOps/Infrastructure
- [ ] Deployment approved
- [ ] Monitoring configured
- [ ] Rollback plan ready
- [ ] Team on-call for issues
- **DevOps Sign-off**: _______________ Date: ______

---

## 🎉 Launch Day

### Morning Checklist
- [ ] Database backups verified
- [ ] Team online and ready
- [ ] Monitoring dashboards open
- [ ] Rollback plan documented and tested

### Deployment
```bash
# 1. Code deploy
npm run build && npm run deploy

# 2. Database migration (if needed)
node scripts/migrate.js

# 3. Smoke tests
curl production/api/products
```

### Post-Deployment (First Hour)
- [ ] Monitor error logs
- [ ] Check API response times
- [ ] Verify stock accuracy
- [ ] Test purchase/sale flow
- [ ] Check database performance

### Post-Deployment (First 24 Hours)
- [ ] Monitor for edge cases
- [ ] Track user feedback
- [ ] Watch for performance issues
- [ ] Verify backup procedures

### Post-Deployment (First Week)
- [ ] Daily health checks
- [ ] Monitor stock accuracy
- [ ] Track any issues
- [ ] Collect team feedback
- [ ] Plan v2 improvements

---

## 🚨 Rollback Plan

### If Critical Issues Found
```bash
# Step 1: Stop using new APIs
# Revert to old API endpoints (if available)

# Step 2: Revert code
git revert <commit_hash>
npm run build && npm run deploy

# Step 3: Verify old system works
curl production/api/products

# Step 4: Investigate issue
# Review logs and error messages
```

### Issues Requiring Rollback
- Stock going negative unexpectedly
- Data corruption detected
- API consistently timing out (> 10s)
- Database connection lost
- Rollback mechanism: ________________ (specify)

---

## 📅 Post-Launch Review

### 1-Week Review
- [ ] System stability: ____/10
- [ ] User satisfaction: ____/10
- [ ] Stock accuracy: ____/10
- [ ] Performance: ____/10
- Issues found: _________________
- Improvements needed: _________________

### 1-Month Review
- [ ] Total purchases: ______
- [ ] Total sales: ______
- [ ] Low stock alerts: ______
- [ ] System uptime: _____%
- [ ] Average response time: ______ms
- [ ] Bugs fixed: ______
- **Status**: ⬜ On Track / 🟡 Minor Issues / 🔴 Major Issues

---

**Deployment Ready**: ✅ YES / ❌ NO

**Approved By**:
- Development: _______________
- Testing: _______________
- Operations: _______________
- Management: _______________

**Deployment Date**: _____________
**Go-Live Time**: _____________
**Prepared By**: _____________
