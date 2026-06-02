import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RootCausePanel } from '@/components/root-cause/RootCausePanel'
import { analyzeRootCause } from '@/lib/root-cause/root-cause-engine'
import type { RootCauseAnalysis } from '@/lib/root-cause/types'
import type { MetadataGraph } from '@/lib/metadata-graph/types'

function emptyGraph(): MetadataGraph {
  return { nodes: new Map(), edges: [] }
}

export default function RootCauseExplorer() {
  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [metric, setMetric] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    if (!changeDescription.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await analyzeRootCause({
        triggerId: crypto.randomUUID(),
        triggerType: 'manual',
        metric: metric || undefined,
        changeDescription,
        affectedColumnIds: [],
        columnNodeMap: {},
        graph: emptyGraph(),
        alerts: [],
        anomalies: [],
      })
      setAnalysis(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Root Cause Explorer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Automatically identify the root cause of data anomalies and pipeline failures.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="metric">Metric / Table (optional)</Label>
            <Input
              id="metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="e.g. revenue, orders_table"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Change Description *</Label>
            <Textarea
              id="desc"
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
              placeholder="Describe the anomaly or change you observed..."
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleAnalyze} disabled={isLoading || !changeDescription.trim()}>
            {isLoading ? 'Analyzing…' : 'Analyze'}
          </Button>
        </CardContent>
      </Card>

      <RootCausePanel analysis={analysis} isLoading={isLoading} />

      {analysis && !isLoading && (
        <div className="flex justify-end">
          <Link to="/decision-engine">
            <Button variant="outline">Run Decision Intelligence →</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
