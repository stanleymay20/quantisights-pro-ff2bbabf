/**
 * A minimal in-process fake of the @supabase/supabase-js client surface
 * used by the GA-2 durable adapters (`SupabaseRuntimePersistence`,
 * `SupabaseRuntimeQueueAdapter`, `SupabaseIdempotencyStoreAdapter`).
 *
 * This is not a mock of the adapters — it is a faithful-enough simulation
 * of the actual Postgres schema and RPCs defined in
 * `supabase/migrations/20260710124500_ga2_durable_runtime_infrastructure.sql`:
 * unique constraints raise Postgres error code 23505, `claim_runtime_queue_message`
 * atomically claims one row with the same ordering as the real SQL
 * function, and `expire_runtime_queue_messages` performs the same
 * visibility-timeout/TTL sweep. Because the row storage lives in this
 * module's `FakeRuntimeDatabase` instance rather than inside any adapter
 * object, constructing a *new* adapter against the *same* database instance
 * faithfully simulates a process restart: the adapter has no memory of its
 * own, all state lives in "the database".
 */

export interface FakeQueryError {
  message: string;
  code?: string;
}

export interface FakeQueryResult<T> {
  data: T | null;
  error: FakeQueryError | null;
}

type Row = Record<string, any>;

interface UniqueConstraint {
  columns: string[];
  /** Only enforced for rows matching this predicate (partial unique index). */
  when?: (row: Row) => boolean;
}

class FakeTable {
  private rows: Row[] = [];

  constructor(
    private readonly name: string,
    private readonly primaryKey: string | string[],
    private readonly uniques: UniqueConstraint[] = [],
  ) {}

  private violatesUnique(candidate: Row, excludePk?: unknown): boolean {
    const pkCols = Array.isArray(this.primaryKey) ? this.primaryKey : [this.primaryKey];
    const constraints: UniqueConstraint[] = [{ columns: pkCols }, ...this.uniques];
    return this.rows.some((row) => {
      if (excludePk !== undefined && pkCols.length === 1 && row[pkCols[0]] === excludePk) return false;
      return constraints.some((constraint) => {
        if (constraint.when && !constraint.when(candidate)) return false;
        if (constraint.when && !constraint.when(row)) return false;
        return constraint.columns.every((col) => row[col] === candidate[col]);
      });
    });
  }

  insert(row: Row): FakeQueryResult<Row> {
    if (this.violatesUnique(row)) {
      return { data: null, error: { message: `duplicate key value violates unique constraint on ${this.name}`, code: "23505" } };
    }
    const stored = { ...row };
    this.rows.push(stored);
    return { data: { ...stored }, error: null };
  }

  all(): Row[] {
    return this.rows.map((row) => ({ ...row }));
  }

  updateWhere(predicate: (row: Row) => boolean, changes: Row): Row[] {
    const updated: Row[] = [];
    this.rows = this.rows.map((row) => {
      if (!predicate(row)) return row;
      const next = { ...row, ...changes };
      updated.push({ ...next });
      return next;
    });
    return updated;
  }

  deleteWhere(predicate: (row: Row) => boolean): Row[] {
    const removed: Row[] = [];
    this.rows = this.rows.filter((row) => {
      if (predicate(row)) {
        removed.push({ ...row });
        return false;
      }
      return true;
    });
    return removed;
  }
}

type FilterFn = (row: Row) => boolean;

class FakeFilterBuilder implements PromiseLike<FakeQueryResult<any>> {
  private filters: FilterFn[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;

  constructor(
    private readonly table: FakeTable,
    private readonly mode: "select" | "insert" | "update" | "delete",
    private readonly payload: Row | undefined,
  ) {}

  eq(column: string, value: unknown): FakeFilterBuilder {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]): FakeFilterBuilder {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  lte(column: string, value: unknown): FakeFilterBuilder {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && row[column] <= value);
    return this;
  }

  gt(column: string, value: unknown): FakeFilterBuilder {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && row[column] > value);
    return this;
  }

  is(column: string, value: unknown): FakeFilterBuilder {
    this.filters.push((row) => (value === null ? row[column] === null || row[column] === undefined : row[column] === value));
    return this;
  }

  or(expression: string): FakeFilterBuilder {
    const clauses = expression.split(",").map((clause) => {
      const [column, op, ...rest] = clause.split(".");
      const value = rest.join(".");
      return (row: Row) => {
        if (op === "eq") return row[column] === value;
        if (op === "lte") return row[column] !== null && row[column] !== undefined && row[column] <= value;
        return false;
      };
    });
    this.filters.push((row) => clauses.some((clause) => clause(row)));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): FakeFilterBuilder {
    this.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  limit(count: number): FakeFilterBuilder {
    this.limitCount = count;
    return this;
  }

  select(_columns?: string): FakeFilterBuilder {
    return this;
  }

  async single(): Promise<FakeQueryResult<any>> {
    const result = await this.run();
    if (result.error) return result;
    const rows = result.data as Row[];
    if (rows.length !== 1) {
      return { data: null, error: { message: `expected exactly one row, got ${rows.length}` } };
    }
    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<FakeQueryResult<any>> {
    const result = await this.run();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data as Row[];
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = FakeQueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: FakeQueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => filter(row));
  }

  private async run(): Promise<FakeQueryResult<Row[]>> {
    if (this.mode === "insert") {
      const result = this.table.insert(this.payload ?? {});
      return { data: result.data ? [result.data] : null, error: result.error };
    }
    if (this.mode === "update") {
      const updated = this.table.updateWhere((row) => this.matches(row), this.payload ?? {});
      return { data: updated, error: null };
    }
    if (this.mode === "delete") {
      const removed = this.table.deleteWhere((row) => this.matches(row));
      return { data: removed, error: null };
    }
    let rows = this.table.all().filter((row) => this.matches(row));
    for (const { column, ascending } of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        if (a[column] === b[column]) return 0;
        const cmp = a[column] < b[column] ? -1 : 1;
        return ascending ? cmp : -cmp;
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return { data: rows, error: null };
  }
}

export class FakeRuntimeDatabase {
  readonly runtime_executions = new FakeTable("runtime_executions", "id", [{ columns: ["tenant_id", "execution_id"] }]);
  readonly runtime_events = new FakeTable("runtime_events", "event_id", [
    { columns: ["tenant_id", "execution_id", "sequence_number"] },
  ]);
  readonly runtime_audit_records = new FakeTable("runtime_audit_records", "audit_id", [
    { columns: ["tenant_id", "previous_audit_hash"], when: (row) => row.previous_audit_hash !== null && row.previous_audit_hash !== undefined },
    { columns: ["tenant_id"], when: (row) => row.previous_audit_hash === null || row.previous_audit_hash === undefined },
  ]);
  readonly runtime_queue_snapshots = new FakeTable("runtime_queue_snapshots", "snapshot_id");
  readonly runtime_queue_messages = new FakeTable("runtime_queue_messages", "queue_message_id");
  readonly runtime_idempotency_keys = new FakeTable("runtime_idempotency_keys", "idempotency_key");
  private idCounter = 0;

  private tableFor(name: string): FakeTable {
    const table = (this as unknown as Record<string, FakeTable>)[name];
    if (!table) throw new Error(`unknown fake table ${name}`);
    return table;
  }

  from(name: string) {
    const table = this.tableFor(name);
    const withDefaults = (row: Row): Row => {
      if (name === "runtime_executions" && row.id === undefined) return { ...row, id: `exec-row-${++this.idCounter}` };
      return row;
    };
    return {
      select: (columns?: string) => new FakeFilterBuilder(table, "select", undefined).select(columns),
      insert: (values: Row) => new FakeFilterBuilder(table, "insert", withDefaults(values)),
      update: (values: Row) => new FakeFilterBuilder(table, "update", values),
      delete: () => new FakeFilterBuilder(table, "delete", undefined),
    };
  }

  async rpc(fn: string, params: Record<string, unknown> = {}): Promise<FakeQueryResult<any>> {
    if (fn === "expire_runtime_queue_messages") {
      const count = this.expireQueueMessages(String(params.p_now));
      return { data: count, error: null };
    }
    if (fn === "claim_runtime_queue_message") {
      const now = String(params.p_now);
      const visibleMs = Number(params.p_visible_ms ?? 30_000);
      this.expireQueueMessages(now);

      const claimable = this.runtime_queue_messages
        .all()
        .filter((row) => (row.status === "QUEUED" || row.status === "RETRY") && row.available_at <= now && row.expires_at > now)
        .sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
          return a.queue_message_id < b.queue_message_id ? -1 : 1;
        });
      const next = claimable[0];
      if (!next) return { data: [], error: null };

      const visibleAt = new Date(Date.parse(now) + visibleMs).toISOString();
      const updated = this.runtime_queue_messages.updateWhere(
        (row) => row.queue_message_id === next.queue_message_id,
        { status: "PROCESSING", attempt_count: next.attempt_count + 1, visible_at: visibleAt },
      );
      return { data: updated, error: null };
    }
    throw new Error(`unknown fake rpc ${fn}`);
  }

  private expireQueueMessages(now: string): number {
    let count = 0;
    count += this.runtime_queue_messages.updateWhere(
      (row) => row.status === "PROCESSING" && row.visible_at != null && row.visible_at <= now,
      { status: "QUEUED", visible_at: null },
    ).length;
    count += this.runtime_queue_messages.updateWhere(
      (row) => (row.status === "QUEUED" || row.status === "RETRY") && row.expires_at <= now,
      { status: "EXPIRED" },
    ).length;
    return count;
  }
}
