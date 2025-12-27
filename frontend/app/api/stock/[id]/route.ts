import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const productId = Number(params.id);
    if (!productId) return NextResponse.json({ status: 'error', message: 'Invalid product id' }, { status: 400 });

    // Try stock table first
    const { data: stockRow, error: stockErr } = await supabase
      .from('stock')
      .select('id, product_id, available_stock, last_updated')
      .eq('product_id', productId)
      .maybeSingle();

    if (stockErr) {
      console.error('Supabase stock fetch error:', stockErr);
      return NextResponse.json({ status: 'error', message: stockErr.message }, { status: 500 });
    }

    if (stockRow) {
      // Try to fetch product name too
      const { data: prod, error: prodErr } = await supabase.from('products').select('id,name').eq('id', productId).maybeSingle();
      const product_name = prod ? prod.name : null;
      return NextResponse.json({ product_id: productId, available_stock: Number(stockRow.available_stock) || 0, last_updated: stockRow.last_updated, product_name });
    }

    // Fallback: compute balance from ledger sums
    const { data: ledgerRows, error: ledgerErr } = await supabase
      .from('stock_ledger')
      .select('quantity')
      .eq('product_id', productId);

    if (ledgerErr) {
      console.error('Supabase ledger fetch error:', ledgerErr);
      return NextResponse.json({ status: 'error', message: ledgerErr.message }, { status: 500 });
    }

    const balance = (ledgerRows || []).reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
    const { data: prod2 } = await supabase.from('products').select('id,name').eq('id', productId).maybeSingle();
    const product_name = prod2 ? prod2.name : null;

    return NextResponse.json({ product_id: productId, available_stock: balance, last_updated: null, product_name });
  } catch (err: any) {
    console.error('API /api/stock/[id] GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
