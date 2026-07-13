export interface NLQueryRequest {
  query: string;
  classId?: string;
  termId?: string;
  academicYearId?: string;
  studentId?: string;
  format?: "table" | "chart" | "text" | "auto";
}

export interface NLQueryResult {
  originalQuery: string;
  interpretedIntent: string;
  queryType: "academic" | "attendance" | "discipline" | "finance" | "general";
  data: any;
  visualization: {
    type: "table" | "bar_chart" | "line_chart" | "pie_chart" | "stat_card" | "text" | "list";
    title: string;
    description: string;
  };
  queryPlanPreview: string;
  summary: string;
  confidence: number;
  warnings: string[];
}

export interface NLQueryHistoryEntry {
  id: string;
  query: string;
  result: NLQueryResult;
  createdAt: string;
  userId: string;
  schoolId: string;
}

export interface NLQueryResponse {
  success: boolean;
  data: NLQueryResult;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}
