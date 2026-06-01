import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown, Database, Table2 } from 'lucide-react'
import type { TableInfo } from '@/connectors/base/types'

interface SchemaTreeProps {
  connectorId: string
  schemas: string[]
  tables: TableInfo[]
  onSelectTable: (tableId: string) => void
  selectedTableId?: string
}

export function SchemaTree({ schemas, tables, onSelectTable, selectedTableId }: SchemaTreeProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(schemas))

  const toggleSchema = (schema: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev)
      if (next.has(schema)) {
        next.delete(schema)
      } else {
        next.add(schema)
      }
      return next
    })
  }

  const tablesBySchema = schemas.reduce<Record<string, TableInfo[]>>((acc, schema) => {
    acc[schema] = tables.filter(t => t.schema === schema)
    return acc
  }, {})

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {schemas.map(schema => (
          <div key={schema}>
            <button
              className="flex items-center gap-1 w-full text-left px-2 py-1 rounded hover:bg-muted text-sm font-semibold"
              onClick={() => toggleSchema(schema)}
            >
              {expandedSchemas.has(schema) ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )}
              <Database className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{schema}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {tablesBySchema[schema]?.length ?? 0}
              </Badge>
            </button>
            {expandedSchemas.has(schema) && (
              <div className="ml-4 space-y-0.5 mt-0.5">
                {(tablesBySchema[schema] ?? []).map(table => (
                  <button
                    key={table.tableId}
                    className={`flex items-center gap-1 w-full text-left px-2 py-1 rounded hover:bg-muted text-sm ${
                      selectedTableId === table.tableId ? 'bg-muted font-medium' : ''
                    }`}
                    onClick={() => onSelectTable(table.tableId)}
                  >
                    <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{table.name}</span>
                    {table.rowCount !== undefined && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        {table.rowCount.toLocaleString()}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
