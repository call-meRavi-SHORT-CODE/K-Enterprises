import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';
import { getCurrentStockBatch } from '@/app/api/lib/stock-ledger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const daysParam = Number(request.nextUrl.searchParams.get('days') || 60);
    const since = new Date(); since.setDate(since.getDate() - daysParam);
    const sinceStr = since.toISOString().slice(0,10);

    // Get last sold date per product (fetch then sort client-side to avoid PostgREST order parsing on related table)
    const { data: lastSoldItems, error: lsErr } = await supabase
      .from('sale_items')
      .select('product_id, sales(sale_date)');
    if (lsErr) throw lsErr;

    const sorted = (lastSoldItems || []).slice().sort((a: any, b: any) => {
      const da = a.sales?.sale_date || '';
      const db = b.sales?.sale_date || '';
      if (da === db) return 0;
      return da < db ? 1 : -1; // descending
    });

    const lastSoldMap: Record<number, string> = {};
    sorted.forEach((it: any) => {
      const pid = Number(it.product_id);
      const d = it.sales?.sale_date;
      if (d && (!lastSoldMap[pid] || lastSoldMap[pid] < d)) lastSoldMap[pid] = d;
    });

    // Get all products and compute stock from stock_ledger
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name');
    if (pErr) throw pErr;

    const productIds = (products || []).map((p: any) => p.id);
    const stockMap = await getCurrentStockBatch(supabase, productIds);

    const rows = (products || []).map((p: any) => ({ 
      product_id: p.id, 
      product_name: p.name, 
      last_sold_date: lastSoldMap[p.id] || null, 
      stock_remaining: stockMap.get(p.id) || 0 
    }));

    const filtered = rows.filter(r => !r.last_sold_date || r.last_sold_date < sinceStr);

    return NextResponse.json({ report: filtered, count: filtered.length });
  } catch (err: any) {
    console.error('API /api/reports/sales/dead-stock GET error:', err);
    return NextResponse.json({ status: 'error', message: err.message || 'Unexpected error' }, { status: 500 });
  }
}