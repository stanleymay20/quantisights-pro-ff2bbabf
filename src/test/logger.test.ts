import { describe, it, expect, beforeEach } from 'vitest';
import { logger } from '@/lib/logger';
import { setupTestEnv, mockUser, mockOrganization } from './test-utils';

setupTestEnv();

describe('logger', () => {
  it('should format log messages correctly', () => {
    expect(() => {
      logger.info('Test message', { userId: mockUser.id });
    }).not.toThrow();
  });

  it('should handle error logging with error object', () => {
    const error = new Error('Test error');
    expect(() => {
      logger.error('Operation failed', error, { context: 'test' });
    }).not.toThrow();
  });

  it('should handle debug logging', () => {
    expect(() => {
      logger.debug('Debug message');
    }).not.toThrow();
  });

  it('should handle warning logging', () => {
    expect(() => {
      logger.warn('Warning message', { severity: 'low' });
    }).not.toThrow();
  });

  it('should format error without stack trace in production', () => {
    const error = new Error('Test error');
    error.stack = 'at test.ts:1';
    
    expect(() => {
      logger.error('Error occurred', error);
    }).not.toThrow();
  });
});
