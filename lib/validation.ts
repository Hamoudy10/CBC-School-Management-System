import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validates request data against a Zod schema or a simple type definition object
 * @param data - The data to validate
 * @param schemaOrDef - Either a ZodSchema or an object defining field names and expected types
 * @returns Object with validation result
 */
export function validateRequest<T>(data: unknown, schemaOrDef: ZodSchema<T> | Record<string, string | 'optional'>): { valid: true; data: T } | { valid: false; error: string } {
  let schema: ZodSchema<T>;
  
  // If schemaOrDef is a plain object (not a Zod schema), convert it to a schema
  if (schemaOrDef && typeof schemaOrDef === 'object' && !(schemaOrDef instanceof z.ZodType)) {
    schema = createValidationSchema(schemaOrDef) as ZodSchema<T>;
  } else {
    schema = schemaOrDef as ZodSchema<T>;
  }

  try {
    const parsed = schema.parse(data);
    return {
      valid: true,
      data: parsed
    };
  } catch (error) {
    if (error instanceof ZodError) {
      // Format Zod error messages
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return {
        valid: false,
        error: errorMessages || 'Validation failed'
      };
    }
    return {
      valid: false,
      error: 'Validation failed'
    };
  }
}

/**
 * Creates a Zod schema from a simple type definition object
 * @param schemaDef - Object defining field names and expected types
 * @returns Zod schema
 */
export function createValidationSchema<T extends Record<string, string | 'optional'>>(schemaDef: T) {
  const shape: Record<string, any> = {};
  
  for (const [key, type] of Object.entries(schemaDef)) {
    switch (type) {
      case 'string':
        shape[key] = z.string();
        break;
      case 'object':
        shape[key] = z.object({}).passthrough(); // Allow any object
        break;
      case 'number':
        shape[key] = z.number();
        break;
      case 'boolean':
        shape[key] = z.boolean();
        break;
      case 'array':
        shape[key] = z.array(z.any());
        break;
      case 'optional':
        // For optional fields, we make them optional in Zod
        shape[key] = z.union([z.string(), z.null(), z.undefined()]).optional();
        break;
      default:
        // Default to any for unknown types
        shape[key] = z.any();
    }
  }
  
  return z.object(shape) as unknown as ZodSchema<T>;
}

// Re-export zod for convenience
export * from 'zod';
