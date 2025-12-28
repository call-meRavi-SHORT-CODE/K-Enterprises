import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { addStockLedgerEntries } from '@/app/api/lib/stock-ledger';

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

    // TRANSACTION START: Insert purchase
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
      // Rollback: delete purchase
      await supabase.from('purchases').delete().eq('id', purchase_id);
      return NextResponse.json({ status: 'error', message: prodErr.message || 'Failed to validate products' }, { status: 400 });
    }

    const productMap = new Map((productsData || []).map((p: any) => [p.id, p.name]));
    
    // Ensure all product ids are present
    for (const pid of productIds) {
      if (!productMap.has(pid)) {
        // Rollback: delete purchase
        await supabase.from('purchases').delete().eq('id', purchase_id);
        return NextResponse.json({ status: 'error', message: `Product id ${pid} not found` }, { status: 400 });
      }
    }

    // Prepare purchase items
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

    // Insert purchase items
    const { error: itemsErr } = await supabase.from('purchase_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error('Insert purchase_items error:', itemsErr);
      // Rollback: delete purchase
      await supabase.from('purchases').delete().eq('id', purchase_id);
      return NextResponse.json({ status: 'error', message: itemsErr.message || 'Failed to insert purchase items' }, { status: 400 });
    }

    // Insert stock ledger entries for each item
    // Stock Ledger: positive quantity for purchases
    const ledgerEntries = itemsToInsert.map((it: any) => ({
      product_id: it.product_id,
      transaction_type: 'purchase',
      quantity: Number(it.quantity),
      reference_id: String(purchase_id),
      reference_type: 'purchase',
      transaction_date: purchase_date,
      notes: `Purchase ${invoice_number} from ${vendor_name}`
    }));

    try {
      await addStockLedgerEntries(supabase, ledgerEntries);
    } catch (ledgerErr: any) {
      console.error('Insert stock_ledger error:', ledgerErr);
      // Rollback: delete purchase and purchase_items
      await supabase.from('purchase_items').delete().eq('purchase_id', purchase_id);
      await supabase.from('purchases').delete().eq('id', purchase_id);
      return NextResponse.json({ status: 'error', message: ledgerErr?.message || 'Failed to record stock ledger' }, { status: 500 });
    }

    // TRANSACTION END: Success
    return NextResponse.json({ 
      status: 'success', 
      data: { id: purchase_id, total_amount }, 
      message: 'Purchase created successfully' 
    });
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
