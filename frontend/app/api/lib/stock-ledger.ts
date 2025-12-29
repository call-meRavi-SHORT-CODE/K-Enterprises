/**
 * Stock Ledger Utilities
 * 
 * Provides atomic transaction support for stock operations.
 * All stock changes MUST go through stock_ledger entries.
 * stock_ledger is the single source of truth for inventory.
 */

interface StockLedgerEntry {
  product_id: number;
  transaction_type: 'purchase' | 'sale' | 'adjustment' | 'return_in' | 'return_out';
  reference_id: string; // References purchase_id, sale_id, etc.
  quantity: number; // Positive for purchases/adjustments, negative for sales
  transaction_date: string;
  notes?: string;
  reference_type?: string;
}

/**
 * Get current stock for a product by aggregating stock_ledger + initial stock
 * Current Stock = Initial Stock (from stock table) + SUM(stock_ledger transactions)
 */
export async function getCurrentStock(
  supabase: any,
  product_id: number
): Promise<number> {
  // Get initial stock from stock table
  const { data: stockRow, error: stockError } = await supabase
    .from('stock')
    .select('available_stock')
    .eq('product_id', product_id)
    .maybeSingle();

  if (stockError) {
    throw new Error(`Failed to fetch stock for product ${product_id}: ${stockError.message}`);
  }

  const initialStock = stockRow ? Number(stockRow.available_stock || 0) : 0;

  // Get stock ledger transactions
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('stock_ledger')
    .select('quantity')
    .eq('product_id', product_id);

  if (ledgerError) {
    throw new Error(`Failed to fetch stock ledger for product ${product_id}: ${ledgerError.message}`);
  }

  // Calculate total from ledger
  const ledgerTotal = (ledgerData || []).reduce((sum: number, entry: any) => {
    return sum + Number(entry.quantity || 0);
  }, 0);

  const total = initialStock + ledgerTotal;
  return Math.max(0, total); // Never allow negative stock
}

/**
 * Get current stock for multiple products
 */
export async function getCurrentStockBatch(
  supabase: any,
  product_ids: number[]
): Promise<Map<number, number>> {
  if (product_ids.length === 0) {
    return new Map();
  }

  // Get initial stock from stock table for all products
  const { data: stockRows, error: stockError } = await supabase
    .from('stock')
    .select('product_id, available_stock')
    .in('product_id', product_ids);

  if (stockError) {
    throw new Error(`Failed to fetch stock data: ${stockError.message}`);
  }

  const stockMap = new Map<number, number>();

  // Initialize all products with 0, then populate from stock table
  product_ids.forEach(pid => stockMap.set(pid, 0));
  (stockRows || []).forEach((row: any) => {
    stockMap.set(row.product_id, Number(row.available_stock || 0));
  });

  // Get stock ledger entries for all products
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('stock_ledger')
    .select('product_id, quantity')
    .in('product_id', product_ids);

  if (ledgerError) {
    throw new Error(`Failed to fetch stock ledger: ${ledgerError.message}`);
  }

  // Add ledger transactions to the stock map
  (ledgerData || []).forEach((entry: any) => {
    const pid = entry.product_id;
    const current = stockMap.get(pid) || 0;
    const change = Number(entry.quantity || 0);
    stockMap.set(pid, current + change);
  });

  // Ensure no negative values
  stockMap.forEach((value, key) => {
    stockMap.set(key, Math.max(0, value));
  });

  return stockMap;
}

/**
 * Add entry to stock_ledger (atomic, non-transactional approach for single entry)
 */
export async function addStockLedgerEntry(
  supabase: any,
  entry: StockLedgerEntry
): Promise<void> {
  const { error } = await supabase
    .from('stock_ledger')
    .insert([
      {
        product_id: entry.product_id,
        transaction_type: entry.transaction_type,
        reference_id: entry.reference_id,
        quantity: entry.quantity,
        transaction_date: entry.transaction_date,
        notes: entry.notes || null,
        reference_type: entry.reference_type || null,
      },
    ]);

  if (error) {
    throw new Error(`Failed to insert stock ledger entry: ${error.message}`);
  }
}

/**
 * Add multiple ledger entries for a transaction
 * These should be called after the main transaction (purchase/sale) is committed
 */
export async function addStockLedgerEntries(
  supabase: any,
  entries: StockLedgerEntry[]
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('stock_ledger')
    .insert(
      entries.map(entry => ({
        product_id: entry.product_id,
        transaction_type: entry.transaction_type,
        reference_id: entry.reference_id,
        quantity: entry.quantity,
        transaction_date: entry.transaction_date,
        notes: entry.notes || null,
        reference_type: entry.reference_type || null,
      }))
    );

  if (error) {
    throw new Error(`Failed to insert stock ledger entries: ${error.message}`);
  }
}

/**
 * Validate that stock is available for a sale
 * Returns true if quantity <= current_stock, false otherwise
 */
export async function validateStockAvailable(
  supabase: any,
  product_id: number,
  quantity: number
): Promise<boolean> {
  const currentStock = await getCurrentStock(supabase, product_id);
  return quantity <= currentStock;
}

/**
 * Validate stock for multiple products in a sale
 * Returns array of { product_id, available, required, valid }
 */
export async function validateStockBatch(
  supabase: any,
  items: Array<{ product_id: number; quantity: number }>
): Promise<
  Array<{
    product_id: number;
    available: number;
    required: number;
    valid: boolean;
  }>
> {
  const product_ids = items.map(it => it.product_id);
  const stockMap = await getCurrentStockBatch(supabase, product_ids);

  return items.map(it => ({
    product_id: it.product_id,
    available: stockMap.get(it.product_id) || 0,
    required: it.quantity,
    valid: (stockMap.get(it.product_id) || 0) >= it.quantity,
  }));
}
