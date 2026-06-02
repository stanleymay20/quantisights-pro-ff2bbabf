import type { MetadataGraph } from '@/lib/metadata-graph/types'
import { findImpactedAssets, findUpstreamSources } from '@/lib/metadata-graph/impact-analysis'
import { Badge } from '@/components/ui/badge'

interface Props {
  nodeId: string | null
  graph: MetadataGraph
}

const TYPE_ABBR: Record<string, string> = {
  database: 'DB', schema: 'SCH', table: 'TBL', column: 'COL',
  business_metric: 'METRIC', decision: 'DEC', dashboard: 'DASH', report: 'RPT',
}

export function ImpactPanel({ nodeId, graph }: Props) {
  if (!nodeId) {
    return <div className="text-sm text-muted-foreground p-4">Select a node to see impact.</div>
  }

  const downstream = findImpactedAssets(nodeId, graph)
  const upstream = findUpstreamSources(nodeId, graph)

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold text-sm mb-2">Downstream Impact ({downstream.length})</h3>
        {downstream.length === 0 ? (
          <p className="text-xs text-muted-foreground">No downstream assets.</p>
        ) : (
          <ul className="space-y-1">
            {downstream.map(asset => (
              <li key={asset.nodeId} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">{asset.impactDistance}</Badge>
                <Badge variant="secondary" className="text-xs">{TYPE_ABBR[asset.type] || asset.type}</Badge>
                <span className="truncate">{asset.label}</span>
                <Badge variant={asset.impactType === 'direct' ? 'default' : 'outline'} className="text-xs ml-auto">
                  {asset.impactType}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Upstream Sources ({upstream.length})</h3>
        {upstream.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upstream sources.</p>
        ) : (
          <ul className="space-y-1">
            {upstream.map(asset => (
              <li key={asset.nodeId} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">{asset.impactDistance}</Badge>
                <Badge variant="secondary" className="text-xs">{TYPE_ABBR[asset.type] || asset.type}</Badge>
                <span className="truncate">{asset.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
