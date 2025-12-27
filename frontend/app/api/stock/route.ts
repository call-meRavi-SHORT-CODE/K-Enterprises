import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();

    // Join stock with product names
    const { data, error } = await supabase
      .from('stock')
      .select('id,product_id,available_stock,last_updated, products(name)')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase fetch stock error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch stock' }, { status: 500 });
    }

    const rows = (data || []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      available_stock: r.available_stock,
      last_updated: r.last_updated,
      product_name: r.products?.name ?? null
    }));

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('API /api/stock GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
