import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();
    const url = new URL(request.url);
    const q = url.searchParams.get('query') || '';

    // Fetch distinct customer names
    const { data, error } = await supabase
      .from('sales')
      .select('customer_name')
      .ilike('customer_name', `%${q}%`)
      .limit(12);

    if (error) {
      console.error('Failed to fetch customers:', error);
      return NextResponse.json([], { status: 500 });
    }

    const names = Array.from(new Set((data || []).map((d: any) => d.customer_name))).slice(0, 12);
    return NextResponse.json(names.map((n: any) => ({ name: n })));
  } catch (err: any) {
    console.error('API /api/customers GET error:', err);
    return NextResponse.json([], { status: 500 });
  }
}
