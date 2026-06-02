import { useEffect, useState } from 'react'
import type { VaultEntry } from '@/lib/security/types'
import { credentialVault } from '@/lib/security/credential-vault'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { AlertTriangle, Plus, RotateCcw, Trash2 } from 'lucide-react'

type EntryMeta = Omit<VaultEntry, 'encryptedPayload'>

function RotationWarning({ entry }: { entry: EntryMeta }) {
  const schedule = credentialVault.getRotationSchedule(entry.connectorId, 90)
  schedule.lastRotated = entry.lastRotatedAt
  schedule.nextRotation = new Date(new Date(entry.lastRotatedAt).getTime() + 90 * 86400000).toISOString()
  if (!credentialVault.isRotationDue(schedule)) return null
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> Rotation due
    </Badge>
  )
}

export function CredentialVaultManager() {
  const [entries, setEntries] = useState<EntryMeta[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [rotatingId, setRotatingId] = useState<string | null>(null)

  const [addForm, setAddForm] = useState({ connectorId: '', label: '', credentialJson: '{}', passphrase: '' })
  const [rotateForm, setRotateForm] = useState({ credentialJson: '{}', oldPassphrase: '', newPassphrase: '' })

  async function loadEntries() {
    try {
      const list = await credentialVault.listEntries()
      setEntries(list)
    } catch {
      toast.error('Failed to load vault entries')
    }
  }

  useEffect(() => { loadEntries() }, [])

  async function handleAdd() {
    try {
      let credential: Record<string, unknown>
      try { credential = JSON.parse(addForm.credentialJson) } catch { toast.error('Invalid JSON'); return }
      await credentialVault.store({
        connectorId: addForm.connectorId,
        connectorType: '',
        label: addForm.label,
        credential,
        passphrase: addForm.passphrase,
      })
      toast.success('Credential stored')
      setShowAdd(false)
      setAddForm({ connectorId: '', label: '', credentialJson: '{}', passphrase: '' })
      loadEntries()
    } catch (e) {
      toast.error('Failed to store credential')
    }
  }

  async function handleRotate(connectorId: string) {
    try {
      let credential: Record<string, unknown>
      try { credential = JSON.parse(rotateForm.credentialJson) } catch { toast.error('Invalid JSON'); return }
      await credentialVault.rotate({
        connectorId,
        newCredential: credential,
        oldPassphrase: rotateForm.oldPassphrase,
        newPassphrase: rotateForm.newPassphrase || undefined,
      })
      toast.success('Credential rotated')
      setRotatingId(null)
      loadEntries()
    } catch {
      toast.error('Failed to rotate credential')
    }
  }

  async function handleDelete(connectorId: string) {
    if (!confirm(`Delete vault entry for ${connectorId}?`)) return
    try {
      await credentialVault.remove(connectorId)
      toast.success('Credential deleted')
      loadEntries()
    } catch {
      toast.error('Failed to delete credential')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stored Credentials</h2>
        <Button size="sm" onClick={() => setShowAdd(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add Credential
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Add Credential</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Connector ID" value={addForm.connectorId} onChange={e => setAddForm(f => ({ ...f, connectorId: e.target.value }))} />
            <Input placeholder="Label" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} />
            <Textarea placeholder='Credential JSON, e.g. {"host":"...", "password":"..."}' value={addForm.credentialJson} onChange={e => setAddForm(f => ({ ...f, credentialJson: e.target.value }))} rows={3} />
            <Input type="password" placeholder="Passphrase (never sent to server)" value={addForm.passphrase} onChange={e => setAddForm(f => ({ ...f, passphrase: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No credentials stored.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <Card key={entry.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{entry.label || entry.connectorId}</span>
                  <Badge variant="outline" className="text-xs">{entry.connectorId}</Badge>
                  <RotationWarning entry={entry} />
                  <div className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRotatingId(entry.connectorId)}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(entry.connectorId)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last rotated: {new Date(entry.lastRotatedAt).toLocaleDateString()}
                  {entry.expiresAt && ` · Expires: ${new Date(entry.expiresAt).toLocaleDateString()}`}
                </div>

                {rotatingId === entry.connectorId && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <p className="text-xs font-medium">Rotate Credential</p>
                    <Textarea placeholder='New credential JSON' value={rotateForm.credentialJson} onChange={e => setRotateForm(f => ({ ...f, credentialJson: e.target.value }))} rows={2} />
                    <Input type="password" placeholder="Old passphrase" value={rotateForm.oldPassphrase} onChange={e => setRotateForm(f => ({ ...f, oldPassphrase: e.target.value }))} />
                    <Input type="password" placeholder="New passphrase (leave blank to keep same)" value={rotateForm.newPassphrase} onChange={e => setRotateForm(f => ({ ...f, newPassphrase: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRotate(entry.connectorId)}>Rotate</Button>
                      <Button size="sm" variant="outline" onClick={() => setRotatingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
