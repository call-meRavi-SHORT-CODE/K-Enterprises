import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const payload = await request.json();

    const name = (payload.name ?? '').toString();
    const quantity_with_unit = (payload.quantity_with_unit ?? '').toString();
    const price_per_unit = Number(payload.price_per_unit);
    const reorder_point = payload.reorder_point !== undefined && payload.reorder_point !== null
      ? Number(payload.reorder_point)
      : null;

    if (!name || !quantity_with_unit || isNaN(price_per_unit)) {
      return NextResponse.json({ status: 'error', message: 'Missing or invalid required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          name,
          quantity_with_unit,
          price_per_unit: price_per_unit,
          reorder_point: reorder_point,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to create product' }, { status: 400 });
    }

    return NextResponse.json({ id: data?.id ?? null, status: 'success', message: 'Product created successfully', product: data });
  } catch (err: any) {
    console.error('API /api/products POST error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API /api/products GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
