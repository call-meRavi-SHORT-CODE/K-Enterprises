import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const format = searchParams.get('format') || 'json';

    // Fetch sales with date filtering
    const query = supabase
      .from('sales')
      .select('id, customer_name, sale_date, total_amount, sale_items(product_id, product_name, quantity, unit_price, total_price)');

    if (startDate) {
      query.gte('sale_date', startDate);
    }
    if (endDate) {
      query.lte('sale_date', endDate);
    }

    const { data: sales, error: salesError } = await query.order('sale_date', { ascending: false });

    if (salesError) {
      console.error('Failed to fetch sales:', salesError);
      return NextResponse.json({ status: 'error', message: salesError.message }, { status: 500 });
    }

    // Group by customer_name (sales executive)
    const executiveMap = new Map<string, any>();

    (sales || []).forEach((sale: any) => {
      const executive = sale.customer_name;
      if (!executiveMap.has(executive)) {
        executiveMap.set(executive, {
          executive_name: executive,
          total_sales: 0,
          total_amount: 0,
          total_quantity: 0,
          sale_count: 0,
          products: new Map<number, any>()
        });
      }

      const data = executiveMap.get(executive);
      data.total_sales += 1;
      data.total_amount += sale.total_amount || 0;
      data.sale_count += 1;

      // Process items
      (sale.sale_items || []).forEach((item: any) => {
        data.total_quantity += item.quantity || 0;

        const productKey = item.product_id;
        if (!data.products.has(productKey)) {
          data.products.set(productKey, {
            product_id: item.product_id,
            product_name: item.product_name,
            quantity_sold: 0,
            revenue: 0
          });
        }

        const product = data.products.get(productKey);
        product.quantity_sold += item.quantity || 0;
        product.revenue += item.total_price || 0;
      });
    });

    // Convert to array and add top product
    const report = Array.from(executiveMap.values()).map((exec: any) => {
      const products = Array.from(exec.products.values());
      const topProduct = products.length > 0
        ? products.reduce((max: any, prod: any) => (prod as any).revenue > ((max as any)?.revenue || 0) ? prod : max, null as any)
        : null;

      return {
        executive_name: exec.executive_name,
        total_sales: exec.total_sales,
        total_amount: exec.total_amount,
        average_order_value: exec.total_sales > 0 ? exec.total_amount / exec.total_sales : 0,
        total_quantity_sold: exec.total_quantity,
        top_product: topProduct ? (topProduct as any).product_name : '-',
        top_product_revenue: topProduct ? (topProduct as any).revenue : 0
      };
    });

    // Sort by total amount descending
    report.sort((a: any, b: any) => (b.total_amount || 0) - (a.total_amount || 0));

    if (format === 'csv') {
      const headers = ['Executive Name', 'Total Sales', 'Total Amount', 'Average Order Value', 'Total Quantity', 'Top Product', 'Top Product Revenue'];
      const rows = report.map((r: any) => [
        r.executive_name,
        r.total_sales,
        r.total_amount.toFixed(2),
        r.average_order_value.toFixed(2),
        r.total_quantity_sold,
        r.top_product,
        r.top_product_revenue.toFixed(2)
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="executive-wise-sales-report.csv"'
        }
      });
    }

    return NextResponse.json({ status: 'success', report });
  } catch (err: any) {
    console.error('API /api/reports/sales/executive-wise error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
