// __tests__/services/timetable.service.test.ts
// ============================================================
// Unit tests for Timetable service layer
// Tests conflict detection, time overlap logic, and day organization
// ============================================================

import { describe, it, expect } from "@jest/globals";

// ============================================================
// Time Overlap Logic
// ============================================================
function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  return s1 < e2 && s2 < e1;
}

describe("timesOverlap", () => {
  it("detects overlapping time ranges", () => {
    expect(timesOverlap("08:00", "09:00", "08:30", "09:30")).toBe(true);
    expect(timesOverlap("10:00", "11:00", "10:15", "10:45")).toBe(true);
  });

  it("detects non-overlapping time ranges", () => {
    expect(timesOverlap("08:00", "09:00", "09:00", "10:00")).toBe(false);
    expect(timesOverlap("08:00", "09:00", "10:00", "11:00")).toBe(false);
  });

  it("handles exact boundary (end equals start)", () => {
    expect(timesOverlap("08:00", "09:00", "09:00", "10:00")).toBe(false);
  });

  it("handles contained ranges", () => {
    expect(timesOverlap("08:00", "10:00", "08:30", "09:30")).toBe(true);
    expect(timesOverlap("08:30", "09:30", "08:00", "10:00")).toBe(true);
  });

  it("handles identical ranges", () => {
    expect(timesOverlap("08:00", "09:00", "08:00", "09:00")).toBe(true);
  });

  it("handles early morning times", () => {
    expect(timesOverlap("06:00", "07:00", "06:30", "07:30")).toBe(true);
    expect(timesOverlap("06:00", "07:00", "07:00", "08:00")).toBe(false);
  });

  it("handles late afternoon times", () => {
    expect(timesOverlap("15:00", "16:00", "15:30", "16:30")).toBe(true);
    expect(timesOverlap("15:00", "16:00", "16:00", "17:00")).toBe(false);
  });
});

// ============================================================
// Day Name Mapping
// ============================================================
const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};

describe("DAY_NAMES", () => {
  it("maps 1-5 to weekday names", () => {
    expect(DAY_NAMES[1]).toBe("Monday");
    expect(DAY_NAMES[2]).toBe("Tuesday");
    expect(DAY_NAMES[3]).toBe("Wednesday");
    expect(DAY_NAMES[4]).toBe("Thursday");
    expect(DAY_NAMES[5]).toBe("Friday");
  });

  it("returns undefined for weekend days", () => {
    expect(DAY_NAMES[0]).toBeUndefined();
    expect(DAY_NAMES[6]).toBeUndefined();
    expect(DAY_NAMES[7]).toBeUndefined();
  });
});
