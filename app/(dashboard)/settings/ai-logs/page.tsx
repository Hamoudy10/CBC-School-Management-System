// app/(dashboard)/settings/ai-logs/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Cpu,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Table, TableWrapper, TableHeader, TableBody, TableHead, TableRow, TableCell, TableEmpty, TableLoading } from '@/components/ui/Table';

interface AILogEntry {
  id: string;
  prompt: string;
  response: string;
  cost: number;
  school_id: string;
  model_used: string;
  tokens_used: number;
  request_label: string | null;
  error: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AILogsPage() {
  const { checkPermission } = useAuth();
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [labels, setLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '50');
      if (statusFilter) {params.set('status', statusFilter);}
      if (labelFilter) {params.set('label', labelFilter);}

      const res = await fetch(`/api/admin/ai-logs?${params}`);
      if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
      const data = await res.json();

      setLogs(data.data ?? []);
      setPagination(data.pagination);
      if (data.filters?.labels) {setLabels(data.filters.labels);}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, labelFilter]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const totalCost = logs.reduce((sum, log) => sum + (log.cost ?? 0), 0);
  const totalTokens = logs.reduce((sum, log) => sum + (log.tokens_used ?? 0), 0);
  const errorCount = logs.filter((l) => l.error).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Activity Logs"
        description="Monitor AI requests, costs, and errors across all features"
        icon={<Activity className="h-6 w-6" />}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">This Page</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{pagination.total}</p>
              </div>
              <Activity className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Est. Cost</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">${totalCost.toFixed(4)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-success-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Tokens Used</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalTokens.toLocaleString()}</p>
              </div>
              <Cpu className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Errors</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{errorCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-error-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-36"
          placeholder="All status"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </Select>

        <Select
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          className="w-64"
          placeholder="All features"
        >
          <option value="">All Features</option>
          {labels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </Select>

        <Input
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
          leftIcon={<Search className="h-4 w-4" />}
        />

        <Button
          variant="outline"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => fetchLogs(1)}
          loading={isLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableLoading colSpan={7} />}
                {!isLoading && logs.length === 0 && (
                  <TableEmpty colSpan={7} message="No AI activity logged yet" />
                )}
                {!isLoading && logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs rounded bg-gray-100 px-1.5 py-0.5">
                        {log.request_label ?? 'general'}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {log.model_used?.replace('llama-', 'L')?.replace('mixtral-', 'M') ?? 'groq'}
                    </TableCell>
                    <TableCell>
                      {log.error ? (
                        <Badge variant="error" size="xs">Error</Badge>
                      ) : (
                        <Badge variant="success" size="xs">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {log.tokens_used?.toLocaleString() ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-600">
                      ${(log.cost ?? 0).toFixed(6)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {/* duration not stored in ai_logs table directly */}
                      -
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      {/* Error detail for selected row */}
      {logs.filter((l) => l.error).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-error-600" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.filter((l) => l.error).slice(0, 5).map((log) => (
              <Alert key={log.id} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <div>
                  <p className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString()} — {log.request_label ?? 'general'}
                  </p>
                  <p className="text-sm font-medium">{log.error}</p>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchLogs(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchLogs(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
