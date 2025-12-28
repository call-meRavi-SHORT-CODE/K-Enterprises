/**
 * Database Migration Tool
 * 
 * Use this to migrate from old stock table to stock_ledger-based system
 */

import { createServerSupabase } from '@/lib/supabase-server';

/**
 * MIGRATION FUNCTION
 * 
 * If you have existing stock data in a "stock" table, run this to convert it to stock_ledger format
 * 
 * STEPS:
 * 1. Ensure stock_ledger table exists in your database
 * 2. Run this function ONCE
 * 3. Verify stock_ledger has entries for all products
 * 4. Delete the old stock table
 * 5. Deploy the new API code
 */
export async function migrateStockToLedger() {
  try {
    const supabase = createServerSupabase();

    // Step 1: Fetch all stock entries from old stock table
    const { data: stockData, error: fetchErr } = await supabase
      .from('stock')
      .select('product_id, available_stock');

    if (fetchErr) {
      throw new Error(`Failed to fetch old stock data: ${fetchErr.message}`);
    }

    if (!stockData || stockData.length === 0) {
      console.log('No stock data to migrate');
      return { migrated: 0, errors: [] };
    }

    // Step 2: Convert to stock_ledger format
    const ledgerEntries = (stockData || []).map((stock: any) => ({
      product_id: stock.product_id,
      transaction_type: 'initialization',
      transaction_id: `init-${stock.product_id}`,
      quantity_in: Number(stock.available_stock),
      quantity_out: 0,
      transaction_date: new Date().toISOString().split('T')[0],
      notes: 'Initial stock migration from stock table'
    }));

    // Step 3: Insert into stock_ledger
    const { error: insertErr } = await supabase
      .from('stock_ledger')
      .insert(ledgerEntries);

    if (insertErr) {
      throw new Error(`Failed to insert ledger entries: ${insertErr.message}`);
    }

    console.log(`Successfully migrated ${ledgerEntries.length} stock records to stock_ledger`);
    return { migrated: ledgerEntries.length, errors: [] };
  } catch (err: any) {
    console.error('Migration error:', err);
    throw err;
  }
}

/**
 * VERIFICATION FUNCTION
 * 
 * Run this after migration to verify data consistency
 */
export async function verifyMigration() {
  try {
    const supabase = createServerSupabase();

    // Get all products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id');

    if (prodErr) throw prodErr;

    const report = {
      total_products: products?.length || 0,
      products_with_ledger: 0,
      products_without_ledger: [] as number[],
      stock_mismatches: [] as any[]
    };

    // Check each product
    for (const product of products || []) {
      const { data: ledger, error: ledErr } = await supabase
        .from('stock_ledger')
        .select('quantity_in, quantity_out')
        .eq('product_id', product.id);

      if (ledErr) {
        report.products_without_ledger.push(product.id);
        continue;
      }

      if (!ledger || ledger.length === 0) {
        report.products_without_ledger.push(product.id);
        continue;
      }

      report.products_with_ledger++;

      // Verify ledger sums
      const total = (ledger || []).reduce((sum: number, entry: any) => {
        return sum + Number(entry.quantity_in || 0) - Number(entry.quantity_out || 0);
      }, 0);

      // If this is initialization only, verify against old stock table
      const initEntries = (ledger || []).filter((e: any) => e.transaction_type === 'initialization');
      if (initEntries.length > 0) {
        // Cross-check with old stock if it still exists
        const { data: oldStock } = await supabase
          .from('stock')
          .select('available_stock')
          .eq('product_id', product.id)
          .maybeSingle();

        if (oldStock && oldStock.available_stock !== total) {
          report.stock_mismatches.push({
            product_id: product.id,
            old_stock: oldStock.available_stock,
            ledger_computed: total
          });
        }
      }
    }

    return report;
  } catch (err: any) {
    console.error('Verification error:', err);
    throw err;
  }
}

/**
 * MANUAL LEDGER ENTRY (for testing/debugging)
 * 
 * Add a manual ledger entry for testing or correcting stock
 */
export async function addManualLedgerEntry(
  product_id: number,
  transaction_type: 'adjustment' | 'initialization',
  quantity: number,
  direction: 'in' | 'out',
  notes?: string
) {
  try {
    const supabase = createServerSupabase();

    const { error } = await supabase
      .from('stock_ledger')
      .insert([{
        product_id,
        transaction_type,
        transaction_id: `manual-${Date.now()}`,
        quantity_in: direction === 'in' ? quantity : 0,
        quantity_out: direction === 'out' ? quantity : 0,
        transaction_date: new Date().toISOString().split('T')[0],
        notes: notes || 'Manual adjustment'
      }]);

    if (error) {
      throw new Error(`Failed to add ledger entry: ${error.message}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error adding ledger entry:', err);
    throw err;
  }
}

/**
 * EXPORT REPORT
 * 
 * Generate a CSV report of all stock movements
 */
export async function exportStockReport(product_id?: number) {
  try {
    const supabase = createServerSupabase();

    let query = supabase
      .from('stock_ledger')
      .select('product_id, transaction_type, transaction_id, quantity_in, quantity_out, transaction_date, notes')
      .order('transaction_date', { ascending: false });

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch ledger data: ${error.message}`);
    }

    // Generate CSV
    const headers = ['Product ID', 'Transaction Type', 'Reference ID', 'In', 'Out', 'Date', 'Notes'];
    const rows = (data || []).map((entry: any) => [
      entry.product_id,
      entry.transaction_type,
      entry.transaction_id,
      entry.quantity_in,
      entry.quantity_out,
      entry.transaction_date,
      entry.notes || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    return csv;
  } catch (err: any) {
    console.error('Error exporting report:', err);
    throw err;
  }
}
