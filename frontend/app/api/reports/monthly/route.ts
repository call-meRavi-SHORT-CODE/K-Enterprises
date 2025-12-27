import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const yearParam = request.nextUrl.searchParams.get('year');
    const monthParam = request.nextUrl.searchParams.get('month');
    const format = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase();

    if (!yearParam || !monthParam) {
      return NextResponse.json({ status: 'error', message: 'year and month are required' }, { status: 400 });
    }

    const year = Number(yearParam);
    const month = Number(monthParam);
    if (!year || !month) return NextResponse.json({ status: 'error', message: 'invalid year/month' }, { status: 400 });

    const { start, end } = monthRange(year, month);

    // Reuse ledger approach
    const { data: products, error: pErr } = await supabase.from('products').select('id, name').order('id');
    if (pErr) throw pErr;
    const productIds = (products || []).map((p: any) => p.id);

    const { data: ledgerRows, error: lErr } = await supabase
      .from('stock_ledger')
      .select('product_id, quantity, transaction_date')
      .in('product_id', productIds.length ? productIds : [-1])
      .order('transaction_date', { ascending: true });
    if (lErr) throw lErr;

    const report = (products || []).map((p: any) => {
      const rows = (ledgerRows || []).filter((r: any) => r.product_id === p.id);
      const opening = rows.filter((r: any) => new Date(r.transaction_date) < start).reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
      const closing = rows.filter((r: any) => new Date(r.transaction_date) <= end).reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
      return {
        product_id: p.id,
        product_name: p.name,
        opening: opening || 0,
        closing: closing || 0
      };
    });

    if (format === 'csv') {
      const header = ['product_id', 'product_name', 'opening', 'closing'];
      const lines = [header.join(',')].concat(report.map(r => `${r.product_id},"${(r.product_name||'').replace(/"/g,'""')}",${r.opening},${r.closing}`));
      return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=stock_monthly_${year}_${month}.csv` } });
    }

    return NextResponse.json({ report, count: report.length });
  } catch (err: any) {
    console.error('API /api/reports/monthly GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}
