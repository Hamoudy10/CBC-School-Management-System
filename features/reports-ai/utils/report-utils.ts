import { ReportTranslatorService } from '../services/translator.service';

export class ReportUtils {
  private translator: ReportTranslatorService;

  constructor() {
    this.translator = new ReportTranslatorService();
  }

  async formatReportForParent(reportData: any): Promise<any> {
    // Translate all technical terms and levels to parent-friendly language
    const translatedReport = { ...reportData };

    // Translate learning areas
    for (const area of translatedReport.learning_areas) {
      area.level = await this.translator.translateLevelToDescription(area.level);
      
      // Translate competencies within each area
      for (const competency of area.competencies) {
        competency.level = await this.translator.translateLevelToDescription(competency.level);
        competency.parent_friendly_comment = await this.translator.translateReportComment(
          competency.comment,
          {
            competency_name: competency.name,
            score: competency.score,
            level: competency.level,
            subject: area.name
          }
        );
      }
    }

    // Translate summary
    translatedReport.summary.overall_level = await this.translator.translateLevelToDescription(
      translatedReport.summary.overall_level
    );

    return translatedReport;
  }

  generateReportPDF(reportData: any): string {
    // This would generate a PDF URL
    // For now, return a placeholder
    return `/api/reports-ai/pdf/${reportData.student_info.id}`;
  }

  validateReportData(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    
    // Check required fields
    const requiredFields = ['student_info', 'learning_areas', 'summary'];
    for (const field of requiredFields) {
      if (!data[field]) return false;
    }

    // Check student info
    const studentInfo = data.student_info;
    const requiredStudentFields = ['id', 'name', 'class', 'term', 'year'];
    for (const field of requiredStudentFields) {
      if (!studentInfo[field]) return false;
    }

    // Check learning areas
    if (!Array.isArray(data.learning_areas) || data.learning_areas.length === 0) {
      return false;
    }

    // Check summary
    const summary = data.summary;
    const requiredSummaryFields = ['total_subjects', 'average_score', 'overall_level'];
    for (const field of requiredSummaryFields) {
      if (summary[field] === undefined) return false;
    }

    return true;
  }

  calculatePerformanceMetrics(reportData: any): any {
    const metrics = {
      total_competencies: 0,
      excellent_competencies: 0,
      good_competencies: 0,
      needs_improvement_competencies: 0,
      average_score: 0,
      strengths: [],
      weaknesses: []
    };

    let totalScore = 0;
    let competencyCount = 0;

    for (const area of reportData.learning_areas) {
      for (const competency of area.competencies) {
        metrics.total_competencies++;
        totalScore += competency.score;
        competencyCount++;

        if (competency.score >= 80) {
          metrics.excellent_competencies++;
          metrics.strengths.push({
            competency: competency.name,
            score: competency.score,
            area: area.name
          });
        } else if (competency.score >= 60) {
          metrics.good_competencies++;
        } else {
          metrics.needs_improvement_competencies++;
          metrics.weaknesses.push({
            competency: competency.name,
            score: competency.score,
            area: area.name
          });
        }
      }
    }

    metrics.average_score = competencyCount > 0 ? totalScore / competencyCount : 0;

    return metrics;
  }

  generateReportSummary(reportData: any): string {
    const metrics = this.calculatePerformanceMetrics(reportData);
    const summary = [];

    summary.push(`Student Performance Summary:`);
    summary.push(`- Average Score: ${metrics.average_score.toFixed(1)}%`);
    summary.push(`- Excelling in: ${metrics.excellent_competencies} competencies`);
    summary.push(`- Good progress in: ${metrics.good_competencies} competencies`);
    summary.push(`- Needs improvement in: ${metrics.needs_improvement_competencies} competencies`);

    if (metrics.strengths.length > 0) {
      summary.push('\nStrengths:');
      metrics.strengths.forEach(strength => {
        summary.push(`- ${strength.competency} (${strength.score}%)`);
      });
    }

    if (metrics.weaknesses.length > 0) {
      summary.push('\nAreas for Improvement:');
      metrics.weaknesses.forEach(weakness => {
        summary.push(`- ${weakness.competency} (${weakness.score}%)`);
      });
    }

    return summary.join('\n');
  }

  formatTermData(termId: string): string {
    const termMap: Record<string, string> = {
      'TERM_1': 'First Term',
      'TERM_2': 'Second Term',
      'TERM_3': 'Third Term',
      'TERM_1_2026': 'First Term 2026',
      'TERM_2_2026': 'Second Term 2026',
      'TERM_3_2026': 'Third Term 2026'
    };

    return termMap[termId] || termId;
  }

  formatAcademicYear(year: string): string {
    const yearMap: Record<string, string> = {
      '2025': 'Academic Year 2025',
      '2026': 'Academic Year 2026',
      '2025_2026': 'Academic Year 2025-2026',
      '2026_2027': 'Academic Year 2026-2027'
    };

    return yearMap[year] || year;
  }
}