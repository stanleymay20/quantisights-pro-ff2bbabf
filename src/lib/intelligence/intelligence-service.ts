import { predictFreshnessFailure } from './freshness-predictor'
import { predictSchemaDrift, predictVolumeDrift } from './drift-predictor'
import { predictKPIChange } from './kpi-predictor'
import { supabase } from '@/integrations/supabase/client'
import type { IntelligenceForecast, TableObservationHistory, KPIHistory, PredictionResult } from './types'

class IntelligenceService {
  async generateForecast(params: {
    connectorId: string
    tables: TableObservationHistory[]
    kpis?: KPIHistory[]
  }): Promise<IntelligenceForecast> {
    const predictions: PredictionResult[] = []

    for (const table of params.tables) {
      if (table.freshnessHistory && table.expectedRefreshHours) {
        predictions.push(predictFreshnessFailure({
          tableId: table.tableId,
          freshnessHistory: table.freshnessHistory,
          expectedRefreshHours: table.expectedRefreshHours,
        }))
      }
      if (table.changeHistory) {
        predictions.push(predictSchemaDrift({ tableId: table.tableId, changeHistory: table.changeHistory }))
      }
      if (table.volumeHistory && table.expectedRows) {
        predictions.push(predictVolumeDrift({
          tableId: table.tableId,
          volumeHistory: table.volumeHistory,
          expectedRows: table.expectedRows,
        }))
      }
    }

    for (const kpi of (params.kpis ?? [])) {
      predictions.push(predictKPIChange(kpi))
    }

    const highRiskPredictions = predictions.filter(p => p.severity === 'high' || p.severity === 'critical')
    const coverageScore = Math.min(100, Math.round(params.tables.length * 10 + (params.kpis?.length ?? 0) * 5))

    const forecast: IntelligenceForecast = {
      id: crypto.randomUUID(),
      connectorId: params.connectorId,
      predictions,
      highRiskPredictions,
      generatedAt: new Date().toISOString(),
      coverageScore,
      summaryLabel: `${highRiskPredictions.length} high-risk event(s) predicted`,
    }

    await this.persistForecast(forecast)
    return forecast
  }

  async persistForecast(forecast: IntelligenceForecast): Promise<void> {
    try {
      await supabase.from('audit_log').insert({
        action_type: 'intelligence:forecast_generated',
        actor_type: 'system',
        resource_type: 'intelligence_forecast',
        resource_id: forecast.connectorId,
        payload: {
          forecastId: forecast.id,
          predictionCount: forecast.predictions.length,
          highRiskCount: forecast.highRiskPredictions.length,
          coverageScore: forecast.coverageScore,
        },
      })
    } catch {
      // Non-fatal
    }
  }
}

export const intelligenceService = new IntelligenceService()
