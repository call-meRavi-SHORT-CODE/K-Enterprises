import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const format = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase();

    // Attempt to join stock and products
    const { data: stocks, error: sErr } = await supabase
      .from('stock')
      .select('product_id, available_stock, products(id, name, reorder_point)')
      .order('product_id');
    if (sErr) throw sErr;

    const rows = (stocks || []).map((r: any) => {
      const prod = r.products || { id: r.product_id, name: null, reorder_point: null };
      const current = Number(r.available_stock || 0);
      const reorder = Number(prod.reorder_point || 0);
      return {
        product_id: r.product_id,
        product_name: prod.name,
        current_stock: current,
        reorder_point: reorder,
        shortage: Math.max(0, reorder - current)
      };
    }).filter((r: any) => r.current_stock < r.reorder_point);

    if (format === 'csv') {
      const header = ['product_id', 'product_name', 'current_stock', 'reorder_point', 'shortage'];
      const lines = [header.join(',')].concat(rows.map(r => `${r.product_id},"${(r.product_name||'').replace(/"/g,'""')}",${r.current_stock},${r.reorder_point},${r.shortage}`));
      const csv = lines.join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=low_stock_report.csv'
        }
      });
    }

    return NextResponse.json({ alerts: rows, count: rows.length });
  } catch (err: any) {
    console.error('API /api/reports/low-stock GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}