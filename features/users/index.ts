// features/users/index.ts
// ============================================================
// Public API for Users feature module
// All external access goes through this barrel file
// ============================================================

// Types
export type {
  User,
  UserListItem,
  UserProfile,
  Role,
  Permission,
  AuditTrailEntry,
  CreateUserPayload,
  UpdateUserPayload,
  UpdateProfilePayload,
  UpdatePermissionPayload,
  UserListFilters,
  AuditTrailFilters,
  PaginatedResponse,
} from "./types";

// Validators
export {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  resetPasswordSchema,
  userListFiltersSchema,
  auditTrailFiltersSchema,
  updatePermissionSchema,
} from "./validators/user.schema";

// Services
export {
  listUsers,
  getUserById,
  getUserProfile,
  createUser,
  updateUser,
  updateUserProfile,
  deactivateUser,
} from "./services/users.service";

export {
  listRoles,
  getRoleById,
  getRoleByName,
  getUserCountByRole,
} from "./services/roles.service";

export {
  listAuditTrail,
  getAuditTrailForUser,
  getRecentAuditEntries,
} from "./services/audit.service";
