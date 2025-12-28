import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';
import { getCurrentStockBatch } from '@/app/api/lib/stock-ledger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    // Fetch sales with nested sale_items
    const { data: todaysSalesRows, error: tErr } = await supabase
      .from('sales')
      .select('id, sale_date, sale_items(quantity, unit_price)')
      .eq('sale_date', todayStr);
    if (tErr) throw tErr;
    let todaysSales = 0;
    (todaysSalesRows || []).forEach((s: any) => {
      (s.sale_items || []).forEach((it: any) => todaysSales += (Number(it.quantity || 0) * Number(it.unit_price || 0)));
    });

    const { data: monthSalesRows, error: mErr } = await supabase
      .from('sales')
      .select('id, sale_date, sale_items(quantity, unit_price)')
      .gte('sale_date', monthStart)
      .lte('sale_date', monthEnd);
    if (mErr) throw mErr;
    let monthRevenue = 0;
    (monthSalesRows || []).forEach((s: any) => {
      (s.sale_items || []).forEach((it: any) => monthRevenue += (Number(it.quantity || 0) * Number(it.unit_price || 0)));
    });

    // Low stock count - compute from stock_ledger
    const { data: products, error: prodErr } = await supabase.from('products').select('id, name, reorder_point');
    if (prodErr) throw prodErr;
    const productIds = (products || []).map((p: any) => p.id);
    const stockMap = await getCurrentStockBatch(supabase, productIds);
    const lowAlerts = (products || []).filter((p: any) => {
      const current = stockMap.get(p.id) || 0;
      const reorder = Number(p.reorder_point || 0);
      return current < reorder;
    });

    // Best selling product (last 30 days)
    const prior30 = new Date(); prior30.setDate(prior30.getDate() - 30);
    const prior30Str = prior30.toISOString().slice(0,10);
    const { data: soldRows, error: soldErr } = await supabase
      .from('sales')
      .select('id, sale_date, sale_items(product_id, quantity), sale_items!inner(product_id)')
      .gte('sale_date', prior30Str);
    // If above composite select doesn't work as expected, fallback to fetching sale_items for sale date range

    let bestSelling: { product_id: number, qty: number } | null = null;
    let bestSellingName: string | null = null;
    try {
      // fallback approach: fetch sale_items joined with sales
      const { data: items, error: itErr } = await supabase
        .from('sale_items')
        .select('product_id, quantity, sales(sale_date)')
        .gte('sales.sale_date', prior30Str);
      if (!itErr) {
        const grouped: Record<number, number> = {};
        (items || []).forEach((it: any) => { grouped[it.product_id] = (grouped[it.product_id] || 0) + Number(it.quantity || 0); });
        const entries = Object.entries(grouped).map(([pid, qty]) => ({ product_id: Number(pid), qty }));
        if (entries.length) {
          entries.sort((a,b) => b.qty - a.qty);
          bestSelling = entries[0];
        }
      }

      if (bestSelling) {
        // Resolve product name
        const { data: prodRows, error: pErr } = await supabase.from('products').select('id, name').eq('id', bestSelling.product_id).limit(1);
        if (!pErr && prodRows && prodRows.length) {
          bestSellingName = prodRows[0].name;
        }
      }
    } catch (e) {
      // ignore
    }

    const payload: any = {
      kpis: {
        todays_sales: { value: todaysSales },
        month_revenue: { value: monthRevenue },
        low_stock_count: { value: (lowAlerts || []).length },
        best_selling_product_id: bestSelling ? bestSelling.product_id : null,
        best_selling_product: bestSellingName,
      }
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('API /api/reports/kpis GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}
