export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/withAuth';

export const GET = withAuth(async (request: NextRequest) => {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const status = searchParams.get('status'); // 'success' | 'error' | null (all)
  const label = searchParams.get('label');   // filter by request_label
  const from = searchParams.get('from');     // ISO date
  const to = searchParams.get('to');         // ISO date

  let query = supabase
    .from('ai_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status === 'error') {
    query = query.not('error', 'is', null);
  } else if (status === 'success') {
    query = query.is('error', null);
  }

  if (label) {
    query = query.eq('request_label', label);
  }

  if (from) {
    query = query.gte('created_at', from);
  }

  if (to) {
    query = query.lte('created_at', to);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get distinct request labels for filter dropdown
  const { data: labels } = await supabase
    .from('ai_logs')
    .select('request_label')
    .not('request_label', 'is', null)
    .order('request_label');

  const uniqueLabels = [...new Set((labels ?? []).map((r: any) => r.request_label))];

  return NextResponse.json({
    data,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    filters: {
      labels: uniqueLabels,
    },
  });
});
