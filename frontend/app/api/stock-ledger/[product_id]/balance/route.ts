import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request, { params }: { params: { product_id: string } }) {
  try {
    const supabase = createServerSupabase();
    const pid = Number(params.product_id);

    // Prefer reading from `stock` table if present
    const { data: stockRow, error: stockErr } = await supabase.from('stock').select('available_stock').eq('product_id', pid).maybeSingle();
    if (stockErr) {
      console.error('Failed to fetch stock row:', stockErr);
      return NextResponse.json({ status: 'error', message: stockErr.message }, { status: 500 });
    }

    if (stockRow) {
      return NextResponse.json({ product_id: pid, balance_quantity: Number(stockRow.available_stock) });
    }

    // Fallback: compute balance from ledger sums
    const { data, error } = await supabase.from('stock_ledger').select('quantity').eq('product_id', pid);
    if (error) {
      console.error('Failed to fetch ledger for balance:', error);
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }

    const balance = (data || []).reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
    return NextResponse.json({ product_id: pid, balance_quantity: balance });
  } catch (err: any) {
    console.error('API /api/stock-ledger/[product_id]/balance GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
