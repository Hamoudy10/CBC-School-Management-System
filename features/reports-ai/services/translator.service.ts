import { AIReportService } from './ai-report.service';

export class ReportTranslatorService {
  private aiService: AIReportService;

  constructor() {
    this.aiService = AIReportService.getInstance();
  }

    async translateTechnicalTerm(technicalTerm: string, context: any): Promise<string> {
    const response = await this.aiService.translateToParentFriendly(technicalTerm, context);
    return response.success ? (response.data as string) || technicalTerm : technicalTerm;
  }

  async translateReportComment(
    comment: string,
    context: {
      competency_name: string;
      score: number;
      level: string;
      subject?: string;
      grade?: string;
    }
  ): Promise<string> {
    const prompt = `
Translate this teacher comment into parent-friendly language:

Original Comment: "${comment}"
Context: ${JSON.stringify(context, null, 2)}

Requirements:
1. Keep the meaning and intent
2. Use simple, accessible language
3. Be encouraging and constructive
4. Avoid educational jargon
5. Return only the translated comment
`;

    try {
      const response = await this.aiService.translateToParentFriendly(comment, context);
      return response.success ? response.data! : comment;
    } catch (error) {
      console.error('Translation failed:', error);
      return comment;
    }
  }

  async translateLevelToDescription(level: string): Promise<string> {
    const levelDescriptions: Record<string, string> = {
      'Exceeding Expectations': 'Excellent performance - working beyond grade level',
      'Meeting Expectations': 'Good performance - meeting grade level expectations',
      'Approaching Expectations': 'Developing - working towards grade level expectations',
      'Below Expectations': 'Needs support - requires additional help',
      'Not Yet': 'Beginning - just starting to develop skills'
    };

    return levelDescriptions[level] || level;
  }

  async translateScoreToParentFriendly(score: number, maxScore: number = 100): Promise<string> {
    const percentage = (score / maxScore) * 100;
    
    if (percentage >= 90) return 'Excellent - performing very well';
    if (percentage >= 75) return 'Good - meeting expectations';
    if (percentage >= 60) return 'Satisfactory - making good progress';
    if (percentage >= 40) return 'Developing - needs some support';
    return 'Needs support - requires additional help';
  }
}