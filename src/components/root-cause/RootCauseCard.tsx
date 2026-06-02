import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RootCause } from '@/lib/root-cause/types'

interface Props {
  cause: RootCause
}

export function RootCauseCard({ cause }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-3">
        <span className="text-lg font-bold text-primary">#{cause.rank}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">{cause.hypothesis}</p>
        </div>
        <Badge variant="outline">{cause.category}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex gap-4">
          <span className="text-muted-foreground">Probability:</span>
          <span className="font-semibold">{Math.round(cause.probability * 100)}%</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted-foreground">Confidence:</span>
          <span className="font-semibold">{Math.round(cause.confidence * 100)}%</span>
        </div>
        {cause.evidence.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1">Evidence:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {cause.evidence.map((e, i) => (
                <li key={i} className="text-xs">{e}</li>
              ))}
            </ul>
          </div>
        )}
        {cause.affectedAssets.length > 0 && (
          <div className="text-muted-foreground text-xs">
            Affected assets: {cause.affectedAssets.length}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
