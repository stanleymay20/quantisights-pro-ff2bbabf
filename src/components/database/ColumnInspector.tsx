import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { TableMetadata } from '@/connectors/base/types'

interface ColumnInspectorProps {
  metadata: TableMetadata | null
  isLoading: boolean
}

export function ColumnInspector({ metadata, isLoading }: ColumnInspectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Loading columns…
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Select a table to inspect its columns.
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Nullable</TableHead>
            <TableHead>Primary Key</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metadata.columns.map(col => (
            <TableRow key={col.name}>
              <TableCell className="text-muted-foreground text-xs">{col.ordinalPosition + 1}</TableCell>
              <TableCell className="font-mono text-sm">{col.name}</TableCell>
              <TableCell className="text-sm">{col.dataType}</TableCell>
              <TableCell>
                {col.isNullable ? (
                  <Badge variant="outline" className="text-xs">yes</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">no</Badge>
                )}
              </TableCell>
              <TableCell>
                {col.isPrimaryKey ? (
                  <Badge className="text-xs">PK</Badge>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
