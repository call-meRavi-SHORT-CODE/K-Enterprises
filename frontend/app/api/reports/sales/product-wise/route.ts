import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const start = request.nextUrl.searchParams.get('start_date');
    const end = request.nextUrl.searchParams.get('end_date');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const offsetParam = request.nextUrl.searchParams.get('offset');
    const limit = limitParam ? Number(limitParam) : undefined;
    const offset = offsetParam ? Number(offsetParam) : 0;

    // fetch sale_items within date range (join sales)
    let q = supabase.from('sale_items').select('product_id, quantity, unit_price, sales(sale_date)');
    if (start) q = q.gte('sales.sale_date', start);
    if (end) q = q.lte('sales.sale_date', end);
    const { data: items, error } = await q;
    if (error) throw error;

    const grouped: Record<number, { product_id: number; product_name?: string; quantity_sold: number; revenue: number }> = {};
    (items || []).forEach((it: any) => {
      const pid = Number(it.product_id);
      grouped[pid] = grouped[pid] || { product_id: pid, quantity_sold: 0, revenue: 0 };
      grouped[pid].quantity_sold += Number(it.quantity || 0);
      grouped[pid].revenue += Number(it.quantity || 0) * Number(it.unit_price || 0);
    });

    // Fetch product names
    const pids = Object.keys(grouped).map(k => Number(k));
    if (pids.length) {
      const { data: prods } = await supabase.from('products').select('id, name').in('id', pids);
      (prods || []).forEach((p: any) => { if (grouped[p.id]) grouped[p.id].product_name = p.name; });
    }

    const rows = Object.values(grouped).sort((a,b) => b.quantity_sold - a.quantity_sold);
    const total = rows.length;
    const paged = limit ? rows.slice(offset, offset + limit) : rows.slice(offset);
    return NextResponse.json({ report: paged, count: total });
  } catch (err: any) {
    console.error('API /api/reports/sales/product-wise GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}