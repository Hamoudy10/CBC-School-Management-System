// lib/api/validation.ts
// ============================================================
// Request Validation Utilities
// Validates request body/params using Zod schemas
// ============================================================

import { NextRequest } from "next/server";
import { z, type ZodSchema, ZodError } from "zod";

// ============================================================
// Validation Result Type
// ============================================================
export interface ValidationResult<T = any> {
  success: boolean;
  data: any;
  errors?: Record<string, string[]>;
  error: string;
  [key: string]: any;
}

// ============================================================
// Validate Request Body
// ============================================================
function formatValidationErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }
  return errors;
}

function firstErrorMessage(errors: Record<string, string[]>): string {
  const first = Object.values(errors)[0]?.[0];
  return first ?? "Validation failed";
}

export function validateBody<T>(
  input: NextRequest,
  schema: ZodSchema<T> | any,
): Promise<ValidationResult<T>>;
export function validateBody<T>(
  input: unknown,
  schema: ZodSchema<T> | any,
): ValidationResult<T>;
export function validateBody<T>(
  input: NextRequest | unknown,
  schema: ZodSchema<T> | any,
): Promise<ValidationResult<T>> | ValidationResult<T> {
  if (input instanceof NextRequest) {
    return (async () => {
      try {
        const body = await input.json();
        const data = schema.parse(body);
        return { success: true, data, error: "" };
      } catch (error) {
        if (error instanceof ZodError) {
          const errors = formatValidationErrors(error);
          return {
            success: false,
            data: undefined as unknown as T,
            errors,
            error: firstErrorMessage(errors),
          };
        }
        if (error instanceof SyntaxError) {
          return {
            success: false,
            data: undefined as unknown as T,
            errors: { body: ["Invalid JSON"] },
            error: "Invalid JSON",
          };
        }
        return {
          success: false,
          data: undefined as unknown as T,
          errors: { body: ["Invalid request body"] },
          error: "Invalid request body",
        };
      }
    })();
  }

  try {
    const data = schema.parse(input);
    return { success: true, data, error: "" };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatValidationErrors(error);
      return {
        success: false,
        data: undefined as unknown as T,
        errors,
        error: firstErrorMessage(errors),
      };
    }
    return {
      success: false,
      data: undefined as unknown as T,
      errors: { body: ["Invalid request body"] },
      error: "Invalid request body",
    };
  }
}

// ============================================================
// Validate Query Parameters
// ============================================================
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T> | any,
): ValidationResult<T> {
  try {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const data = schema.parse(params);
    return { success: true, data, error: "" };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatValidationErrors(error);
      return {
        success: false,
        data: undefined as unknown as T,
        errors,
        error: firstErrorMessage(errors),
      };
    }
    return {
      success: false,
      data: undefined as unknown as T,
      errors: { query: ["Invalid query parameters"] },
      error: "Invalid query parameters",
    };
  }
}

// ============================================================
// Validate Path Parameter (UUID)
// ============================================================
const uuidSchema = z.string().uuid("Invalid ID format");

export function validateUuid(id: string): ValidationResult<string> {
  try {
    const data = uuidSchema.parse(id);
    return { success: true, data, error: "" };
  } catch {
    return {
      success: false,
      data: "",
      errors: { id: ["Invalid ID format"] },
      error: "Invalid ID format",
    };
  }
}

export function validateSearchParams<T>(
  input: NextRequest | URLSearchParams,
  schema: ZodSchema<T> | any,
): ValidationResult<T> {
  const searchParams =
    input instanceof NextRequest ? new URL(input.url).searchParams : input;
  const result = validateQuery(searchParams, schema) as ValidationResult<T>;

  if (result.success && result.data && typeof result.data === "object") {
    Object.assign(result, result.data);
    if ("pageSize" in result.data && !("page_size" in result)) {
      result.page_size = result.data.pageSize;
    }
  }

  return result;
}

// ============================================================
// Common Validation Schemas
// ============================================================
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
