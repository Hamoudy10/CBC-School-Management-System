// app/(dashboard)/compliance/audit-logs/page.tsx
// ============================================================
// Audit Log Management Page
// ============================================================

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeletons";
import { FileDown, Search, Filter } from "lucide-react";

interface AuditLog {
  id: string;
  schoolId: string;
  tableName: string;
  recordId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  changesJson: Record<string, unknown> | null;
}

const ACTION_COLORS: Record<string, "default" | "success" | "warning" | "error"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "error",
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const pageSize = 20;

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) {return;}

      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });

        if (tableFilter) {params.set("tableName", tableFilter);}
        if (actionFilter) {params.set("action", actionFilter);}

        const res = await fetch(`/api/audit-logs?${params}`);
        const json = await res.json();

        if (json.success) {
          setLogs(json.data ?? []);
          setTotal(json.pagination?.total ?? 0);
        }
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, page, tableFilter, actionFilter]);

  const filteredLogs = search
    ? logs.filter(
        (log) =>
          log.tableName.toLowerCase().includes(search.toLowerCase()) ||
          log.action.toLowerCase().includes(search.toLowerCase()) ||
          log.performedByName.toLowerCase().includes(search.toLowerCase()) ||
          log.recordId.toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  const handleExport = async () => {
    try {
      const res = await fetch("/api/audit-logs/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export audit logs:", err);
    }
  };

  const uniqueTables = [...new Set(logs.map((l) => l.tableName))];
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log Management"
        description="Review system-wide audit trail for compliance and accountability."
      >
        <Button size="sm" leftIcon={<FileDown className="h-4 w-4" />} onClick={handleExport}>
          Export CSV
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4 text-gray-400" />}
              />
            </div>
            <Select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="w-[180px]"
            >
              <option value="">All Tables</option>
              {uniqueTables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-[150px]"
            >
              <option value="">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              title="No audit logs found"
              description="Audit logs will appear here when system actions are recorded."
              icon={<Filter className="h-12 w-12 text-gray-300" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Performed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(log.performedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[log.action] ?? "default"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.tableName}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {log.recordId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">{log.performedByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
