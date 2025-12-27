import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function DELETE(request: Request, { params }: { params: { email: string } }) {
  try {
    const supabase = createServerSupabase();

    // Attempt to clear avatar; if column doesn't exist, this will return an error
    const { data, error } = await supabase
      .from('employees')
      .update({ avatar: null })
      .eq('email', params.email)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase photo update error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to remove photo' }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', message: 'Employee photo removed', row: data });
  } catch (err: any) {
    console.error('API /api/employees/[email]/photo DELETE error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
