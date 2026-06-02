import type { GraphNode, MetadataGraph } from '@/lib/metadata-graph/types'
import type { BusinessTerm } from '@/lib/metadata-graph/business-glossary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  node: GraphNode | null
  graph: MetadataGraph
  businessTerms: BusinessTerm[]
  onTraceImpact?: (nodeId: string) => void
  onFindSources?: (nodeId: string) => void
}

export function NodeInspector({ node, businessTerms, onTraceImpact, onFindSources }: Props) {
  if (!node) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Select a node to inspect.
        </CardContent>
      </Card>
    )
  }

  const linkedTerms = businessTerms.filter(t => t.linkedColumnIds.includes(node.id))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Badge variant="outline">{node.type}</Badge>
          {node.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Metadata</p>
          <table className="text-xs w-full">
            <tbody>
              {Object.entries(node.metadata).map(([k, v]) => (
                <tr key={k}>
                  <td className="font-medium pr-2 py-0.5 text-muted-foreground">{k}</td>
                  <td>{String(v)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-medium pr-2 py-0.5 text-muted-foreground">id</td>
                <td className="truncate max-w-[200px]">{node.id}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2 py-0.5 text-muted-foreground">discoveredAt</td>
                <td>{new Date(node.discoveredAt).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {linkedTerms.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Business Terms</p>
            <div className="flex flex-wrap gap-1">
              {linkedTerms.map(t => (
                <Badge key={t.id} variant="secondary" className="text-xs">{t.term}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {onTraceImpact && (
            <Button size="sm" variant="outline" onClick={() => onTraceImpact(node.id)}>
              Trace Impact
            </Button>
          )}
          {onFindSources && (
            <Button size="sm" variant="outline" onClick={() => onFindSources(node.id)}>
              Find Sources
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
