import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatabaseExplorer } from '@/components/database/DatabaseExplorer'
import { connectionManager } from '@/services/connection-manager'
import type { ConnectorType, ConnectionConfig } from '@/connectors/base/types'

interface FormState {
  type: ConnectorType
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  ssl: boolean
  account: string
  warehouse: string
  projectId: string
}

const defaultForm: FormState = {
  type: 'postgres',
  name: '',
  host: '',
  port: '',
  database: '',
  username: '',
  password: '',
  ssl: false,
  account: '',
  warehouse: '',
  projectId: '',
}

let _idCounter = 1

export default function DatabaseExplorerPage() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [connectedId, setConnectedId] = useState<string | null>(null)
  const [connectedName, setConnectedName] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const buildConfig = (): ConnectionConfig => ({
    id: `ephemeral-${_idCounter++}`,
    type: form.type,
    name: form.name || form.database || 'Database',
    host: form.host || undefined,
    port: form.port ? Number(form.port) : undefined,
    database: form.database || undefined,
    username: form.username || undefined,
    password: form.password || undefined,
    ssl: form.ssl,
    account: form.account || undefined,
    warehouse: form.warehouse || undefined,
    projectId: form.projectId || undefined,
    createdAt: new Date().toISOString(),
  })

  const handleTest = async () => {
    setIsTesting(true)
    try {
      const config = buildConfig()
      connectionManager.registerConnector(config)
      const ok = await connectionManager.testConnection(config.id)
      connectionManager.removeConnector(config.id)
      if (ok) {
        toast.success('Connection successful')
      } else {
        toast.error('Connection failed')
      }
    } catch (e) {
      toast.error(`Test failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const config = buildConfig()
      connectionManager.registerConnector(config)
      setConnectedId(config.id)
      setConnectedName(config.name)
      toast.success(`Connected to ${config.name}`)
    } catch (e) {
      toast.error(`Connection failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const isSnowflake = form.type === 'snowflake'
  const isBigQuery = form.type === 'bigquery'

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Connection panel */}
      <div className="border rounded-lg p-4 bg-card space-y-4">
        <h2 className="font-semibold text-sm">Database Connection</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={v => set('type', v as ConnectorType)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="sqlserver">SQL Server</SelectItem>
                <SelectItem value="snowflake">Snowflake</SelectItem>
                <SelectItem value="bigquery">BigQuery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Name (optional)</Label>
            <Input
              className="h-8 text-sm"
              placeholder="My DB"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {!isSnowflake && !isBigQuery && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Host</Label>
                <Input className="h-8 text-sm" placeholder="localhost" value={form.host} onChange={e => set('host', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Port</Label>
                <Input className="h-8 text-sm" placeholder="5432" value={form.port} onChange={e => set('port', e.target.value)} />
              </div>
            </>
          )}

          {isSnowflake && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Account</Label>
                <Input className="h-8 text-sm" placeholder="org-account" value={form.account} onChange={e => set('account', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Warehouse</Label>
                <Input className="h-8 text-sm" placeholder="COMPUTE_WH" value={form.warehouse} onChange={e => set('warehouse', e.target.value)} />
              </div>
            </>
          )}

          {isBigQuery && (
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Project ID</Label>
              <Input className="h-8 text-sm" placeholder="my-gcp-project" value={form.projectId} onChange={e => set('projectId', e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Database</Label>
            <Input className="h-8 text-sm" placeholder="mydb" value={form.database} onChange={e => set('database', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input className="h-8 text-sm" placeholder="user" value={form.username} onChange={e => set('username', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Password</Label>
            <Input className="h-8 text-sm" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>

          {!isBigQuery && (
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={form.ssl} onCheckedChange={v => set('ssl', v)} id="ssl-toggle" />
              <Label htmlFor="ssl-toggle" className="text-xs cursor-pointer">SSL</Label>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
            {isTesting ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button size="sm" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </div>

      {/* Explorer */}
      {connectedId && (
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
          <DatabaseExplorer connectorId={connectedId} connectorName={connectedName} />
        </div>
      )}
    </div>
  )
}
