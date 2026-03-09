// @ts-nocheck
// features/reports/services/pdfGenerator.service.ts
// Server-side PDF generation for all report types
// Uses html-to-pdf approach with React components rendered to HTML

import type {
  TermReportData,
  ClassListData,
  FeeStatementData,
  AttendanceReportData,
} from "../types";

// CBC performance level color mapping
const LEVEL_COLORS: Record<string, string> = {
  "Exceeding Expectation": "#3B82F6",
  "Meeting Expectation": "#10B981",
  "Approaching Expectation": "#F59E0B",
  "Below Expectation": "#EF4444",
};

const LEVEL_BG: Record<string, string> = {
  "Exceeding Expectation": "#EFF6FF",
  "Meeting Expectation": "#ECFDF5",
  "Approaching Expectation": "#FFFBEB",
  "Below Expectation": "#FEF2F2",
};

export class PdfGeneratorService {
  // ── Generate term report card HTML ──
  static generateTermReportHtml(data: TermReportData): string {
    const levelBadge = (level: string) => `
      <span style="
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        color: ${LEVEL_COLORS[level] || "#666"};
        background: ${LEVEL_BG[level] || "#f3f4f6"};
      ">${level}</span>
    `;

    const scoreDot = (score: number) => {
      const colors = ["", "#EF4444", "#F59E0B", "#10B981", "#3B82F6"];
      return `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${colors[score] || "#ccc"};color:white;text-align:center;line-height:24px;font-weight:bold;font-size:12px;">${score}</span>`;
    };

    let learningAreasHtml = "";
    for (const la of data.learning_areas) {
      let strandRows = "";
      for (const strand of la.strands) {
        for (const sub of strand.sub_strands) {
          for (const comp of sub.competencies) {
            strandRows += `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${strand.name}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${sub.name}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${comp.name}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${scoreDot(comp.score)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${levelBadge(comp.level)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${comp.remarks || ""}</td>
              </tr>
            `;
          }
        }
      }

      learningAreasHtml += `
        <div style="margin-bottom:16px;">
          <div style="background:#1E3A8A;color:white;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:13px;">${la.name}</strong>
            <span>${levelBadge(la.overall_level)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:6px 8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Strand</th>
                <th style="padding:6px 8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Sub-Strand</th>
                <th style="padding:6px 8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Competency</th>
                <th style="padding:6px 8px;text-align:center;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Score</th>
                <th style="padding:6px 8px;text-align:center;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Level</th>
                <th style="padding:6px 8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Remarks</th>
              </tr>
            </thead>
            <tbody>${strandRows}</tbody>
          </table>
        </div>
      `;
    }

    const { overall_summary, attendance_summary } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; color: #1f2937; line-height: 1.4; margin: 0; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #1E3A8A;padding-bottom:15px;">
          ${data.school.logo_url ? `<img src="${data.school.logo_url}" alt="Logo" style="height:60px;margin-bottom:8px;">` : ""}
          <h1 style="margin:0;font-size:20px;color:#1E3A8A;">${data.school.name}</h1>
          <p style="margin:2px 0;font-size:12px;color:#6b7280;">${data.school.address} | ${data.school.contact_phone} | ${data.school.contact_email}</p>
          ${data.school.motto ? `<p style="margin:2px 0;font-size:11px;font-style:italic;color:#9ca3af;">"${data.school.motto}"</p>` : ""}
          <h2 style="margin:10px 0 0;font-size:16px;color:#1f2937;">STUDENT PROGRESS REPORT - ${data.term} ${data.academic_year}</h2>
        </div>

        <!-- Student Info -->
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;background:#f9fafb;padding:12px;border-radius:8px;">
          <div>
            <p style="margin:2px 0;font-size:12px;"><strong>Name:</strong> ${data.student.name}</p>
            <p style="margin:2px 0;font-size:12px;"><strong>Admission No:</strong> ${data.student.admission_no}</p>
            <p style="margin:2px 0;font-size:12px;"><strong>Class:</strong> ${data.student.class_name}</p>
          </div>
          <div>
            ${data.student.date_of_birth ? `<p style="margin:2px 0;font-size:12px;"><strong>DOB:</strong> ${data.student.date_of_birth}</p>` : ""}
            ${data.student.parent_name ? `<p style="margin:2px 0;font-size:12px;"><strong>Parent:</strong> ${data.student.parent_name}</p>` : ""}
            ${data.student.parent_phone ? `<p style="margin:2px 0;font-size:12px;"><strong>Phone:</strong> ${data.student.parent_phone}</p>` : ""}
          </div>
        </div>

        <!-- Performance Key -->
        <div style="margin-bottom:16px;padding:8px 12px;background:#f9fafb;border-radius:6px;display:flex;gap:16px;justify-content:center;">
          <span style="font-size:11px;">${scoreDot(4)} Exceeding (EE)</span>
          <span style="font-size:11px;">${scoreDot(3)} Meeting (ME)</span>
          <span style="font-size:11px;">${scoreDot(2)} Approaching (AE)</span>
          <span style="font-size:11px;">${scoreDot(1)} Below (BE)</span>
        </div>

        <!-- Learning Areas -->
        ${learningAreasHtml}

        <!-- Summary Section -->
        <div style="display:flex;gap:16px;margin-top:20px;">
          <!-- Overall Performance -->
          <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
            <h3 style="margin:0 0 8px;font-size:14px;color:#1E3A8A;">Overall Performance</h3>
            <p style="margin:4px 0;font-size:12px;">Total Competencies: <strong>${overall_summary.total_competencies}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Exceeding: <strong style="color:#3B82F6;">${overall_summary.exceeding}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Meeting: <strong style="color:#10B981;">${overall_summary.meeting}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Approaching: <strong style="color:#F59E0B;">${overall_summary.approaching}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Below: <strong style="color:#EF4444;">${overall_summary.below}</strong></p>
            <div style="margin-top:8px;padding:8px;background:#f9fafb;border-radius:6px;text-align:center;">
              <strong>Overall: ${levelBadge(overall_summary.overall_level)}</strong>
            </div>
          </div>

          <!-- Attendance -->
          <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
            <h3 style="margin:0 0 8px;font-size:14px;color:#1E3A8A;">Attendance Summary</h3>
            <p style="margin:4px 0;font-size:12px;">School Days: <strong>${attendance_summary.total_days}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Present: <strong style="color:#10B981;">${attendance_summary.present}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Absent: <strong style="color:#EF4444;">${attendance_summary.absent}</strong></p>
            <p style="margin:4px 0;font-size:12px;">Late: <strong style="color:#F59E0B;">${attendance_summary.late}</strong></p>
            <div style="margin-top:8px;padding:8px;background:#f9fafb;border-radius:6px;text-align:center;">
              <strong>Rate: ${attendance_summary.attendance_rate}%</strong>
            </div>
          </div>
        </div>

        <!-- Remarks -->
        <div style="margin-top:20px;">
          ${
            data.class_teacher_remarks
              ? `
            <div style="margin-bottom:12px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
              <p style="margin:0;font-size:12px;"><strong>Class Teacher's Remarks:</strong></p>
              <p style="margin:4px 0 0;font-size:12px;color:#4b5563;">${data.class_teacher_remarks}</p>
            </div>
          `
              : `
            <div style="margin-bottom:12px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
              <p style="margin:0;font-size:12px;"><strong>Class Teacher's Remarks:</strong> ___________________________</p>
              <p style="margin:8px 0 0;font-size:12px;"><strong>Signature:</strong> _______________ <strong>Date:</strong> _______________</p>
            </div>
          `
          }
          ${
            data.principal_remarks
              ? `
            <div style="margin-bottom:12px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
              <p style="margin:0;font-size:12px;"><strong>Principal's Remarks:</strong></p>
              <p style="margin:4px 0 0;font-size:12px;color:#4b5563;">${data.principal_remarks}</p>
            </div>
          `
              : `
            <div style="margin-bottom:12px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
              <p style="margin:0;font-size:12px;"><strong>Principal's Remarks:</strong> ___________________________</p>
              <p style="margin:8px 0 0;font-size:12px;"><strong>Signature:</strong> _______________ <strong>Date:</strong> _______________</p>
            </div>
          `
          }
        </div>

        <!-- Footer -->
        <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;">
          ${data.closing_date ? `<span>Closing Date: ${data.closing_date}</span>` : "<span></span>"}
          ${data.next_term_opens ? `<span>Next Term Opens: ${data.next_term_opens}</span>` : "<span></span>"}
          <span>Generated: ${new Date().toLocaleDateString()}</span>
        </div>

        <!-- School stamp area -->
        <div style="margin-top:30px;text-align:center;">
          <div style="display:inline-block;width:120px;height:120px;border:2px dashed #d1d5db;border-radius:8px;line-height:120px;font-size:11px;color:#9ca3af;">School Stamp</div>
        </div>
      </body>
      </html>
    `;
  }

  // ── Generate class list HTML ──
  static generateClassListHtml(data: ClassListData): string {
    const rows = data.students
      .map(
        (s) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${s.no}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${s.admission_no}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:500;">${s.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${s.gender}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${s.date_of_birth}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${s.parent_name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${s.parent_phone}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><style>@page{size:A4 landscape;margin:15mm;}body{font-family:'Segoe UI',sans-serif;color:#1f2937;}</style></head>
      <body>
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="margin:0;font-size:18px;color:#1E3A8A;">${data.school.name}</h1>
          <h2 style="margin:4px 0;font-size:14px;">Class List - ${data.class_name}</h2>
          <p style="margin:2px 0;font-size:12px;color:#6b7280;">${data.term} ${data.academic_year} | Class Teacher: ${data.class_teacher}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#1E3A8A;color:white;">
              <th style="padding:8px;font-size:11px;">#</th>
              <th style="padding:8px;font-size:11px;text-align:left;">Adm No</th>
              <th style="padding:8px;font-size:11px;text-align:left;">Name</th>
              <th style="padding:8px;font-size:11px;">Gender</th>
              <th style="padding:8px;font-size:11px;text-align:left;">DOB</th>
              <th style="padding:8px;font-size:11px;text-align:left;">Parent</th>
              <th style="padding:8px;font-size:11px;text-align:left;">Phone</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:16px;display:flex;gap:24px;font-size:12px;">
          <span><strong>Total:</strong> ${data.total_students}</span>
          <span><strong>Boys:</strong> ${data.total_boys}</span>
          <span><strong>Girls:</strong> ${data.total_girls}</span>
        </div>
        <p style="font-size:10px;color:#9ca3af;margin-top:20px;text-align:right;">Generated: ${new Date().toLocaleDateString()}</p>
      </body>
      </html>
    `;
  }

  // ── Generate fee statement HTML ──
  static generateFeeStatementHtml(data: FeeStatementData): string {
    const feeRows = data.fees
      .map(
        (f) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${f.description}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;">KES ${f.amount_due.toLocaleString()}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;color:#10B981;">KES ${f.amount_paid.toLocaleString()}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;color:${f.balance > 0 ? "#EF4444" : "#10B981"};">KES ${f.balance.toLocaleString()}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${f.due_date}</td>
      </tr>
    `,
      )
      .join("");

    const paymentRows = data.payments
      .map(
        (p) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.date}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.receipt_no}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;">KES ${p.amount.toLocaleString()}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.method}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><style>@page{size:A4;margin:15mm;}body{font-family:'Segoe UI',sans-serif;color:#1f2937;}</style></head>
      <body>
        <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #1E3A8A;padding-bottom:12px;">
          <h1 style="margin:0;font-size:18px;color:#1E3A8A;">${data.school.name}</h1>
          <h2 style="margin:4px 0;font-size:14px;">Fee Statement - ${data.academic_year}</h2>
        </div>
        <div style="margin-bottom:16px;background:#f9fafb;padding:12px;border-radius:8px;">
          <p style="margin:2px 0;font-size:12px;"><strong>Student:</strong> ${data.student.name} | <strong>Adm No:</strong> ${data.student.admission_no} | <strong>Class:</strong> ${data.student.class_name}</p>
        </div>

        <h3 style="font-size:13px;color:#1E3A8A;margin:16px 0 8px;">Fee Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px;text-align:left;font-size:11px;">Description</th>
            <th style="padding:8px;text-align:right;font-size:11px;">Amount Due</th>
            <th style="padding:8px;text-align:right;font-size:11px;">Paid</th>
            <th style="padding:8px;text-align:right;font-size:11px;">Balance</th>
            <th style="padding:8px;text-align:left;font-size:11px;">Due Date</th>
          </tr></thead>
          <tbody>${feeRows}</tbody>
          <tfoot><tr style="background:#f9fafb;font-weight:bold;">
            <td style="padding:8px;font-size:12px;">Total</td>
            <td style="padding:8px;text-align:right;font-size:12px;">KES ${data.total_due.toLocaleString()}</td>
            <td style="padding:8px;text-align:right;font-size:12px;color:#10B981;">KES ${data.total_paid.toLocaleString()}</td>
            <td style="padding:8px;text-align:right;font-size:12px;color:${data.total_balance > 0 ? "#EF4444" : "#10B981"};">KES ${data.total_balance.toLocaleString()}</td>
            <td></td>
          </tr></tfoot>
        </table>

        ${
          data.payments.length > 0
            ? `
          <h3 style="font-size:13px;color:#1E3A8A;margin:20px 0 8px;">Payment History</h3>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
            <thead><tr style="background:#f9fafb;">
              <th style="padding:8px;text-align:left;font-size:11px;">Date</th>
              <th style="padding:8px;text-align:left;font-size:11px;">Receipt No</th>
              <th style="padding:8px;text-align:right;font-size:11px;">Amount</th>
              <th style="padding:8px;text-align:left;font-size:11px;">Method</th>
            </tr></thead>
            <tbody>${paymentRows}</tbody>
          </table>
        `
            : ""
        }

        <p style="font-size:10px;color:#9ca3af;margin-top:24px;text-align:right;">Generated: ${data.generated_date}</p>
      </body>
      </html>
    `;
  }

  // ── Generate attendance report HTML ──
  static generateAttendanceReportHtml(data: AttendanceReportData): string {
    const rows = data.students
      .map(
        (s) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${s.admission_no}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:500;">${s.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;color:#10B981;">${s.present}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;color:#EF4444;">${s.absent}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;color:#F59E0B;">${s.late}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${s.excused}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${s.total}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-weight:bold;color:${s.rate >= 80 ? "#10B981" : s.rate >= 60 ? "#F59E0B" : "#EF4444"};">${s.rate}%</td>
      </tr>
    `,
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><style>@page{size:A4;margin:15mm;}body{font-family:'Segoe UI',sans-serif;color:#1f2937;}</style></head>
      <body>
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="margin:0;font-size:18px;color:#1E3A8A;">${data.school.name}</h1>
          <h2 style="margin:4px 0;font-size:14px;">Attendance Report - ${data.class_name || "School-wide"}</h2>
          <p style="font-size:12px;color:#6b7280;">${data.term} ${data.academic_year} | ${data.period.from} to ${data.period.to}</p>
        </div>

        <div style="margin-bottom:16px;display:flex;gap:16px;">
          <div style="flex:1;background:#f9fafb;padding:10px;border-radius:6px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6b7280;">School Days</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#1E3A8A;">${data.total_school_days}</p>
          </div>
          <div style="flex:1;background:#ECFDF5;padding:10px;border-radius:6px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6b7280;">Average Rate</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#10B981;">${data.class_average_rate}%</p>
          </div>
          <div style="flex:1;background:#f9fafb;padding:10px;border-radius:6px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6b7280;">Students</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#1E3A8A;">${data.students.length}</p>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
          <thead><tr style="background:#1E3A8A;color:white;">
            <th style="padding:8px;font-size:11px;text-align:left;">Adm No</th>
            <th style="padding:8px;font-size:11px;text-align:left;">Name</th>
            <th style="padding:8px;font-size:11px;">Present</th>
            <th style="padding:8px;font-size:11px;">Absent</th>
            <th style="padding:8px;font-size:11px;">Late</th>
            <th style="padding:8px;font-size:11px;">Excused</th>
            <th style="padding:8px;font-size:11px;">Total</th>
            <th style="padding:8px;font-size:11px;">Rate</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="font-size:10px;color:#9ca3af;margin-top:24px;text-align:right;">Generated: ${new Date().toLocaleDateString()}</p>
      </body>
      </html>
    `;
  }
}
