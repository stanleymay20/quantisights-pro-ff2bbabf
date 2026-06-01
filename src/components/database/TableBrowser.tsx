import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface TableBrowserProps {
  rows: Record<string, unknown>[]
  isLoading: boolean
  tableId: string
}

export function TableBrowser({ rows, isLoading, tableId }: TableBrowserProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Loading preview…
      </div>
    )
  }

  if (!tableId) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Select a table to preview its data.
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        No rows found.
      </div>
    )
  }

  const headers = Object.keys(rows[0])

  return (
    <ScrollArea className="h-full w-full">
      <div className="min-w-max">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-muted/30">
                {headers.map(h => (
                  <td key={h} className="px-3 py-1.5 whitespace-nowrap font-mono text-xs">
                    {row[h] == null ? (
                      <span className="text-muted-foreground italic">null</span>
                    ) : (
                      String(row[h])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
