import { Badge } from '@/components/ui/badge'
import type { SQLAgentQuery } from '@/lib/sql-agent/types'

interface SQLHistoryProps {
  queries: SQLAgentQuery[]
  onSelect: (id: string) => void
}

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'secondary'> = {
  success: 'default',
  error: 'destructive',
  pending: 'secondary',
  executing: 'secondary',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function truncate(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export function SQLHistory({ queries, onSelect }: SQLHistoryProps) {
  const sorted = [...queries].reverse()

  if (sorted.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">No queries yet. Ask a question to get started.</div>
    )
  }

  return (
    <ul className="divide-y overflow-auto">
      {sorted.map(q => (
        <li
          key={q.id}
          className="px-3 py-2 hover:bg-muted/40 cursor-pointer space-y-0.5"
          onClick={() => onSelect(q.id)}
        >
          <p className="text-xs truncate" title={q.naturalLanguage}>
            {truncate(q.naturalLanguage)}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[q.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
              {q.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{formatTime(q.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
