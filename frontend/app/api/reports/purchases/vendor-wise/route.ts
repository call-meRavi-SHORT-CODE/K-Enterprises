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
    let q = supabase.from('purchases').select('id, vendor_name, purchase_date, purchase_items(quantity, unit_price)');
    if (start) q = q.gte('purchase_date', start);
    if (end) q = q.lte('purchase_date', end);
    const { data: purchases, error } = await q;
    if (error) throw error;

    const map: Record<string, { vendor: string; total_purchase_value: number; items_bought: number }> = {};
    (purchases || []).forEach((p: any) => {
      const vendor = p.vendor_name || 'Unknown';
      const items = p.purchase_items || [];
      const totalForPurchase = items.reduce((sum: number, it: any) => sum + (Number(it.quantity||0) * Number(it.unit_price||0)), 0);
      const qtyForPurchase = items.reduce((sum: number, it: any) => sum + Number(it.quantity||0), 0);
      map[vendor] = map[vendor] || { vendor, total_purchase_value: 0, items_bought: 0 };
      map[vendor].total_purchase_value += totalForPurchase;
      map[vendor].items_bought += qtyForPurchase;
    });

    const rows = Object.values(map).sort((a,b) => b.total_purchase_value - a.total_purchase_value);
    const total = rows.length;
    const paged = limit ? rows.slice(offset, offset + limit) : rows.slice(offset);

    if (format === 'csv') {
      const header = ['vendor','total_purchase_value','items_bought'];
      const lines = [header.join(',')].concat(paged.map(r => `"${(r.vendor||'').replace(/"/g,'""')}",${r.total_purchase_value},${r.items_bought}`));
      return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=vendor_wise_purchases.csv` } });
    }

    return NextResponse.json({ report: paged, count: total });
  } catch (err: any) {
    console.error('API /api/reports/purchases/vendor-wise GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}