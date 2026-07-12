import type {
  RuntimeQueue,
  RuntimeQueueAdapter,
  RuntimeQueueConfig,
  RuntimeQueueDequeueResult,
  RuntimeQueueEnqueueInput,
  RuntimeQueueEnqueueResult,
  RuntimeQueueMessage,
  RuntimeQueuePurgeResult,
  RuntimeQueueRetryInput,
  RuntimeQueueRetryPolicy,
  RuntimeQueueStats,
} from "@/lib/runtime-queue-types";

export type {
  RuntimeQueue,
  RuntimeQueueAdapter,
  RuntimeQueueConfig,
  RuntimeQueueDequeueResult,
  RuntimeQueueEnqueueInput,
  RuntimeQueueEnqueueResult,
  RuntimeQueueMessage,
  RuntimeQueuePurgeResult,
  RuntimeQueueRetryHistoryEntry,
  RuntimeQueueRetryInput,
  RuntimeQueueRetryPolicy,
  RuntimeQueueStats,
} from "@/lib/runtime-queue-types";

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_RETRY_POLICY: RuntimeQueueRetryPolicy = {
  max_attempts: 3,
  retry_delay_ms: 60 * 1000,
  dead_letter_threshold: 3,
};

export function createRuntimeQueue(config: RuntimeQueueConfig): RuntimeQueue {
  const now = () => config.now?.() ?? new Date().toISOString();
  const ttlMs = config.ttl_ms ?? DEFAULT_TTL_MS;
  const retryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...config.retry_policy,
  };

  return {
    enqueue: (input) => enqueue(config.adapter, normalizeEnqueueInput(input, now(), ttlMs)),
    peek: (timestamp) => peek(config.adapter, timestamp ?? now()),
    dequeue: (timestamp) => dequeue(config.adapter, timestamp ?? now()),
    ack: (queueMessageId, completionReason = "processed", timestamp) =>
      ack(config.adapter, queueMessageId, completionReason, timestamp ?? now()),
    retry: (queueMessageId, input) =>
      retry(config.adapter, queueMessageId, {
        failure_reason: input.failure_reason,
        now: input.now ?? now(),
      }, retryPolicy),
    moveToDeadLetter: (queueMessageId, reason, timestamp) =>
      moveToDeadLetter(config.adapter, queueMessageId, reason, timestamp ?? now()),
    purge: (timestamp) => purge(config.adapter, timestamp ?? now()),
    queueStats: (timestamp) => queueStats(config.adapter, timestamp ?? now()),
  };
}

export async function enqueue(
  adapter: RuntimeQueueAdapter,
  input: Required<RuntimeQueueEnqueueInput>,
): Promise<RuntimeQueueEnqueueResult> {
  try {
    const message: RuntimeQueueMessage = {
      queue_message_id: input.queue_message_id,
      correlation_id: input.correlation_id,
      idempotency_key: input.idempotency_key,
      request_hash: input.request_hash,
      tenant_id: input.tenant_id,
      organization_id: input.organization_id,
      payload_reference: input.payload_reference,
      created_at: input.now,
      available_at: input.available_at,
      attempt_count: 0,
      status: "QUEUED",
      priority: input.priority,
      expires_at: addMilliseconds(input.now, input.ttl_ms),
      retry_history: [],
      failure_reason: null,
      dead_letter_reason: null,
      acked_at: null,
      completion_reason: null,
    };

    return {
      status: "QUEUED",
      message: await adapter.enqueue(message),
      errors: [],
    };
  } catch (error) {
    return failedEnqueue(error);
  }
}

export async function peek(
  adapter: RuntimeQueueAdapter,
  now: string = new Date().toISOString(),
): Promise<RuntimeQueueMessage | null> {
  return adapter.peek(now);
}

export async function dequeue(
  adapter: RuntimeQueueAdapter,
  now: string = new Date().toISOString(),
): Promise<RuntimeQueueDequeueResult> {
  try {
    const message = await adapter.dequeue(now);
    if (!message) {
      return {
        status: "EMPTY",
        message: null,
        errors: [],
      };
    }
    return {
      status: "PROCESSING",
      message,
      errors: [],
    };
  } catch (error) {
    return {
      status: "FAILED",
      message: null,
      errors: [messageFrom(error)],
    };
  }
}

export async function ack(
  adapter: RuntimeQueueAdapter,
  queueMessageId: string,
  completionReason = "processed",
  now: string = new Date().toISOString(),
): Promise<RuntimeQueueMessage | null> {
  return adapter.ack(queueMessageId, completionReason, now);
}

export async function retry(
  adapter: RuntimeQueueAdapter,
  queueMessageId: string,
  input: Required<RuntimeQueueRetryInput>,
  policy: RuntimeQueueRetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<RuntimeQueueMessage | null> {
  return adapter.retry(queueMessageId, input, policy);
}

export async function moveToDeadLetter(
  adapter: RuntimeQueueAdapter,
  queueMessageId: string,
  reason: string,
  now: string = new Date().toISOString(),
): Promise<RuntimeQueueMessage | null> {
  return adapter.deadLetter(queueMessageId, reason, now);
}

export async function purge(
  adapter: RuntimeQueueAdapter,
  now: string = new Date().toISOString(),
): Promise<RuntimeQueuePurgeResult> {
  return {
    purged_count: await adapter.purge(now),
  };
}

export async function queueStats(
  adapter: RuntimeQueueAdapter,
  now: string = new Date().toISOString(),
): Promise<RuntimeQueueStats> {
  return adapter.stats(now);
}

export class InMemoryRuntimeQueueAdapter implements RuntimeQueueAdapter {
  private readonly messages = new Map<string, RuntimeQueueMessage>();

  enqueue(message: RuntimeQueueMessage): RuntimeQueueMessage {
    const snapshot = cloneMessage(message);
    this.messages.set(snapshot.queue_message_id, snapshot);
    return cloneMessage(snapshot);
  }

  peek(now: string): RuntimeQueueMessage | null {
    this.expireUnavailable(now);
    const message = this.nextAvailable(now);
    return message ? cloneMessage(message) : null;
  }

  dequeue(now: string): RuntimeQueueMessage | null {
    this.expireUnavailable(now);
    const message = this.nextAvailable(now);
    if (!message) return null;
    const updated: RuntimeQueueMessage = {
      ...message,
      status: "PROCESSING",
      attempt_count: message.attempt_count + 1,
    };
    this.messages.set(updated.queue_message_id, cloneMessage(updated));
    return cloneMessage(updated);
  }

  ack(queueMessageId: string, completionReason: string, now: string): RuntimeQueueMessage | null {
    const message = this.messages.get(queueMessageId);
    if (!message) return null;
    const updated: RuntimeQueueMessage = {
      ...message,
      status: "ACKNOWLEDGED",
      acked_at: now,
      completion_reason: completionReason,
    };
    this.messages.set(queueMessageId, cloneMessage(updated));
    return cloneMessage(updated);
  }

  retry(
    queueMessageId: string,
    input: Required<RuntimeQueueRetryInput>,
    policy: RuntimeQueueRetryPolicy,
  ): RuntimeQueueMessage | null {
    const message = this.messages.get(queueMessageId);
    if (!message) return null;

    if (message.attempt_count >= policy.max_attempts || message.attempt_count >= policy.dead_letter_threshold) {
      return this.deadLetterWithHistory(message, input.failure_reason, input.now);
    }

    const nextAvailableAt = addMilliseconds(input.now, policy.retry_delay_ms);
    const updated: RuntimeQueueMessage = {
      ...message,
      status: "RETRY",
      available_at: nextAvailableAt,
      failure_reason: input.failure_reason,
      retry_history: [
        ...message.retry_history,
        {
          attempt: Math.max(message.attempt_count, 1),
          failed_at: input.now,
          failure_reason: input.failure_reason,
          next_available_at: nextAvailableAt,
        },
      ],
    };
    this.messages.set(queueMessageId, cloneMessage(updated));
    return cloneMessage(updated);
  }

  deadLetter(queueMessageId: string, reason: string, now: string): RuntimeQueueMessage | null {
    const message = this.messages.get(queueMessageId);
    if (!message) return null;
    return this.deadLetterWithHistory(message, reason, now);
  }

  stats(now: string): RuntimeQueueStats {
    this.expireUnavailable(now);
    const stats: RuntimeQueueStats = {
      queue_depth: 0,
      processing_count: 0,
      retry_count: 0,
      dead_letter_count: 0,
      expired_count: 0,
      acknowledged_count: 0,
      purged_count: 0,
    };
    for (const message of this.messages.values()) {
      if (message.status === "QUEUED") stats.queue_depth += 1;
      if (message.status === "PROCESSING") stats.processing_count += 1;
      if (message.status === "RETRY") stats.retry_count += 1;
      if (message.status === "DEAD_LETTER") stats.dead_letter_count += 1;
      if (message.status === "EXPIRED") stats.expired_count += 1;
      if (message.status === "ACKNOWLEDGED") stats.acknowledged_count += 1;
      if (message.status === "PURGED") stats.purged_count += 1;
    }
    return stats;
  }

  purge(_now: string): number {
    let purged = 0;
    for (const message of Array.from(this.messages.values())) {
      if (message.status === "ACKNOWLEDGED" || message.status === "EXPIRED" || message.status === "PURGED") {
        this.messages.delete(message.queue_message_id);
        purged += 1;
      }
    }
    return purged;
  }

  private nextAvailable(now: string): RuntimeQueueMessage | null {
    return Array.from(this.messages.values())
      .filter((message) => isAvailable(message, now))
      .sort(compareQueueMessages)[0] ?? null;
  }

  private expireUnavailable(now: string): void {
    for (const message of Array.from(this.messages.values())) {
      if (
        (message.status === "QUEUED" || message.status === "RETRY" || message.status === "PROCESSING") &&
        isExpired(message, now)
      ) {
        this.messages.set(message.queue_message_id, {
          ...message,
          status: "EXPIRED",
        });
      }
    }
  }

  private deadLetterWithHistory(
    message: RuntimeQueueMessage,
    reason: string,
    now: string,
  ): RuntimeQueueMessage {
    const updated: RuntimeQueueMessage = {
      ...message,
      status: "DEAD_LETTER",
      failure_reason: reason,
      dead_letter_reason: reason,
      retry_history: [
        ...message.retry_history,
        {
          attempt: Math.max(message.attempt_count, 1),
          failed_at: now,
          failure_reason: reason,
          next_available_at: null,
        },
      ],
    };
    this.messages.set(message.queue_message_id, cloneMessage(updated));
    return cloneMessage(updated);
  }
}

function normalizeEnqueueInput(
  input: RuntimeQueueEnqueueInput,
  now: string,
  defaultTtlMs: number,
): Required<RuntimeQueueEnqueueInput> {
  return {
    ...input,
    priority: input.priority ?? 0,
    now: input.now ?? now,
    available_at: input.available_at ?? input.now ?? now,
    ttl_ms: input.ttl_ms ?? defaultTtlMs,
  };
}

function failedEnqueue(error: unknown): RuntimeQueueEnqueueResult {
  return {
    status: "FAILED",
    message: null,
    errors: [messageFrom(error)],
  };
}

function isAvailable(message: RuntimeQueueMessage, now: string): boolean {
  return (
    (message.status === "QUEUED" || message.status === "RETRY") &&
    !isExpired(message, now) &&
    Date.parse(message.available_at) <= Date.parse(now)
  );
}

function isExpired(message: RuntimeQueueMessage, now: string): boolean {
  return Date.parse(message.expires_at) <= Date.parse(now);
}

function compareQueueMessages(a: RuntimeQueueMessage, b: RuntimeQueueMessage): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const createdDelta = Date.parse(a.created_at) - Date.parse(b.created_at);
  if (createdDelta !== 0) return createdDelta;
  return a.queue_message_id.localeCompare(b.queue_message_id);
}

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

function cloneMessage(message: RuntimeQueueMessage): RuntimeQueueMessage {
  return {
    ...message,
    retry_history: message.retry_history.map((entry) => ({ ...entry })),
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Minimal shape of an injected @supabase/supabase-js client needed by
 * `SupabaseRuntimeQueueAdapter`. Deliberately duplicated (rather than
 * imported) from the equivalent type in `runtime-persistence.ts` so AG-3D
 * stays independent of AG-3E, matching the existing module boundaries.
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
  in(column: string, values: unknown[]): SupabaseRuntimeFilterBuilder;
  lte(column: string, value: unknown): SupabaseRuntimeFilterBuilder;
  gt(column: string, value: unknown): SupabaseRuntimeFilterBuilder;
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
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<SupabaseRuntimeQueryResult<any>>;
}

const QUEUE_UNIQUE_VIOLATION = "23505";
const DEFAULT_VISIBILITY_TIMEOUT_MS = 30_000;

/**
 * GA-2: durable Postgres-backed implementation of the AG-3D queue
 * contract, backed by the `runtime_queue_messages` table. `dequeue()` uses
 * the `claim_runtime_queue_message` RPC (`FOR UPDATE SKIP LOCKED`) so
 * concurrent workers never claim the same message twice, and the same RPC
 * reclaims messages whose visibility timeout elapsed — the crash-recovery
 * path for a worker that dequeued a message and never called
 * ack/retry/deadLetter before dying.
 */
export class SupabaseRuntimeQueueAdapter implements RuntimeQueueAdapter {
  constructor(
    private readonly client: SupabaseRuntimeClient,
    private readonly visibilityTimeoutMs: number = DEFAULT_VISIBILITY_TIMEOUT_MS,
  ) {}

  async enqueue(message: RuntimeQueueMessage): Promise<RuntimeQueueMessage> {
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .insert(messageToRow(message))
      .select("*")
      .single();
    if (error) {
      if (error.code === QUEUE_UNIQUE_VIOLATION) {
        throw new Error(`queue message ${message.queue_message_id} already exists`);
      }
      throw new Error(`SupabaseRuntimeQueueAdapter.enqueue failed: ${error.message}`);
    }
    return rowToMessage(data);
  }

  async peek(now: string): Promise<RuntimeQueueMessage | null> {
    await this.client.rpc("expire_runtime_queue_messages", { p_now: now });
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .select("*")
      .in("status", ["QUEUED", "RETRY"])
      .lte("available_at", now)
      .gt("expires_at", now)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .order("queue_message_id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.peek failed: ${error.message}`);
    return data ? rowToMessage(data) : null;
  }

  async dequeue(now: string): Promise<RuntimeQueueMessage | null> {
    const { data, error } = await this.client.rpc("claim_runtime_queue_message", {
      p_now: now,
      p_visible_ms: this.visibilityTimeoutMs,
    });
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.dequeue failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? rowToMessage(row) : null;
  }

  async ack(queueMessageId: string, completionReason: string, now: string): Promise<RuntimeQueueMessage | null> {
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .update({ status: "ACKNOWLEDGED", acked_at: now, completion_reason: completionReason })
      .eq("queue_message_id", queueMessageId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.ack failed: ${error.message}`);
    return data ? rowToMessage(data) : null;
  }

  async retry(
    queueMessageId: string,
    input: Required<RuntimeQueueRetryInput>,
    policy: RuntimeQueueRetryPolicy,
  ): Promise<RuntimeQueueMessage | null> {
    const existing = await this.getRow(queueMessageId);
    if (!existing) return null;

    if (existing.attempt_count >= policy.max_attempts || existing.attempt_count >= policy.dead_letter_threshold) {
      return this.deadLetterRow(existing, input.failure_reason, input.now);
    }

    const nextAvailableAt = addMilliseconds(input.now, policy.retry_delay_ms);
    const retryHistory = [
      ...(existing.retry_history ?? []),
      {
        attempt: Math.max(existing.attempt_count, 1),
        failed_at: input.now,
        failure_reason: input.failure_reason,
        next_available_at: nextAvailableAt,
      },
    ];
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .update({
        status: "RETRY",
        available_at: nextAvailableAt,
        failure_reason: input.failure_reason,
        retry_history: retryHistory,
      })
      .eq("queue_message_id", queueMessageId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.retry failed: ${error.message}`);
    return data ? rowToMessage(data) : null;
  }

  async deadLetter(queueMessageId: string, reason: string, now: string): Promise<RuntimeQueueMessage | null> {
    const existing = await this.getRow(queueMessageId);
    if (!existing) return null;
    return this.deadLetterRow(existing, reason, now);
  }

  private async deadLetterRow(existing: any, reason: string, now: string): Promise<RuntimeQueueMessage | null> {
    const retryHistory = [
      ...(existing.retry_history ?? []),
      {
        attempt: Math.max(existing.attempt_count, 1),
        failed_at: now,
        failure_reason: reason,
        next_available_at: null,
      },
    ];
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .update({
        status: "DEAD_LETTER",
        failure_reason: reason,
        dead_letter_reason: reason,
        retry_history: retryHistory,
      })
      .eq("queue_message_id", existing.queue_message_id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.deadLetter failed: ${error.message}`);
    return data ? rowToMessage(data) : null;
  }

  private async getRow(queueMessageId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .select("*")
      .eq("queue_message_id", queueMessageId)
      .maybeSingle();
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.getRow failed: ${error.message}`);
    return data ?? null;
  }

  async stats(now: string): Promise<RuntimeQueueStats> {
    await this.client.rpc("expire_runtime_queue_messages", { p_now: now });
    const { data, error } = await this.client.from("runtime_queue_messages").select("status");
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.stats failed: ${error.message}`);

    const stats: RuntimeQueueStats = {
      queue_depth: 0,
      processing_count: 0,
      retry_count: 0,
      dead_letter_count: 0,
      expired_count: 0,
      acknowledged_count: 0,
      purged_count: 0,
    };
    for (const row of data ?? []) {
      if (row.status === "QUEUED") stats.queue_depth += 1;
      if (row.status === "PROCESSING") stats.processing_count += 1;
      if (row.status === "RETRY") stats.retry_count += 1;
      if (row.status === "DEAD_LETTER") stats.dead_letter_count += 1;
      if (row.status === "EXPIRED") stats.expired_count += 1;
      if (row.status === "ACKNOWLEDGED") stats.acknowledged_count += 1;
    }
    return stats;
  }

  async purge(_now: string): Promise<number> {
    const { data, error } = await this.client
      .from("runtime_queue_messages")
      .delete()
      .in("status", ["ACKNOWLEDGED", "EXPIRED", "PURGED"])
      .select("queue_message_id");
    if (error) throw new Error(`SupabaseRuntimeQueueAdapter.purge failed: ${error.message}`);
    return (data ?? []).length;
  }
}

function messageToRow(message: RuntimeQueueMessage): Record<string, unknown> {
  return {
    queue_message_id: message.queue_message_id,
    correlation_id: message.correlation_id,
    idempotency_key: message.idempotency_key,
    request_hash: message.request_hash,
    tenant_id: message.tenant_id,
    organization_id: message.organization_id,
    payload_reference: message.payload_reference,
    created_at: message.created_at,
    available_at: message.available_at,
    attempt_count: message.attempt_count,
    status: message.status,
    priority: message.priority,
    expires_at: message.expires_at,
    retry_history: message.retry_history,
    failure_reason: message.failure_reason,
    dead_letter_reason: message.dead_letter_reason,
    acked_at: message.acked_at,
    completion_reason: message.completion_reason,
  };
}

function rowToMessage(row: any): RuntimeQueueMessage {
  return {
    queue_message_id: row.queue_message_id,
    correlation_id: row.correlation_id,
    idempotency_key: row.idempotency_key,
    request_hash: row.request_hash,
    tenant_id: row.tenant_id,
    organization_id: row.organization_id,
    payload_reference: row.payload_reference,
    created_at: row.created_at,
    available_at: row.available_at,
    attempt_count: row.attempt_count,
    status: row.status,
    priority: row.priority,
    expires_at: row.expires_at,
    retry_history: row.retry_history ?? [],
    failure_reason: row.failure_reason,
    dead_letter_reason: row.dead_letter_reason,
    acked_at: row.acked_at,
    completion_reason: row.completion_reason,
  };
}
