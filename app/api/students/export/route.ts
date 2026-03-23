import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? '');
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  }

  const allowedRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'subject_teacher',
    'ict_admin',
  ];

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, message: 'Insufficient permissions', data: null },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId ?? user.school_id;
  const searchParams = new URL(req.url).searchParams;
  const format = searchParams.get('format') === 'excel' ? 'excel' : 'csv';

  let query = supabase
    .from('students')
    .select(
      `
      admission_number,
      first_name,
      last_name,
      middle_name,
      gender,
      status,
      enrollment_date,
      nemis_number,
      has_special_needs,
      classes (
        name,
        stream,
        grades ( name )
      )
    `,
    )
    .order('first_name', { ascending: true });

  if (schoolId && user.role !== 'super_admin') {
    query = query.eq('school_id', schoolId);
  }

  const classId = searchParams.get('classId') ?? searchParams.get('class_id');
  const status = searchParams.get('status');
  const gender = searchParams.get('gender');
  const search = searchParams.get('search');
  const gradeId = searchParams.get('gradeId') ?? searchParams.get('grade_id');

  if (classId) {
    query = query.eq('current_class_id', classId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (gender) {
    query = query.eq('gender', gender);
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`,
    );
  }

  if (gradeId) {
    const { data: classRows } = await supabase
      .from('classes')
      .select('class_id')
      .eq('grade_id', gradeId)
      .eq('school_id', schoolId);

    const ids = (classRows ?? []).map((row) => row.class_id);
    if (ids.length === 0) {
      query = query.in('current_class_id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      query = query.in('current_class_id', ids);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, data: null },
      { status: 500 },
    );
  }

  const rows = (data ?? []).map((student: any) => {
    const classRow = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const gradeRow = Array.isArray(classRow?.grades) ? classRow.grades[0] : classRow?.grades;
    return {
      'Admission Number': student.admission_number,
      Name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '),
      Gender: student.gender,
      Status: student.status,
      Grade: gradeRow?.name ?? '',
      Class: classRow?.name ?? '',
      Stream: classRow?.stream ?? '',
      'Enrollment Date': student.enrollment_date,
      NEMIS: student.nemis_number ?? '',
      'Special Needs': student.has_special_needs ? 'Yes' : 'No',
    };
  });

  if (format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="students-export-${new Date()
          .toISOString()
          .split('T')[0]}.xlsx"`,
      },
    });
  }

  const headers = Object.keys(rows[0] ?? {
    'Admission Number': '',
    Name: '',
    Gender: '',
    Status: '',
    Grade: '',
    Class: '',
    Stream: '',
    'Enrollment Date': '',
    NEMIS: '',
    'Special Needs': '',
  });

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv((row as Record<string, unknown>)[header])).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="students-export-${new Date()
        .toISOString()
        .split('T')[0]}.csv"`,
    },
  });
}
