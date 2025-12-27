import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const start = request.nextUrl.searchParams.get('start_date');
    const end = request.nextUrl.searchParams.get('end_date');
    const limit = Number(request.nextUrl.searchParams.get('limit') || 10);

    let q = supabase.from('sale_items').select('product_id, quantity, unit_price, sales(sale_date)');
    if (start) q = q.gte('sales.sale_date', start);
    if (end) q = q.lte('sales.sale_date', end);
    const { data: items, error } = await q;
    if (error) throw error;

    const grouped: Record<number, { product_id: number; product_name?: string; qty_sold: number }> = {};
    (items || []).forEach((it: any) => {
      const pid = Number(it.product_id);
      grouped[pid] = grouped[pid] || { product_id: pid, qty_sold: 0 };
      grouped[pid].qty_sold += Number(it.quantity || 0);
    });

    const entries = Object.values(grouped);
    entries.sort((a,b) => b.qty_sold - a.qty_sold);
    const pids = entries.map(e => e.product_id);
    if (pids.length) {
      const { data: prods } = await supabase.from('products').select('id, name').in('id', pids.slice(0, 100));
      (prods || []).forEach((p: any) => { const e = entries.find(x => x.product_id === p.id); if (e) e.product_name = p.name; });
    }

    return NextResponse.json({ report: entries.slice(0, limit), count: entries.length });
  } catch (err: any) {
    console.error('API /api/reports/sales/top-selling GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}