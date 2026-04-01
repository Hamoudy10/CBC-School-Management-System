// __tests__/services/staff.service.test.ts
// ============================================================
// Unit tests for Staff service layer
// Tests validation logic, role hierarchy, and status transitions
// ============================================================

import { describe, it, expect } from "@jest/globals";
import { canManageRole } from "@/lib/auth/permissions";
import { ROLE_HIERARCHY } from "@/types/roles";

// ============================================================
// Role Hierarchy
// ============================================================
describe("ROLE_HIERARCHY", () => {
  it("ranks super_admin highest", () => {
    expect(ROLE_HIERARCHY.super_admin).toBe(100);
  });

  it("ranks student lowest", () => {
    expect(ROLE_HIERARCHY.student).toBe(10);
  });

  it("ranks principal above deputy_principal", () => {
    expect(ROLE_HIERARCHY.principal).toBeGreaterThan(ROLE_HIERARCHY.deputy_principal);
  });

  it("ranks class_teacher above teacher", () => {
    expect(ROLE_HIERARCHY.class_teacher).toBeGreaterThan(ROLE_HIERARCHY.teacher);
  });

  it("ranks finance_officer above bursar", () => {
    expect(ROLE_HIERARCHY.finance_officer).toBeGreaterThan(ROLE_HIERARCHY.bursar);
  });
});

// ============================================================
// Permission: canManageRole
// ============================================================
describe("canManageRole", () => {
  it("allows super_admin to manage any role", () => {
    expect(canManageRole("super_admin", "school_admin")).toBe(true);
    expect(canManageRole("super_admin", "principal")).toBe(true);
    expect(canManageRole("super_admin", "teacher")).toBe(true);
  });

  it("prevents teacher from managing other teachers", () => {
    expect(canManageRole("teacher", "teacher")).toBe(false);
    expect(canManageRole("teacher", "class_teacher")).toBe(false);
  });

  it("allows principal to manage teachers", () => {
    expect(canManageRole("principal", "teacher")).toBe(true);
    expect(canManageRole("principal", "class_teacher")).toBe(true);
  });

  it("prevents lower role from managing higher role", () => {
    expect(canManageRole("teacher", "principal")).toBe(false);
    expect(canManageRole("class_teacher", "deputy_principal")).toBe(false);
  });

  it("allows school_admin to manage teachers", () => {
    expect(canManageRole("school_admin", "teacher")).toBe(true);
    expect(canManageRole("school_admin", "class_teacher")).toBe(true);
  });
});
