import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();

    const { data: products, error } = await supabase
      .from('products')
      .select('id,name,reorder_point');

    if (error) {
      console.error('Failed to fetch products for low stock check:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch alerts' }, { status: 500 });
    }

    // fetch stock for all products
    const { data: stocks } = await supabase.from('stock').select('product_id,available_stock');
    const stockMap = new Map((stocks || []).map((s: any) => [s.product_id, Number(s.available_stock)]));

    const alerts = (products || []).reduce((acc: any[], p: any) => {
      const current = stockMap.get(p.id) ?? 0;
      if (p.reorder_point != null && current < Number(p.reorder_point)) {
        acc.push({ product_id: p.id, product_name: p.name, available_stock: current, reorder_point: p.reorder_point, shortage: Number(p.reorder_point) - current });
      }
      return acc;
    }, []);

    return NextResponse.json({ alerts, count: alerts.length });
  } catch (err: any) {
    console.error('API /api/stock/alerts/low-stock GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
