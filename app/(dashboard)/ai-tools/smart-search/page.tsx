'use client';

import React, { useState, useCallback } from 'react';
import { Search, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';

interface Column {
  key: string;
  label: string;
}

interface SearchResult {
  query: string;
  interpretation: string;
  summary: string;
  data: Record<string, unknown>[];
  columns: Column[];
  totalResults: number;
  generatedAt: string;
}

const suggestedQueries = [
  'Show me all Grade 4 students',
  'List students who scored below 40% in Mathematics',
  'Show attendance summary for this term',
  'Which learning areas have the most students below expectations?',
];

export default function SmartSearchPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const handleSearch = useCallback(async (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      error('Enter a search query (min 3 characters)');
      return;
    }
    setSearching(true);
    setResult(null);
    try {
      const res = await fetch('/api/smart-search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), scope }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Search failed');
      setResult(json.data);
      success('Search complete');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Search failed');
    } finally { setSearching(false); }
  }, [query, scope, success, error]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Search"
        description="Ask natural language questions about your school data"
        icon={<Search className="h-6 w-6" />}
      />

      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Ask anything about your school data..."
                rows={2}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-36">
                <option value="all">All data</option>
                <option value="students">Students</option>
                <option value="assessments">Assessments</option>
                <option value="attendance">Attendance</option>
                <option value="fees">Fees</option>
              </Select>
              <Button leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => handleSearch()} loading={searching}>
                Search
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 leading-7">Try:</span>
            {suggestedQueries.map((sq) => (
              <button
                key={sq}
                type="button"
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
                onClick={() => { setQuery(sq); handleSearch(sq); }}
              >
                {sq}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {searching && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-gray-500">Interpreting your query and searching...</span>
          </CardContent>
        </Card>
      )}

      {result && !searching && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Results
              <Badge variant="info" size="sm">{result.totalResults} found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700 mb-1">Interpretation</p>
              <p className="text-sm text-blue-800">{result.interpretation}</p>
            </div>
            <p className="text-sm text-gray-700">{result.summary}</p>

            {result.columns.length > 0 && result.data.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col.key} className="px-4 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.data.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {result.columns.map((col) => (
                          <td key={col.key} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                            {String(row[col.key] ?? row[col.label] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : result.totalResults > 0 ? (
              <p className="text-sm text-gray-500">Data available but no table columns mapped.</p>
            ) : (
              <Alert variant="info">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No results</AlertTitle>
                <AlertDescription>Try rephrasing your query or selecting a different scope.</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Generated: {new Date(result.generatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
