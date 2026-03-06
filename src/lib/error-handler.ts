import { logger } from './logger';

/**
 * Type-safe API error handling
 */

export class APIError extends Error {
  constructor(
    public message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(
    public message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Safe async handler with type safety
 * Prevents unhandled promise rejections and provides consistent error handling
 */
export async function handleAsync<T>(
  promise: Promise<T>,
  context?: { operation: string; metadata?: Record<string, unknown> }
): Promise<[T | null, Error | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (context) {
      logger.error(`Operation failed: ${context.operation}`, err, context.metadata);
    }
    return [null, err];
  }
}

/**
 * Type guard for error responses
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Parse and log API errors safely
 */
export function parseAPIError(error: unknown): { message: string; statusCode?: number } {
  if (isAPIError(error)) {
    return {
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: 'An unknown error occurred' };
}

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new ValidationError(`Missing required field: ${String(field)}`, String(field), data[field]);
    }
  }
}

/**
 * Safe type assertion with validation
 */
export function assertType<T>(value: unknown, typeName: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(`Expected ${typeName}, got null or undefined`);
  }
}
