'use client';

import React, { useState } from 'react';
import { School, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Form 1', 'Form 2', 'Form 3', 'Form 4'];

export default function ApplyPage() {
  const { success, error } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState(''); const [gender, setGender] = useState('');
  const [grade, setGrade] = useState(''); const [prevSchool, setPrevSchool] = useState('');
  const [parentName, setParentName] = useState(''); const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState(''); const [parentId, setParentId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !dob || !gender || !grade || !parentName || !parentPhone) {
      error('Fill all required fields'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admissions/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, dateOfBirth: dob, gender, gradeApplyingFor: grade, previousSchool: prevSchool || undefined, parentName, parentPhone, parentEmail: parentEmail || undefined, parentIdNumber: parentId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      setDone(true);
      success('Application submitted');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-bold text-gray-900">Application Submitted!</h2>
            <p className="text-sm text-gray-500">We have received your application for {grade}. The school will contact {parentName} at {parentPhone} regarding the next steps.</p>
            <Button onClick={() => window.location.href = '/'}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <School className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Online Admission</h1>
            <p className="text-sm text-gray-500">Submit an application for the upcoming term</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Student Information</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth *</label><input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Gender *</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Applying For *</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="">Select grade</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Previous School</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="School name (optional)" value={prevSchool} onChange={(e) => setPrevSchool(e.target.value)} /></div>

              <hr className="my-4" />
              <h3 className="text-sm font-semibold text-gray-900">Parent / Guardian Information</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Parent/guardian name" value={parentName} onChange={(e) => setParentName(e.target.value)} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="07XX XXX XXX" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="email@example.com" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">ID Number</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="National ID (optional)" value={parentId} onChange={(e) => setParentId(e.target.value)} /></div>
              </div>

              <Button type="submit" className="w-full" leftIcon={<Send className="h-4 w-4" />} loading={submitting}>
                Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
