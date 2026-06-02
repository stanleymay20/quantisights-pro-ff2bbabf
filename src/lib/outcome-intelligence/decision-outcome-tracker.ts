import { supabase } from '@/integrations/supabase/client'
import { eventBus } from '@/lib/realtime/event-bus'
import type { OutcomeRecord } from './types'

function mapRowToOutcome(row: Record<string, unknown>): OutcomeRecord {
  const predicted = (row.expected_change as number) ?? 0
  const actual = row.observed_value_after as number | undefined
  let deviationPercent: number | undefined
  let outcome: OutcomeRecord['outcome'] = 'not_measured'
  if (actual !== undefined && predicted !== 0) {
    deviationPercent = ((actual - predicted) / Math.abs(predicted)) * 100
    if (Math.abs(deviationPercent) < 10) outcome = 'as_expected'
    else if (actual > predicted) outcome = 'better_than_expected'
    else outcome = 'worse_than_expected'
  } else if (actual !== undefined && predicted === 0) {
    outcome = 'as_expected'
  }

  return {
    id: row.id as string,
    decisionId: row.decision_id as string,
    recommendationId: (row.dataset_id as string) ?? '',
    organizationId: row.organization_id as string,
    predictedImpact: row.expected_direction as string,
    actualImpact: row.observed_metric as string | undefined,
    predictedMetric: row.expected_metric as string,
    predictedValue: predicted,
    actualValue: actual,
    deviationPercent,
    outcome,
    measurementWindowDays: (row.evaluation_window_days as number) ?? 30,
    measuredAt: row.evaluation_date as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
  }
}

export async function recordOutcome(params: {
  decisionId: string
  recommendationId: string
  organizationId: string
  predictedImpact: string
  predictedMetric: string
  predictedValue: number
  measurementWindowDays: number
}): Promise<OutcomeRecord> {
  const { data, error } = await supabase
    .from('decision_outcomes')
    .insert({
      decision_id: params.decisionId,
      organization_id: params.organizationId,
      expected_direction: params.predictedImpact,
      expected_metric: params.predictedMetric,
      expected_change: params.predictedValue,
      evaluation_window_days: params.measurementWindowDays,
      outcome_status: 'pending',
      dataset_id: params.recommendationId,
    })
    .select()
    .single()

  if (error) throw error
  return mapRowToOutcome(data as Record<string, unknown>)
}

export async function updateOutcomeWithActual(params: {
  outcomeId: string
  actualValue: number
  actualImpact: string
  notes?: string
}): Promise<OutcomeRecord> {
  // Get existing row first
  const { data: existing } = await supabase
    .from('decision_outcomes')
    .select('expected_change')
    .eq('id', params.outcomeId)
    .single()

  const predicted = (existing?.expected_change as number) ?? 0
  let deviationPercent = 0
  let outcome: OutcomeRecord['outcome'] = 'as_expected'
  if (predicted !== 0) {
    deviationPercent = ((params.actualValue - predicted) / Math.abs(predicted)) * 100
    if (Math.abs(deviationPercent) < 10) outcome = 'as_expected'
    else if (params.actualValue > predicted) outcome = 'better_than_expected'
    else outcome = 'worse_than_expected'
  }

  const accuracyScore = Math.max(0, 100 - Math.min(100, Math.abs(deviationPercent)))

  const { data, error } = await supabase
    .from('decision_outcomes')
    .update({
      observed_value_after: params.actualValue,
      observed_metric: params.actualImpact,
      notes: params.notes,
      outcome_status: outcome,
      accuracy_score: accuracyScore,
      evaluation_date: new Date().toISOString(),
    })
    .eq('id', params.outcomeId)
    .select()
    .single()

  if (error) throw error
  const record = mapRowToOutcome(data as Record<string, unknown>)

  eventBus.publish({
    id: crypto.randomUUID(),
    category: 'decision',
    type: 'decision.outcome.measured',
    priority: 'normal',
    payload: { outcomeId: params.outcomeId, outcome, deviationPercent },
    timestamp: new Date().toISOString(),
  })

  return record
}

export async function getOutcomesForDecision(decisionId: string): Promise<OutcomeRecord[]> {
  const { data } = await supabase
    .from('decision_outcomes')
    .select('*')
    .eq('decision_id', decisionId)
  return (data ?? []).map((r) => mapRowToOutcome(r as Record<string, unknown>))
}

export async function getRecentOutcomes(
  organizationId: string,
  limit = 20
): Promise<OutcomeRecord[]> {
  const { data } = await supabase
    .from('decision_outcomes')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => mapRowToOutcome(r as Record<string, unknown>))
}
