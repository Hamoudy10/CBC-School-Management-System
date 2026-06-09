'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Clock, Search, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';

interface Application {
  applicationId: string; firstName: string; lastName: string;
  dateOfBirth: string; gender: string; gradeApplyingFor: string;
  previousSchool: string | null; parentName: string; parentPhone: string;
  parentEmail: string | null; parentIdNumber: string | null;
  status: string; notes: string | null; submittedAt: string; reviewedAt: string | null;
}

interface Stats { total: number; pending: number; accepted: number; rejected: number; }

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  reviewed: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AdmissionsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = filter ? `?status=${filter}` : '';
      const res = await fetch(`/api/admissions/applications${params}`, { credentials: 'include' });
      if (res.ok) { const j = await res.json(); setApps(j.data?.applications ?? []); setStats(j.data?.stats ?? stats); }
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const review = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admissions/applications/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: reviewNotes || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setApps((prev) => prev.map((a) => a.applicationId === id ? json.data : a));
      setSelectedApp(null); setReviewNotes('');
      success(`Application ${status}`);
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [reviewNotes, success, error]);

  return (
    <div className="space-y-6">
      <PageHeader title="Admissions" description="Manage incoming student applications" icon={<Users className="h-6 w-6" />} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Pending</p><p className="text-2xl font-bold text-amber-600">{stats.pending}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Accepted</p><p className="text-2xl font-bold text-green-600">{stats.accepted}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Rejected</p><p className="text-2xl font-bold text-red-600">{stats.rejected}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="All statuses" className="w-44">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button variant="outline" leftIcon={<Search className="h-4 w-4" />} onClick={fetchData}>Refresh</Button>
        <a href="/apply" target="_blank" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Public form
        </a>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center"><Spinner size="lg" /></CardContent></Card>
      ) : apps.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-gray-500">No applications found.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Student</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Grade</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Parent</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Phone</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Submitted</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((app) => (
                <tr key={app.applicationId} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{app.firstName} {app.lastName}</td>
                  <td className="px-4 py-2.5">{app.gradeApplyingFor}</td>
                  <td className="px-4 py-2.5 text-gray-600">{app.parentName}</td>
                  <td className="px-4 py-2.5 text-gray-600">{app.parentPhone}</td>
                  <td className="px-4 py-2.5"><Badge variant={app.status as any} size="xs" className={statusColors[app.status]}>{app.status}</Badge></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(app.submittedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <Button variant="outline" size="sm" onClick={() => setSelectedApp(selectedApp?.applicationId === app.applicationId ? null : app)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedApp && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Review: {selectedApp.firstName} {selectedApp.lastName}
              <Badge variant={selectedApp.status as any} size="sm">{selectedApp.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><span className="font-medium text-gray-600">DOB:</span> {new Date(selectedApp.dateOfBirth).toLocaleDateString()}</div>
              <div><span className="font-medium text-gray-600">Gender:</span> {selectedApp.gender}</div>
              <div><span className="font-medium text-gray-600">Grade:</span> {selectedApp.gradeApplyingFor}</div>
              <div><span className="font-medium text-gray-600">Prev School:</span> {selectedApp.previousSchool || 'None'}</div>
              <div><span className="font-medium text-gray-600">Parent:</span> {selectedApp.parentName}</div>
              <div><span className="font-medium text-gray-600">Phone:</span> {selectedApp.parentPhone}</div>
              {selectedApp.parentEmail && <div><span className="font-medium text-gray-600">Email:</span> {selectedApp.parentEmail}</div>}
              {selectedApp.parentIdNumber && <div><span className="font-medium text-gray-600">ID:</span> {selectedApp.parentIdNumber}</div>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Review Notes</label>
              <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notes about this application..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" leftIcon={<Clock className="h-4 w-4" />} onClick={() => review(selectedApp.applicationId, 'reviewed')}>
                Mark Reviewed
              </Button>
              <Button leftIcon={<CheckCircle className="h-4 w-4" />} onClick={() => review(selectedApp.applicationId, 'accepted')} className="bg-green-600 hover:bg-green-700">
                Accept
              </Button>
              <Button leftIcon={<XCircle className="h-4 w-4" />} onClick={() => review(selectedApp.applicationId, 'rejected')} className="bg-red-600 hover:bg-red-700">
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
