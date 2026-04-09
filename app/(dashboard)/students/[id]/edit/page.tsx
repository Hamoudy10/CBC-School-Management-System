'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Camera, Loader2, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useReferenceData } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

function PhotoUpload({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'students');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        onChange(data.url);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setPreviewUrl(value || null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className={cn(
            'flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-gray-300 bg-gray-50',
            !disabled && 'hover:border-blue-400 hover:bg-blue-50'
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Student photo" className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-gray-400" />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
        {!disabled && (
          <label
            className={cn(
              'absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700',
              isUploading && 'pointer-events-none opacity-50'
            )}
          >
            <Camera className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={disabled || isUploading}
              className="hidden"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">Click the camera icon to upload a photo</p>
    </div>
  );
}

type EditStudentForm = {
  firstName: string;
  lastName: string;
  middleName: string;
  admissionNumber: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  currentClassId: string;
  enrollmentDate: string;
  status: 'active' | 'transferred' | 'graduated' | 'withdrawn' | 'suspended';
  photoUrl: string;
  nemisNumber: string;
  birthCertificateNo: string;
  previousSchool: string;
  medicalInfo: string;
  specialNeedsDetails: string;
};

const emptyForm: EditStudentForm = {
  firstName: '',
  lastName: '',
  middleName: '',
  admissionNumber: '',
  dateOfBirth: '',
  gender: 'male',
  currentClassId: '',
  enrollmentDate: '',
  status: 'active',
  photoUrl: '',
  nemisNumber: '',
  birthCertificateNo: '',
  previousSchool: '',
  medicalInfo: '',
  specialNeedsDetails: '',
};

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();
  const studentId = params.id as string;

  const [form, setForm] = useState<EditStudentForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const canEdit = checkPermission('students', 'update');
  const { classes, isLoading: referenceLoading } = useReferenceData({
    enabled: Boolean(user && canEdit),
  });

  const classOptions = useMemo(
    () =>
      classes.map((item) => ({
        value: item.classId,
        label: item.gradeName ? `${item.name} (${item.gradeName})` : item.name,
      })),
    [classes],
  );

  useEffect(() => {
    if (!user || !canEdit) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadStudent = async () => {
      try {
        setIsLoading(true);
        setPageError(null);

        const response = await fetch(`/api/students/${studentId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load student');
        }

        const json = await response.json();
        const student = json.data?.student ?? json.data;

        if (!isMounted || !student) {
          return;
        }

        setForm({
          firstName: student.firstName ?? '',
          lastName: student.lastName ?? '',
          middleName: student.middleName ?? '',
          admissionNumber: student.admissionNumber ?? '',
          dateOfBirth: student.dateOfBirth ?? '',
          gender: student.gender ?? 'male',
          currentClassId: student.currentClassId ?? '',
          enrollmentDate: student.enrollmentDate ?? '',
          status: student.status ?? 'active',
          photoUrl: student.photoUrl ?? '',
          nemisNumber: student.nemisNumber ?? '',
          birthCertificateNo: student.birthCertificateNo ?? '',
          previousSchool: student.previousSchool ?? '',
          medicalInfo: student.medicalInfo ?? '',
          specialNeedsDetails: student.specialNeedsDetails ?? '',
        });
      } catch (err) {
        setPageError(err instanceof Error ? err.message : 'Failed to load student');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStudent();

    return () => {
      isMounted = false;
    };
  }, [user, canEdit, studentId]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      const payload = {
        ...form,
        photoUrl: form.photoUrl.trim() || undefined,
      };

      const response = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'Failed to update student');
      }

      success('Student Updated', 'Student record updated successfully.');
      router.push(`/students/${studentId}`);
    } catch (err) {
      toastError('Update Failed', err instanceof Error ? err.message : 'Failed to update student');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading || referenceLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading student editor...</p>
        </div>
      </div>
    );
  }

  if (!user || !canEdit) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Student" />
        <Alert variant="destructive">
          You do not have permission to edit student records.
        </Alert>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Student">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </PageHeader>
        <Alert variant="destructive">{pageError}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Student"
        description={`Update ${form.firstName} ${form.lastName}`.trim()}
      >
        <Button variant="secondary" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <Input
              label="First Name"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
            />
            <Input
              label="Last Name"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
            />
            <Input
              label="Middle Name"
              name="middleName"
              value={form.middleName}
              onChange={handleChange}
            />
            <Input
              label="Admission Number"
              name="admissionNumber"
              value={form.admissionNumber}
              onChange={handleChange}
              required
            />
            <Input
              label="Date of Birth"
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={handleChange}
              required
            />
            <Select
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Select
              label="Current Class"
              name="currentClassId"
              value={form.currentClassId}
              onChange={handleChange}
              placeholder="Select class"
              options={classOptions}
            />
            <Input
              label="Enrollment Date"
              name="enrollmentDate"
              type="date"
              value={form.enrollmentDate}
              onChange={handleChange}
            />
            <Select
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'transferred', label: 'Transferred' },
                { value: 'graduated', label: 'Graduated' },
                { value: 'withdrawn', label: 'Withdrawn' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
            <div className="flex justify-center">
              <PhotoUpload
                value={form.photoUrl || undefined}
                onChange={(url) => setForm((current) => ({ ...current, photoUrl: url }))}
                disabled={isSaving}
              />
            </div>
            <Input
              label="NEMIS Number"
              name="nemisNumber"
              value={form.nemisNumber}
              onChange={handleChange}
            />
            <Input
              label="Birth Certificate No."
              name="birthCertificateNo"
              value={form.birthCertificateNo}
              onChange={handleChange}
            />
            <Input
              label="Previous School"
              name="previousSchool"
              value={form.previousSchool}
              onChange={handleChange}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-secondary-700">Medical Info</label>
              <textarea
                name="medicalInfo"
                value={form.medicalInfo}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-secondary-300 bg-white px-3 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-secondary-700">Special Needs Details</label>
              <textarea
                name="specialNeedsDetails"
                value={form.specialNeedsDetails}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-secondary-300 bg-white px-3 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
