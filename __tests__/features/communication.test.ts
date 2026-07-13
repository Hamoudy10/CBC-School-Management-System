import { describe, it, expect } from "@jest/globals";
import { sendMessageSchema, messageFilterSchema } from "@/features/communication";

const UUID = "00000000-0000-0000-0000-000000000001";

describe("sendMessageSchema", () => {
  it("accepts valid message with one user recipient", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "Hello",
      recipients: [{ recipient_id: UUID, recipient_type: "user" as const }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts message with role recipients", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Staff Meeting",
      body: "Tomorrow at 10am",
      recipients: [{ recipient_id: UUID, recipient_type: "role" as const }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts message with class recipients", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Field Trip",
      body: "Permission slip required",
      recipients: [{ recipient_id: UUID, recipient_type: "class" as const }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple recipients", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Announcement",
      body: "School closed",
      recipients: [
        { recipient_id: UUID, recipient_type: "user" as const },
        { recipient_id: "00000000-0000-0000-0000-000000000002", recipient_type: "user" as const },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects message with no recipients", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "Hello",
      recipients: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects message with empty subject", () => {
    const result = sendMessageSchema.safeParse({
      subject: "",
      body: "Hello",
      recipients: [{ recipient_id: UUID, recipient_type: "user" as const }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects message with empty body", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "",
      recipients: [{ recipient_id: UUID, recipient_type: "user" as const }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID recipient_id", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "Hello",
      recipients: [{ recipient_id: "not-a-uuid", recipient_type: "user" as const }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects over 100 recipients", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "Hello",
      recipients: Array.from({ length: 101 }, (_, i) => ({
        recipient_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        recipient_type: "user" as const,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("defaults priority to normal", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "Hello",
      recipients: [{ recipient_id: UUID, recipient_type: "user" as const }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("normal");
    }
  });

  it("defaults category to general", () => {
    const result = sendMessageSchema.safeParse({
      subject: "Test",
      body: "Hello",
      recipients: [{ recipient_id: UUID, recipient_type: "user" as const }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("general");
    }
  });
});

describe("messageFilterSchema", () => {
  it("accepts empty filters", () => {
    const result = messageFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts read_status as string", () => {
    const result = messageFilterSchema.safeParse({ read_status: "true" });
    expect(result.success).toBe(true);
  });

  it("transforms read_status to boolean", () => {
    const result = messageFilterSchema.safeParse({ read_status: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.read_status).toBe(true);
    }
  });

  it("accepts date range filters", () => {
    const result = messageFilterSchema.safeParse({
      date_from: "2026-01-01",
      date_to: "2026-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = messageFilterSchema.safeParse({ date_from: "01-01-2026" });
    expect(result.success).toBe(false);
  });

  it("accepts search filter", () => {
    const result = messageFilterSchema.safeParse({ search: "meeting" });
    expect(result.success).toBe(true);
  });

  it("defaults page to 1", () => {
    const result = messageFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });

  it("defaults pageSize to 20", () => {
    const result = messageFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string page to number", () => {
    const result = messageFilterSchema.safeParse({ page: "3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });
});
