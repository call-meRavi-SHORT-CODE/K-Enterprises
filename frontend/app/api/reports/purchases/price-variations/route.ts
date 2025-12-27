import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const start = request.nextUrl.searchParams.get('start_date');
    const end = request.nextUrl.searchParams.get('end_date');
    const format = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase();
    const limitParam = request.nextUrl.searchParams.get('limit');
    const offsetParam = request.nextUrl.searchParams.get('offset');
    const limit = limitParam ? Number(limitParam) : undefined;
    const offset = offsetParam ? Number(offsetParam) : 0;

    // Fetch purchases in range
    let pq = supabase.from('purchases').select('id, purchase_date');
    if (start) pq = pq.gte('purchase_date', start);
    if (end) pq = pq.lte('purchase_date', end);
    const { data: purchases, error: pErr } = await pq;
    if (pErr) throw pErr;
    const purchaseIds = (purchases || []).map((p: any) => p.id);

    // Fetch purchase_items for those purchases
    if (purchaseIds.length === 0) return NextResponse.json({ report: [], count: 0 });
    const { data: items, error: itErr } = await supabase.from('purchase_items').select('product_id, unit_price').in('purchase_id', purchaseIds);
    if (itErr) throw itErr;

    const grouped: Record<number, { product_id: number; product_name?: string; min_price: number; max_price: number; sum: number; count: number }> = {};
    (items || []).forEach((it: any) => {
      const pid = Number(it.product_id);
      const price = Number(it.unit_price || 0);
      if (!grouped[pid]) grouped[pid] = { product_id: pid, min_price: price, max_price: price, sum: price, count: 1 };
      else {
        grouped[pid].min_price = Math.min(grouped[pid].min_price, price);
        grouped[pid].max_price = Math.max(grouped[pid].max_price, price);
        grouped[pid].sum += price;
        grouped[pid].count += 1;
      }
    });

    const pids = Object.keys(grouped).map(k => Number(k));
    if (pids.length) {
      const { data: prods } = await supabase.from('products').select('id, name').in('id', pids);
      (prods || []).forEach((p: any) => { if (grouped[p.id]) grouped[p.id].product_name = p.name; });
    }

    const rows = Object.values(grouped).map(g => ({ product_id: g.product_id, product_name: g.product_name, min_price: g.min_price, max_price: g.max_price, avg_price: g.count ? g.sum / g.count : 0 }));
    const total = rows.length;
    const paged = limit ? rows.slice(offset, offset + limit) : rows.slice(offset);

    if (format === 'csv') {
      const header = ['product_id','product_name','min_price','max_price','avg_price'];
      const lines = [header.join(',')].concat(paged.map(r => `${r.product_id},"${(r.product_name||'').replace(/"/g,'""')}",${r.min_price},${r.max_price},${r.avg_price}`));
      return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=price_variations.csv` } });
    }

    return NextResponse.json({ report: rows, count: total });
  } catch (err: any) {
    console.error('API /api/reports/purchases/price-variations GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}