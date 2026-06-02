import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DecisionIntelligencePanel } from '@/components/decision-intelligence/DecisionIntelligencePanel'
import { runDecisionIntelligence } from '@/lib/decision-intelligence/decision-engine'
import type { Scenario, DecisionIntelligenceResult } from '@/lib/decision-intelligence/types'
import type { RootCauseAnalysis } from '@/lib/root-cause/types'

function mockRootCause(): RootCauseAnalysis {
  return {
    id: crypto.randomUUID(),
    triggerId: 'demo',
    triggerType: 'manual',
    changeDescription: 'Demo analysis',
    rootCauses: [{
      id: crypto.randomUUID(),
      hypothesis: 'Data quality degradation',
      probability: 0.6,
      confidence: 0.7,
      evidence: ['Demo evidence'],
      affectedAssets: [],
      category: 'data_quality',
      rank: 1,
    }],
    topCause: {
      id: crypto.randomUUID(),
      hypothesis: 'Data quality degradation',
      probability: 0.6,
      confidence: 0.7,
      evidence: [],
      affectedAssets: [],
      category: 'data_quality',
      rank: 1,
    },
    affectedAssets: [],
    lineagePath: null,
    correlations: [],
    dependencyFailures: [],
    narrative: 'Demo root cause',
    confidence: 0.7,
    analyzedAt: new Date().toISOString(),
  }
}

interface ScenarioFormRow {
  id: string
  name: string
  description: string
  metricKey: string
  metricDelta: string
}

export default function DecisionIntelligenceEngine() {
  const [result, setResult] = useState<DecisionIntelligenceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ScenarioFormRow[]>([
    { id: crypto.randomUUID(), name: 'Scenario 1', description: 'Increase inventory', metricKey: 'inventory', metricDelta: '0.2' },
  ])

  function addRow() {
    setRows((r) => [...r, { id: crypto.randomUUID(), name: '', description: '', metricKey: '', metricDelta: '0' }])
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id))
  }

  function updateRow(id: string, field: keyof ScenarioFormRow, value: string) {
    setRows((r) => r.map((row) => row.id === id ? { ...row, [field]: value } : row))
  }

  async function handleGenerate() {
    setIsLoading(true)
    setError(null)
    try {
      const scenarios: Scenario[] = rows.map((row) => ({
        id: row.id,
        name: row.name || 'Unnamed scenario',
        description: row.description,
        assumptions: [],
        inputChanges: row.metricKey ? { [row.metricKey]: parseFloat(row.metricDelta) || 0 } : {},
      }))
      const res = await runDecisionIntelligence({
        rootCause: mockRootCause(),
        scenarios,
        baselineMetrics: {},
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Decision Intelligence Engine</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Simulate scenarios and generate ranked recommendations based on root cause analysis.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          No root cause? <Link to="/root-cause" className="underline">Run Root Cause Analysis first</Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenario Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} placeholder="Scenario name" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Description</Label>
                <Input value={row.description} onChange={(e) => updateRow(row.id, 'description', e.target.value)} placeholder="What changes?" />
              </div>
              <div>
                <Label className="text-xs">Metric key</Label>
                <Input value={row.metricKey} onChange={(e) => updateRow(row.id, 'metricKey', e.target.value)} placeholder="inventory" />
              </div>
              <div className="flex gap-1 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Delta (e.g. 0.2)</Label>
                  <Input value={row.metricDelta} onChange={(e) => updateRow(row.id, 'metricDelta', e.target.value)} placeholder="0.2" />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeRow(row.id)}>✕</Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={addRow}>+ Add Scenario</Button>
            <Button onClick={handleGenerate} disabled={isLoading || rows.length === 0}>
              {isLoading ? 'Generating…' : 'Generate Recommendations'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <DecisionIntelligencePanel result={result} isLoading={isLoading} />
    </div>
  )
}
