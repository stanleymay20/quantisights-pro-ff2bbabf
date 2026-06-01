import { describe, it, expect } from 'vitest'
import { explainResults } from '@/lib/sql-agent/result-explainer'

const sampleResult = {
  rows: [
    { id: 1, amount: 100, status: 'paid' },
    { id: 2, amount: 200, status: 'pending' },
  ],
  rowCount: 2,
  executionMs: 42,
  columns: ['id', 'amount', 'status'],
}

describe('explainResults', () => {
  it('returns a headline string', () => {
    const explanation = explainResults('Show orders', sampleResult)
    expect(typeof explanation.headline).toBe('string')
    expect(explanation.headline.length).toBeGreaterThan(0)
  })

  it('keyFindings is an array of strings', () => {
    const explanation = explainResults('Show orders', sampleResult)
    expect(Array.isArray(explanation.keyFindings)).toBe(true)
    expect(explanation.keyFindings.every(f => typeof f === 'string')).toBe(true)
  })

  it('recommendedAnalyses is an array', () => {
    const explanation = explainResults('Show orders', sampleResult)
    expect(Array.isArray(explanation.recommendedAnalyses)).toBe(true)
  })

  it('returns graceful explanation for empty result set', () => {
    const emptyResult = { rows: [], rowCount: 0, executionMs: 5, columns: [] }
    const explanation = explainResults('Show orders', emptyResult)
    expect(explanation.headline).toContain('No rows')
    expect(explanation.keyFindings.length).toBeGreaterThan(0)
  })
})
