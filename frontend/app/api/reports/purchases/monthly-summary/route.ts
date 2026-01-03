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

    console.log('Monthly summary params - start:', start, 'end:', end);

    // First, fetch ALL purchases to see what data exists
    const { data: allPurchases, error: allErr } = await supabase.from('purchases').select('id, purchase_date').limit(5);
    console.log('Sample purchases from DB:', allPurchases, 'Error:', allErr);

    // Fetch purchases with nested items and date filtering
    let query = supabase.from('purchases').select('id, purchase_date, purchase_items(quantity, unit_price)');
    if (start) {
      query = query.gte('purchase_date', start);
    }
    if (end) {
      query = query.lte('purchase_date', end);
    }
    
    const { data: purchasesWithItems, error: pwErr } = await query;
    if (pwErr) {
      console.error('Query error:', pwErr);
      throw pwErr;
    }

    console.log('Fetched purchases count:', purchasesWithItems?.length || 0);
    if (purchasesWithItems && purchasesWithItems.length > 0) {
      console.log('First purchase:', purchasesWithItems[0]);
    }

    const monthMap: Record<string, { total_purchase: number; items: number; purchase_count: number }> = {};
    (purchasesWithItems || []).forEach((p: any) => {
      const month = p.purchase_date ? p.purchase_date.slice(0, 7) : 'unknown';
      const itemsList = p.purchase_items || [];
      console.log('Processing purchase:', { id: p.id, date: p.purchase_date, month, itemsCount: itemsList.length });
      const totalForPurchase = itemsList.reduce((sum: number, it: any) => sum + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);
      const qtyForPurchase = itemsList.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
      monthMap[month] = monthMap[month] || { total_purchase: 0, items: 0, purchase_count: 0 };
      monthMap[month].total_purchase += totalForPurchase;
      monthMap[month].items += qtyForPurchase;
      monthMap[month].purchase_count += 1;
    });

    const rows = Object.entries(monthMap).map(([month, v]) => ({ month, total_purchase: v.total_purchase, items_bought: v.items, avg_cost: v.purchase_count ? v.total_purchase / v.purchase_count : 0 }));
    rows.sort((a, b) => b.month.localeCompare(a.month));

    console.log('Final report rows:', rows);

    const total = rows.length;
    const paged = limit ? rows.slice(offset, offset + limit) : rows.slice(offset);

    if (format === 'csv') {
      const header = ['month', 'total_purchase', 'items_bought', 'avg_cost'];
      const lines = [header.join(',')].concat(paged.map(r => `${r.month},${r.total_purchase},${r.items_bought},${r.avg_cost}`));
      return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=monthly_purchase_summary.csv` } });
    }

    return NextResponse.json({ report: paged, count: total });
  } catch (err: any) {
    console.error('API /api/reports/purchases/monthly-summary GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}