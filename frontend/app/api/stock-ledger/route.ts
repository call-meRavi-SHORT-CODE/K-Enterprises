import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();
    const url = new URL(request.url);
    const product_id = url.searchParams.get('product_id');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(500, Number(limitParam)) : 200;

    let query = supabase.from('stock_ledger').select('*').order('transaction_date', { ascending: false }).limit(limit);
    if (product_id) query = query.eq('product_id', Number(product_id));

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch stock ledger:', error);
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('API /api/stock-ledger GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
