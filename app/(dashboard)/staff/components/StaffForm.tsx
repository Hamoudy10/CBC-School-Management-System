// app/(dashboard)/staff/components/StaffForm.tsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  User,
  Shield,
  Briefcase,
  Lock,
  Camera,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import {
  createStaffSchema,
  updateStaffSchema,
  STAFF_POSITION_LABELS,
  STAFF_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type StaffPosition,
  type StaffStatus,
  type ContractType,
} from '@/features/staff';
import { GENDER_OPTIONS } from '@/features/students';

// ============================================================
// Types
// ============================================================
interface RoleOption {
  role_id: string;
  name: string;
  description?: string | null;
}

interface StaffFormProps {
  mode: 'create' | 'edit';
  roles: RoleOption[];
  staffId?: string;
  defaultValues?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    phone?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    roleId?: string | null;
    tscNumber?: string | null;
    position?: StaffPosition | null;
    employmentDate?: string | null;
    contractType?: ContractType | null;
    qualification?: string | null;
    status?: StaffStatus | null;
    photoUrl?: string | null;
  };
}

type StaffFormValues = {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email?: string;
  phone?: string | null;
  gender?: 'male' | 'female' | 'other';
  roleId?: string;
  tscNumber?: string | null;
  position?: StaffPosition;
  employmentDate?: string | null;
  contractType?: ContractType | null;
  qualification?: string | null;
  status?: StaffStatus;
  photoUrl?: string | null;
  password?: string;
  confirmPassword?: string;
};

// ============================================================
// Schemas
// ============================================================
const createFormSchema = createStaffSchema
  .extend({
    confirmPassword: z.string().min(1, 'Please confirm the password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const updateFormSchema = updateStaffSchema;

// ============================================================
// Helpers
// ============================================================
function formatRoleName(name: string) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toNullIfEmpty(value: unknown) {
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  return value;
}

function toUndefinedIfEmpty(value: unknown) {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

function generatePassword(length = 12) {
  const charset =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => charset[value % charset.length]).join('');
}

// ============================================================
// Component
// ============================================================
export function StaffForm({
  mode,
  roles,
  staffId,
  defaultValues,
}: StaffFormProps) {
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { success, error } = useToast();
  const isCreate = mode === 'create';
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const staffEmail = defaultValues?.email || '';

  const canCreate = checkPermission('teachers', 'create');
  const canUpdate = checkPermission('teachers', 'update');
  const isAllowed = isCreate ? canCreate : canUpdate;

  useEffect(() => {
    if (!loading && user && !isAllowed) {
      error('Access Denied', 'You do not have permission to manage staff.');
      router.push('/staff');
    }
  }, [loading, user, isAllowed, error, router]);

  const schema = useMemo(() => {
    return isCreate ? createFormSchema : updateFormSchema;
  }, [isCreate]);

  const formDefaults: StaffFormValues = isCreate
    ? {
        firstName: '',
        lastName: '',
        middleName: '',
        email: '',
        phone: '',
        gender: undefined,
        roleId: '',
        tscNumber: '',
        position: undefined,
        employmentDate: '',
        contractType: undefined,
        qualification: '',
        photoUrl: '',
        password: '',
        confirmPassword: '',
      }
    : {
        firstName: defaultValues?.firstName || '',
        lastName: defaultValues?.lastName || '',
        middleName: defaultValues?.middleName || '',
        phone: defaultValues?.phone || '',
        gender: (defaultValues?.gender || undefined) as
          | 'male'
          | 'female'
          | 'other'
          | undefined,
        roleId: defaultValues?.roleId || '',
        tscNumber: defaultValues?.tscNumber || '',
        position: (defaultValues?.position || undefined) as
          | StaffPosition
          | undefined,
        employmentDate: defaultValues?.employmentDate || '',
        contractType: (defaultValues?.contractType || undefined) as
          | ContractType
          | undefined,
        qualification: defaultValues?.qualification || '',
        status: (defaultValues?.status || 'active') as StaffStatus,
        photoUrl: defaultValues?.photoUrl || '',
      };

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults,
    mode: 'onChange',
  });

  const selectedRoleId = watch('roleId');
  const photoUrl = watch('photoUrl') || '';
  const selectedRole = useMemo(
    () => roles.find((role) => role.role_id === selectedRoleId),
    [roles, selectedRoleId]
  );

  const handleGeneratePassword = () => {
    const nextPassword = generatePassword(12);
    setValue('password', nextPassword, { shouldDirty: true, shouldValidate: true });
    setValue('confirmPassword', nextPassword, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleCopyPassword = async () => {
    const current = watch('password');
    if (!current) {return;}
    try {
      await navigator.clipboard.writeText(current);
      success('Copied', 'Temporary password copied to clipboard.');
    } catch {
      error('Copy failed', 'Unable to copy password to clipboard.');
    }
  };

  const handleResetPassword = async () => {
    if (!staffId) {return;}
    setIsResetting(true);
    setResetPassword(null);
    try {
      const response = await fetch(`/api/staff/${staffId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Failed to reset password');
      }
      const tempPassword = result?.data?.password || result?.password;
      setResetPassword(tempPassword);
      success(
        'Password reset',
        'A new temporary password has been generated.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      error('Error', message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!staffId) {return;}
    setIsEmailSending(true);
    try {
      const response = await fetch(`/api/staff/${staffId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'email' }),
      });
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Failed to send reset email');
      }
      success(
        'Reset email sent',
        staffEmail ? `Email sent to ${staffEmail}.` : result?.data?.message,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email send failed';
      error('Error', message);
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleCopyResetPassword = async () => {
    if (!resetPassword) {return;}
    try {
      await navigator.clipboard.writeText(resetPassword);
      success('Copied', 'Reset password copied to clipboard.');
    } catch {
      error('Copy failed', 'Unable to copy password to clipboard.');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'staff');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result?.error || 'Upload failed');
    }

    const result = await response.json();
    setValue('photoUrl', result.data?.url || result.url, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const onSubmit = async (values: StaffFormValues) => {
    setSubmitError(null);

    const payload: Record<string, unknown> = { ...values };
    delete payload.confirmPassword;

    if (isCreate) {
      payload.middleName = toUndefinedIfEmpty(payload.middleName);
      payload.phone = toUndefinedIfEmpty(payload.phone);
      payload.gender = toUndefinedIfEmpty(payload.gender);
      payload.tscNumber = toUndefinedIfEmpty(payload.tscNumber);
      payload.employmentDate = toUndefinedIfEmpty(payload.employmentDate);
      payload.contractType = toUndefinedIfEmpty(payload.contractType);
      payload.qualification = toUndefinedIfEmpty(payload.qualification);
      payload.photoUrl = toUndefinedIfEmpty(payload.photoUrl);
    } else {
      payload.middleName = toNullIfEmpty(payload.middleName);
      payload.phone = toNullIfEmpty(payload.phone);
      payload.tscNumber = toNullIfEmpty(payload.tscNumber);
      payload.employmentDate = toNullIfEmpty(payload.employmentDate);
      payload.contractType = toNullIfEmpty(payload.contractType);
      payload.qualification = toNullIfEmpty(payload.qualification);
      payload.photoUrl = toNullIfEmpty(payload.photoUrl);
      payload.gender = toUndefinedIfEmpty(payload.gender);
      payload.roleId = toUndefinedIfEmpty(payload.roleId);
      payload.position = toUndefinedIfEmpty(payload.position);
      payload.status = toUndefinedIfEmpty(payload.status);
    }

    try {
      if (!isCreate && !staffId) {
        throw new Error('Missing staff identifier.');
      }

      const response = await fetch(
        isCreate ? '/api/staff' : `/api/staff/${staffId}`,
        {
          method: isCreate ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok || result?.success === false) {
        if (result?.details) {
          const currentValues = getValues();
          Object.entries(result.details).forEach(([field, messages]) => {
            if (field in currentValues) {
              setError(field as keyof StaffFormValues, {
                type: 'server',
                message: (messages as string[])[0] || 'Invalid value',
              });
            }
          });
        }

        throw new Error(result?.error || 'Failed to save staff member');
      }

      if (isCreate) {
        success(
          'Staff Member Created',
          `${values.firstName} ${values.lastName} has been added successfully.`
        );
      } else {
        success('Staff Updated', 'Staff details have been updated successfully.');
      }

      const targetId = isCreate ? result?.data?.staffId : staffId;
      if (targetId) {
        router.push(`/staff/${targetId}`);
      } else {
        router.push('/staff');
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setSubmitError(message);
      error('Error', message);
    }
  };

  if (!user || !isAllowed) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {submitError && (
        <Alert variant="warning" className="flex items-center gap-2">
          <span>{submitError}</span>
        </Alert>
      )}

      <FormSection
        title="Profile Photo"
        description="Upload a staff profile picture"
        icon={<Camera className="h-4 w-4" />}
      >
        <PhotoUpload
          value={photoUrl}
          onUpload={handlePhotoUpload}
          disabled={isSubmitting}
        />
        <input type="hidden" {...register('photoUrl')} />
      </FormSection>

      <FormSection
        title="Personal Information"
        description="Basic profile details for the staff member"
        icon={<User className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="First Name"
            required
            placeholder="Enter first name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Middle Name"
            placeholder="Enter middle name"
            error={errors.middleName?.message}
            {...register('middleName', {
              setValueAs: isCreate ? toUndefinedIfEmpty : toNullIfEmpty,
            })}
          />
          <Input
            label="Last Name"
            required
            placeholder="Enter last name"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone Number"
            placeholder="e.g., 0712345678"
            type="tel"
            error={errors.phone?.message}
            {...register('phone', {
              setValueAs: isCreate ? toUndefinedIfEmpty : toNullIfEmpty,
            })}
          />

          <Select
            label="Gender"
            value={watch('gender') || ''}
            error={errors.gender?.message}
            {...register('gender', {
              setValueAs: toUndefinedIfEmpty,
            })}
          >
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </FormSection>

      <FormSection
        title="Account Information"
        description="User account details and access role"
        icon={<Shield className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {isCreate ? (
            <Input
              label="Email Address"
              required
              type="email"
              placeholder="staff@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
          ) : (
            <Input
              label="Email Address"
              type="email"
              value={defaultValues?.email || ''}
              disabled
            />
          )}

          <Select
            label="System Role"
            required={isCreate}
            value={watch('roleId') || ''}
            error={errors.roleId?.message}
            helperText={selectedRole?.description || undefined}
            {...register('roleId', {
              setValueAs: toUndefinedIfEmpty,
            })}
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {formatRoleName(role.name)}
              </option>
            ))}
          </Select>
        </div>

        {isCreate && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Temporary Password"
                required
                type="password"
                helperText="Minimum 8 characters"
                error={errors.password?.message}
                {...register('password')}
              />
              <Input
                label="Confirm Password"
                required
                type="password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
                disabled={isSubmitting}
              >
                <RefreshCw className="h-4 w-4" />
                Generate Password
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyPassword}
                disabled={!watch('password')}
              >
                <Copy className="h-4 w-4" />
                Copy Password
              </Button>
            </div>
          </div>
        )}
      </FormSection>

      {!isCreate && (
        <FormSection
          title="Password Reset"
          description="Generate a new temporary password for this staff member"
          icon={<Lock className="h-4 w-4" />}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              loading={isResetting}
            >
              Generate New Password
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendResetEmail}
              loading={isEmailSending}
            >
              Send Reset Email
            </Button>
            {resetPassword && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyResetPassword}
              >
                <Copy className="h-4 w-4" />
                Copy Password
              </Button>
            )}
          </div>
          {resetPassword && (
            <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700">
              Temporary password:{" "}
              <span className="font-mono font-semibold">{resetPassword}</span>
            </div>
          )}
        </FormSection>
      )}

      <FormSection
        title="Employment Details"
        description="Position and contract information"
        icon={<Briefcase className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Position"
            required={isCreate}
            value={(watch('position') as string) || ''}
            error={errors.position?.message}
            {...register('position', {
              setValueAs: toUndefinedIfEmpty,
            })}
          >
            <option value="">Select position</option>
            {Object.entries(STAFF_POSITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Input
            label="TSC Number"
            placeholder="Optional"
            error={errors.tscNumber?.message}
            {...register('tscNumber', {
              setValueAs: isCreate ? toUndefinedIfEmpty : toNullIfEmpty,
            })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Contract Type"
            value={(watch('contractType') as string) || ''}
            error={errors.contractType?.message}
            {...register('contractType', {
              setValueAs: isCreate ? toUndefinedIfEmpty : toNullIfEmpty,
            })}
          >
            <option value="">Select contract type</option>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Input
            label="Employment Date"
            type="date"
            error={errors.employmentDate?.message}
            {...register('employmentDate', {
              setValueAs: isCreate ? toUndefinedIfEmpty : toNullIfEmpty,
            })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-secondary-700">
            Qualification
          </label>
          <textarea
            rows={4}
            placeholder="Enter qualifications, certifications, or relevant experience"
            className="w-full rounded-lg border border-secondary-300 bg-white px-3 py-2.5 text-sm text-secondary-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            {...register('qualification', {
              setValueAs: isCreate ? toUndefinedIfEmpty : toNullIfEmpty,
            })}
          />
          {errors.qualification?.message && (
            <p className="text-xs text-error-600">{errors.qualification?.message}</p>
          )}
        </div>
      </FormSection>

      {!isCreate && (
        <FormSection
          title="Status"
          description="Manage staff account status"
          icon={<Lock className="h-4 w-4" />}
        >
          <Select
            label="Staff Status"
            value={(watch('status') as string) || ''}
            error={errors.status?.message}
            {...register('status', {
              setValueAs: toUndefinedIfEmpty,
            })}
          >
            <option value="">Select status</option>
            {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormSection>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-secondary-100 pt-4">
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
          loading={isSubmitting}
          disabled={isSubmitting || !isDirty}
        >
          {isCreate ? 'Create Staff Member' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// Form Section Component
// ============================================================
interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function FormSection({ title, description, icon, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-secondary-200 pb-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-secondary-900">{title}</h3>
          {description && (
            <p className="text-sm text-secondary-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// Photo Upload Component
// ============================================================
interface PhotoUploadProps {
  value?: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

function PhotoUpload({ value, onUpload, disabled }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  useEffect(() => {
    setPreviewUrl(value || null);
  }, [value]);

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
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      console.error('Upload error:', err);
      setPreviewUrl(value || null);
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
      <div className="relative">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-secondary-300 bg-secondary-50">
          {previewUrl ? (
            <img src={previewUrl} alt="Staff photo" className="h-full w-full object-cover" />
          ) : (
            <User className="h-10 w-10 text-secondary-400" />
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white">
              <span className="text-xs">Uploading...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-secondary-700">
          Upload Photo
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isUploading}
            className="relative overflow-hidden"
          >
            Choose File
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={disabled || isUploading}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => setPreviewUrl(value || null)}
            >
              Reset
            </Button>
          )}
        </div>
        <p className="text-xs text-secondary-500">
          JPG/PNG up to 5MB. Recommended square image.
        </p>
      </div>
    </div>
  );
}

