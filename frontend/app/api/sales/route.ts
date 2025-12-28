import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { validateStockBatch, addStockLedgerEntries } from '@/app/api/lib/stock-ledger';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const payload = await request.json();

    const customer_name = (payload.customer_name ?? '').toString();
    const invoice_number = (payload.invoice_number ?? '').toString();
    const sale_date = payload.sale_date ?? new Date().toISOString().split('T')[0];
    const notes = payload.notes ?? null;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!customer_name || !invoice_number || items.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Missing required fields' }, { status: 400 });
    }

    // Validate products exist
    const productIds = Array.from(new Set(items.map((it: any) => Number(it.product_id))));
    const { data: productsData, error: prodErr } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    
    if (prodErr) {
      console.error('Failed to fetch products for sale items:', prodErr);
      return NextResponse.json({ status: 'error', message: prodErr.message || 'Failed to validate products' }, { status: 400 });
    }

    const productMap = new Map((productsData || []).map((p: any) => [p.id, p.name]));
    for (const pid of productIds) {
      if (!productMap.has(pid)) {
        return NextResponse.json({ status: 'error', message: `Product id ${pid} not found` }, { status: 400 });
      }
    }

    // CRITICAL: Validate stock availability BEFORE creating sale
    // Use stock_ledger to compute current stock for each product
    const stockValidations = await validateStockBatch(
      supabase,
      items.map((it: any) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity) }))
    );

    // Check if all items have sufficient stock
    const insufficientStock = stockValidations.filter(v => !v.valid);
    if (insufficientStock.length > 0) {
      const details = insufficientStock
        .map(v => `Product ${v.product_id}: available ${v.available}, required ${v.required}`)
        .join('; ');
      return NextResponse.json(
        { status: 'error', message: `Insufficient stock: ${details}` },
        { status: 400 }
      );
    }

    // Calculate total
    const total_amount = items.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unit_price)), 0);

    // TRANSACTION START: Insert sale
    const { data: sale, error: sErr } = await supabase
      .from('sales')
      .insert([{ customer_name, invoice_number, sale_date, notes, total_amount }])
      .select('*')
      .single();

    if (sErr) {
      console.error('Insert sale error:', sErr);
      return NextResponse.json({ status: 'error', message: sErr.message || 'Failed to create sale' }, { status: 400 });
    }

    const sale_id = sale.id;

    // Prepare sale items
    const itemsToInsert = items.map((it: any) => {
      const pid = Number(it.product_id);
      return {
        sale_id,
        product_id: pid,
        product_name: productMap.get(pid),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.quantity) * Number(it.unit_price)
      };
    });

    // Insert sale items
    const { error: itemsErr } = await supabase.from('sale_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error('Insert sale_items error:', itemsErr);
      // Rollback: delete sale
      await supabase.from('sales').delete().eq('id', sale_id);
      return NextResponse.json({ status: 'error', message: itemsErr.message || 'Failed to insert sale items' }, { status: 400 });
    }

    // Insert stock ledger entries for each item
    // Stock Ledger: negative quantity for sales
    const ledgerEntries = itemsToInsert.map((it: any) => ({
      product_id: it.product_id,
      transaction_type: 'sale',
      quantity: -Number(it.quantity),
      reference_id: String(sale_id),
      reference_type: 'sale',
      transaction_date: sale_date,
      notes: `Sale ${invoice_number} to ${customer_name}`
    }));

    try {
      await addStockLedgerEntries(supabase, ledgerEntries);
    } catch (ledgerErr: any) {
      console.error('Insert stock_ledger error:', ledgerErr);
      // Rollback: delete sale and sale_items
      await supabase.from('sale_items').delete().eq('sale_id', sale_id);
      await supabase.from('sales').delete().eq('id', sale_id);
      return NextResponse.json({ status: 'error', message: ledgerErr?.message || 'Failed to record stock ledger' }, { status: 500 });
    }

    // TRANSACTION END: Success
    return NextResponse.json({ 
      status: 'success', 
      data: { id: sale_id, total_amount }, 
      message: 'Sale created successfully' 
    });
  } catch (err: any) {
    console.error('API /api/sales POST error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Supabase fetch sales error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch sales' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API /api/sales GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
