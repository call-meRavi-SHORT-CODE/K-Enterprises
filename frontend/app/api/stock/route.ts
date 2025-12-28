import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getCurrentStockBatch } from '@/app/api/lib/stock-ledger';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();

    // Get all products
    const { data: productsData, error: prodError } = await supabase
      .from('products')
      .select('id, name')
      .order('id', { ascending: true });

    if (prodError) {
      console.error('Supabase fetch products error:', prodError);
      return NextResponse.json({ status: 'error', message: prodError.message || 'Failed to fetch products' }, { status: 500 });
    }

    const products = productsData || [];
    const productIds = products.map((p: any) => p.id);

    // Compute current stock from stock_ledger for all products
    const stockMap = await getCurrentStockBatch(supabase, productIds);

    // Map products with their computed stock
    const rows = products.map((p: any) => ({
      product_id: p.id,
      available_stock: stockMap.get(p.id) || 0,
      product_name: p.name,
      last_updated: new Date().toISOString()
    }));

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('API /api/stock GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
