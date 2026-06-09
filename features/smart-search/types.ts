export interface SmartSearchColumn {
  key: string;
  label: string;
}

export interface SmartSearchResult {
  query: string;
  interpretation: string;
  summary: string;
  data: Record<string, unknown>[];
  columns: SmartSearchColumn[];
  totalResults: number;
  generatedAt: string;
}
