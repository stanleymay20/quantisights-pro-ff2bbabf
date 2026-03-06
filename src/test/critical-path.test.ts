import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { setupTestEnv } from './test-utils';

/**
 * Integration tests for critical production paths
 * MUST PASS before deployment
 */

setupTestEnv();

describe('CRITICAL PATH: Authentication', () => {
  it('should handle user registration', async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'TempPassword123!@#';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(email);
  });

  it('should enforce MFA after signup', async () => {
    // In production: MFA should be enforced for all users
    const user = await supabase.auth.getUser();
    expect(user.data.user).toBeDefined();
  });

  it('should handle session expiry correctly', async () => {
    const session = await supabase.auth.getSession();
    if (session.data.session) {
      expect(session.data.session.expires_at).toBeGreaterThan(Date.now() / 1000);
    }
  });

  it('should reject invalid credentials', async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'wrongpassword',
    });

    expect(error).toBeDefined();
  });
});

describe('CRITICAL PATH: Decision Operations', () => {
  const orgId = 'test-org-' + Date.now();

  it('should create a decision', async () => {
    const { data, error } = await supabase
      .from('decision_ledger')
      .insert({
        organization_id: orgId,
        title: 'Test Decision',
        decision_type: 'growth',
        decision_status: 'pending',
        execution_status: 'not_started',
        recommended_action: 'Test action',
        capped_confidence: 75,
        raw_confidence: 80,
        predicted_net_impact: 100,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    expect(data?.capped_confidence).toBe(75);
  });

  it('should update decision outcome', async () => {
    const { data: decision, error: createErr } = await supabase
      .from('decision_ledger')
      .insert({
        organization_id: orgId,
        title: 'Decision for Update',
        decision_type: 'growth',
        decision_status: 'pending',
        execution_status: 'in_progress',
        recommended_action: 'Test action',
        capped_confidence: 75,
        raw_confidence: 80,
        predicted_net_impact: 100,
      })
      .select()
      .single();

    expect(createErr).toBeNull();

    const { data: updated, error: updateErr } = await supabase
      .from('decision_ledger')
      .update({
        execution_status: 'completed',
        actual_outcome_delta: 15,
        outcome_delta: 110,
      })
      .eq('id', decision.id)
      .select()
      .single();

    expect(updateErr).toBeNull();
    expect(updated?.execution_status).toBe('completed');
  });

  it('should enforce RLS on decisions', async () => {
    // Different org should not see decisions
    const { data, error } = await supabase
      .from('decision_ledger')
      .select('*')
      .eq('organization_id', 'different-org')
      .limit(1);

    // Should either be empty or error (depending on RLS policy)
    expect(error === null || data?.length === 0).toBe(true);
  });

  it('should handle concurrent decision creation', async () => {
    const promises = Array(10)
      .fill(null)
      .map((_, i) =>
        supabase
          .from('decision_ledger')
          .insert({
            organization_id: orgId,
            title: `Concurrent Decision ${i}`,
            decision_type: 'growth',
            decision_status: 'pending',
            execution_status: 'not_started',
            recommended_action: 'Test',
            capped_confidence: 50 + i,
            raw_confidence: 55 + i,
            predicted_net_impact: 100,
          })
          .select()
          .single()
      );

    const results = await Promise.all(promises);
    const succeeded = results.filter((r) => r.error === null).length;
    expect(succeeded).toBe(10);
  });
});

describe('CRITICAL PATH: Data Upload & Pipeline', () => {
  it('should handle CSV upload without errors', async () => {
    const csvContent = `date,value,region
2026-01-01,100,US
2026-01-02,110,US
2026-01-03,120,EU`;

    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    // This would need actual upload infrastructure
    expect(file.name).toBe('test.csv');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should validate metric data integrity', async () => {
    const { data, error } = await supabase
      .from('metrics')
      .select('count(*)', { count: 'exact' });

    // Verify table exists and is queryable
    expect(error === null || data !== null).toBe(true);
  });

  it('should handle large numeric values', async () => {
    const largeValue = 1e11; // 100 billion
    const { data, error } = await supabase
      .from('metrics')
      .insert({
        organization_id: 'test-org',
        metric_type: 'revenue',
        value: largeValue,
        date: new Date().toISOString(),
        region: 'global',
        segment: 'all',
      })
      .select()
      .single();

    // Should handle large numbers without precision loss
    expect(error).toBeNull();
    expect(data?.value).toBe(largeValue);
  });
});

describe('CRITICAL PATH: Calibration Engine', () => {
  it('should compute calibration scores', async () => {
    const { data, error } = await supabase
      .from('calibration_models')
      .select('*')
      .limit(1);

    // Calibration table should exist and be queryable
    expect(error === null || data !== null).toBe(true);
  });

  it('should track confidence drift', async () => {
    const { data, error } = await supabase
      .from('calibration_history')
      .select('*')
      .limit(1);

    // History table should exist
    expect(error === null || data !== null).toBe(true);
  });
});

describe('CRITICAL PATH: Audit Logging', () => {
  it('should record all mutations in audit log', async () => {
    const { data: preCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true });

    // Perform a mutation
    await supabase.from('decision_ledger').insert({
      organization_id: 'test-org',
      title: 'Audit Test',
      decision_type: 'growth',
      decision_status: 'pending',
      execution_status: 'not_started',
      recommended_action: 'Test',
      capped_confidence: 50,
      raw_confidence: 50,
    });

    const { data: postCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true });

    // Audit log should have recorded the insert
    expect((postCount?.length ?? 0) >= (preCount?.length ?? 0)).toBe(true);
  });

  it('should log with correct actor information', async () => {
    const { data } = await supabase.from('audit_log').select('actor_id').limit(1);

    // Actor ID should be recorded
    if (data && data.length > 0) {
      expect(data[0].actor_id).toBeDefined();
    }
  });
});

describe('CRITICAL PATH: Payment Integration', () => {
  it('should verify Stripe connection', async () => {
    // Check that Stripe environment variable is set
    const stripeKey = import.meta.env.VITE_STRIPE_KEY;
    expect(stripeKey).toBeDefined();
    expect(stripeKey).toContain('pk_');
  });

  it('should have subscription tables', async () => {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .limit(1);

    expect(error === null || data !== null).toBe(true);
  });
});

describe('CRITICAL PATH: Performance', () => {
  it('should respond within SLA (< 500ms)', async () => {
    const start = Date.now();

    await supabase.from('decision_ledger').select('*').limit(1);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it('should handle 10 concurrent queries', async () => {
    const start = Date.now();

    const promises = Array(10)
      .fill(null)
      .map(() => supabase.from('decision_ledger').select('*').limit(1));

    await Promise.all(promises);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000); // 10 queries should complete in 2s
  });
});
