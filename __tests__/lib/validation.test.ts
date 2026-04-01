// __tests__/lib/validation.test.ts
// ============================================================
// Unit tests for Validation utilities
// Tests UUID validation, query param parsing, body validation
// ============================================================

import { describe, it, expect } from "@jest/globals";
import { validateUuid } from "@/lib/api/validation";

describe("validateUuid", () => {
  it("accepts valid UUIDs", () => {
    expect(validateUuid("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(validateUuid("123e4567-e89b-12d3-a456-426614174000").success).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(validateUuid("not-a-uuid").success).toBe(false);
    expect(validateUuid("").success).toBe(false);
    expect(validateUuid("12345").success).toBe(false);
  });

  it("rejects UUIDs with wrong format", () => {
    expect(validateUuid("550e8400-e29b-41d4-a716").success).toBe(false);
    expect(validateUuid("550e8400e29b41d4a716446655440000").success).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(validateUuid(null as any).success).toBe(false);
    expect(validateUuid(undefined as any).success).toBe(false);
  });
});
