import {
  AGENT_GATEWAY_SCHEMA_VERSION,
  AGENT_GATEWAY_VERSION,
} from "@/lib/agent-gateway";
import {
  RUNTIME_GATEWAY_VERSION,
} from "@/lib/runtime-types";
import type {
  IdempotencyPurgeResult,
  IdempotencyRecord,
  IdempotencyRecordStatus,
  IdempotencyReplayResult,
  IdempotencyReserveInput,
  IdempotencyReserveResult,
  IdempotencyStore,
  IdempotencyStoreAdapter,
  IdempotencyStoreConfig,
  IdempotencyStoreFindCriteria,
  IdempotencyStoreSaveInput,
  IdempotencyStoreUpdateInput,
  ReplayReason,
} from "@/lib/idempotency-store-types";

export type {
  IdempotencyPurgeResult,
  IdempotencyRecord,
  IdempotencyRecordStatus,
  IdempotencyReplayResult,
  IdempotencyReserveInput,
  IdempotencyReserveResult,
  IdempotencyStore,
  IdempotencyStoreAdapter,
  IdempotencyStoreConfig,
  IdempotencyStoreFindCriteria,
  IdempotencyStoreSaveInput,
  IdempotencyStoreUpdateInput,
  ReplayReason,
} from "@/lib/idempotency-store-types";

const DEFAULT_TTL_MS = 60 * 60 * 1000;

export function createIdempotencyStore(config: IdempotencyStoreConfig): IdempotencyStore {
  const now = () => config.now?.() ?? new Date().toISOString();
  const defaultTtl = config.ttl_ms ?? DEFAULT_TTL_MS;

  return {
    reserveKey: (input) => reserveKey(config.adapter, normalizeInput(input, now(), defaultTtl)),
    lookupKey: (idempotency_key) => lookupKey(config.adapter, idempotency_key),
    completeKey: (idempotency_key, changes) => completeKey(config.adapter, idempotency_key, changes, now()),
    expireKey: (idempotency_key, timestamp) => expireKey(config.adapter, idempotency_key, timestamp ?? now()),
    purgeExpired: (timestamp) => purgeExpired(config.adapter, timestamp ?? now()),
    detectReplay: (input) => detectReplay(config.adapter, normalizeInput(input, now(), defaultTtl)),
  };
}

export async function reserveKey(
  adapter: IdempotencyStoreAdapter,
  input: Required<IdempotencyReserveInput>,
): Promise<IdempotencyReserveResult> {
  try {
    const replay = await detectReplay(adapter, input);
    if (replay.replayed) {
      return {
        status: "REJECTED",
        record: null,
        replay,
        errors: [replay.explanation],
      };
    }

    const record: IdempotencyRecord = {
      idempotency_key: input.idempotency_key,
      request_hash: input.request_hash,
      correlation_id: input.correlation_id,
      tenant_id: input.tenant_id,
      organization_id: input.organization_id,
      created_at: input.now,
      completed_at: null,
      expires_at: addMilliseconds(input.now, input.ttl_ms),
      status: "RESERVED",
      gateway_version: input.gateway_version,
      schema_version: input.schema_version,
      runtime_version: input.runtime_version,
    };
    return {
      status: "RESERVED",
      record: await adapter.save(record),
      replay: noReplay(),
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failedReserve(message);
  }
}

export async function lookupKey(
  adapter: IdempotencyStoreAdapter,
  idempotency_key: string,
): Promise<IdempotencyRecord | null> {
  return adapter.find({ idempotency_key });
}

export async function completeKey(
  adapter: IdempotencyStoreAdapter,
  idempotency_key: string,
  changes: { status?: "COMPLETED" | "FAILED" | "PROCESSING"; completed_at?: string } = {},
  now: string = new Date().toISOString(),
): Promise<IdempotencyRecord | null> {
  return adapter.update(idempotency_key, {
    status: changes.status ?? "COMPLETED",
    completed_at: changes.completed_at ?? now,
  });
}

export async function expireKey(
  adapter: IdempotencyStoreAdapter,
  idempotency_key: string,
  now: string = new Date().toISOString(),
): Promise<IdempotencyRecord | null> {
  const record = await adapter.find({ idempotency_key });
  if (!record) return null;
  if (!isExpired(record, now)) return record;
  return adapter.update(idempotency_key, {
    status: "EXPIRED",
  });
}

export async function purgeExpired(
  adapter: IdempotencyStoreAdapter,
  now: string = new Date().toISOString(),
): Promise<IdempotencyPurgeResult> {
  return {
    deleted_count: await adapter.deleteExpired(now),
  };
}

export async function detectReplay(
  adapter: IdempotencyStoreAdapter,
  input: Required<IdempotencyReserveInput>,
): Promise<IdempotencyReplayResult> {
  try {
    const byKey = await adapter.find({ idempotency_key: input.idempotency_key });
    if (byKey) {
      if (byKey.tenant_id !== input.tenant_id || byKey.organization_id !== input.organization_id) {
        return replay("CROSS_TENANT_KEY_REUSE", byKey, "Idempotency key is already reserved by another tenant or organization.");
      }
      if (byKey.status === "EXPIRED" || isExpired(byKey, input.now)) {
        if (byKey.status !== "EXPIRED") {
          await adapter.update(byKey.idempotency_key, { status: "EXPIRED" });
          return replay("EXPIRED_RESERVATION_REUSE", { ...byKey, status: "EXPIRED" }, "Expired idempotency reservation cannot be reused.");
        }
        return replay("EXPIRED_RESERVATION_REUSE", byKey, "Expired idempotency reservation cannot be reused.");
      }
      if (byKey.request_hash !== input.request_hash) {
        return replay("CONFLICTING_REQUEST_HASH", byKey, "Idempotency key was reused with a conflicting request hash.");
      }
      return replay("DUPLICATE_IDEMPOTENCY_KEY", byKey, "Idempotency key was already reserved for this request.");
    }

    const byHash = await adapter.find({ request_hash: input.request_hash });
    if (byHash) {
      if (byHash.tenant_id !== input.tenant_id || byHash.organization_id !== input.organization_id) {
        return replay("CROSS_TENANT_KEY_REUSE", byHash, "Request hash is already associated with another tenant or organization.");
      }
      if (byHash.status === "EXPIRED" || isExpired(byHash, input.now)) {
        return replay("EXPIRED_RESERVATION_REUSE", byHash, "Expired request hash reservation cannot be reused.");
      }
      return replay("DUPLICATE_REQUEST_HASH", byHash, "Request hash was already reserved with a different idempotency key.");
    }

    return noReplay();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      replayed: false,
      reason: "ADAPTER_FAILURE",
      retryable: true,
      existing_record: null,
      explanation: message,
    };
  }
}

export class InMemoryIdempotencyStoreAdapter implements IdempotencyStoreAdapter {
  private readonly records = new Map<string, IdempotencyRecord>();

  save(record: IdempotencyStoreSaveInput): IdempotencyRecord {
    const snapshot = cloneRecord(record);
    this.records.set(snapshot.idempotency_key, snapshot);
    return cloneRecord(snapshot);
  }

  find(criteria: IdempotencyStoreFindCriteria): IdempotencyRecord | null {
    for (const record of this.records.values()) {
      if (matches(record, criteria)) return cloneRecord(record);
    }
    return null;
  }

  update(idempotency_key: string, changes: IdempotencyStoreUpdateInput): IdempotencyRecord | null {
    const existing = this.records.get(idempotency_key);
    if (!existing) return null;
    const updated: IdempotencyRecord = {
      ...existing,
      ...changes,
      completed_at: changes.completed_at === undefined ? existing.completed_at : changes.completed_at,
      expires_at: changes.expires_at ?? existing.expires_at,
    };
    this.records.set(idempotency_key, cloneRecord(updated));
    return cloneRecord(updated);
  }

  deleteExpired(now: string): number {
    let deleted = 0;
    for (const record of Array.from(this.records.values())) {
      if (record.status === "EXPIRED" || isExpired(record, now)) {
        this.records.delete(record.idempotency_key);
        deleted += 1;
      }
    }
    return deleted;
  }

  exists(criteria: IdempotencyStoreFindCriteria): boolean {
    return this.find(criteria) !== null;
  }
}

function normalizeInput(
  input: IdempotencyReserveInput,
  now: string,
  defaultTtl: number,
): Required<IdempotencyReserveInput> {
  return {
    ...input,
    gateway_version: input.gateway_version ?? AGENT_GATEWAY_VERSION,
    schema_version: input.schema_version ?? AGENT_GATEWAY_SCHEMA_VERSION,
    runtime_version: input.runtime_version ?? RUNTIME_GATEWAY_VERSION,
    now: input.now ?? now,
    ttl_ms: input.ttl_ms ?? defaultTtl,
  };
}

function replay(
  reason: Exclude<ReplayReason, "NONE" | "ADAPTER_FAILURE">,
  existing: IdempotencyRecord,
  explanation: string,
): IdempotencyReplayResult {
  return {
    replayed: true,
    reason,
    retryable: false,
    existing_record: cloneRecord(existing),
    explanation,
  };
}

function noReplay(): IdempotencyReplayResult {
  return {
    replayed: false,
    reason: "NONE",
    retryable: false,
    existing_record: null,
    explanation: "No idempotency or replay conflict detected.",
  };
}

function failedReserve(message: string): IdempotencyReserveResult {
  return {
    status: "FAILED",
    record: null,
    replay: {
      replayed: false,
      reason: "ADAPTER_FAILURE",
      retryable: true,
      existing_record: null,
      explanation: message,
    },
    errors: [message],
  };
}

function isExpired(record: IdempotencyRecord, now: string): boolean {
  return Date.parse(record.expires_at) <= Date.parse(now);
}

function addMilliseconds(timestamp: string, ttlMs: number): string {
  return new Date(Date.parse(timestamp) + ttlMs).toISOString();
}

function matches(record: IdempotencyRecord, criteria: IdempotencyStoreFindCriteria): boolean {
  return Object.entries(criteria).every(([key, value]) => {
    if (value === undefined) return true;
    return record[key as keyof IdempotencyRecord] === value;
  });
}

function cloneRecord(record: IdempotencyRecord): IdempotencyRecord {
  return { ...record };
}

/**
 * Minimal shape of an injected @supabase/supabase-js client needed by
 * `SupabaseIdempotencyStoreAdapter`. Deliberately duplicated (rather than
 * imported) from the equivalent types in `runtime-persistence.ts` /
 * `runtime-queue.ts` so AG-3C stays independent of AG-3D/AG-3E, matching
 * the existing module boundaries.
 */
export interface SupabaseRuntimeQueryError {
  message: string;
  code?: string;
}

export interface SupabaseRuntimeQueryResult<T> {
  data: T | null;
  error: SupabaseRuntimeQueryError | null;
}

export interface SupabaseRuntimeFilterBuilder extends PromiseLike<SupabaseRuntimeQueryResult<any>> {
  eq(column: string, value: unknown): SupabaseRuntimeFilterBuilder;
  or(filters: string): SupabaseRuntimeFilterBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseRuntimeFilterBuilder;
  limit(count: number): SupabaseRuntimeFilterBuilder;
  select(columns?: string): SupabaseRuntimeFilterBuilder;
  single(): PromiseLike<SupabaseRuntimeQueryResult<any>>;
  maybeSingle(): PromiseLike<SupabaseRuntimeQueryResult<any>>;
}

export interface SupabaseRuntimeQueryBuilder {
  select(columns?: string): SupabaseRuntimeFilterBuilder;
  insert(values: unknown): SupabaseRuntimeFilterBuilder;
  update(values: unknown): SupabaseRuntimeFilterBuilder;
  delete(): SupabaseRuntimeFilterBuilder;
}

export interface SupabaseRuntimeClient {
  from(table: string): SupabaseRuntimeQueryBuilder;
}

const IDEMPOTENCY_UNIQUE_VIOLATION = "23505";

/**
 * GA-2: durable Postgres-backed implementation of the AG-3C idempotency
 * contract, backed by the `runtime_idempotency_keys` table
 * (`idempotency_key` primary key). `reserveKey()`'s in-app `detectReplay()`
 * check (in `createIdempotencyStore`) remains the primary duplicate/replay
 * detector; the table's primary key on `idempotency_key` is a durability
 * backstop that turns a concurrent double-reservation race into a clean
 * unique-violation instead of two consumers believing they each reserved
 * the key.
 */
export class SupabaseIdempotencyStoreAdapter implements IdempotencyStoreAdapter {
  constructor(private readonly client: SupabaseRuntimeClient) {}

  async save(record: IdempotencyStoreSaveInput): Promise<IdempotencyRecord> {
    const { data, error } = await this.client
      .from("runtime_idempotency_keys")
      .insert(recordToRow(record))
      .select("*")
      .single();
    if (error) {
      if (error.code === IDEMPOTENCY_UNIQUE_VIOLATION) {
        throw new Error(`idempotency key ${record.idempotency_key} is already reserved`);
      }
      throw new Error(`SupabaseIdempotencyStoreAdapter.save failed: ${error.message}`);
    }
    return rowToRecord(data);
  }

  async find(criteria: IdempotencyStoreFindCriteria): Promise<IdempotencyRecord | null> {
    let builder = this.client.from("runtime_idempotency_keys").select("*");
    for (const [key, value] of Object.entries(criteria)) {
      if (value !== undefined) builder = builder.eq(key, value);
    }
    const { data, error } = await builder.order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw new Error(`SupabaseIdempotencyStoreAdapter.find failed: ${error.message}`);
    return data ? rowToRecord(data) : null;
  }

  async update(idempotency_key: string, changes: IdempotencyStoreUpdateInput): Promise<IdempotencyRecord | null> {
    const { data, error } = await this.client
      .from("runtime_idempotency_keys")
      .update(changesToRow(changes))
      .eq("idempotency_key", idempotency_key)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`SupabaseIdempotencyStoreAdapter.update failed: ${error.message}`);
    return data ? rowToRecord(data) : null;
  }

  async deleteExpired(now: string): Promise<number> {
    const { data, error } = await this.client
      .from("runtime_idempotency_keys")
      .delete()
      .or(`status.eq.EXPIRED,expires_at.lte.${now}`)
      .select("idempotency_key");
    if (error) throw new Error(`SupabaseIdempotencyStoreAdapter.deleteExpired failed: ${error.message}`);
    return (data ?? []).length;
  }

  async exists(criteria: IdempotencyStoreFindCriteria): Promise<boolean> {
    return (await this.find(criteria)) !== null;
  }
}

function recordToRow(record: IdempotencyStoreSaveInput): Record<string, unknown> {
  return {
    idempotency_key: record.idempotency_key,
    request_hash: record.request_hash,
    correlation_id: record.correlation_id,
    tenant_id: record.tenant_id,
    organization_id: record.organization_id,
    created_at: record.created_at,
    completed_at: record.completed_at,
    expires_at: record.expires_at,
    status: record.status,
    gateway_version: record.gateway_version,
    schema_version: record.schema_version,
    runtime_version: record.runtime_version,
  };
}

function changesToRow(changes: IdempotencyStoreUpdateInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.completed_at !== undefined) row.completed_at = changes.completed_at;
  if (changes.expires_at !== undefined) row.expires_at = changes.expires_at;
  return row;
}

function rowToRecord(row: any): IdempotencyRecord {
  return {
    idempotency_key: row.idempotency_key,
    request_hash: row.request_hash,
    correlation_id: row.correlation_id,
    tenant_id: row.tenant_id,
    organization_id: row.organization_id,
    created_at: row.created_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    status: row.status,
    gateway_version: row.gateway_version,
    schema_version: row.schema_version,
    runtime_version: row.runtime_version,
  };
}
