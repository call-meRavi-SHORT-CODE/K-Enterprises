import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Initialize or set stock for a product.
 * Useful for initial inventory setup.
 * POST: { product_id: number, quantity: number }
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { product_id, quantity } = await request.json();

    if (!product_id || quantity === undefined) {
      return NextResponse.json({ status: 'error', message: 'Missing product_id or quantity' }, { status: 400 });
    }

    const pid = Number(product_id);
    const qty = Number(quantity);

    if (isNaN(pid) || isNaN(qty)) {
      return NextResponse.json({ status: 'error', message: 'Invalid product_id or quantity' }, { status: 400 });
    }

    // Check if product exists
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', pid)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ status: 'error', message: 'Product not found' }, { status: 404 });
    }

    // Check if stock row exists
    const { data: stockRow, error: stockErr } = await supabase
      .from('stock')
      .select('id')
      .eq('product_id', pid)
      .maybeSingle();

    if (stockErr) throw stockErr;

    let result;
    if (stockRow) {
      // Update existing stock
      const { data, error } = await supabase
        .from('stock')
        .update({ available_stock: qty, last_updated: new Date().toISOString() })
        .eq('product_id', pid)
        .select('*')
        .single();

      if (error) throw error;
      result = { action: 'updated', stock: data };
    } else {
      // Create new stock row
      const { data, error } = await supabase
        .from('stock')
        .insert([{ product_id: pid, available_stock: qty }])
        .select('*')
        .single();

      if (error) throw error;
      result = { action: 'created', stock: data };
    }

    return NextResponse.json({ status: 'success', message: `Stock ${result.action} successfully`, data: result });
  } catch (err: any) {
    console.error('API /api/stock/initialize POST error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
