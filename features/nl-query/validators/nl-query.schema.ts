import { z } from "zod";

export const nlQueryRequestSchema = z.object({
  query: z.string().min(3).max(500),
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  format: z.enum(["table", "chart", "text", "auto"]).default("auto"),
});

export type NLQueryInput = z.infer<typeof nlQueryRequestSchema>;
