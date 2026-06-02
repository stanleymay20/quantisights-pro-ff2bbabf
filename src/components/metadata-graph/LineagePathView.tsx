import type { LineagePath } from '@/lib/metadata-graph/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'

interface Props {
  path: LineagePath | null
}

export function LineagePathView({ path }: Props) {
  if (!path || path.nodes.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No lineage path to display.</div>
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto p-4 flex-wrap">
      {path.nodes.map((node, i) => (
        <div key={node.id} className="flex items-center gap-2">
          <Card className="min-w-[120px]">
            <CardContent className="p-2">
              <p className="text-xs font-medium truncate">{node.label}</p>
              <p className="text-xs text-muted-foreground">{node.type}</p>
            </CardContent>
          </Card>
          {i < path.edges.length && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">{path.edges[i].type}</Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
