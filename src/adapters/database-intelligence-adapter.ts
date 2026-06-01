import { buildIngestionIntelligence } from '@/lib/ingestion-intelligence'
import { buildCopilotBrief } from '@/lib/semantic/data-copilot'
import { computeTrustScore } from '@/lib/semantic/trust-score'
import { inferSchema } from '@/lib/data-upload-utils'
import type { IngestionIntelligenceResult } from '@/lib/ingestion-intelligence'
import type { CopilotBrief } from '@/lib/semantic/data-copilot'
import type { TrustScore } from '@/lib/semantic/trust-score'
import type { TableMetadata } from '@/connectors/base/types'

export interface DatabaseIntelligenceResult {
  tableId: string
  ingestion: IngestionIntelligenceResult
  copilot: CopilotBrief
  trust: TrustScore
  analyzedAt: string
}

export async function analyzeTable(
  tableId: string,
  metadata: TableMetadata,
  previewRows: Record<string, unknown>[],
): Promise<DatabaseIntelligenceResult> {
  const headers = metadata.columns.map(c => c.name)
  const rows = previewRows.map(row => headers.map(h => String(row[h] ?? '')))

  const schema = inferSchema(headers, rows)

  const ingestion = buildIngestionIntelligence({ headers, rows, schema })

  const sampleRows = previewRows.slice(0, 200)

  const piiColumnCount = ingestion.semanticSchema.piiColumns.length

  const copilot = buildCopilotBrief({
    headers,
    sampleRows,
    diagnostics: { anomalyCount: 0, piiColumnCount, completeness: 1 },
    drift: null,
    hasLineage: false,
  })

  const trust = computeTrustScore({
    diagnostics: { anomalyCount: 0, piiColumnCount, completeness: 1 },
    drift: null,
    hasLineage: false,
    schemaStabilityScore: 95,
  })

  return { tableId, ingestion, copilot, trust, analyzedAt: new Date().toISOString() }
}
