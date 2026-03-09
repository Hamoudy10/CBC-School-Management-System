// features/users/validators/user.schema.ts
// ============================================================
// Zod validation schemas for User Management
// All API inputs validated BEFORE database queries
// ============================================================

import { z } from "zod";

// ============================================================
// Shared field validators
// ============================================================
const emailField = z
  .string()
  .email("Invalid email address")
  .max(255, "Email must be under 255 characters")
  .transform((v) => v.toLowerCase().trim());

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be under 128 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/,
    "Password must include uppercase, lowercase, number, and special character",
  );

const nameField = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be under 100 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters")
  .transform((v) => v.trim());

const phoneField = z
  .string()
  .max(20, "Phone number must be under 20 characters")
  .regex(/^\+?[\d\s-]+$/, "Invalid phone number format")
  .optional()
  .or(z.literal(""));

const genderField = z.enum(["male", "female", "other"]).optional();

const uuidField = z.string().uuid("Invalid ID format");

const statusField = z.enum(["active", "inactive", "suspended", "archived"]);

// ============================================================
// Create User Schema
// ============================================================
export const createUserSchema = z.object({
  email: emailField,
  password: passwordField,
  firstName: nameField,
  lastName: nameField,
  middleName: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z\s'-]*$/, "Name contains invalid characters")
    .optional()
    .or(z.literal("")),
  phone: phoneField,
  gender: genderField,
  roleId: uuidField,
  schoolId: uuidField,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ============================================================
// Update User Schema
// ============================================================
export const updateUserSchema = z
  .object({
    firstName: nameField.optional(),
    lastName: nameField.optional(),
    middleName: z
      .string()
      .max(100)
      .regex(/^[a-zA-Z\s'-]*$/)
      .optional()
      .or(z.literal("")),
    phone: phoneField,
    gender: genderField,
    status: statusField.optional(),
    roleId: uuidField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ============================================================
// Update Profile Schema
// ============================================================
export const updateProfileSchema = z
  .object({
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .optional(),
    address: z
      .string()
      .max(500, "Address must be under 500 characters")
      .optional(),
    photoUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
    nationalId: z.string().max(20).optional(),
    emergencyContactName: z.string().max(200).optional(),
    emergencyContactPhone: phoneField,
    bloodGroup: z
      .string()
      .max(5)
      .regex(/^(A|B|AB|O)[+-]?$/, "Invalid blood group")
      .optional()
      .or(z.literal("")),
    medicalConditions: z.string().max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================
// Change Password Schema
// ============================================================
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================================
// Reset Password Request Schema
// ============================================================
export const resetPasswordSchema = z.object({
  email: emailField,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================================
// User List Filters Schema
// ============================================================
export const userListFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  role: z
    .enum([
      "super_admin",
      "school_admin",
      "principal",
      "deputy_principal",
      "teacher",
      "class_teacher",
      "subject_teacher",
      "finance_officer",
      "parent",
      "student",
      "bursar",
      "librarian",
      "ict_admin",
    ])
    .optional(),
  status: statusField.optional(),
  schoolId: uuidField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["first_name", "last_name", "email", "created_at", "last_login_at"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type UserListFiltersInput = z.infer<typeof userListFiltersSchema>;

// ============================================================
// Audit Trail Filters Schema
// ============================================================
export const auditTrailFiltersSchema = z.object({
  userId: uuidField.optional(),
  action: z.string().max(50).optional(),
  tableName: z.string().max(100).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AuditTrailFiltersInput = z.infer<typeof auditTrailFiltersSchema>;

// ============================================================
// Update Permission Schema
// ============================================================
export const updatePermissionSchema = z
  .object({
    canRead: z.boolean().optional(),
    canCreate: z.boolean().optional(),
    canUpdate: z.boolean().optional(),
    canDelete: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one permission field must be provided",
  });

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
