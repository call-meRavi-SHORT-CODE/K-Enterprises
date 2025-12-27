import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request, { params }: { params: { product_id: string, year: string, month: string } }) {
  try {
    const supabase = createServerSupabase();
    const pid = Number(params.product_id);
    const year = Number(params.year);
    const month = Number(params.month);

    if (!pid || !year || !month) return NextResponse.json({ status: 'error', message: 'Invalid params' }, { status: 400 });

    const firstDay = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0,10);

    // Sum all ledger quantities before the first day of month
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('quantity')
      .eq('product_id', pid)
      .lt('transaction_date', firstDay);

    if (error) {
      console.error('Failed to compute opening stock:', error);
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }

    const opening = (data || []).reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
    return NextResponse.json({ product_id: pid, year, month, opening_stock: opening });
  } catch (err: any) {
    console.error('API opening stock error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
