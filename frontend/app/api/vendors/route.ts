import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const q = request.nextUrl.searchParams.get('query') || '';

    const { data, error } = await supabase
      .from('purchases')
      .select('vendor_name')
      .limit(100);

    if (error) {
      console.error('Failed to fetch vendors:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch vendors' }, { status: 500 });
    }

    const vendors = (data || []).map((r: any) => r.vendor_name).filter(Boolean);
    const unique = Array.from(new Set(vendors));
    const filtered = q ? unique.filter(v => v.toLowerCase().includes(q.toLowerCase())).slice(0, 10) : unique.slice(0, 10);

    return NextResponse.json({ vendors: filtered });
  } catch (err: any) {
    console.error('API /api/vendors GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
