import { generateGroqCompletion } from '../../../lib/ai/groq.client';
import type { AIResponse } from '../../../lib/ai/ai.types';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { logger } from '../../../lib/logger';
import type { 
  AIReportGenerationRequest, 
  CBCReportData,
  ReportInsights 
} from '../types/report-ai.types';

export class AIReportService {
  private static instance: AIReportService;

  static getInstance(): AIReportService {
    if (!AIReportService.instance) {
      AIReportService.instance = new AIReportService();
    }
    return AIReportService.instance;
  }

  async generateAIReport(request: AIReportGenerationRequest): Promise<AIResponse<CBCReportData>> {
    try {
      // Build CBC context
      const cbcContext = await this.buildCBCContext(request);
      
      // Generate AI-powered report
      const reportData = await this.generateStructuredReport(request, cbcContext);
      
      // Generate insights if requested
      let insights: ReportInsights | undefined;
      if (request.include_insights) {
        insights = await this.generateReportInsights(request, reportData);
      }

      // Generate parent summary if requested
      let parentSummary: string | undefined;
      if (request.include_parent_summary) {
        parentSummary = await this.generateParentSummary(request, reportData, insights);
      }

      // Enhance report with AI-generated content
      const enhancedReport = await this.enhanceReportWithAI(reportData, insights, parentSummary);

      return {
        success: true,
        data: enhancedReport,
        confidence: 0.92,
        reasoning: "AI-generated CBC report with structured insights and parent-friendly content",
        warnings: []
      };
    } catch (error) {
      logger.error('AI Report Generation Error', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error(error instanceof Error ? error.message : 'Failed to generate AI-powered report');
    }
  }

    private async buildCBCContext(request: AIReportGenerationRequest) {
    const supabase = await createSupabaseServerClient();
    const { student_id, term_id, academic_year, school_id } = request;

    // Resolve academic year (accept UUID or year label)
    let academicYearId = academic_year;
    const { data: ayByUuid } = await supabase
      .from('academic_years')
      .select('academic_year_id')
      .eq('academic_year_id', academic_year)
      .maybeSingle();
    if (!ayByUuid) {
      const { data: ayByYear } = await supabase
        .from('academic_years')
        .select('academic_year_id')
        .eq('year', parseInt(academic_year, 10))
        .eq('school_id', school_id)
        .maybeSingle();
      if (ayByYear) academicYearId = ayByYear.academic_year_id;
    }

    // Student info with class and school
    const { data: student } = await supabase
      .from('students')
      .select(`
        student_id, first_name, last_name, admission_number,
        class_id, classes!inner(name),
        schools!inner(name)
      `)
      .eq('student_id', student_id)
      .eq('school_id', school_id)
      .maybeSingle();

    // Class teacher from teacher_subjects for this class or staff assignment
    let classTeacherName = '';
    if (student?.class_id) {
      const { data: ct } = await supabase
        .from('teacher_subjects')
        .select('staff:staff(staff_id, user:users(first_name, last_name))')
        .eq('class_id', student.class_id)
        .eq('school_id', school_id)
        .limit(1)
        .maybeSingle();
      if (ct?.staff) {
        const s = ct.staff as any;
        classTeacherName = s.user ? `${(s.user as any).first_name} ${(s.user as any).last_name}` : '';
      }
    }

    // Learning areas
    const { data: learningAreas } = await supabase
      .from('learning_areas')
      .select('learning_area_id, name, code, description')
      .eq('school_id', school_id)
      .order('name' as any);

    // Competencies with sub-strand → strand → learning area chain
    const { data: competencies } = await supabase
      .from('competencies')
      .select(`
        competency_id, name, description, sort_order,
        sub_strand_id,
        sub_strands!inner(
          sub_strand_id, name,
          strand_id,
          strands!inner(
            strand_id, name,
            learning_area_id,
            learning_areas!inner(learning_area_id, name)
          )
        )
      `)
      .eq('school_id', school_id)
      .order('sort_order' as any);

    // Assessments for this student in this term/academic year
    const { data: assessments } = await supabase
      .from('assessments')
      .select(`
        assessment_id, score, remarks, assessment_date,
        competency_id,
        competencies!inner(competency_id, name),
        learning_area_id,
        learning_areas!inner(learning_area_id, name)
      `)
      .eq('student_id', student_id)
      .eq('term_id', term_id)
      .eq('academic_year_id', academicYearId);

    // Assessment aggregates per learning area (precomputed)
    const { data: aggregates } = await supabase
      .from('assessment_aggregates')
      .select('*')
      .eq('student_id', student_id)
      .eq('term_id', term_id)
      .eq('academic_year_id', academicYearId);

    // Attendance summary
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status, date')
      .eq('student_id', student_id)
      .eq('term_id', term_id)
      .eq('school_id', school_id);
    const totalDays = (attendance ?? []).length;
    const presentCount = (attendance ?? []).filter((a: any) => a.status === 'present').length;
    const absentCount = (attendance ?? []).filter((a: any) => a.status === 'absent').length;
    const lateCount = (attendance ?? []).filter((a: any) => a.status === 'late').length;
    const attendancePct = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

    // Teacher remarks from existing report card
    const { data: existingReport } = await supabase
      .from('report_cards')
      .select('class_teacher_remarks, principal_remarks')
      .eq('student_id', student_id)
      .eq('term_id', term_id)
      .eq('academic_year_id', academicYearId)
      .maybeSingle();

    // Term info
    const { data: term } = await supabase
      .from('terms')
      .select('name')
      .eq('term_id', term_id)
      .maybeSingle();

    return {
      student: student ? {
        id: (student as any).student_id,
        name: `${(student as any).first_name} ${(student as any).last_name}`,
        admission_number: (student as any).admission_number,
        class: (student as any).classes?.name ?? '',
        class_teacher: classTeacherName,
        school: (student as any).schools?.name ?? '',
      } : null,
      term: term?.name ?? '',
      learning_areas: (learningAreas ?? []).map((la: any) => ({
        id: la.learning_area_id,
        name: la.name,
        code: la.code ?? '',
        description: la.description ?? '',
        average_score: (aggregates ?? []).find((a: any) => a.learning_area_id === la.learning_area_id)?.average_score ?? null,
        overall_level: (aggregates ?? []).find((a: any) => a.learning_area_id === la.learning_area_id)?.overall_level ?? null,
      })),
      competencies: (competencies ?? []).map((c: any) => ({
        id: c.competency_id,
        name: c.name,
        description: c.description ?? '',
        learning_area: c.sub_strands?.strands?.learning_areas?.name ?? '',
        learning_area_id: c.sub_strands?.strands?.learning_area_id ?? '',
      })),
      assessments: (assessments ?? []).map((a: any) => ({
        id: a.assessment_id,
        score: a.score,
        remarks: a.remarks ?? '',
        date: a.assessment_date,
        competency: a.competencies?.name ?? '',
        competency_id: a.competency_id,
        learning_area: a.learning_areas?.name ?? '',
        learning_area_id: a.learning_area_id,
      })),
      attendance: {
        total_days: totalDays,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        percentage: attendancePct,
      },
      teacher_remarks: {
        class_teacher: (existingReport as any)?.class_teacher_remarks ?? '',
        principal: (existingReport as any)?.principal_remarks ?? '',
      },
    };
  }

    private async generateStructuredReport(
    request: AIReportGenerationRequest, 
    cbcContext: any
  ): Promise<CBCReportData> {
    const prompt = this.buildReportPrompt(request, cbcContext);
    
    const response = await generateGroqCompletion({
      prompt,
      system: "You are an expert CBC (Competency-Based Curriculum) report generator. Generate accurate, comprehensive, and educational reports based on student performance data.",
      temperature: 0.3,
      responseFormat: "json"
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate structured report');
    }

    // Cast to CBCReportData since we're trusting the AI to return the correct structure
    return response.data as CBCReportData;
  }

  private buildReportPrompt(request: AIReportGenerationRequest, cbcContext: any): string {
    return `
Generate a comprehensive CBC report for the following student:

Student ID: ${request.student_id}
Term: ${request.term_id}
Academic Year: ${request.academic_year}
School ID: ${request.school_id}

CBC Context:
${JSON.stringify(cbcContext, null, 2)}

Please return a JSON object with the following structure:
{
  "student_info": {
    "id": "string",
    "name": "string",
    "admission_number": "string",
    "class": "string",
    "class_teacher": "string",
    "term": "string",
    "year": "string",
    "school_name": "string"
  },
  "learning_areas": [
    {
      "code": "string",
      "name": "string",
      "score": number,
      "level": "string",
      "comment": "string",
      "competencies": [
        {
          "code": "string",
          "name": "string",
          "score": number,
          "level": "string",
          "comment": "string"
        }
      ]
    }
  ],
  "summary": {
    "total_subjects": number,
    "average_score": number,
    "overall_level": "string",
    "attendance_percentage": number,
    "total_days_present": number,
    "total_days_absent": number
  }
}

The report should:
1. Be accurate and comprehensive
2. Include specific competencies and their levels
3. Provide constructive comments for each learning area
4. Include attendance information
5. Follow CBC guidelines and standards
`;
  }

    private async generateReportInsights(
    request: AIReportGenerationRequest, 
    reportData: CBCReportData
  ): Promise<ReportInsights> {
    const prompt = this.buildInsightsPrompt(reportData);
    
    const response = await generateGroqCompletion({
      prompt,
      system: "You are an educational AI assistant specializing in student performance analysis. Generate insightful, constructive, and actionable insights for teachers and parents.",
      temperature: 0.4,
      responseFormat: "json"
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate report insights');
    }

    // Cast to ReportInsights since we're trusting the AI to return the correct structure
    return response.data as ReportInsights;
  }

  private buildInsightsPrompt(reportData: CBCReportData): string {
    return `
Analyze the following CBC report and generate insights:

${JSON.stringify(reportData, null, 2)}

Please return a JSON object with the following structure:
{
  "strengths": [
    {
      "competency": "string",
      "level": "string",
      "description": "string"
    }
  ],
  "weaknesses": [
    {
      "competency": "string",
      "level": "string",
      "description": "string",
      "improvement_actions": ["string"]
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "academic|social|behavioral|attendance",
      "action": "string",
      "timeline": "string",
      "responsible_party": "teacher|parent|both"
    }
  ],
  "overall_performance": "excellent|good|average|needs_improvement|concerning"
}

The insights should be:
1. Specific and actionable
2. Constructive and encouraging
3. Aligned with CBC learning outcomes
4. Include realistic improvement timelines
5. Clearly indicate responsibilities
`;
  }

    private async generateParentSummary(
    request: AIReportGenerationRequest,
    reportData: CBCReportData,
    insights?: ReportInsights
  ): Promise<string> {
    const prompt = this.buildParentSummaryPrompt(reportData, insights);
    
    const response = await generateGroqCompletion({
      prompt,
      system: "You are an expert educational communicator who translates technical CBC reports into parent-friendly language. Make complex educational concepts accessible and encouraging for parents.",
      temperature: 0.5,
      responseFormat: "json"
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate parent summary');
    }

    // Extract summary from the AI response - handle different possible structures
    const data = response.data as any;
    return data.summary || "Parent-friendly summary generated successfully.";
  }

  private buildParentSummaryPrompt(reportData: CBCReportData, insights?: ReportInsights): string {
    return `
Generate a parent-friendly summary of the following CBC report:

${JSON.stringify(reportData, null, 2)}

${insights ? `Insights: ${JSON.stringify(insights, null, 2)}` : ''}

Please return a JSON object with:
{
  "summary": "A warm, encouraging, and clear summary that parents can easily understand. Focus on achievements, areas for improvement, and next steps. Use simple language and avoid educational jargon."
}

The summary should:
1. Be written in warm, encouraging language
2. Highlight specific achievements
3. Address areas for improvement constructively
4. Provide clear next steps for parents
5. Be 150-300 words long
6. Use simple, accessible language
`;
  }

  private async enhanceReportWithAI(
    reportData: CBCReportData,
    insights?: ReportInsights,
    parentSummary?: string
  ): Promise<CBCReportData> {
    // Add insights to report if available
    if (insights) {
      reportData.insights = insights;
    }

    // Add parent summary if available
    if (parentSummary) {
      reportData.parent_summary = parentSummary;
    }

    // Generate AI comments for each competency if not already present
    for (const learningArea of reportData.learning_areas) {
      for (const competency of learningArea.competencies) {
        if (!competency.comment || competency.comment.trim() === '') {
          competency.comment = await this.generateAIComment(competency);
        }
      }
    }

    return reportData;
  }

  private async generateAIComment(competency: any): Promise<string> {
    const prompt = `
Generate a constructive, encouraging comment for a CBC competency:

Competency: ${competency.name}
Score: ${competency.score}
Level: ${competency.level}

Return only the comment text.
`;

    const response = await generateGroqCompletion({
      prompt,
      system: "You are an experienced teacher providing constructive feedback to students.",
      temperature: 0.6,
      responseFormat: "text"
    });

    return response.success ? response.data : "Comment will be provided by teacher.";
  }

  async translateToParentFriendly(
    technicalTerm: string,
    context: any
  ): Promise<AIResponse<string>> {
    try {
      const prompt = `
Translate this educational term into parent-friendly language:

Technical Term: "${technicalTerm}"
Context: ${JSON.stringify(context, null, 2)}

Provide a simple, clear explanation that parents can understand.
Return only the translated text.
`;

      const response = await generateGroqCompletion({
        prompt,
        system: "You translate educational jargon into simple, parent-friendly language.",
        temperature: 0.4,
        responseFormat: "text"
      });

      return {
        success: true,
        data: response.success ? response.data : "Unable to translate term",
        confidence: 0.9,
        reasoning: "Technical term translated to parent-friendly language",
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: technicalTerm,
        confidence: 0,
        reasoning: "Failed to translate term",
        warnings: [error instanceof Error ? error.message : "Unknown error"]
      };
    }
  }
}
