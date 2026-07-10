import type { RoleName } from "@/types/roles";

export const SYSTEM_ADMINS: RoleName[] = ["super_admin", "school_admin"];

export const SCHOOL_LEADERS: RoleName[] = ["principal", "deputy_principal"];

export const TEACHING_ROLES: RoleName[] = [
  "teacher",
  "class_teacher",
  "subject_teacher",
];

export const FINANCE_ROLES: RoleName[] = ["finance_officer", "bursar"];

export const GUARDIAN_ROLES: RoleName[] = ["parent"];

export const LEARNER_ROLES: RoleName[] = ["student"];

export const SUPPORT_ROLES: RoleName[] = ["librarian", "ict_admin"];

export function isSystemAdmin(role: RoleName): boolean {
  return SYSTEM_ADMINS.includes(role);
}

export function isSchoolLeader(role: RoleName): boolean {
  return SCHOOL_LEADERS.includes(role);
}

export function isTeachingRole(role: RoleName): boolean {
  return TEACHING_ROLES.includes(role);
}

export function isFinanceRole(role: RoleName): boolean {
  return FINANCE_ROLES.includes(role);
}

export function isGuardian(role: RoleName): boolean {
  return GUARDIAN_ROLES.includes(role);
}

export function isLearner(role: RoleName): boolean {
  return LEARNER_ROLES.includes(role);
}

export function isSupportRole(role: RoleName): boolean {
  return SUPPORT_ROLES.includes(role);
}

export function getRoleGroup(role: RoleName): string {
  if (isSystemAdmin(role)) {return "system_admin";}
  if (isSchoolLeader(role)) {return "school_leader";}
  if (isTeachingRole(role)) {return "teaching";}
  if (isFinanceRole(role)) {return "finance";}
  if (isGuardian(role)) {return "guardian";}
  if (isLearner(role)) {return "learner";}
  if (isSupportRole(role)) {return "support";}
  return "other";
}

export function getRoleDisplayName(role: string): string {
  const map: Record<string, string> = {
    super_admin: "Super Administrator",
    school_admin: "School Administrator",
    principal: "Principal",
    deputy_principal: "Deputy Principal",
    teacher: "Teacher",
    class_teacher: "Class Teacher",
    subject_teacher: "Subject Teacher",
    finance_officer: "Finance Officer",
    bursar: "Bursar",
    parent: "Parent",
    student: "Student",
    librarian: "Librarian",
    ict_admin: "ICT Administrator",
  };
  return map[role] || "User";
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {return "Good morning";}
  if (hour < 17) {return "Good afternoon";}
  return "Good evening";
}
