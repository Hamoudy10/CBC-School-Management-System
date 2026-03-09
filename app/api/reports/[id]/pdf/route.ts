// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportCardDocument } from '@/features/reports/components/ReportCardPDF';

// ─── Response Helpers ─────────────────────────────────────────────────────────

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Route Context ────────────────────────────────────────────────────────────

interface RouteContext {
  params: { id: string };
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportCardPDFData {
  school: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    motto: string | null;
  };
  student: {
    name: string;
    admission_number: string;
    date_of_birth: string;
    gender: string;
    photo_url: string | null;
  };
  class_name: string;
  grade_name: string;
  term_name: string;
  academic_year: string;
  overall_score: number | null;
  performance_level: string | null;
  learning_areas: Array<{
    name: string;
    average_score: number | null;
    performance_level: string | null;
    total_competencies: number;
    competencies: Array<{
      strand: string;
      sub_strand: string;
      description: string;
      score: number;
    }>;
  }>;
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  class_teacher_remarks: string | null;
  principal_remarks: string | null;
  generated_at: string | null;
  published_at: string | null;
}

// ─── GET /api/reports/[id]/pdf ────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();

  // 1. Validate report ID
  if (!params.id || !uuidRegex.test(params.id)) {
    return errorResponse('Invalid report card ID format', 400);
  }

  const reportCardId = params.id;

  // 2. Auth check
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return errorResponse('Unauthorized', 401);
  }

  // 3. Get user with role
  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user?.school_id) {
    return errorResponse('Forbidden — no school associated', 403);
  }

  const roleName = (user.roles as Record<string, string>)?.name ?? 'student';
  const schoolId = user.school_id;
  const userId = user.user_id;

  // 4. Fetch report card with all related data
  const { data: reportCard, error: fetchError } = await supabase
    .from('report_cards')
    .select(
      `
      *,
      students (
        student_id,
        first_name,
        last_name,
        middle_name,
        admission_number,
        date_of_birth,
        gender,
        photo_url
      ),
      classes (
        class_id,
        name,
        stream,
        grades ( name, level_order )
      ),
      terms (
        term_id,
        name,
        start_date,
        end_date
      ),
      academic_years (
        academic_year_id,
        name
      )
    `
    )
    .eq('report_card_id', reportCardId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (fetchError) {
    return errorResponse(`Failed to fetch report card: ${fetchError.message}`, 500);
  }

  if (!reportCard) {
    return errorResponse('Report card not found', 404);
  }

  // 5. Role-based access control
  const isAdmin = ['super_admin', 'school_admin', 'principal', 'deputy_principal'].includes(roleName);
  const isTeacher = ['teacher', 'class_teacher', 'subject_teacher'].includes(roleName);
  const isParent = roleName === 'parent';
  const isStudent = roleName === 'student';

  // Parents can only access their children's reports
  if (isParent) {
    const { data: guardianLink } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_user_id', userId)
      .eq('student_id', reportCard.student_id)
      .maybeSingle();

    if (!guardianLink) {
      return errorResponse('You do not have access to this report card', 403);
    }
  }

  // Students can only access their own reports
  if (isStudent) {
    const { data: studentRecord } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', userId)
      .eq('student_id', reportCard.student_id)
      .maybeSingle();

    if (!studentRecord) {
      return errorResponse('You can only access your own report card', 403);
    }
  }

  // Non-admin/teacher users can only view published reports
  if (!isAdmin && !isTeacher && reportCard.status !== 'published') {
    return errorResponse('This report card has not been published yet', 403);
  }

  // 6. Fetch school details
  const { data: school } = await supabase
    .from('schools')
    .select('name, address, phone, email, logo_url, motto')
    .eq('school_id', schoolId)
    .single();

  if (!school) {
    return errorResponse('School information not found', 500);
  }

  // 7. Fetch assessment aggregates
  const { data: aggregates } = await supabase
    .from('assessment_aggregates')
    .select(
      `
      learning_area_id,
      average_score,
      performance_level,
      total_competencies,
      learning_areas ( name )
    `
    )
    .eq('student_id', reportCard.student_id)
    .eq('term_id', reportCard.term_id);

  // 8. Fetch detailed assessments
  const { data: assessments } = await supabase
    .from('assessments')
    .select(
      `
      score,
      competencies (
        competency_id,
        description,
        sub_strands (
          name,
          strands (
            name,
            learning_area_id
          )
        )
      )
    `
    )
    .eq('student_id', reportCard.student_id)
    .eq('term_id', reportCard.term_id);

  // 9. Build learning areas data structure
  const learningAreasMap = new Map<
    string,
    {
      name: string;
      average_score: number | null;
      performance_level: string | null;
      total_competencies: number;
      competencies: Array<{
        strand: string;
        sub_strand: string;
        description: string;
        score: number;
      }>;
    }
  >();

  // Initialize from aggregates
  (aggregates ?? []).forEach((agg) => {
    const laName = (agg.learning_areas as Record<string, string>)?.name ?? 'Unknown';
    learningAreasMap.set(agg.learning_area_id, {
      name: laName,
      average_score: agg.average_score,
      performance_level: agg.performance_level,
      total_competencies: agg.total_competencies ?? 0,
      competencies: [],
    });
  });

  // Add competency details
  (assessments ?? []).forEach((assessment) => {
    const competency = assessment.competencies as Record<string, unknown> | null;
    const subStrand = competency?.sub_strands as Record<string, unknown> | null;
    const strand = subStrand?.strands as Record<string, unknown> | null;
    const learningAreaId = strand?.learning_area_id as string;

    if (learningAreaId && learningAreasMap.has(learningAreaId)) {
      const la = learningAreasMap.get(learningAreaId)!;
      la.competencies.push({
        strand: (strand?.name as string) ?? '',
        sub_strand: (subStrand?.name as string) ?? '',
        description: (competency?.description as string) ?? '',
        score: assessment.score,
      });
    }
  });

  // 10. Fetch attendance summary
  const term = reportCard.terms as Record<string, string> | null;
  let attendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };

  if (term?.start_date && term?.end_date) {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', reportCard.student_id)
      .gte('date', term.start_date)
      .lte('date', term.end_date);

    const records = attendance ?? [];
    attendanceSummary = {
      present: records.filter((a) => a.status === 'present').length,
      absent: records.filter((a) => a.status === 'absent').length,
      late: records.filter((a) => a.status === 'late').length,
      excused: records.filter((a) => a.status === 'excused').length,
      total: records.length,
    };
  }

  // 11. Build PDF data
  const student = reportCard.students as Record<string, unknown>;
  const classData = reportCard.classes as Record<string, unknown>;
  const grade = classData?.grades as Record<string, string> | null;
  const academicYear = reportCard.academic_years as Record<string, string> | null;

  const studentName = [
    student.first_name,
    student.middle_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(' ');

  const className = classData
    ? `${classData.name}${classData.stream ? ` ${classData.stream}` : ''}`
    : 'N/A';

  const pdfData: ReportCardPDFData = {
    school: {
      name: school.name ?? 'School Name',
      address: school.address ?? null,
      phone: school.phone ?? null,
      email: school.email ?? null,
      logo_url: school.logo_url ?? null,
      motto: school.motto ?? null,
    },
    student: {
      name: studentName,
      admission_number: student.admission_number as string,
      date_of_birth: student.date_of_birth as string,
      gender: student.gender as string,
      photo_url: student.photo_url as string | null,
    },
    class_name: className,
    grade_name: grade?.name ?? '',
    term_name: term?.name ?? '',
    academic_year: academicYear?.name ?? '',
    overall_score: reportCard.overall_score,
    performance_level: reportCard.performance_level,
    learning_areas: Array.from(learningAreasMap.values()),
    attendance: attendanceSummary,
    class_teacher_remarks: reportCard.class_teacher_remarks,
    principal_remarks: reportCard.principal_remarks,
    generated_at: reportCard.generated_at,
    published_at: reportCard.published_at,
  };

  // 12. Check query params
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'pdf';

  // 13. Generate PDF
  try {
    if (format === 'html') {
      // Return HTML preview
      const html = generateHtmlPreview(pdfData);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // Generate PDF using @react-pdf/renderer
    const pdfBuffer = await renderToBuffer(ReportCardDocument({ data: pdfData }));

    const filename = `report-card-${pdfData.student.admission_number}-${pdfData.term_name.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (pdfError) {
    console.error('PDF generation failed:', pdfError);

    // Fallback to HTML if PDF generation fails
    const html = generateHtmlPreview(pdfData);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-PDF-Fallback': 'true',
      },
    });
  }
}

// ─── HTML Preview Generator (Fallback) ────────────────────────────────────────

function generateHtmlPreview(data: ReportCardPDFData): string {
  const scoreToLevel = (score: number): string => {
    if (score >= 3.5) return 'Exceeding Expectations';
    if (score >= 2.5) return 'Meeting Expectations';
    if (score >= 1.5) return 'Approaching Expectations';
    return 'Below Expectations';
  };

  const scoreToColor = (score: number): string => {
    if (score >= 3.5) return '#22c55e';
    if (score >= 2.5) return '#3b82f6';
    if (score >= 1.5) return '#f59e0b';
    return '#ef4444';
  };

  const attendanceRate =
    data.attendance.total > 0
      ? ((data.attendance.present / data.attendance.total) * 100).toFixed(1)
      : '0';

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const learningAreasHtml = data.learning_areas
    .map(
      (la) => `
      <div class="learning-area">
        <div class="la-header">
          <h3>${escapeHtml(la.name)}</h3>
          <div class="la-summary">
            <span class="score-badge" style="background-color: ${scoreToColor(la.average_score ?? 0)}">
              ${la.average_score?.toFixed(1) ?? '—'}
            </span>
            <span class="level">${escapeHtml(la.performance_level ?? 'Not Assessed')}</span>
          </div>
        </div>
        ${
          la.competencies.length > 0
            ? `
          <table class="competencies-table">
            <thead>
              <tr>
                <th>Strand</th>
                <th>Sub-strand</th>
                <th>Competency</th>
                <th>Score</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              ${la.competencies
                .map(
                  (c) => `
                <tr>
                  <td>${escapeHtml(c.strand)}</td>
                  <td>${escapeHtml(c.sub_strand)}</td>
                  <td>${escapeHtml(c.description)}</td>
                  <td class="score-cell">
                    <span class="score-badge" style="background-color: ${scoreToColor(c.score)}">${c.score}</span>
                  </td>
                  <td>${scoreToLevel(c.score)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
            : '<p class="no-data">No competencies assessed yet.</p>'
        }
      </div>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Card - ${escapeHtml(data.student.name)}</title>
  <style>
    :root {
      --primary: #1e40af;
      --primary-light: #e0e7ff;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-500: #6b7280;
      --gray-700: #374151;
      --gray-900: #1f2937;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: var(--gray-900);
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .report-card {
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm;
    }
    
    /* Header */
    .header {
      text-align: center;
      border-bottom: 3px solid var(--primary);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    
    .school-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    
    .school-name {
      font-size: 22px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 4px;
    }
    
    .school-motto {
      font-style: italic;
      color: var(--gray-500);
      margin-bottom: 4px;
    }
    
    .school-contact {
      font-size: 10px;
      color: var(--gray-500);
    }
    
    .report-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 12px;
      color: var(--gray-900);
    }
    
    /* Student Info */
    .student-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 16px;
      background: var(--gray-50);
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .info-group { display: flex; flex-direction: column; gap: 6px; }
    .info-row { display: flex; gap: 8px; }
    .info-label { font-weight: 600; color: var(--gray-500); min-width: 100px; }
    .info-value { color: var(--gray-900); }
    .info-value strong { font-weight: 600; }
    
    /* Overall Performance */
    .overall-performance {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 20px;
      background: linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%);
      border-radius: 8px;
      color: white;
      margin-bottom: 24px;
    }
    
    .performance-item { text-align: center; }
    .performance-label { font-size: 10px; opacity: 0.9; margin-bottom: 4px; }
    .performance-value { font-size: 28px; font-weight: 700; }
    .performance-level-text { font-size: 13px; font-weight: 600; }
    
    /* Section Title */
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary);
      margin: 24px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 2px solid var(--gray-200);
    }
    
    /* Learning Areas */
    .learning-area {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    
    .la-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--primary-light);
      padding: 10px 14px;
      border-radius: 6px 6px 0 0;
    }
    
    .la-header h3 { font-size: 13px; color: var(--primary); }
    .la-summary { display: flex; align-items: center; gap: 10px; }
    
    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 28px;
      padding: 0 10px;
      border-radius: 14px;
      color: white;
      font-weight: 700;
      font-size: 13px;
    }
    
    .level { font-size: 11px; color: var(--gray-700); }
    
    .competencies-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    .competencies-table th,
    .competencies-table td {
      border: 1px solid var(--gray-200);
      padding: 8px 10px;
      text-align: left;
    }
    
    .competencies-table th {
      background: var(--gray-50);
      font-weight: 600;
      color: var(--gray-700);
    }
    
    .competencies-table tr:nth-child(even) { background: var(--gray-50); }
    .score-cell { text-align: center; }
    
    .no-data {
      padding: 16px;
      text-align: center;
      color: var(--gray-500);
      background: var(--gray-50);
      border: 1px solid var(--gray-200);
      border-top: none;
      border-radius: 0 0 6px 6px;
    }
    
    /* Attendance */
    .attendance-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .attendance-stat {
      text-align: center;
      padding: 14px;
      background: var(--gray-50);
      border-radius: 8px;
    }
    
    .attendance-stat .value { font-size: 22px; font-weight: 700; color: var(--gray-900); }
    .attendance-stat .label { font-size: 10px; color: var(--gray-500); margin-top: 4px; }
    
    /* Remarks */
    .remarks-box {
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
      min-height: 70px;
    }
    
    .remarks-title { font-weight: 600; color: var(--gray-700); margin-bottom: 8px; }
    .remarks-content { color: var(--gray-500); font-style: italic; }
    
    /* Grading Key */
    .grading-key {
      margin-top: 24px;
      padding: 14px;
      background: var(--gray-50);
      border-radius: 8px;
    }
    
    .grading-key h4 { font-size: 11px; margin-bottom: 10px; color: var(--gray-700); }
    .grading-key-items { display: flex; gap: 20px; flex-wrap: wrap; }
    
    .grading-key-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
    }
    
    .key-score {
      width: 22px;
      height: 22px;
      line-height: 22px;
      border-radius: 50%;
      color: white;
      font-weight: 700;
      text-align: center;
      font-size: 11px;
    }
    
    /* Signatures */
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 40px;
      padding-top: 20px;
    }
    
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid var(--gray-500); padding-top: 30px; margin-bottom: 6px; }
    .signature-label { font-size: 10px; color: var(--gray-500); }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 9px;
      color: var(--gray-500);
      border-top: 1px solid var(--gray-200);
      padding-top: 14px;
    }
    
    @media print {
      .report-card { padding: 8mm; }
      body { font-size: 11px; }
      .learning-area { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      ${data.school.logo_url ? `<img src="${escapeHtml(data.school.logo_url)}" alt="School Logo" class="school-logo">` : ''}
      <div class="school-name">${escapeHtml(data.school.name)}</div>
      ${data.school.motto ? `<div class="school-motto">"${escapeHtml(data.school.motto)}"</div>` : ''}
      <div class="school-contact">
        ${[data.school.address, data.school.phone, data.school.email].filter(Boolean).map(escapeHtml).join(' • ')}
      </div>
      <div class="report-title">STUDENT PROGRESS REPORT</div>
    </div>
    
    <div class="student-info">
      <div class="info-group">
        <div class="info-row">
          <span class="info-label">Student Name:</span>
          <span class="info-value"><strong>${escapeHtml(data.student.name)}</strong></span>
        </div>
        <div class="info-row">
          <span class="info-label">Admission No:</span>
          <span class="info-value">${escapeHtml(data.student.admission_number)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date of Birth:</span>
          <span class="info-value">${formatDate(data.student.date_of_birth)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Gender:</span>
          <span class="info-value">${escapeHtml(data.student.gender.charAt(0).toUpperCase() + data.student.gender.slice(1))}</span>
        </div>
      </div>
      <div class="info-group">
        <div class="info-row">
          <span class="info-label">Class:</span>
          <span class="info-value"><strong>${escapeHtml(data.class_name)}</strong></span>
        </div>
        <div class="info-row">
          <span class="info-label">Grade:</span>
          <span class="info-value">${escapeHtml(data.grade_name)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Term:</span>
          <span class="info-value">${escapeHtml(data.term_name)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Academic Year:</span>
          <span class="info-value">${escapeHtml(data.academic_year)}</span>
        </div>
      </div>
    </div>
    
    <div class="overall-performance">
      <div class="performance-item">
        <div class="performance-label">OVERALL SCORE</div>
        <div class="performance-value">${data.overall_score?.toFixed(1) ?? '—'}</div>
      </div>
      <div class="performance-item">
        <div class="performance-label">PERFORMANCE LEVEL</div>
        <div class="performance-level-text">${escapeHtml(data.performance_level ?? 'Not Assessed')}</div>
      </div>
      <div class="performance-item">
        <div class="performance-label">ATTENDANCE RATE</div>
        <div class="performance-value">${attendanceRate}%</div>
      </div>
    </div>
    
    <h2 class="section-title">Learning Area Performance</h2>
    ${learningAreasHtml || '<p class="no-data">No learning areas assessed yet.</p>'}
    
    <h2 class="section-title">Attendance Summary</h2>
    <div class="attendance-grid">
      <div class="attendance-stat">
        <div class="value">${data.attendance.present}</div>
        <div class="label">Present</div>
      </div>
      <div class="attendance-stat">
        <div class="value">${data.attendance.absent}</div>
        <div class="label">Absent</div>
      </div>
      <div class="attendance-stat">
        <div class="value">${data.attendance.late}</div>
        <div class="label">Late</div>
      </div>
      <div class="attendance-stat">
        <div class="value">${data.attendance.excused}</div>
        <div class="label">Excused</div>
      </div>
      <div class="attendance-stat">
        <div class="value">${data.attendance.total}</div>
        <div class="label">Total Days</div>
      </div>
    </div>
    
    <h2 class="section-title">Remarks</h2>
    <div class="remarks-box">
      <div class="remarks-title">Class Teacher's Remarks:</div>
      <div class="remarks-content">${escapeHtml(data.class_teacher_remarks ?? 'No remarks provided.')}</div>
    </div>
    <div class="remarks-box">
      <div class="remarks-title">Principal's Remarks:</div>
      <div class="remarks-content">${escapeHtml(data.principal_remarks ?? 'No remarks provided.')}</div>
    </div>
    
    <div class="grading-key">
      <h4>CBC Performance Levels (1-4 Scale)</h4>
      <div class="grading-key-items">
        <div class="grading-key-item">
          <span class="key-score" style="background-color: #22c55e">4</span>
          <span>Exceeding Expectations (EE)</span>
        </div>
        <div class="grading-key-item">
          <span class="key-score" style="background-color: #3b82f6">3</span>
          <span>Meeting Expectations (ME)</span>
        </div>
        <div class="grading-key-item">
          <span class="key-score" style="background-color: #f59e0b">2</span>
          <span>Approaching Expectations (AE)</span>
        </div>
        <div class="grading-key-item">
          <span class="key-score" style="background-color: #ef4444">1</span>
          <span>Below Expectations (BE)</span>
        </div>
      </div>
    </div>
    
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Class Teacher's Signature</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Principal's Signature</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Parent/Guardian's Signature</div>
      </div>
    </div>
    
    <div class="footer">
      Generated on ${formatDate(data.generated_at)}
      ${data.published_at ? ` • Published on ${formatDate(data.published_at)}` : ''}
      <br>
      This is a computer-generated report card from ${escapeHtml(data.school.name)}.
    </div>
  </div>
</body>
</html>`;
}

// ─── HTML Escape Helper ───────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}
