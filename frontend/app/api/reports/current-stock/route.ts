import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function toDateOnly(s: string) {
  return new Date(s + 'T00:00:00Z');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const start = request.nextUrl.searchParams.get('start_date');
    const end = request.nextUrl.searchParams.get('end_date');
    const format = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase();

    // Fetch products
    const { data: products, error: pErr } = await supabase.from('products').select('id, name').order('id');
    if (pErr) throw pErr;
    const prodMap = (products || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
    const productIds = (products || []).map((p: any) => p.id);

    // Fetch all relevant ledger entries (we'll filter in JS)
    const { data: ledgerRows, error: lErr } = await supabase
      .from('stock_ledger')
      .select('product_id, quantity, transaction_date')
      .in('product_id', productIds.length ? productIds : [-1])
      .order('transaction_date', { ascending: true });
    if (lErr) throw lErr;

    const startDate = start ? toDateOnly(start) : new Date('1970-01-01T00:00:00Z');
    const endDate = end ? toDateOnly(end) : new Date();

    const report = (products || []).map((p: any) => {
      const rows = (ledgerRows || []).filter((r: any) => r.product_id === p.id);
      const opening = rows
        .filter((r: any) => new Date(r.transaction_date) < startDate)
        .reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
      const periodRows = rows.filter((r: any) => {
        const d = new Date(r.transaction_date);
        return d >= startDate && d <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      });
      const purchased = periodRows.filter((r: any) => Number(r.quantity) > 0).reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
      const sold = periodRows.filter((r: any) => Number(r.quantity) < 0).reduce((s: number, r: any) => s + Math.abs(Number(r.quantity) || 0), 0);
      const closing = opening + purchased - sold;
      return {
        product_id: p.id,
        product_name: p.name,
        opening: opening || 0,
        purchased: purchased || 0,
        sold: sold || 0,
        closing: closing || 0
      };
    });

    if (format === 'csv') {
      const header = ['product_id', 'product_name', 'opening', 'purchased', 'sold', 'closing'];
      const lines = [header.join(',')].concat(report.map(r => `${r.product_id},"${(r.product_name||'').replace(/"/g,'""')}",${r.opening},${r.purchased},${r.sold},${r.closing}`));
      const csv = lines.join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=current_stock_report.csv'
        }
      });
    }

    return NextResponse.json({ report, count: report.length });
  } catch (err: any) {
    console.error('API /api/reports/current-stock GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}
