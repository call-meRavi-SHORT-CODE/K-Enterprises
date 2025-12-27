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

    // Fetch purchases in range with nested items
    let q = supabase.from('purchases').select('id, purchase_date, purchase_items(quantity, unit_price)');
    if (start) q = q.gte('purchase_date', start);
    if (end) q = q.lte('purchase_date', end);
    const { data: purchases, error } = await q;
    if (error) throw error;

    const map: Record<string, { total_purchase: number; items: number; purchase_count: number }> = {};
    (purchases || []).forEach((p: any) => {
      const month = p.purchase_date ? p.purchase_date.slice(0,7) : 'unknown';
      const items = p.purchase_items || [];
      const totalForPurchase = items.reduce((sum: number, it: any) => sum + (Number(it.quantity||0) * Number(it.unit_price||0)), 0);
      const qtyForPurchase = items.reduce((sum: number, it: any) => sum + Number(it.quantity||0), 0);
      map[month] = map[month] || { total_purchase: 0, items: 0, purchase_count: 0 };
      map[month].total_purchase += totalForPurchase;
      map[month].items += qtyForPurchase;
      map[month].purchase_count += 1;
    });

    const rows = Object.entries(map).map(([month, v]) => ({ month, total_purchase: v.total_purchase, items_bought: v.items, avg_cost: v.purchase_count ? v.total_purchase / v.purchase_count : 0 }));
    rows.sort((a,b) => b.month.localeCompare(a.month));

    const total = rows.length;
    const paged = limit ? rows.slice(offset, offset + limit) : rows.slice(offset);

    if (format === 'csv') {
      const header = ['month','total_purchase','items_bought','avg_cost'];
      const lines = [header.join(',')].concat(paged.map(r => `${r.month},${r.total_purchase},${r.items_bought},${r.avg_cost}`));
      return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=monthly_purchase_summary.csv` } });
    }

    return NextResponse.json({ report: paged, count: total });
  } catch (err: any) {
    console.error('API /api/reports/purchases/monthly-summary GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}