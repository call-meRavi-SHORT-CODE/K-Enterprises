import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';
import { getCurrentStockBatch } from '@/app/api/lib/stock-ledger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const format = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase();

    // Get all products with reorder points
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, name, reorder_point')
      .order('id');
    if (prodErr) throw prodErr;

    // Compute current stock from stock_ledger
    const productIds = (products || []).map((p: any) => p.id);
    const stockMap = await getCurrentStockBatch(supabase, productIds);

    const rows = (products || []).map((p: any) => {
      const current = stockMap.get(p.id) || 0;
      const reorder = Number(p.reorder_point || 0);
      return {
        product_id: p.id,
        product_name: p.name,
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