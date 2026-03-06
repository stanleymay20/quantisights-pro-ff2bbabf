import { describe, it, expect, beforeEach } from 'vitest';
import {
  APIError,
  ValidationError,
  handleAsync,
  parseAPIError,
  validateRequired,
  assertType,
} from '@/lib/error-handler';
import { setupTestEnv } from './test-utils';

setupTestEnv();

describe('error-handler', () => {
  describe('APIError', () => {
    it('should create APIError with message and status', () => {
      const error = new APIError('Not Found', 404);
      expect(error.message).toBe('Not Found');
      expect(error.statusCode).toBe(404);
      expect(error instanceof Error).toBe(true);
    });

    it('should include details in APIError', () => {
      const details = { field: 'email' };
      const error = new APIError('Validation failed', 400, details);
      expect(error.details).toEqual(details);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with field information', () => {
      const error = new ValidationError('Invalid email', 'email', 'invalid@');
      expect(error.message).toBe('Invalid email');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid@');
    });
  });

  describe('handleAsync', () => {
    it('should resolve successful promise', async () => {
      const [data, error] = await handleAsync(Promise.resolve('success'));
      expect(data).toBe('success');
      expect(error).toBeNull();
    });

    it('should handle rejected promise', async () => {
      const testError = new Error('Test error');
      const [data, error] = await handleAsync(Promise.reject(testError));
      expect(data).toBeNull();
      expect(error).toBe(testError);
    });

    it('should include context in error logging', async () => {
      const testError = new Error('Test error');
      const [data, error] = await handleAsync(Promise.reject(testError), {
        operation: 'testOp',
        metadata: { userId: '123' },
      });
      expect(error).toBe(testError);
    });
  });

  describe('parseAPIError', () => {
    it('should parse APIError', () => {
      const error = new APIError('Not Found', 404);
      const parsed = parseAPIError(error);
      expect(parsed.message).toBe('Not Found');
      expect(parsed.statusCode).toBe(404);
    });

    it('should parse regular Error', () => {
      const error = new Error('Regular error');
      const parsed = parseAPIError(error);
      expect(parsed.message).toBe('Regular error');
    });

    it('should handle unknown error type', () => {
      const parsed = parseAPIError('unknown error');
      expect(parsed.message).toBe('An unknown error occurred');
    });
  });

  describe('validateRequired', () => {
    it('should pass validation with all required fields', () => {
      const data = { name: 'Test', email: 'test@example.com' };
      expect(() => {
        validateRequired(data, ['name', 'email']);
      }).not.toThrow();
    });

    it('should throw on missing required field', () => {
      const data = { name: 'Test' };
      expect(() => {
        validateRequired(data as any, ['name', 'email']);
      }).toThrow();
    });

    it('should throw on empty string field', () => {
      const data = { name: '', email: 'test@example.com' };
      expect(() => {
        validateRequired(data, ['name', 'email']);
      }).toThrow();
    });
  });

  describe('assertType', () => {
    it('should pass assertion for non-null values', () => {
      const value = 'test' as unknown;
      expect(() => {
        assertType<string>(value, 'string');
      }).not.toThrow();
    });

    it('should throw assertion for null values', () => {
      expect(() => {
        assertType(null as unknown, 'object');
      }).toThrow();
    });

    it('should throw assertion for undefined values', () => {
      expect(() => {
        assertType(undefined as unknown, 'string');
      }).toThrow();
    });
  });
});
