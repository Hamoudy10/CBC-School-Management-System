// features/reports/services/pdf.service.ts
// PDF generation service using server-side rendering
// Uses html-to-pdf approach for server-side generation

import type { CBCReportCardData } from "../types";

// ============================================================
// HTML TEMPLATE GENERATORS
// ============================================================

export function generateReportCardHTML(data: CBCReportCardData): string {
  const levelColor = (level: string): string => {
    switch (level) {
      case "EE":
        return "#3B82F6";
      case "ME":
        return "#10B981";
      case "AE":
        return "#F59E0B";
      case "BE":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const levelBg = (level: string): string => {
    switch (level) {
      case "EE":
        return "#EFF6FF";
      case "ME":
        return "#ECFDF5";
      case "AE":
        return "#FFFBEB";
      case "BE":
        return "#FEF2F2";
      default:
        return "#F9FAFB";
    }
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Card - ${data.student.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #1F2937;
      line-height: 1.4;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1E3A8A;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .school-name {
      font-size: 20px;
      font-weight: 700;
      color: #1E3A8A;
      text-transform: uppercase;
    }
    .school-motto {
      font-size: 11px;
      color: #6B7280;
      font-style: italic;
      margin-top: 2px;
    }
    .report-title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .student-info {
      display: flex;
      justify-content: space-between;
      background: #F9FAFB;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border: 1px solid #E5E7EB;
    }
    .student-info .col {
      flex: 1;
    }
    .student-info .label {
      font-size: 9px;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .student-info .value {
      font-size: 12px;
      font-weight: 600;
      color: #1F2937;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1E3A8A;
      margin: 12px 0 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #DBEAFE;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      background: #1E3A8A;
      color: white;
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 10px;
    }
    tr:nth-child(even) td {
      background: #F9FAFB;
    }
    .level-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-align: center;
      min-width: 30px;
    }
    .la-row {
      background: #F3F4F6 !important;
      font-weight: 600;
    }
    .la-row td {
      border-top: 2px solid #D1D5DB;
      padding-top: 8px;
    }
    .overall-box {
      display: flex;
      gap: 15px;
      margin: 15px 0;
    }
    .overall-card {
      flex: 1;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #E5E7EB;
    }
    .overall-card .label {
      font-size: 9px;
      color: #6B7280;
      text-transform: uppercase;
    }
    .overall-card .value {
      font-size: 22px;
      font-weight: 700;
    }
    .remarks-box {
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 10px 15px;
      margin-bottom: 10px;
      min-height: 50px;
    }
    .remarks-label {
      font-size: 10px;
      color: #6B7280;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .attendance-grid {
      display: flex;
      gap: 10px;
    }
    .att-item {
      flex: 1;
      text-align: center;
      padding: 8px;
      background: #F9FAFB;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
    }
    .att-item .num {
      font-size: 18px;
      font-weight: 700;
      color: #1E3A8A;
    }
    .att-item .lbl {
      font-size: 9px;
      color: #6B7280;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #E5E7EB;
    }
    .signature-block {
      text-align: center;
      width: 30%;
    }
    .signature-line {
      border-bottom: 1px solid #374151;
      height: 30px;
      margin-bottom: 4px;
    }
    .signature-label {
      font-size: 9px;
      color: #6B7280;
    }
    .legend {
      margin-top: 10px;
      padding: 8px 12px;
      background: #F9FAFB;
      border-radius: 6px;
      display: flex;
      gap: 15px;
      font-size: 9px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    @media print {
      body { background: #fff; }
      .page {
        margin: 0;
        padding: 10mm;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="school-name">${escapeHtml(data.school.name)}</div>
      ${data.school.motto ? `<div class="school-motto">"${escapeHtml(data.school.motto)}"</div>` : ""}
      <div style="font-size: 10px; color: #6B7280; margin-top: 4px;">
        ${escapeHtml(data.school.address)}
        ${data.school.contact_phone ? ` | Tel: ${escapeHtml(data.school.contact_phone)}` : ""}
      </div>
      <div class="report-title">Competency Based Curriculum Progress Report</div>
    </div>

    <!-- STUDENT INFO -->
    <div class="student-info">
      <div class="col">
        <div class="label">Student Name</div>
        <div class="value">${escapeHtml(data.student.name)}</div>
      </div>
      <div class="col">
        <div class="label">Admission No.</div>
        <div class="value">${escapeHtml(data.student.admission_no)}</div>
      </div>
      <div class="col">
        <div class="label">Class</div>
        <div class="value">${escapeHtml(data.student.class_name)}</div>
      </div>
      <div class="col">
        <div class="label">Term</div>
        <div class="value">${escapeHtml(data.student.term)}</div>
      </div>
      <div class="col">
        <div class="label">Year</div>
        <div class="value">${escapeHtml(data.student.academic_year)}</div>
      </div>
    </div>

    <!-- PERFORMANCE OVERVIEW -->
    <div class="overall-box">
      <div class="overall-card" style="background: ${levelBg(data.overall.level)}; border-color: ${levelColor(data.overall.level)};">
        <div class="label">Overall Score</div>
        <div class="value" style="color: ${levelColor(data.overall.level)};">${data.overall.average_score}</div>
        <div style="font-size: 10px; font-weight: 600; color: ${levelColor(data.overall.level)};">${data.overall.level_label}</div>
      </div>
      <div class="overall-card">
        <div class="label">Learning Areas</div>
        <div class="value" style="color: #1E3A8A;">${data.overall.total_learning_areas}</div>
      </div>
      <div class="overall-card" style="background: #ECFDF5;">
        <div class="label">Exceeding</div>
        <div class="value" style="color: #3B82F6;">${data.overall.level_distribution.exceeding}</div>
      </div>
      <div class="overall-card" style="background: #ECFDF5;">
        <div class="label">Meeting</div>
        <div class="value" style="color: #10B981;">${data.overall.level_distribution.meeting}</div>
      </div>
      <div class="overall-card" style="background: #FFFBEB;">
        <div class="label">Approaching</div>
        <div class="value" style="color: #F59E0B;">${data.overall.level_distribution.approaching}</div>
      </div>
      <div class="overall-card" style="background: #FEF2F2;">
        <div class="label">Below</div>
        <div class="value" style="color: #EF4444;">${data.overall.level_distribution.below}</div>
      </div>
    </div>

    <!-- LEARNING AREAS TABLE -->
    <div class="section-title">Learning Areas Performance</div>
    <table>
      <thead>
        <tr>
          <th style="width: 35%;">Learning Area / Strand / Sub-Strand</th>
          <th style="width: 15%; text-align: center;">Score</th>
          <th style="width: 15%; text-align: center;">Level</th>
          <th style="width: 35%;">Performance Descriptor</th>
        </tr>
      </thead>
      <tbody>
        ${data.learning_areas
          .map(
            (la) => `
          <tr class="la-row">
            <td><strong>${escapeHtml(la.name)}</strong></td>
            <td style="text-align: center; font-weight: 700;">${la.average_score}</td>
            <td style="text-align: center;">
              <span class="level-badge" style="background: ${levelBg(la.level)}; color: ${levelColor(la.level)};">${la.level}</span>
            </td>
            <td style="font-weight: 600;">${escapeHtml(la.level_label)}</td>
          </tr>
          ${la.strands
            .map(
              (strand) => `
            ${strand.sub_strands
              .map(
                (ss) => `
              <tr>
                <td style="padding-left: 20px; color: #4B5563;">↳ ${escapeHtml(strand.name)} → ${escapeHtml(ss.name)}</td>
                <td style="text-align: center;">${ss.score}</td>
                <td style="text-align: center;">
                  <span class="level-badge" style="background: ${levelBg(ss.level)}; color: ${levelColor(ss.level)};">${ss.level}</span>
                </td>
                <td style="color: #6B7280;">${escapeHtml(ss.level_label)}</td>
              </tr>`,
              )
              .join("")}`,
            )
            .join("")}`,
          )
          .join("")}
      </tbody>
    </table>

    <!-- LEGEND -->
    <div class="legend">
      <div class="legend-item">
        <div class="legend-dot" style="background: #3B82F6;"></div>
        <span><strong>EE</strong> - Exceeding Expectation (3.5-4.0)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #10B981;"></div>
        <span><strong>ME</strong> - Meeting Expectation (2.5-3.4)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #F59E0B;"></div>
        <span><strong>AE</strong> - Approaching Expectation (1.5-2.4)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #EF4444;"></div>
        <span><strong>BE</strong> - Below Expectation (1.0-1.4)</span>
      </div>
    </div>

    <!-- ATTENDANCE -->
    <div class="section-title">Attendance Summary</div>
    <div class="attendance-grid">
      <div class="att-item">
        <div class="num">${data.attendance.total_days}</div>
        <div class="lbl">School Days</div>
      </div>
      <div class="att-item">
        <div class="num" style="color: #10B981;">${data.attendance.present_days}</div>
        <div class="lbl">Present</div>
      </div>
      <div class="att-item">
        <div class="num" style="color: #EF4444;">${data.attendance.absent_days}</div>
        <div class="lbl">Absent</div>
      </div>
      <div class="att-item">
        <div class="num" style="color: #F59E0B;">${data.attendance.late_days}</div>
        <div class="lbl">Late</div>
      </div>
      <div class="att-item">
        <div class="num" style="color: #1E3A8A;">${data.attendance.attendance_rate}%</div>
        <div class="lbl">Attendance Rate</div>
      </div>
    </div>

    <!-- REMARKS -->
    <div class="section-title">Remarks</div>
    <div class="remarks-box">
      <div class="remarks-label">Class Teacher's Remarks</div>
      <div>${data.remarks.class_teacher ? escapeHtml(data.remarks.class_teacher) : "_______________________________________________"}</div>
    </div>
    <div class="remarks-box">
      <div class="remarks-label">Principal's Remarks</div>
      <div>${data.remarks.principal ? escapeHtml(data.remarks.principal) : "_______________________________________________"}</div>
    </div>

    <!-- DATES -->
    <div style="display: flex; gap: 20px; margin-top: 10px; font-size: 10px; color: #6B7280;">
      ${data.dates.closing_date ? `<div><strong>Closing Date:</strong> ${data.dates.closing_date}</div>` : ""}
      ${data.dates.next_term_opening ? `<div><strong>Next Term Opens:</strong> ${data.dates.next_term_opening}</div>` : ""}
    </div>

    <!-- SIGNATURES -->
    <div class="signature-section">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Class Teacher's Signature</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Principal's Signature & Stamp</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Parent/Guardian's Signature</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

// ============================================================
// FINANCE REPORT HTML GENERATOR
// ============================================================

export function generateFinanceReportHTML(data: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Finance Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; font-size: 11px; color: #1F2937; }
    .page { width: 210mm; padding: 15mm; margin: 0 auto; }
    .header { text-align: center; border-bottom: 3px solid #1E3A8A; padding-bottom: 10px; margin-bottom: 15px; }
    .title { font-size: 18px; font-weight: 700; color: #1E3A8A; }
    .subtitle { font-size: 12px; color: #6B7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #1E3A8A; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #E5E7EB; font-size: 10px; }
    tr:nth-child(even) td { background: #F9FAFB; }
    .summary-grid { display: flex; gap: 12px; margin: 15px 0; }
    .summary-card {
      flex: 1; text-align: center; padding: 12px;
      border-radius: 8px; border: 1px solid #E5E7EB;
    }
    .summary-card .label { font-size: 9px; color: #6B7280; text-transform: uppercase; }
    .summary-card .value { font-size: 18px; font-weight: 700; }
    .section-title { font-size: 13px; font-weight: 700; color: #1E3A8A; margin: 15px 0 8px; border-bottom: 2px solid #DBEAFE; padding-bottom: 4px; }
    .amount { text-align: right; font-family: monospace; }
    .total-row td { font-weight: 700; border-top: 2px solid #1E3A8A; background: #F3F4F6 !important; }
    @media print { .page { margin: 0; padding: 10mm; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">${escapeHtml(data.school_name || "School")}</div>
      <div class="subtitle">Fee Collection Report - ${escapeHtml(data.term || "")} ${escapeHtml(data.academic_year || "")}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card" style="background: #EFF6FF;">
        <div class="label">Total Expected</div>
        <div class="value" style="color: #1E3A8A;">KES ${formatCurrency(data.summary?.total_expected || 0)}</div>
      </div>
      <div class="summary-card" style="background: #ECFDF5;">
        <div class="label">Total Collected</div>
        <div class="value" style="color: #10B981;">KES ${formatCurrency(data.summary?.total_collected || 0)}</div>
      </div>
      <div class="summary-card" style="background: #FEF2F2;">
        <div class="label">Outstanding</div>
        <div class="value" style="color: #EF4444;">KES ${formatCurrency(data.summary?.total_outstanding || 0)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Collection Rate</div>
        <div class="value" style="color: #1E3A8A;">${data.summary?.collection_rate || 0}%</div>
      </div>
    </div>

    ${
      data.by_category?.length
        ? `
    <div class="section-title">Collection by Category</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="amount">Expected (KES)</th>
          <th class="amount">Collected (KES)</th>
          <th class="amount">Outstanding (KES)</th>
        </tr>
      </thead>
      <tbody>
        ${data.by_category
          .map(
            (c: any) => `
        <tr>
          <td>${escapeHtml(c.category)}</td>
          <td class="amount">${formatCurrency(c.expected)}</td>
          <td class="amount">${formatCurrency(c.collected)}</td>
          <td class="amount">${formatCurrency(c.outstanding)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
        : ""
    }

    ${
      data.defaulters?.length
        ? `
    <div class="section-title">Fee Defaulters</div>
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Adm No.</th>
          <th>Class</th>
          <th class="amount">Amount Due (KES)</th>
          <th style="text-align: center;">Days Overdue</th>
        </tr>
      </thead>
      <tbody>
        ${data.defaulters
          .map(
            (d: any) => `
        <tr>
          <td>${escapeHtml(d.student_name)}</td>
          <td>${escapeHtml(d.admission_no)}</td>
          <td>${escapeHtml(d.class_name)}</td>
          <td class="amount">${formatCurrency(d.amount_due)}</td>
          <td style="text-align: center; color: ${d.days_overdue > 30 ? "#EF4444" : "#F59E0B"};">${d.days_overdue}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
        : ""
    }

    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between;">
      <div style="font-size: 10px; color: #6B7280;">Generated: ${new Date().toLocaleDateString("en-KE", { dateStyle: "long" })}</div>
      <div style="text-align: center; width: 30%;">
        <div style="border-bottom: 1px solid #374151; height: 25px;"></div>
        <div style="font-size: 9px; color: #6B7280;">Finance Officer's Signature</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
