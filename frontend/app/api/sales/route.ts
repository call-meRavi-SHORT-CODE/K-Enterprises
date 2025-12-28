import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

async function updateStockAndLedger(supabase: any, product_id: number, qty_change: number, transaction_type: string, reference_id: string | null, notes: string | null, transaction_date: string | null) {
  const { data: stockRow, error: stockErr } = await supabase
    .from('stock')
    .select('id, available_stock')
    .eq('product_id', product_id)
    .maybeSingle();

  if (stockErr) throw stockErr;

  let new_balance = qty_change;
  if (stockRow && stockRow.available_stock != null) {
    new_balance = Number(stockRow.available_stock) + Number(qty_change);
    const { error: updErr } = await supabase
      .from('stock')
      .update({ available_stock: new_balance, last_updated: new Date().toISOString() })
      .eq('product_id', product_id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase
      .from('stock')
      .insert([{ product_id, available_stock: new_balance }]);
    if (insErr) throw insErr;
  }

  const ledgerRow = {
    product_id,
    transaction_type,
    quantity: qty_change,
    reference_id: reference_id,
    reference_type: transaction_type,
    notes: notes,
    transaction_date: transaction_date ?? new Date().toISOString().split('T')[0]
  };

  const { error: ledgerErr } = await supabase.from('stock_ledger').insert([ledgerRow]);
  if (ledgerErr) throw ledgerErr;

  return { product_id, new_balance };
}

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

    // Validate products and resolve names
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

    // Calculate total
    const total_amount = items.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unit_price)), 0);

    // Insert sale
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

    // Validate stock availability before inserting/decreasing stock
    for (const it of itemsToInsert) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      const { data: stockRow, error: stockErr } = await supabase.from('stock').select('available_stock').eq('product_id', pid).maybeSingle();
      if (stockErr) {
        console.error('Failed to fetch stock for validation:', stockErr);
        // cleanup
        await supabase.from('sales').delete().eq('id', sale_id);
        return NextResponse.json({ status: 'error', message: 'Failed to validate stock availability' }, { status: 500 });
      }
      const available = stockRow && stockRow.available_stock != null ? Number(stockRow.available_stock) : 0;
      if (available < qty) {
        // cleanup
        await supabase.from('sales').delete().eq('id', sale_id);
        return NextResponse.json({ status: 'error', message: `Insufficient stock for product ${pid}: available ${available}, required ${qty}` }, { status: 400 });
      }
    }

    const { error: itemsErr } = await supabase.from('sale_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error('Insert sale_items error:', itemsErr);
      // cleanup
      await supabase.from('sales').delete().eq('id', sale_id);
      return NextResponse.json({ status: 'error', message: itemsErr.message || 'Failed to insert sale items' }, { status: 400 });
    }

    // Decrease stock and add ledger entries
    for (const it of itemsToInsert) {
      await updateStockAndLedger(supabase, Number(it.product_id), -Number(it.quantity), 'sale', String(sale_id), `Sale ${invoice_number}`, sale_date);
    }

    return NextResponse.json({ status: 'success', data: { id: sale_id, total_amount }, message: 'Sale created successfully' });
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
