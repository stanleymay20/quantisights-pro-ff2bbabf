import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IntelligenceFeed } from '@/components/intelligence/IntelligenceFeed'
import { intelligenceService } from '@/lib/intelligence/intelligence-service'
import type { IntelligenceForecast } from '@/lib/intelligence/types'

export default function PredictiveIntelligence() {
  const [forecast, setForecast] = useState<IntelligenceForecast | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [connectorId, setConnectorId] = useState('demo-connector')
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await intelligenceService.generateForecast({
        connectorId,
        tables: [],
        kpis: [],
      })
      setForecast(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Forecast failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Predictive Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Predict freshness failures, schema drift, volume anomalies, and KPI changes before they occur.
        </p>
      </div>

      {forecast && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg text-sm">
          <span className="text-muted-foreground">Coverage score:</span>
          <strong className="text-lg">{forecast.coverageScore}%</strong>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="connector">Connector ID</Label>
            <Input
              id="connector"
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
              placeholder="connector-id"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? 'Generating…' : 'Generate Forecast'}
          </Button>
        </CardContent>
      </Card>

      <IntelligenceFeed forecast={forecast} isLoading={isLoading} />
    </div>
  )
}
