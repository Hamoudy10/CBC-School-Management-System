// app/(dashboard)/students/new/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  Heart,
  Users,
  Plus,
  Trash2,
  Upload,
  Camera,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/auth/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import {
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  GenderType,
  GuardianRelationship,
} from '@/features/students';

// ─── Validation Schema ───────────────────────────────────────
const guardianSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
  relationship: z.enum(['father', 'mother', 'guardian', 'grandparent', 'uncle', 'aunt', 'sibling', 'other'] as const),
  isPrimaryContact: z.boolean().default(false),
  canPickup: z.boolean().default(true),
});

const studentSchema = z.object({
  // Basic Info
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  middleName: z.string().max(100).optional(),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other'] as const),
  
  // Enrollment Info
  admissionNumber: z.string().optional(),
  classId: z.string().min(1, 'Class is required'),
  enrollmentDate: z.string().optional(),
  
  // Documents
  birthCertificateNo: z.string().max(50).optional(),
  nemisNumber: z.string().max(50).optional(),
  
  // Medical & Special Needs
  hasSpecialNeeds: z.boolean().default(false),
  specialNeedsDetails: z.string().optional(),
  medicalInfo: z.string().optional(),
  
  // Previous School
  previousSchool: z.string().max(255).optional(),
  
  // Photo
  photoUrl: z.string().optional(),
  
  // Guardians
  guardians: z.array(guardianSchema).min(0),
});

type StudentFormData = z.infer<typeof studentSchema>;

// ─── Types ───────────────────────────────────────────────────
interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
  gradeId: string;
}

interface GradeOption {
  gradeId: string;
  name: string;
}

// ─── Photo Upload Component ──────────────────────────────────
interface PhotoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

function PhotoUpload({ value, onChange, disabled }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div
          className={cn(
            'flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-gray-300 bg-gray-50 transition-colors',
            !disabled && 'hover:border-blue-400 hover:bg-blue-50'
          )}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Student photo"
              className="h-full w-full object-cover"
            />
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
              'absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700',
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

      <p className="text-xs text-gray-500">
        Click the camera icon to upload a photo
      </p>
    </div>
  );
}

// ─── Form Section Component ──────────────────────────────────
interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function FormSection({ title, description, icon, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Guardian Card Component ─────────────────────────────────
interface GuardianCardProps {
  index: number;
  control: any;
  errors: any;
  onRemove: () => void;
  isPrimary: boolean;
  onSetPrimary: () => void;
}

function GuardianCard({
  index,
  control,
  errors,
  onRemove,
  isPrimary,
  onSetPrimary,
}: GuardianCardProps) {
  const guardianErrors = errors?.guardians?.[index];

  return (
    <Card className={cn(isPrimary && 'ring-2 ring-blue-500')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              Guardian {index + 1}
            </CardTitle>
            {isPrimary && (
              <Badge variant="primary" className="text-xs">
                Primary Contact
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPrimary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSetPrimary}
              >
                Set as Primary
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name={`guardians.${index}.firstName`}
            control={control}
            render={({ field }) => (
              <Input
                label="First Name *"
                placeholder="Enter first name"
                error={guardianErrors?.firstName?.message}
                {...field}
              />
            )}
          />

          <Controller
            name={`guardians.${index}.lastName`}
            control={control}
            render={({ field }) => (
              <Input
                label="Last Name *"
                placeholder="Enter last name"
                error={guardianErrors?.lastName?.message}
                {...field}
              />
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name={`guardians.${index}.phone`}
            control={control}
            render={({ field }) => (
              <Input
                label="Phone Number"
                placeholder="e.g., 0712345678"
                type="tel"
                error={guardianErrors?.phone?.message}
                {...field}
              />
            )}
          />

          <Controller
            name={`guardians.${index}.email`}
            control={control}
            render={({ field }) => (
              <Input
                label="Email Address"
                placeholder="guardian@example.com"
                type="email"
                error={guardianErrors?.email?.message}
                {...field}
              />
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name={`guardians.${index}.relationship`}
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Relationship *
                </label>
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  error={guardianErrors?.relationship?.message}
                >
                  <option value="">Select relationship</option>
                  {RELATIONSHIP_OPTIONS.map((rel: string) => (
                    <option key={rel} value={rel}>
                      {rel.charAt(0).toUpperCase() + rel.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          />

          <Controller
            name={`guardians.${index}.canPickup`}
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id={`guardian-${index}-pickup`}
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor={`guardian-${index}-pickup`}
                  className="text-sm text-gray-700"
                >
                  Authorized to pick up student
                </label>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function NewStudentPage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error, warning, info } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const {
    classes: referenceClasses,
    levels: referenceLevels,
    isLoading: isLoadingClasses,
  } = useReferenceData({ enabled: Boolean(user) });
  const classes = useMemo<ClassOption[]>(
    () =>
      referenceClasses.map((c) => ({
        classId: c.classId,
        name: c.name,
        gradeName: c.gradeName || '',
        gradeId: c.gradeId || '',
      })),
    [referenceClasses],
  );
  const grades = useMemo<GradeOption[]>(
    () =>
      referenceLevels.map((g) => ({
        gradeId: g.gradeId,
        name: g.name,
      })),
    [referenceLevels],
  );

  // ─── Form Setup ────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid, isDirty },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
      dateOfBirth: '',
      gender: 'male',
      admissionNumber: '',
      classId: '',
      enrollmentDate: new Date().toISOString().split('T')[0],
      birthCertificateNo: '',
      nemisNumber: '',
      hasSpecialNeeds: false,
      specialNeedsDetails: '',
      medicalInfo: '',
      previousSchool: '',
      photoUrl: '',
      guardians: [],
    },
    mode: 'onChange',
  });

  const { fields: guardianFields, append: appendGuardian, remove: removeGuardian } = useFieldArray({
    control,
    name: 'guardians',
  });

  const watchHasSpecialNeeds = watch('hasSpecialNeeds');
  const watchGuardians = watch('guardians');

  // ─── Permissions Check ─────────────────────────────────────
  const canCreate = checkPermission('students', 'create');

  useEffect(() => {
    if (user && !canCreate) {
      error('Access Denied', 'You do not have permission to create students.');
      router.push('/students');
    }
  }, [user, canCreate, router]);

  // ─── Fetch Classes & Grades ────────────────────────────────
  // Filter classes by selected grade
  const filteredClasses = selectedGradeId
    ? classes.filter((c) => c.gradeId === selectedGradeId)
    : classes;

  // ─── Handlers ──────────────────────────────────────────────
  const handleAddGuardian = () => {
    appendGuardian({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      relationship: 'guardian',
      isPrimaryContact: guardianFields.length === 0,
      canPickup: true,
    });
  };

  const handleSetPrimaryGuardian = (index: number) => {
    guardianFields.forEach((_, i) => {
      setValue(`guardians.${i}.isPrimaryContact`, i === index);
    });
  };

  const onSubmit = async (data: StudentFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create student');
      }

      const result = await response.json();

      success(
        'Student Created',
        `${data.firstName} ${data.lastName} has been enrolled successfully.`
      );

      router.push(`/students/${result.data.studentId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      error('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Calculate form completion ─────────────────────────────
  const getTabStatus = (tab: string): 'complete' | 'incomplete' | 'error' => {
    switch (tab) {
      case 'basic':
        if (errors.firstName || errors.lastName || errors.dateOfBirth || errors.gender) {
          return 'error';
        }
        const basicFields = watch(['firstName', 'lastName', 'dateOfBirth', 'gender']);
        return basicFields.every(Boolean) ? 'complete' : 'incomplete';
      
      case 'enrollment':
        if (errors.classId) {return 'error';}
        return watch('classId') ? 'complete' : 'incomplete';
      
      case 'guardians':
        if (errors.guardians) {return 'error';}
        return guardianFields.length > 0 ? 'complete' : 'incomplete';
      
      default:
        return 'incomplete';
    }
  };

  // ─── Render ────────────────────────────────────────────────
  if (!user || !canCreate) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Enroll New Student"
        description="Add a new student to the school system"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || !isDirty}
            loading={isSubmitting}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Student
          </Button>
        </div>
      </PageHeader>

      {/* ── Form ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabTrigger value="basic" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Basic Info
              {getTabStatus('basic') === 'complete' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {getTabStatus('basic') === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </TabTrigger>
            <TabTrigger value="enrollment" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Enrollment
              {getTabStatus('enrollment') === 'complete' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {getTabStatus('enrollment') === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </TabTrigger>
            <TabTrigger value="medical" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Medical & Needs
            </TabTrigger>
            <TabTrigger value="guardians" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Guardians
              {guardianFields.length > 0 && (
                <Badge variant="default" className="ml-1 text-xs">
                  {guardianFields.length}
                </Badge>
              )}
            </TabTrigger>
          </TabsList>

          {/* ── Basic Info Tab ──────────────────────────────── */}
          <TabContent value="basic" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
                  {/* Photo Upload */}
                  <div className="flex justify-center lg:justify-start">
                    <Controller
                      name="photoUrl"
                      control={control}
                      render={({ field }) => (
                        <PhotoUpload
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      )}
                    />
                  </div>

                  {/* Basic Fields */}
                  <div className="space-y-6">
                    <FormSection
                      title="Personal Information"
                      description="Enter the student's basic details"
                      icon={<User className="h-5 w-5" />}
                    >
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Controller
                          name="firstName"
                          control={control}
                          render={({ field }) => (
                            <Input
                              label="First Name *"
                              placeholder="Enter first name"
                              error={errors.firstName?.message}
                              {...field}
                            />
                          )}
                        />

                        <Controller
                          name="middleName"
                          control={control}
                          render={({ field }) => (
                            <Input
                              label="Middle Name"
                              placeholder="Enter middle name"
                              error={errors.middleName?.message}
                              {...field}
                            />
                          )}
                        />

                        <Controller
                          name="lastName"
                          control={control}
                          render={({ field }) => (
                            <Input
                              label="Last Name *"
                              placeholder="Enter last name"
                              error={errors.lastName?.message}
                              {...field}
                            />
                          )}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Controller
                          name="dateOfBirth"
                          control={control}
                          render={({ field }) => (
                            <Input
                              label="Date of Birth *"
                              type="date"
                              max={new Date().toISOString().split('T')[0]}
                              error={errors.dateOfBirth?.message}
                              {...field}
                            />
                          )}
                        />

                        <Controller
                          name="gender"
                          control={control}
                          render={({ field }) => (
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-gray-700">
                                Gender *
                              </label>
                              <Select
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.gender?.message}
                              >
                                {GENDER_OPTIONS.map((option: any) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                        />
                      </div>
                    </FormSection>

                    <FormSection
                      title="Documents"
                      description="Official document numbers (optional)"
                      icon={<MapPin className="h-5 w-5" />}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Controller
                          name="birthCertificateNo"
                          control={control}
                          render={({ field }) => (
                            <Input
                              label="Birth Certificate Number"
                              placeholder="Enter birth certificate number"
                              error={errors.birthCertificateNo?.message}
                              {...field}
                            />
                          )}
                        />

                        <Controller
                          name="nemisNumber"
                          control={control}
                          render={({ field }) => (
                            <Input
                              label="NEMIS Number"
                              placeholder="Enter NEMIS number"
                              helperText="National Education Management Information System"
                              error={errors.nemisNumber?.message}
                              {...field}
                            />
                          )}
                        />
                      </div>
                    </FormSection>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabContent>

          {/* ── Enrollment Tab ──────────────────────────────── */}
          <TabContent value="enrollment" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <FormSection
                  title="Enrollment Details"
                  description="Class assignment and enrollment information"
                  icon={<GraduationCap className="h-5 w-5" />}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Grade Level
                      </label>
                      <Select
                        value={selectedGradeId}
                        onChange={(e) => {
                          setSelectedGradeId(e.target.value);
                          setValue('classId', '');
                        }}
                        disabled={isLoadingClasses}
                      >
                        <option value="">Select grade first</option>
                        {grades.map((grade) => (
                          <option key={grade.gradeId} value={grade.gradeId}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-gray-500">
                        Select a grade to filter available classes
                      </p>
                    </div>

                    <Controller
                      name="classId"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            Class *
                          </label>
                          <Select
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.classId?.message}
                            disabled={isLoadingClasses || !selectedGradeId}
                          >
                            <option value="">
                              {selectedGradeId
                                ? 'Select class'
                                : 'Select grade first'}
                            </option>
                            {filteredClasses.map((cls) => (
                              <option key={cls.classId} value={cls.classId}>
                                {cls.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Controller
                      name="admissionNumber"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label="Admission Number"
                          placeholder="Auto-generated if left blank"
                          helperText="Leave blank to auto-generate"
                          error={errors.admissionNumber?.message}
                          {...field}
                        />
                      )}
                    />

                    <Controller
                      name="enrollmentDate"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label="Enrollment Date"
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          error={errors.enrollmentDate?.message}
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <Controller
                    name="previousSchool"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label="Previous School"
                        placeholder="Enter previous school name (if any)"
                        error={errors.previousSchool?.message}
                        {...field}
                      />
                    )}
                  />
                </FormSection>
              </CardContent>
            </Card>
          </TabContent>

          {/* ── Medical & Needs Tab ─────────────────────────── */}
          <TabContent value="medical" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <FormSection
                  title="Medical & Special Needs"
                  description="Health information and special requirements"
                  icon={<Heart className="h-5 w-5" />}
                >
                  <div className="space-y-4">
                    <Controller
                      name="hasSpecialNeeds"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
                          <input
                            type="checkbox"
                            id="hasSpecialNeeds"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <label
                              htmlFor="hasSpecialNeeds"
                              className="text-sm font-medium text-gray-900"
                            >
                              Student has special needs
                            </label>
                            <p className="text-xs text-gray-500">
                              Check this if the student requires additional
                              support or accommodations
                            </p>
                          </div>
                        </div>
                      )}
                    />

                    {watchHasSpecialNeeds && (
                      <Controller
                        name="specialNeedsDetails"
                        control={control}
                        render={({ field }) => (
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              Special Needs Details
                            </label>
                            <textarea
                              placeholder="Describe the student's special needs, required accommodations, or support..."
                              rows={4}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              {...field}
                            />
                          </div>
                        )}
                      />
                    )}

                    <Controller
                      name="medicalInfo"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            Medical Information
                          </label>
                          <textarea
                            placeholder="Any allergies, medical conditions, medications, or health notes..."
                            rows={4}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            {...field}
                          />
                          <p className="text-xs text-gray-500">
                            This information will be kept confidential and only
                            shared with authorized staff
                          </p>
                        </div>
                      )}
                    />
                  </div>
                </FormSection>
              </CardContent>
            </Card>
          </TabContent>

          {/* ── Guardians Tab ───────────────────────────────── */}
          <TabContent value="guardians" className="mt-6">
            <div className="space-y-4">
              {guardianFields.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-gray-100 p-4">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">
                      No Guardians Added
                    </h3>
                    <p className="mt-1 text-center text-sm text-gray-500">
                      Add at least one parent or guardian for this student.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      className="mt-4"
                      onClick={handleAddGuardian}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Guardian
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Guardians ({guardianFields.length})
                      </h3>
                      <p className="text-sm text-gray-500">
                        Parents or guardians responsible for this student
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddGuardian}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {guardianFields.map((field, index) => (
                      <GuardianCard
                        key={field.id}
                        index={index}
                        control={control}
                        errors={errors}
                        onRemove={() => removeGuardian(index)}
                        isPrimary={watchGuardians?.[index]?.isPrimaryContact ?? false}
                        onSetPrimary={() => handleSetPrimaryGuardian(index)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Tip Alert */}
              <Alert variant="info" title="Guardian Portal Access">
                Guardians with valid email addresses will receive an invitation
                to access the parent portal where they can view their
                child&apos;s progress, attendance, and fee statements.
              </Alert>
            </div>
          </TabContent>
        </Tabs>

        {/* ── Form Actions (Mobile) ─────────────────────────── */}
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 lg:hidden">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !isDirty}
            loading={isSubmitting}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Student
          </Button>
        </div>
      </form>
    </div>
  );
}
