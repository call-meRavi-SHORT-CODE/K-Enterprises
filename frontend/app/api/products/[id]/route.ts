import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'Invalid product id' }, { status: 400 });

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase fetch single error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch product' }, { status: 404 });
    }

    return NextResponse.json(data);
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
    ['name','quantity_with_unit','price_per_unit','reorder_point'].forEach((k) => {
      if (payload[k] !== undefined) allowed[k] = payload[k];
    });

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ status: 'error', message: 'No valid fields to update' }, { status: 400 });
    }

    // Normalize numeric fields
    if (allowed.price_per_unit !== undefined) allowed.price_per_unit = Number(allowed.price_per_unit);
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
