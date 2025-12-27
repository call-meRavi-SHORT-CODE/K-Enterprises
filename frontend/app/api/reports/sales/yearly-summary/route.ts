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

    let query = supabase.from('sales').select('id, sale_date, sale_items(quantity, unit_price)');
    if (start) query = query.gte('sale_date', start);
    if (end) query = query.lte('sale_date', end);
    const { data: sales, error } = await query;
    if (error) throw error;

    const map: Record<string, { total_sales: number; total_quantity_sold: number; sale_count: number }> = {};
    (sales || []).forEach((s: any) => {
      const year = s.sale_date ? s.sale_date.slice(0,4) : 'unknown';
      const items = s.sale_items || [];
      const totalForSale = items.reduce((sum: number, it: any) => sum + (Number(it.quantity||0) * Number(it.unit_price||0)), 0);
      const qtyForSale = items.reduce((sum: number, it: any) => sum + Number(it.quantity||0), 0);
      map[year] = map[year] || { total_sales: 0, total_quantity_sold: 0, sale_count: 0 };
      map[year].total_sales += totalForSale;
      map[year].total_quantity_sold += qtyForSale;
      map[year].sale_count += 1;
    });

    const rows = Object.entries(map).map(([year, v]) => ({ year, total_sales: v.total_sales, total_quantity_sold: v.total_quantity_sold, avg_sale_value: v.sale_count ? v.total_sales / v.sale_count : 0 }));
    rows.sort((a,b) => b.year.localeCompare(a.year));

    const total = rows.length;
    const paged = limit ? rows.slice(offset, offset + limit) : rows.slice(offset);
    return NextResponse.json({ report: paged, count: total });
  } catch (err: any) {
    console.error('API /api/reports/sales/yearly-summary GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}