import React from 'react'
import type { OutcomeIntelligenceSummary } from '@/lib/outcome-intelligence/types'

interface LearningDashboardProps {
  summary: OutcomeIntelligenceSummary | null
  isLoading: boolean
}

export function LearningDashboard({ summary, isLoading }: LearningDashboardProps) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading intelligence summary...</div>
  }
  if (!summary) {
    return <div className="text-sm text-muted-foreground">No summary available. Load outcomes first.</div>
  }

  const measuredPct = summary.totalDecisions > 0
    ? Math.round((summary.measuredDecisions / summary.totalDecisions) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Decisions" value={summary.totalDecisions} />
        <StatCard label="Measured %" value={`${measuredPct}%`} />
        <StatCard label="Avg Accuracy" value={`${summary.averageAccuracy.toFixed(1)}%`} />
        <StatCard label="Well Calibrated" value={summary.wellCalibratedCount} />
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-medium text-sm">Calibration Distribution</p>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>Well Calibrated: <span className="text-green-600 font-medium">{summary.wellCalibratedCount}</span></li>
          <li>Overconfident: <span className="text-red-600 font-medium">{summary.overconfidentCount}</span></li>
          <li>Underconfident: <span className="text-amber-600 font-medium">{summary.underconfidentCount}</span></li>
        </ul>
      </div>

      {summary.topSuccessPatterns.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="font-medium text-sm mb-2">Top Success Patterns</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {summary.topSuccessPatterns.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {summary.topFailurePatterns.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="font-medium text-sm mb-2">Top Failure Patterns</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {summary.topFailurePatterns.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-lg p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
