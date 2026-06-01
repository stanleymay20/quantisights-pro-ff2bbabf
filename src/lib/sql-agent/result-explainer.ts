import { buildCopilotBrief } from '@/lib/semantic/data-copilot'
import type { SQLExecutionResult } from './sql-executor'

export interface ResultExplanation {
  headline: string
  keyFindings: string[]
  recommendedAnalyses: string[]
}

export function explainResults(
  query: string,
  result: SQLExecutionResult,
): ResultExplanation {
  if (result.rowCount === 0) {
    return {
      headline: `No rows returned for: "${query}"`,
      keyFindings: ['The query returned an empty result set.'],
      recommendedAnalyses: ['Check filters or date ranges', 'Verify the table contains data', 'Try a broader query'],
    }
  }

  const brief = buildCopilotBrief({
    headers: result.columns,
    sampleRows: result.rows.slice(0, 200),
    diagnostics: { anomalyCount: 0, piiColumnCount: 0, completeness: 1 },
    drift: null,
    hasLineage: false,
  })

  const keyFindings = brief.recommendedAnalyses.slice(0, 3)
  const recommendedAnalyses = brief.recommendedAnalyses.slice(3, 6)

  return {
    headline: brief.headline,
    keyFindings: keyFindings.length > 0 ? keyFindings : [`Returned ${result.rowCount} row(s) across ${result.columns.length} column(s).`],
    recommendedAnalyses,
  }
}
