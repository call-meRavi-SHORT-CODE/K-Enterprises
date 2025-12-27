import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

async function updateStockAndLedger(supabase: any, product_id: number, qty_change: number, transaction_type: string, reference_id: string | null, notes: string | null, transaction_date: string | null) {
  // Get current stock
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

    const vendor_name = (payload.vendor_name ?? '').toString();
    const invoice_number = (payload.invoice_number ?? '').toString();
    const purchase_date = payload.purchase_date ?? new Date().toISOString().split('T')[0];
    const notes = payload.notes ?? null;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!vendor_name || !invoice_number || items.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Missing required fields' }, { status: 400 });
    }

    // Calculate total
    const total_amount = items.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unit_price)), 0);

    // Insert purchase
    const { data: purchase, error: pErr } = await supabase
      .from('purchases')
      .insert([{ vendor_name, invoice_number, purchase_date, notes, total_amount }])
      .select('*')
      .single();

    if (pErr) {
      console.error('Insert purchase error:', pErr);
      return NextResponse.json({ status: 'error', message: pErr.message || 'Failed to create purchase' }, { status: 400 });
    }

    const purchase_id = purchase.id;

    // Resolve product names from product_ids and validate
    const productIds = Array.from(new Set(items.map((it: any) => Number(it.product_id))));
    const { data: productsData, error: prodErr } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    if (prodErr) {
      console.error('Failed to fetch products for purchase items:', prodErr);
      // cleanup purchase
      await supabase.from('purchases').delete().eq('id', purchase_id);
      return NextResponse.json({ status: 'error', message: prodErr.message || 'Failed to validate products' }, { status: 400 });
    }

    const productMap = new Map((productsData || []).map((p: any) => [p.id, p.name]));
    // Ensure all product ids are present
    for (const pid of productIds) {
      if (!productMap.has(pid)) {
        await supabase.from('purchases').delete().eq('id', purchase_id);
        return NextResponse.json({ status: 'error', message: `Product id ${pid} not found` }, { status: 400 });
      }
    }

    const itemsToInsert = items.map((it: any) => {
      const pid = Number(it.product_id);
      const pname = productMap.get(pid);
      return {
        purchase_id,
        product_id: pid,
        product_name: pname,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.quantity) * Number(it.unit_price)
      };
    });

    const { error: itemsErr } = await supabase.from('purchase_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error('Insert purchase_items error:', itemsErr);
      // cleanup purchase
      await supabase.from('purchases').delete().eq('id', purchase_id);
      return NextResponse.json({ status: 'error', message: itemsErr.message || 'Failed to insert purchase items' }, { status: 400 });
    }

    // Update stock and ledger for each item
    for (const it of itemsToInsert) {
      await updateStockAndLedger(supabase, Number(it.product_id), Number(it.quantity), 'purchase', String(purchase_id), `Purchase ${invoice_number}`, purchase_date);
    }

    return NextResponse.json({ status: 'success', data: { id: purchase_id, total_amount }, message: 'Purchase created successfully' });
  } catch (err: any) {
    console.error('API /api/purchases POST error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();

    // select purchases with items
    const { data, error } = await supabase
      .from('purchases')
      .select('*, purchase_items(*)')
      .order('purchase_date', { ascending: false });

    if (error) {
      console.error('Supabase fetch purchases error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch purchases' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API /api/purchases GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
