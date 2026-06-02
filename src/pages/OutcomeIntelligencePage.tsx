import React, { useEffect, useState } from 'react'
import { LearningDashboard } from '@/components/outcome-intelligence/LearningDashboard'
import { OutcomeCard } from '@/components/outcome-intelligence/OutcomeCard'
import { useOutcomeIntelligence } from '@/hooks/useOutcomeIntelligence'

const PLACEHOLDER_ORG_ID = 'demo-org'

export default function OutcomeIntelligencePage() {
  const {
    recentOutcomes,
    summary,
    isLoading,
    loadOutcomes,
    recordActualValue,
    refreshSummary,
  } = useOutcomeIntelligence(PLACEHOLDER_ORG_ID)

  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [actualVal, setActualVal] = useState('')
  const [actualImpact, setActualImpact] = useState('')

  useEffect(() => {
    loadOutcomes().then(refreshSummary)
  }, [])

  const handleRecord = async (outcomeId: string) => {
    const val = parseFloat(actualVal)
    if (isNaN(val)) return
    await recordActualValue(outcomeId, val, actualImpact || 'Recorded')
    setRecordingId(null)
    setActualVal('')
    setActualImpact('')
    refreshSummary()
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outcome Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track prediction accuracy and improve future recommendations through feedback loops.
          </p>
        </div>
        <button
          onClick={() => loadOutcomes().then(refreshSummary)}
          className="text-sm border rounded px-3 py-1.5 hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Learning Dashboard</h2>
        <LearningDashboard summary={summary} isLoading={isLoading} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Outcomes ({recentOutcomes.length})</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading outcomes…</p>
        ) : recentOutcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outcomes recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentOutcomes.map((outcome) => (
              <div key={outcome.id} className="space-y-2">
                <OutcomeCard outcome={outcome} />
                {outcome.actualValue === undefined && (
                  recordingId === outcome.id ? (
                    <div className="border rounded p-3 space-y-2 bg-muted/30">
                      <input
                        type="number"
                        placeholder="Actual value"
                        value={actualVal}
                        onChange={(e) => setActualVal(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                      <input
                        placeholder="Actual impact description"
                        value={actualImpact}
                        onChange={(e) => setActualImpact(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRecord(outcome.id)}
                          className="flex-1 bg-primary text-primary-foreground rounded px-2 py-1 text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setRecordingId(null)}
                          className="flex-1 border rounded px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRecordingId(outcome.id)}
                      className="w-full text-xs border rounded px-3 py-1.5 hover:bg-muted text-muted-foreground"
                    >
                      Record Actual Value
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
