import type { RootCauseAnalysis, RootCause } from './types'

export function narrateRootCause(
  analysis: Omit<RootCauseAnalysis, 'narrative' | 'id'>
): string {
  const confidencePct = Math.round(analysis.confidence * 100)
  const causesText = analysis.rootCauses
    .slice(0, 5)
    .map((c: RootCause) => {
      const probPct = Math.round(c.probability * 100)
      const evidenceText = c.evidence.slice(0, 3).join(', ') || 'No direct evidence'
      return `${c.rank}. ${c.hypothesis} — ${probPct}% probability\n   Evidence: ${evidenceText}`
    })
    .join('\n')

  const affectedLabels = analysis.affectedAssets
    .slice(0, 3)
    .map((a) => a.label)
    .join(', ') || 'No affected assets identified'

  return `${analysis.changeDescription}

Root Cause Analysis (${confidencePct}% confidence):
${causesText}

Affected assets: ${affectedLabels}

Recommended action: Investigate ${analysis.topCause.category} in upstream dependencies.`
}
