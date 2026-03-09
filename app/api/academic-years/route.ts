import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.schoolId || user.school_id;
    if (!schoolId) {
      return NextResponse.json({ error: 'No school context' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Academic years fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const years = (data || []).map((year) => ({
      ...year,
      year_name: year.year,
      is_current: year.is_active,
    }));

    return NextResponse.json({ data: years });
  } catch (error) {
    console.error('Academic years API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
