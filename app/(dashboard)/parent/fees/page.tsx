'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Download, Phone, CreditCard, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface StudentOption {
  studentId: string; firstName: string; lastName: string; className: string;
}

interface FeeItem {
  studentFeeId: string; invoiceNumber: string; feeName: string; amountDue: number; amountPaid: number; balance: number; dueDate: string; status: string;
}

export default function ParentFeesPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [paidFee, setPaidFee] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/parent/dashboard', { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json.data?.students) {
          setStudents(json.data.students.map((s: any) => ({ studentId: s.studentId, firstName: s.firstName, lastName: s.lastName, className: s.className })));
          if (json.data.students.length > 0) setSelectedStudent(json.data.students[0].studentId);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    async function loadFees() {
      try {
        const res = await fetch(`/api/student-fees?studentId=${selectedStudent}`, { credentials: 'include' });
        const json = await res.json();
        setFees(json.data ?? []);
      } catch {}
    }
    loadFees();
  }, [selectedStudent]);

  const handlePay = async (fee: FeeItem) => {
    if (!phone.trim()) { error('Enter your M-Pesa phone number'); return; }
    setPaying(fee.studentFeeId);
    try {
      const res = await fetch('/api/mpesa/stk-push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(), amount: fee.balance, studentFeeId: fee.studentFeeId,
          accountReference: fee.invoiceNumber, transactionDesc: `Fee payment: ${fee.feeName}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment failed');
      setPaidFee(fee.studentFeeId);
      success('STK Push sent! Check your phone to complete payment.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Payment failed');
    } finally { setPaying(null); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fee Payments</h1>
        <p className="text-sm text-gray-500">View fee statements and pay via M-Pesa</p>
      </div>

      {students.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => { setSelectedStudent(s.studentId); setPaidFee(null); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selectedStudent === s.studentId ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.firstName} {s.lastName} — {s.className}
            </button>
          ))}
        </div>
      )}

      {fees.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">No fee records found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {fees.map((fee) => (
            <Card key={fee.studentFeeId}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{fee.feeName}</span>
                      <Badge variant={fee.status as any} size="xs">{fee.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Invoice: {fee.invoiceNumber}</span>
                      <span>Due: {new Date(fee.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-xs text-gray-500">Amount Due</p><p className="font-semibold">KES {fee.amountDue.toLocaleString()}</p></div>
                      <div><p className="text-xs text-gray-500">Paid</p><p className="font-semibold text-green-600">KES {fee.amountPaid.toLocaleString()}</p></div>
                      <div><p className="text-xs text-gray-500">Balance</p><p className={`font-semibold ${fee.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>KES {fee.balance.toLocaleString()}</p></div>
                    </div>
                  </div>
                </div>

                {paidFee === fee.studentFeeId ? (
                  <div className="mt-3 rounded-lg bg-green-50 p-3 flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle className="h-4 w-4" /> Payment request sent. Complete on your phone.
                  </div>
                ) : fee.balance > 0 ? (
                  <div className="mt-3 flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">M-Pesa Phone Number</label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <input className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                    </div>
                    <Button onClick={() => handlePay(fee)} loading={paying === fee.studentFeeId} leftIcon={<CreditCard className="h-4 w-4" />}>
                      Pay KES {fee.balance.toLocaleString()}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
