import { describe, it, expect } from "@jest/globals";

describe("Class payload normalization", () => {
  it("maps snake_case API response to ClassOption", () => {
    const apiData = [
      { class_id: "uuid-1", name: "4A", grade_name: "Grade 4", grade_level: 4 },
    ];
    const mapped = apiData.map((c: any) => ({
      classId: c.classId ?? c.class_id ?? c.id,
      name: c.name,
      gradeName: c.gradeName ?? c.grade_name ?? "",
    })).filter((c) => c.classId);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].classId).toBe("uuid-1");
    expect(mapped[0].gradeName).toBe("Grade 4");
  });

  it("maps camelCase API response to ClassOption", () => {
    const apiData = [
      { classId: "uuid-2", name: "5B", gradeName: "Grade 5" },
    ];
    const mapped = apiData.map((c: any) => ({
      classId: c.classId ?? c.class_id ?? c.id,
      name: c.name,
      gradeName: c.gradeName ?? c.grade_name ?? "",
    })).filter((c) => c.classId);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].classId).toBe("uuid-2");
    expect(mapped[0].gradeName).toBe("Grade 5");
  });

  it("maps mixed fields, preferring camelCase", () => {
    const apiData = [
      { classId: "uuid-3", class_id: "uuid-old", name: "6C", gradeName: "Grade 6", grade_name: "Old Grade" },
    ];
    const mapped = apiData.map((c: any) => ({
      classId: c.classId ?? c.class_id ?? c.id,
      name: c.name,
      gradeName: c.gradeName ?? c.grade_name ?? "",
    })).filter((c) => c.classId);

    expect(mapped[0].classId).toBe("uuid-3");
    expect(mapped[0].gradeName).toBe("Grade 6");
  });

  it("filters out items without a classId", () => {
    const apiData = [
      { classId: "valid-1", name: "A" },
      { name: "no id" },
      { class_id: "valid-2", name: "B" },
    ];
    const mapped = apiData.map((c: any) => ({
      classId: c.classId ?? c.class_id ?? c.id,
      name: c.name,
      gradeName: c.gradeName ?? c.grade_name ?? "",
    })).filter((c) => c.classId);

    expect(mapped).toHaveLength(2);
    expect(mapped[0].classId).toBe("valid-1");
    expect(mapped[1].classId).toBe("valid-2");
  });

  it("handles empty API response", () => {
    const mapped = [].map((c: any) => ({
      classId: c.classId ?? c.class_id ?? c.id,
      name: c.name,
      gradeName: c.gradeName ?? c.grade_name ?? "",
    })).filter((c) => c.classId);

    expect(mapped).toHaveLength(0);
  });
});

describe("Student response mapping", () => {
  it("maps camelCase API response to snake_case expected by select", () => {
    const apiData = [
      { studentId: "s1", firstName: "John", lastName: "Doe" },
      { studentId: "s2", firstName: "Jane", lastName: "Smith" },
    ];
    const mapped = apiData.map((s: any) => ({
      student_id: s.studentId ?? s.student_id,
      first_name: s.firstName ?? s.first_name ?? "",
      last_name: s.lastName ?? s.last_name ?? "",
    })).filter((s: any) => s.student_id);

    expect(mapped).toHaveLength(2);
    expect(mapped[0].student_id).toBe("s1");
    expect(mapped[0].first_name).toBe("John");
    expect(mapped[0].last_name).toBe("Doe");
  });

  it("maps snake_case to itself", () => {
    const apiData = [
      { student_id: "s1", first_name: "John", last_name: "Doe" },
    ];
    const mapped = apiData.map((s: any) => ({
      student_id: s.studentId ?? s.student_id,
      first_name: s.firstName ?? s.first_name ?? "",
      last_name: s.lastName ?? s.last_name ?? "",
    })).filter((s: any) => s.student_id);

    expect(mapped[0].student_id).toBe("s1");
    expect(mapped[0].first_name).toBe("John");
  });

  it("filters out items without student_id", () => {
    const apiData = [
      { studentId: "s1", firstName: "A" },
      { name: "no id" },
    ];
    const mapped = apiData.map((s: any) => ({
      student_id: s.studentId ?? s.student_id,
      first_name: s.firstName ?? s.first_name ?? "",
      last_name: s.lastName ?? s.last_name ?? "",
    })).filter((s: any) => s.student_id);

    expect(mapped).toHaveLength(1);
  });
});

describe("UUID validation", () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("accepts valid UUID v4", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(UUID_RE.test("")).toBe(false);
  });

  it("rejects non-UUID string", () => {
    expect(UUID_RE.test("not-a-uuid")).toBe(false);
  });

  it("rejects partial UUID", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4")).toBe(false);
  });

  it("accepts uppercase UUID", () => {
    expect(UUID_RE.test("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });
});
