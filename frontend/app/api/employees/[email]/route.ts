import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function PUT(request: Request, { params }: { params: { email: string } }) {
  try {
    const supabase = createServerSupabase();

    let payload = await request.json();

    // Remove immutable or non-existent columns
    delete payload.joining_date;
    delete payload.emp_id;

    // Allow only whitelisted columns to be updated
    const allowed: any = {};
    ['email','name','position','department','contact'].forEach((k) => {
      if (payload[k] !== undefined) allowed[k] = payload[k];
    });

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ status: 'error', message: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('employees')
      .update(allowed)
      .eq('email', params.email)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to update employee' }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', message: 'Employee updated', row: data });
  } catch (err: any) {
    console.error('API /api/employees/[email] PUT error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { email: string } }) {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('employees')
      .delete()
      .eq('email', params.email)
      .select('id')
      .single();

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ status: 'error', message: error.message || 'Failed to delete employee' }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', message: 'Employee deleted', row: data?.id ?? null });
  } catch (err: any) {
    console.error('API /api/employees/[email] DELETE error:', err);
    return NextResponse.json({ status: 'error', message: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

