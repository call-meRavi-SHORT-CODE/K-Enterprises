import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid product id' }, { status: 400 });

    const { data, error } = await supabase
      .from('products')
      .select('*, stock(available_stock, product_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch single error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch product' }, { status: 404 });
    }

    if (!data) return NextResponse.json({ status: 'error', message: 'Product not found' }, { status: 404 });

    const stockRow = Array.isArray((data as any).stock) && (data as any).stock.length > 0 ? (data as any).stock[0] : null;
    const current_stock = stockRow && stockRow.available_stock != null ? Number(stockRow.available_stock) : 0;
    const { stock, ...rest } = data as any;

    return NextResponse.json({ ...rest, current_stock });
  } catch (err: any) {
    console.error('API /api/products/[id] GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid product id' }, { status: 400 });

    let payload = await request.json();

    // Disallow updating id/created_at
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    // Only allow known columns
    const allowed: any = {};
    ['name','quantity_with_unit','purchase_unit_price','sales_unit_price','reorder_point'].forEach((k) => {
      if (payload[k] !== undefined) allowed[k] = payload[k];
    });

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ status: 'error', message: 'No valid fields to update' }, { status: 400 });
    }

    // Normalize numeric fields
    if (allowed.purchase_unit_price !== undefined) allowed.purchase_unit_price = Number(allowed.purchase_unit_price);
    if (allowed.sales_unit_price !== undefined) allowed.sales_unit_price = Number(allowed.sales_unit_price);
    if (allowed.reorder_point !== undefined) allowed.reorder_point = allowed.reorder_point === null ? null : Number(allowed.reorder_point);

    const { data, error } = await supabase
      .from('products')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to update product' }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', message: 'Product updated', product: data });
  } catch (err: any) {
    console.error('API /api/products/[id] PUT error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid product id' }, { status: 400 });

    // Do not allow deleting products that have related purchase or sale items
    const { data: purchaseRef, error: purchaseRefErr } = await supabase.from('purchase_items').select('id').eq('product_id', id).limit(1);
    if (purchaseRefErr) {
      console.error('Supabase ref check error:', purchaseRefErr);
      return NextResponse.json({ status: 'error', message: purchaseRefErr.message || 'Failed to check product references' }, { status: 500 });
    }
    const { data: saleRef, error: saleRefErr } = await supabase.from('sale_items').select('id').eq('product_id', id).limit(1);
    if (saleRefErr) {
      console.error('Supabase ref check error:', saleRefErr);
      return NextResponse.json({ status: 'error', message: saleRefErr.message || 'Failed to check product references' }, { status: 500 });
    }

    if ((purchaseRef && purchaseRef.length > 0) || (saleRef && saleRef.length > 0)) {
      return NextResponse.json({ status: 'error', message: 'Cannot delete product that has purchase/sale history. Remove related records first.' }, { status: 400 });
    }

    // Safe to remove stock and ledger rows for this product, then the product row
    const { error: delLedgerErr } = await supabase.from('stock_ledger').delete().eq('product_id', id);
    if (delLedgerErr) throw delLedgerErr;
    const { error: delStockErr } = await supabase.from('stock').delete().eq('product_id', id);
    if (delStockErr) throw delStockErr;

    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to delete product' }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', message: 'Product deleted', id: data?.id ?? null });
  } catch (err: any) {
    console.error('API /api/products/[id] DELETE error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
