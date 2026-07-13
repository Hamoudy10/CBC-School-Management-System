import { describe, it, expect } from "@jest/globals";
import { submitApplicationSchema } from "@/features/admissions";

describe("submitApplicationSchema", () => {
  const validBase = {
    firstName: "John",
    lastName: "Doe",
    dateOfBirth: "2015-06-15",
    gender: "male" as const,
    gradeApplyingFor: "Grade 5",
    parentName: "Jane Doe",
    parentPhone: "0712345678",
  };

  it("accepts valid application", () => {
    const result = submitApplicationSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = submitApplicationSchema.safeParse({ ...validBase, firstName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gender", () => {
    const result = submitApplicationSchema.safeParse({ ...validBase, gender: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects missing parentName", () => {
    const result = submitApplicationSchema.safeParse({ ...validBase, parentName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing parentPhone", () => {
    const result = submitApplicationSchema.safeParse({ ...validBase, parentPhone: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional parentEmail", () => {
    const result = submitApplicationSchema.safeParse({ ...validBase, parentEmail: "parent@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid parentEmail format", () => {
    const result = submitApplicationSchema.safeParse({ ...validBase, parentEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });
});
