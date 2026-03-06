# ⚡ Production Performance Optimization Guide

**Last Updated**: March 6, 2026  
**Version**: 1.0.0

---

## 🎯 Performance Targets

**Service Level Agreement (SLA)**:
- ✅ Availability: 99.9% uptime
- ✅ Latency p50: < 200ms
- ✅ Latency p95: < 500ms  
- ✅ Latency p99: < 1 second
- ✅ Error rate: < 0.1%
- ✅ Success rate: > 99.9%

**User-Facing Targets**:
- ✅ Dashboard load: < 2 seconds
- ✅ Decision creation: < 500ms
- ✅ Data upload: < 1 second per 100 rows
- ✅ Calibration run: < 5 seconds
- ✅ Report generation: < 30 seconds

---

## 🔍 Identifying Performance Issues

### Step 1: Measure Current Performance

```bash
# Get latency percentiles
kubectl logs deployment/quantivis-production -n quantivis-production | \
  grep -oP 'duration=\K[0-9]+' | \
  sort -n | \
  awk '{a[NR]=$1} END {
    print "p50: " a[int(NR*0.5)];
    print "p95: " a[int(NR*0.95)];
    print "p99: " a[int(NR*0.99)];
  }'

# Get error rate
ERRORS=$(kubectl logs deployment/quantivis-production -n quantivis-production | grep ERROR | wc -l)
TOTAL=$(kubectl logs deployment/quantivis-production -n quantivis-production | wc -l)
echo "Error rate: $((ERRORS * 100 / TOTAL))%"

# Get most common endpoints
kubectl logs deployment/quantivis-production -n quantivis-production | \
  grep -oP 'path=\K[^ ]+' | \
  sort | uniq -c | sort -rn | head -10
```

### Step 2: Profile the Application

```bash
# CPU profiling (Node.js)
kubectl set env deployment/quantivis-production \
  NODE_OPTIONS="--prof" \
  -n quantivis-production

# Wait for profile
sleep 60

# Extract and process
kubectl cp quantivis-production/quantivis-xxx:isolate*.log ./profile.log
node --prof-process profile.log > processed.txt

# Look for:
# - Functions taking > 50% of time
# - Functions called frequently but inefficiently
```

### Step 3: Identify Bottlenecks

```bash
# Database query performance
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT query, calls, mean_exec_time, max_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC 
LIMIT 20;
EOF

# Cache hit rate
redis-cli --stat

# Memory allocations
kubectl top pods -n quantivis-production --containers

# Network I/O
kubectl logs deployment/quantivis-production -n quantivis-production | \
  grep -oP 'response_size=\K[0-9]+' | \
  awk '{sum+=$0} END {printf "AVG: %d bytes\n", sum/NR}'
```

---

## 🚀 Optimization Opportunities

### 1. **Database Query Optimization** (High Impact)

**Problem**: Slow queries blocking requests  
**Impact**: Can save 100-500ms per request

```bash
# Find slowest queries
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT query, calls, mean_exec_time FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC LIMIT 5;
EOF

# Analyze query plan
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
EXPLAIN ANALYZE
SELECT * FROM decisions 
WHERE organization_id = $1 
AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
EOF
```

**Solutions**:

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_decisions_org_date ON decisions(organization_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_audit_log_org_date ON audit_log(organization_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_users_org ON users(organization_id);

-- Denormalize if reads >> writes
ALTER TABLE decisions ADD COLUMN cached_confidence_score NUMERIC;
UPDATE decisions SET cached_confidence_score = (SELECT AVG(score) FROM scores WHERE decision_id = decisions.id);

-- Partition large tables
ALTER TABLE audit_log SET (autovacuum_vacuum_scale_factor = 0.05);

-- Statistics update
ANALYZE;
VACUUM ANALYZE;
```

### 2. **Caching Strategy** (High Impact)

**Problem**: Repeated database queries  
**Impact**: Can save 50-200ms per request

```typescript
// In-memory cache for frequently accessed data
const cache = new Map<string, CachedData>();

cache.set(`org:${orgId}`, {
  data: organizationData,
  expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
});

// Check cache first
function getOrganization(orgId: string) {
  const cached = cache.get(`org:${orgId}`);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  
  const data = await db.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
  cache.set(`org:${orgId}`, { data, expiresAt: Date.now() + 5 * 60 * 1000 });
  return data;
}

// Or use Redis for distributed cache
const redis = new Redis();

async function getOrganization(orgId: string) {
  const cached = await redis.get(`org:${orgId}`);
  if (cached) return JSON.parse(cached);
  
  const data = await db.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
  await redis.setex(`org:${orgId}`, 300, JSON.stringify(data)); // 5 min TTL
  return data;
}
```

**General Strategy**:
- Cache: Decisions (5 min), Organizations (5 min), Calibrations (1 hour)
- Don't cache: User preferences, Real-time metrics
- Invalidate on: Write operations, User preference changes
- Monitor: Cache hit rate, memory usage

### 3. **API Response Optimization** (Medium Impact)

**Problem**: Large JSON responses  
**Impact**: Can save 50-100ms per request + bandwidth

```typescript
// 1. Selective fields - don't return all columns
async function getDecision(id: string) {
  // Bad: returns all 50 columns
  return db.query('SELECT * FROM decisions WHERE id = $1', [id]);
  
  // Good: return only needed fields
  return db.query(`
    SELECT id, title, description, status, created_at, updated_at 
    FROM decisions 
    WHERE id = $1
  `, [id]);
}

// 2. Pagination - don't return all results
async function listDecisions(orgId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  return db.query(`
    SELECT id, title, status, created_at 
    FROM decisions 
    WHERE organization_id = $1 
    ORDER BY created_at DESC 
    LIMIT $2 OFFSET $3
  `, [orgId, limit, offset]);
}

// 3. Lazy loading - load related data on demand
async function getDecisionWithScores(id: string) {
  const decision = await db.query('SELECT * FROM decisions WHERE id = $1', [id]);
  
  // Only load scores if requested
  if (includeScores) {
    const scores = await db.query('SELECT * FROM scores WHERE decision_id = $1', [id]);
    decision.scores = scores;
  }
  
  return decision;
}

// 4. Compression - enable gzip on API responses
app.use(compression({
  level: 6, // Balance between speed and compression (1-9)
  threshold: 100, // Only compress responses > 100 bytes
}));
```

### 4. **Frontend Optimization** (Medium Impact)

**Problem**: Large bundle size, inefficient rendering  
**Impact**: Can improve first load by 1-2 seconds

```typescript
// 1. Code splitting - load components on demand
const Dashboard = lazy(() => import('./Dashboard'));
const Analytics = lazy(() => import('./Analytics'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}

// 2. Bundle size reduction
// Check bundle: bun build --analyze
// Tools: webpack-bundle-analyzer, source-map-explorer

// 3. Memoization - prevent unnecessary re-renders
const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  return <div>{/* rendering logic */}</div>;
});

// 4. Virtual lists - only render visible items
function LargeList({ items }) {
  return (
    <VirtualList
      items={items}
      height={600}
      itemHeight={50}
    />
  );
}

// 5. Image optimization
import { svelte } from 'vite-plugin-svelte';
export default {
  plugins: [
    imageOptimizer({
      minWidth: 600,
      formats: ['avif', 'webp', 'jpeg']
    })
  ]
}

// 6. CSS optimization - remove unused styles
// TailwindCSS config: purge: ['./src/**/*.{ts,tsx}']
```

### 5. **Connection Pooling** (Medium Impact)

**Problem**: Overhead from new connections  
**Impact**: Can save 10-50ms per request

```typescript
// Configure connection pool
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool settings
  max: 20, // Maximum connections
  min: 10, // Minimum connections
  idleTimeoutMillis: 30000, // Idle timeout
  connectionTimeoutMillis: 5000, // Connection timeout
  
  // Enable query queuing if pool exhausted
  application_name: 'quantivis-api'
});

// Monitor pool
setInterval(() => {
  console.log(`Pool size: ${pool._clients.length}, Idle: ${pool._idle.length}, Waiting: ${pool._queue.length}`);
}, 60000);
```

### 6. **Reduce N+1 Queries** (High Impact)

**Problem**: Fetching related data in loops  
**Impact**: Can save 100ms-5s depending on data size

```typescript
// Bad: N+1 queries
async function getDecisionsWithMetrics(orgId: string) {
  const decisions = await db.query(
    'SELECT id, title FROM decisions WHERE organization_id = $1', 
    [orgId]
  );
  
  for (let decision of decisions) {
    // This query runs for EACH decision!
    decision.metrics = await db.query(
      'SELECT * FROM metrics WHERE decision_id = $1',
      [decision.id]
    );
  }
  
  return decisions;
}

// Good: Single query with JOIN
async function getDecisionsWithMetrics(orgId: string) {
  return db.query(`
    SELECT 
      d.id, d.title,
      json_agg(json_build_object('id', m.id, 'value', m.value)) AS metrics
    FROM decisions d
    LEFT JOIN metrics m ON d.id = m.decision_id
    WHERE d.organization_id = $1
    GROUP BY d.id, d.title
  `, [orgId]);
}

// Or use batch loading
import DataLoader from 'dataloader';

const metricsLoader = new DataLoader(async (decisionIds) => {
  const metrics = await db.query(
    'SELECT decision_id, json_agg(json_build_object(...)) FROM metrics WHERE decision_id = ANY($1) GROUP BY decision_id',
    [decisionIds]
  );
  return decisionIds.map(id => metrics.find(m => m.decision_id === id) || []);
});

async function getDecisionsWithMetrics(orgId: string) {
  const decisions = await db.query(
    'SELECT id, title FROM decisions WHERE organization_id = $1',
    [orgId]
  );
  
  for (let decision of decisions) {
    decision.metrics = await metricsLoader.load(decision.id);
  }
  
  return decisions;
}
```

### 7. **Lazy Load Heavy Computations** (Medium Impact)

**Problem**: Expensive calculations blocking requests  
**Impact**: Can save 100ms-1s per request

```typescript
// Bad: Calculate on request
app.get('/metrics', async (req, res) => {
  const metrics = await expensiveAggregation(); // Takes 5 seconds!
  res.json(metrics);
});

// Good: Calculate in background
let cachedMetrics = null;
let metricsRefreshTime = null;

// Refresh every 5 minutes in background
setInterval(async () => {
  cachedMetrics = await expensiveAggregation();
  metricsRefreshTime = Date.now();
}, 5 * 60 * 1000);

app.get('/metrics', (req, res) => {
  if (!cachedMetrics) {
    return res.status(202).json({ message: 'Metrics being calculated...' });
  }
  res.json({ ...cachedMetrics, refreshedAt: metricsRefreshTime });
});

// Or use job queue
import Queue from 'bull';

const metricsQueue = new Queue('metrics-calculation');

metricsQueue.process(async (job) => {
  const metrics = await expensiveAggregation();
  await cache.set('metrics', metrics);
  return metrics;
});

// Schedule job
metricsQueue.add({}, { repeat: { every: 5 * 60 * 1000 } });

app.get('/metrics', async (req, res) => {
  const metrics = await cache.get('metrics');
  res.json(metrics);
});
```

### 8. **Increase Resource Limits** (Quick Fix, Not Recommended Long-term)

**Problem**: Resource-constrained pods  
**Impact**: Can stop OOMKills and throttling

```bash
# Scale horizontally (better)
kubectl scale deployment quantivis-production --replicas=10 -n quantivis-production

# Increase per-pod resources (only if justified by profiling)
kubectl set resources deployment/quantivis-production \
  --requests=cpu=500m,memory=512Mi \
  --limits=cpu=1000m,memory=1Gi \
  -n quantivis-production

# Verify HPA is enabled
kubectl get hpa -n quantivis-production
```

---

## 📊 Optimization Impact Analysis

| Optimization | Effort | Impact | Priority |
|--------------|--------|--------|----------|
| Add indexes | Low | 100ms | 🔴 P1 |
| Redis cache | Medium | 50-100ms | 🔴 P1 |
| API response optimization | Low | 10-50ms | 🟡 P2 |
| Frontend bundling | Medium | 1-2s | 🟡 P2 |
| Connection pooling | Low | 10-50ms | 🟡 P2 |
| Reduce N+1 | Medium | 100ms-1s | 🔴 P1 |
| Lazy load computations | Medium | 100ms-1s | 🟡 P2 |
| Increase resources | Low | Stop crashes | 🔴 P1 |

---

## 🔄 Performance Regression Testing

```bash
# Before and after latency comparison
# Run benchmark before change
k6 run load-test.js --out json=before.json

# Apply optimization
# Run benchmark after change
k6 run load-test.js --out json=after.json

# Compare results
# after.json response_time should be < before.json response_time
```

---

## 📈 Long-term Performance Strategy

1. **Measure regularly**: Set up alerts for performance regressions
2. **Profile systematically**: Use tools to identify bottlenecks
3. **Optimize iteratively**: Fix highest-impact issues first
4. **Scale horizontally**: Add more pods before adding resources
5. **Monitor trends**: Track performance over time
6. **Plan for growth**: Design for 10x

---

## 🆘 Performance Emergency

If p95 latency suddenly > 2 seconds:

```bash
# 1. Check for resource issues
kubectl top pods -n quantivis-production

# 2. Check database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 3. Check for traffic spike
kubectl logs deployment/quantivis-production -n quantivis-production | \
  grep -c "GET\|POST\|PUT\|DELETE"

# 4. Quick fixes:
# - Scale up: kubectl scale deployment quantivis-production --replicas=10 -n quantivis-production
# - Clear cache: redis-cli FLUSHALL (DANGEROUS!)
# - Restart pods: kubectl rollout restart deployment/quantivis-production -n quantivis-production

# 5. Investigate root cause while serving traffic
```

---

## 📚 References

- [Kubernetes Performance Tuning](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Analysis_Tools)
- [Node.js Profiling](https://nodejs.org/en/docs/guides/simple-profiling/)
- [React Performance](https://react.dev/reference/react/memo)
- [Web Vitals](https://web.dev/vitals/)
