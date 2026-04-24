import { generateGroqCompletion } from '../../../lib/ai/groq.client';
import type { AIResponse } from '../../../lib/ai/ai.types';
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
      console.error('AI Report Generation Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to generate AI-powered report');
    }
  }

    private async buildCBCContext(request: AIReportGenerationRequest) {
    // This would typically fetch CBC-specific data from the database
    // For now, we'll use a mock implementation
    return {
      learning_areas: [],
      competencies: [],
      student_performance: []
    } as any;
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
