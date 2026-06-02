import { CredentialVaultManager } from '@/components/security/CredentialVaultManager'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldCheck } from 'lucide-react'

export default function CredentialVaultPage() {
  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Credential Vault</h1>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Credentials are encrypted client-side using AES-256-GCM before storage. Your passphrase never leaves this browser.
        </AlertDescription>
      </Alert>

      <CredentialVaultManager />
    </div>
  )
}
