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
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid id' }, { status: 400 });

    const { data, error } = await supabase
      .from('purchases')
      .select('*, purchase_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase fetch purchase error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch purchase' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API /api/purchases/[id] GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid id' }, { status: 400 });

    const payload = await request.json();
    const vendor_name = payload.vendor_name ?? null;
    const invoice_number = payload.invoice_number ?? null;
    const purchase_date = payload.purchase_date ?? null;
    const notes = payload.notes ?? null;
    const items = Array.isArray(payload.items) ? payload.items : [];

    // Fetch existing items to reverse stock
    const { data: existingItems, error: eiErr } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', id);
    if (eiErr) throw eiErr;

    // Reverse previous stock changes (but first validate that reverting won't make stock negative)
    for (const it of existingItems || []) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      const { data: stockRow } = await supabase.from('stock').select('available_stock').eq('product_id', pid).maybeSingle();
      const available = stockRow && stockRow.available_stock != null ? Number(stockRow.available_stock) : 0;
      if (available < qty) {
        throw new Error(`Cannot revert previous purchase for product ${pid}: available stock (${available}) is less than ${qty}. Remove dependent sales first.`);
      }
      await updateStockAndLedger(supabase, pid, -qty, 'purchase_return', String(id), 'Revert previous purchase items on edit', purchase_date ?? new Date().toISOString().split('T')[0]);
    }

    // Delete previous items
    const { error: delErr } = await supabase.from('purchase_items').delete().eq('purchase_id', id);
    if (delErr) throw delErr;

    // Resolve product names and validate product ids
    const productIds = Array.from(new Set(items.map((it: any) => Number(it.product_id))));
    let itemsToInsert: any[] = [];
    if (productIds.length > 0) {
      const { data: productsData, error: prodErr } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      if (prodErr) throw prodErr;

      const productMap = new Map((productsData || []).map((p: any) => [p.id, p.name]));
      for (const pid of productIds) {
        if (!productMap.has(pid)) throw new Error(`Product id ${pid} not found`);
      }

      itemsToInsert = items.map((it: any) => {
        const pid = Number(it.product_id);
        return {
          purchase_id: id,
          product_id: pid,
          product_name: productMap.get(pid),
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total_price: Number(it.quantity) * Number(it.unit_price)
        };
      });
    }

    const { error: insErr } = await supabase.from('purchase_items').insert(itemsToInsert);
    if (insErr) throw insErr;

    // Apply stock for new items
    for (const it of itemsToInsert) {
      await updateStockAndLedger(supabase, Number(it.product_id), Number(it.quantity), 'purchase', String(id), `Updated Purchase ${invoice_number ?? ''}`, purchase_date ?? new Date().toISOString().split('T')[0]);
    }

    // Update purchase header
    const updateFields: any = {};
    if (vendor_name !== null) updateFields.vendor_name = vendor_name;
    if (invoice_number !== null) updateFields.invoice_number = invoice_number;
    if (purchase_date !== null) updateFields.purchase_date = purchase_date;
    if (notes !== null) updateFields.notes = notes;
    if (Object.keys(updateFields).length > 0) {
      // Recalculate total
      const total_amount = itemsToInsert.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unit_price)), 0);
      updateFields.total_amount = total_amount;

      const { data: updated, error: updateErr } = await supabase.from('purchases').update(updateFields).eq('id', id).select('*').single();
      if (updateErr) throw updateErr;
      return NextResponse.json({ status: 'success', message: 'Purchase updated', data: updated });
    }

    return NextResponse.json({ status: 'success', message: 'Purchase updated' });
  } catch (err: any) {
    console.error('API /api/purchases/[id] PUT error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid id' }, { status: 400 });

    // Get items to revert stock
    const { data: items, error: itErr } = await supabase.from('purchase_items').select('*').eq('purchase_id', id);
    if (itErr) throw itErr;

    // Revert stock for each item, but ensure stock won't go negative (items may have been sold already)
    for (const it of items || []) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      const { data: stockRow } = await supabase.from('stock').select('available_stock').eq('product_id', pid).maybeSingle();
      const available = stockRow && stockRow.available_stock != null ? Number(stockRow.available_stock) : 0;
      if (available < qty) {
        return NextResponse.json({ status: 'error', message: `Cannot delete purchase because product ${pid} has only ${available} in stock but needs ${qty} to revert. Remove dependent sales first.` }, { status: 400 });
      }
      await updateStockAndLedger(supabase, pid, -qty, 'purchase_return', String(id), 'Purchase deleted', new Date().toISOString().split('T')[0]);
    }

    // Delete items
    const { error: delItemsErr } = await supabase.from('purchase_items').delete().eq('purchase_id', id);
    if (delItemsErr) throw delItemsErr;

    const { error: delPurchaseErr } = await supabase.from('purchases').delete().eq('id', id);
    if (delPurchaseErr) throw delPurchaseErr;

    return NextResponse.json({ status: 'success', message: 'Purchase deleted' });
  } catch (err: any) {
    console.error('API /api/purchases/[id] DELETE error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
