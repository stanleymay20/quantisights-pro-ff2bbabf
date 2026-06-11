// @ts-nocheck
/**
 * connector-credentials.ts
 *
 * Per-connector credential resolution.
 * Priority: Vault → data_connectors.config.credentials → env var fallback.
 *
 * This allows the system to work with:
 *  a) Per-org Vault-backed credentials (production path)
 *  b) Credentials embedded in data_connectors.config.credentials (simple path)
 *  c) Global env vars (legacy / development)
 */

export interface ResolvedCredentials {
  [key: string]: string | undefined;
}

/**
 * Read a secret from Supabase Vault via RPC.
 * Returns null if the secret doesn't exist or the RPC fails.
 */
async function vaultGet(svc: any, name: string): Promise<string | null> {
  try {
    const { data, error } = await svc.rpc("get_connector_secret", { _secret_name: name });
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

/**
 * Resolve all credentials for a connector.
 * Looks up the data_connectors record, reads vault_keys, resolves each from Vault.
 * Falls back to config.credentials for non-vaulted fields.
 */
export async function resolveConnectorCredentials(
  svc: any,
  connectorId: string,
): Promise<ResolvedCredentials> {
  const { data: connector, error } = await svc
    .from("data_connectors")
    .select("config, credential_vault_keys")
    .eq("id", connectorId)
    .single();

  if (error || !connector) return {};

  const resolved: ResolvedCredentials = {};
  const cfg = connector.config ?? {};
  const vaultKeys: Record<string, string> = connector.credential_vault_keys ?? cfg.vault_keys ?? {};

  // Read from Vault
  for (const [field, vaultKey] of Object.entries(vaultKeys)) {
    const value = await vaultGet(svc, vaultKey as string);
    if (value) resolved[field] = value;
  }

  // Fall back to config.credentials (non-vaulted embedded credentials)
  const embedded = cfg.credentials ?? {};
  for (const [field, value] of Object.entries(embedded)) {
    if (!resolved[field] && value) resolved[field] = String(value);
  }

  // Also check for credential_* prefix in config (second fallback)
  for (const [key, value] of Object.entries(cfg)) {
    if (key.startsWith("credential_") && value) {
      const field = key.replace("credential_", "");
      if (!resolved[field]) resolved[field] = String(value);
    }
  }

  return resolved;
}
