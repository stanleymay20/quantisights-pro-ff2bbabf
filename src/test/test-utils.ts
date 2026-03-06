import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Test utilities for common operations
 */

// Mock data generators
export const mockUser = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
};

export const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
};

export const mockDecision = {
  id: 'decision-123',
  organization_id: 'org-123',
  title: 'Test Decision',
  confidence: 75,
  expected_impact: 100,
  actual_outcome: 85,
  status: 'completed' as const,
};

// Async test helper
export const expectAsync = async (
  fn: () => Promise<void>,
  expectedError?: string
) => {
  try {
    await fn();
    if (expectedError) {
      throw new Error(`Expected error with "${expectedError}" but no error was thrown`);
    }
  } catch (error) {
    if (expectedError && !String(error).includes(expectedError)) {
      throw new Error(`Expected "${expectedError}" but got: ${error}`);
    }
  }
};

// Setup/teardown helpers
export const setupTestEnv = () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
  });
};

// API mock helper
export function mockAPIResponse<T>(data: T, delay = 0) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

// Error expectation helper
export const expectError = (fn: () => void, expectedMessage: string) => {
  expect(fn).toThrow(expectedMessage);
};
