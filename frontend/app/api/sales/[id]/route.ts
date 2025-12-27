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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);

    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Fetch sale error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch sale' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API /api/sales/[id] GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    const payload = await request.json();

    // Fetch existing items
    const { data: existingItems, error: exErr } = await supabase.from('sale_items').select('*').eq('sale_id', id);
    if (exErr) throw exErr;

    // Reverse stock for existing items (add back)
    for (const it of existingItems || []) {
      await updateStockAndLedger(supabase, Number(it.product_id), Number(it.quantity), 'sale_return', String(id), `Revert old sale ${id}`, payload.sale_date ?? null);
    }

    // Delete existing items
    const { error: delErr } = await supabase.from('sale_items').delete().eq('sale_id', id);
    if (delErr) throw delErr;

    // Validate products for new items
    const items = Array.isArray(payload.items) ? payload.items : [];
    const productIds = Array.from(new Set(items.map((it: any) => Number(it.product_id))));
    if (productIds.length) {
      const { data: productsData, error: prodErr } = await supabase.from('products').select('id, name').in('id', productIds);
      if (prodErr) throw prodErr;
      const productMap = new Map((productsData || []).map((p: any) => [p.id, p.name]));
      for (const pid of productIds) {
        if (!productMap.has(pid)) throw new Error(`Product ${pid} not found`);
      }

      const itemsToInsert = items.map((it: any) => {
        const pid = Number(it.product_id);
        return {
          sale_id: id,
          product_id: pid,
          product_name: productMap.get(pid),
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total_price: Number(it.quantity) * Number(it.unit_price)
        };
      });

      const { error: itemsErr } = await supabase.from('sale_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      // Apply stock decrease for new items
      for (const it of itemsToInsert) {
        await updateStockAndLedger(supabase, Number(it.product_id), -Number(it.quantity), 'sale', String(id), `Sale update ${id}`, payload.sale_date ?? null);
      }
    }

    // Update sale header
    const total_amount = items.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unit_price)), 0);
    const updates: any = {
      customer_name: payload.customer_name,
      invoice_number: payload.invoice_number,
      sale_date: payload.sale_date,
      notes: payload.notes,
      total_amount
    };

    const { error: updErr } = await supabase.from('sales').update(updates).eq('id', id);
    if (updErr) throw updErr;

    const { data: updated } = await supabase.from('sales').select('*, sale_items(*)').eq('id', id).maybeSingle();

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('API /api/sales/[id] PUT error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);

    // Fetch items to reverse
    const { data: existingItems, error: exErr } = await supabase.from('sale_items').select('*').eq('sale_id', id);
    if (exErr) throw exErr;

    for (const it of existingItems || []) {
      await updateStockAndLedger(supabase, Number(it.product_id), Number(it.quantity), 'sale_return', String(id), `Delete sale ${id}`, null);
    }

    const { error: delItemsErr } = await supabase.from('sale_items').delete().eq('sale_id', id);
    if (delItemsErr) throw delItemsErr;

    const { error: delSaleErr } = await supabase.from('sales').delete().eq('id', id);
    if (delSaleErr) throw delSaleErr;

    return NextResponse.json({ status: 'success', message: 'Sale deleted' });
  } catch (err: any) {
    console.error('API /api/sales/[id] DELETE error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
