'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, CheckCircle, Clock, DollarSign, TrendingUp, TrendingDown, AlertCircle, GraduationCap, FileText, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

interface StudentPerformance {
  learningArea: string;
  averageScore: number;
  overallLevel: string;
  totalCompetencies: number;
}

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
}

interface PaymentRecord {
  amount: number;
  paidAt: string;
}

interface StudentData {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  status: string;
  className: string;
  gradeLevel: string;
  performance: StudentPerformance[];
  attendance: AttendanceSummary;
  recentPayments: PaymentRecord[];
}

interface DashboardData {
  students: StudentData[];
  message?: string;
}

const levelColors: Record<string, string> = {
  exceeding: 'bg-blue-100 text-blue-800 border-blue-300',
  meeting: 'bg-green-100 text-green-800 border-green-300',
  approaching: 'bg-amber-100 text-amber-800 border-amber-300',
  below_expectation: 'bg-red-100 text-red-800 border-red-300',
};

export default function ParentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'parent') { router.replace('/dashboard'); return; }

    async function fetchData() {
      try {
        const res = await fetch('/api/parent/dashboard', { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json.data) {
          setData({
            ...json.data,
            students: (json.data.students ?? []).map((s: any) => ({
              ...s,
              performance: s.performance ?? [],
              attendance: s.attendance ?? { totalDays: 0, presentDays: 0, absentDays: 0, attendanceRate: 0 },
              recentPayments: s.recentPayments ?? [],
            })),
          });
          if (json.data.students?.length > 0) {
            setSelectedStudent(json.data.students[0].studentId);
          }
        }
      } catch {} finally { setLoading(false); }
    }
    fetchData();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-500">Loading your dashboard...</span>
      </div>
    );
  }

  if (!data || data.students.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Users className="h-16 w-16 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-700">Welcome to Parent Portal</h2>
            <p className="text-sm text-gray-500 max-w-md text-center">
              {data?.message || 'No linked students found. Contact the school to link your account.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStudent = data.students.find((s) => s.studentId === selectedStudent) || data.students[0];
  const weakestArea = [...currentStudent.performance].sort((a, b) => a.averageScore - b.averageScore)[0];
  const strongestArea = [...currentStudent.performance].sort((a, b) => b.averageScore - a.averageScore)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Portal</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.firstName ?? 'Parent'}</p>
        </div>
      </div>

      {data.students.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {data.students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudent(s.studentId)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedStudent === s.studentId
                  ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <GraduationCap className="inline h-4 w-4 mr-1" />
              {s.firstName} {s.lastName} — {s.className}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Student</p>
              <p className="font-semibold text-gray-900">{currentStudent.firstName} {currentStudent.lastName}</p>
              <p className="text-xs text-gray-500">{currentStudent.className} ({currentStudent.gradeLevel})</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-xl p-2.5 ${currentStudent.attendance.attendanceRate >= 80 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Attendance</p>
              <p className="font-semibold text-gray-900">{currentStudent.attendance.attendanceRate}%</p>
              <p className="text-xs text-gray-500">{currentStudent.attendance.presentDays}/{currentStudent.attendance.totalDays} days</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-purple-100 p-2.5 text-purple-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Learning Areas</p>
              <p className="font-semibold text-gray-900">{currentStudent.performance.length}</p>
              <p className="text-xs text-gray-500">subjects assessed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Recent Payments</p>
              <p className="font-semibold text-gray-900">{currentStudent.recentPayments.length}</p>
              <p className="text-xs text-gray-500">this term</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance"><TrendingUp className="h-4 w-4 mr-1" /> Performance</TabsTrigger>
          <TabsTrigger value="attendance"><Clock className="h-4 w-4 mr-1" /> Attendance</TabsTrigger>
          <TabsTrigger value="fees"><DollarSign className="h-4 w-4 mr-1" /> Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {currentStudent.performance.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-gray-500">No assessment data available yet.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Performance Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {currentStudent.performance.map((p) => (
                    <div key={p.learningArea} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-900">{p.learningArea}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{p.averageScore.toFixed(1)}%</span>
                          <Badge variant={p.overallLevel as any} size="xs">{p.overallLevel.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${p.averageScore}%`,
                            backgroundColor: p.averageScore >= 80 ? '#22c55e' : p.averageScore >= 60 ? '#eab308' : p.averageScore >= 40 ? '#f97316' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                {strongestArea && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">Strongest Area</span>
                      </div>
                      <p className="font-semibold text-gray-900">{strongestArea.learningArea}</p>
                      <p className="text-sm text-gray-500">{strongestArea.averageScore.toFixed(1)}% — {strongestArea.overallLevel.replace('_', ' ')}</p>
                    </CardContent>
                  </Card>
                )}
                {weakestArea && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium">Needs Improvement</span>
                      </div>
                      <p className="font-semibold text-gray-900">{weakestArea.learningArea}</p>
                      <p className="text-sm text-gray-500">{weakestArea.averageScore.toFixed(1)}% — {weakestArea.overallLevel.replace('_', ' ')}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />} onClick={() => router.push(`/reports?studentId=${currentStudent.studentId}`)}>
                  View Report Cards
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Attendance</CardTitle></CardHeader>
            <CardContent>
              {currentStudent.attendance.totalDays === 0 ? (
                <p className="text-sm text-gray-500">No attendance records for this month.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Attendance Rate</span>
                        <span className={`text-sm font-bold ${currentStudent.attendance.attendanceRate >= 80 ? 'text-green-600' : currentStudent.attendance.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {currentStudent.attendance.attendanceRate}%
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${currentStudent.attendance.attendanceRate}%`,
                            backgroundColor: currentStudent.attendance.attendanceRate >= 80 ? '#22c55e' : currentStudent.attendance.attendanceRate >= 60 ? '#eab308' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-2xl font-bold text-green-600">{currentStudent.attendance.presentDays}</p>
                      <p className="text-xs text-green-700">Present</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-2xl font-bold text-red-600">{currentStudent.attendance.absentDays}</p>
                      <p className="text-xs text-red-700">Absent</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-2xl font-bold text-gray-600">{currentStudent.attendance.totalDays}</p>
                      <p className="text-xs text-gray-600">Total Days</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Fee Payments</CardTitle></CardHeader>
            <CardContent>
              {currentStudent.recentPayments.length === 0 ? (
                <p className="text-sm text-gray-500">No recent payments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {currentStudent.recentPayments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-900">
                          KES {p.amount.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="mt-3" leftIcon={<DollarSign className="h-4 w-4" />}>
                View Full Statement
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />} onClick={() => router.push(`/reports?studentId=${currentStudent.studentId}`)}>
            Report Cards
          </Button>
          <Button variant="outline" leftIcon={<CheckCircle className="h-4 w-4" />} onClick={() => router.push(`/attendance?studentId=${currentStudent.studentId}`)}>
            Attendance
          </Button>
          <Button variant="outline" leftIcon={<MessageSquare className="h-4 w-4" />} onClick={() => router.push('/communication/chatbot')}>
            Ask the Chatbot
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
