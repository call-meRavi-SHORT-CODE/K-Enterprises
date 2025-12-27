import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();

    const form = await request.formData();
    const email = form.get('email')?.toString() ?? '';
    const name = form.get('name')?.toString() ?? '';
    const position = form.get('position')?.toString() ?? '';
    const department = form.get('department')?.toString() ?? '';
    const contact = form.get('contact')?.toString() ?? '';
    const joining_date = form.get('joining_date')?.toString() ?? '';

    if (!email || !name || !position || !department || !contact || !joining_date) {
      return NextResponse.json({ status: 'error', message: 'Missing required fields' }, { status: 400 });
    }

    // Validate date
    const d = new Date(joining_date);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ status: 'error', message: 'Invalid joining_date' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([
        {
          email,
          name,
          position,
          department,
          contact,
          joining_date: joining_date,
        },
      ])
      .select('id')
      .single();

    if (error) {
      // Log and return friendly message for duplicate email
      console.error('Supabase insert error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to create employee' }, { status: 400 });
    }

    return NextResponse.json({ row: data?.id ?? null, status: 'success', message: 'Employee created successfully' });
  } catch (err: any) {
    console.error('API /api/employees POST error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
} 

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to fetch employees' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API /api/employees GET error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
