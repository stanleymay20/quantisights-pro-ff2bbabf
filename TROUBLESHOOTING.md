# 🔧 Production Troubleshooting Guide

**Last Updated**: March 6, 2026  
**Version**: 1.0.0

---

## 🚀 Quick Diagnostics

### Health Check Script

```bash
#!/bin/bash
# Run this when something feels wrong

echo "🔍 Quantivis Production Diagnostics"
echo "======================================"

# 1. Cluster health
echo -n "Cluster: "
kubectl cluster-info | grep -q "is running" && echo "✅" || echo "❌"

# 2. Pod status
echo -n "Pods: "
POD_COUNT=$(kubectl get pods -n quantivis-production --no-headers | wc -l)
READY_COUNT=$(kubectl get pods -n quantivis-production -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | tr ' ' '\n' | grep true | wc -l)
echo "$READY_COUNT/$POD_COUNT ready"

# 3. API health
echo -n "API: "
curl -s -I https://api.quantivis.io/health | grep -q "200 OK" && echo "✅" || echo "❌"

# 4. Database connectivity
echo -n "Database: "
kubectl exec -it deployment/quantivis-production -n quantivis-production -- \
  psql -h $DB_HOST -U postgres -d quantivis -c "SELECT 1" &>/dev/null && echo "✅" || echo "❌"

# 5. Recent errors
echo -n "Errors (5m): "
ERROR_COUNT=$(kubectl logs deployment/quantivis-production -n quantivis-production --tail=500 | grep -i error | wc -l)
echo "$ERROR_COUNT"

echo ""
echo "Run: kubectl logs -f deployment/quantivis-production -n quantivis-production"
```

---

## 🐛 Common Issues & Solutions

### Issue: Service Returns 502 Bad Gateway

**Symptoms:**
- Browser shows: "502 Bad Gateway"
- nginx logs show: `upstream timed out`

**Diagnosis:**
```bash
# 1. Check if pods are running
kubectl get pods -n quantivis-production

# 2. Check pod logs for startup errors
kubectl logs pod/quantivis-production-xxx -n quantivis-production

# 3. Check if pod is passing readiness probe
kubectl describe pod/quantivis-production-xxx -n quantivis-production | grep -A 5 "Readiness"
```

**Solutions:**
```bash
# If pod is CrashLooping:
kubectl logs pod/quantivis-production-xxx -n quantivis-production | tail -50

# Common causes:
# 1. Missing env variable
kubectl set env deployment/quantivis-production --from=secret/quantivis-secrets -n quantivis-production

# 2. Port already in use (unlikely, but check)
kubectl get pod -o wide -n quantivis-production

# 3. Database migration failed
kubectl logs pod/quantivis-production-xxx -c migrations -n quantivis-production

# 4. Application crash - check for OOM
kubectl describe pod/quantivis-production-xxx | grep -i oom
```

---

### Issue: High Memory Usage / OOM Kills

**Symptoms:**
- Pods restart frequently
- kubectl describe shows: `OOMKilled`
- Logs mention: "memory exhausted"

**Diagnosis:**
```bash
# Check memory usage per pod
kubectl top pods -n quantivis-production --containers

# Check memory trends
kubectl logs pod/quantivis-production-xxx -n quantivis-production | grep -i memory | tail -20

# Check for memory leaks in application
# Look for patterns like:
# - Unbounded cache growth
# - Event listeners not unregistered
# - Circular references in data structures
```

**Solutions:**
```bash
# 1. Increase memory limit
kubectl set resources deployment/quantivis-production \
  --limits=memory=2Gi \
  --requests=memory=1Gi \
  -n quantivis-production

# 2. Enable memory profiling to find leak
# Add to environment:
kubectl set env deployment/quantivis-production \
  NODE_DEBUG=heapsnapshot \
  -n quantivis-production

# 3. Check for memory leak in application code
# Compare heap snapshots over time

# 4. If persistent, restart pod (will trigger new instance)
kubectl rollout restart deployment/quantivis-production -n quantivis-production
```

---

### Issue: Database Queries Timing Out

**Symptoms:**
- API returns: "Connection timeout"
- Logs show: `database connection timeout`
- Response time suddenly increases

**Diagnosis:**
```bash
# 1. Check database connectivity
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  psql -h $DB_HOST -U postgres -d quantivis -c "SELECT 1"

# 2. Check connection pool status
kubectl logs deployment/quantivis-production -n quantivis-production | grep -i "pool"

# 3. Check for slow queries
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
EOF

# 4. Check table sizes (might need indexing)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
ORDER BY pg_total_relation_size DESC 
LIMIT 10;
EOF

# 5. Check active connections
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
SELECT state, count(*) FROM pg_stat_activity WHERE datname='quantivis' GROUP BY state;
EOF
```

**Solutions:**
```bash
# 1. If connection pool exhausted, increase pool size
kubectl set env deployment/quantivis-production \
  DB_POOL_SIZE=50 \
  -n quantivis-production

# 2. If slow queries, optimize them
# Get query plan:
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
EXPLAIN ANALYZE SELECT ...;
EOF

# 3. Add missing indexes (shown in EXPLAIN output)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
CREATE INDEX idx_decisions_org_id ON decisions(organization_id);
EOF

# 4. Kill long-running queries that aren't needed
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT pg_cancel_backend(pid) FROM pg_stat_activity 
WHERE duration > interval '5 minutes' AND state = 'active';
EOF

# 5. Restart connection pool in app
kubectl set env deployment/quantivis-production \
  DB_POOL_RESET=$(date +%s) \
  -n quantivis-production
```

---

### Issue: High CPU Usage

**Symptoms:**
- CPU constantly > 70%
- Response time increases
- Nodes becoming hot

**Diagnosis:**
```bash
# Check CPU usage per pod
kubectl top pods -n quantivis-production --containers

# Check CPU trends
kubectl logs deployment/quantivis-production -n quantivis-production | grep -i "cpu" | tail -20

# Profile the application
# In Node.js/Deno, enable profiling:
kubectl set env deployment/quantivis-production \
  NODE_OPTIONS="--prof" \
  -n quantivis-production

# Wait for profile to generate, then extract
kubectl cp quantivis-production/quantivis-xxx:isolate-*.log ./profile.log
node --prof-process profile.log > processed.txt
```

**Solutions:**
```bash
# 1. Look for CPU-intensive operations
# Check for:
# - Unoptimized loops
# - Missing caching
# - Inefficient algorithms

# 2. Scale horizontally
kubectl scale deployment quantivis-production --replicas=10 -n quantivis-production

# 3. Optimize hot code paths
# Profile shows what's consuming CPU
# Usually: sorting large arrays, regex operations, JSON parsing

# 4. Cache expensive computations
# For example: decision filtering, metric calculation

# 5. Use database query optimization
# Offload computation to database

# 6. If temporary spike, monitor
# HPA should automatically scale: kubectl get hpa -n quantivis-production
```

---

### Issue: Authentication Failures

**Symptoms:**
- Users cannot login
- Logs show: "Invalid credentials"
- Session tokens not working

**Diagnosis:**
```bash
# Check auth service logs
kubectl logs deployment/quantivis-production -n quantivis-production | grep -i "auth\|login"

# Check if auth secrets are mounted
kubectl describe pod/quantivis-production-xxx -n quantivis-production | grep -A 5 Mounts

# Verify secret values exist
kubectl get secret quantivis-secrets -n quantivis-production -o yaml

# Check if secret values are correct (DANGEROUS - reveals secrets)
# kubectl get secret quantivis-secrets -n quantivis-production -o jsonpath='{.data.supabase-url}' | base64 -d
```

**Solutions:**
```bash
# 1. If secret missing, create it
kubectl create secret generic quantivis-secrets \
  --from-literal=supabase-url=https://... \
  --from-literal=supabase-key=... \
  -n quantivis-production

# 2. Restart pods to pick up secrets
kubectl rollout restart deployment/quantivis-production -n quantivis-production

# 3. If still failing, check auth provider (Supabase)
# Is Supabase service up?
curl -I https://your-supabase-project.supabase.co

# 4. Check RLS policies in database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT schemaname, tablename, policyname FROM pg_policies LIMIT 5;
EOF

# 5. If RLS policy broken, disable temporarily
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
EOF
# (Re-enable after fixing: ALTER TABLE users ENABLE ROW LEVEL SECURITY;)
```

---

### Issue: Data Missing / Inconsistent

**Symptoms:**
- Expected data not visible
- Different users seeing different data
- Writes not persisting

**Diagnosis:**
```bash
# Check if database is writable
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT usename, usecanlogin FROM pg_user;
EOF

# Check for replication lag
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT replica_name, client_addr, state, sync_state, write_lag FROM pg_stat_replication;
EOF

# Check RLS policies (might be filtering data)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT * FROM pg_policies WHERE tablename = 'decisions';
EOF

# Check audit log for what happened
SELECT * FROM audit_log WHERE table_name = 'decisions' ORDER BY created_at DESC LIMIT 20;

# Check for failed writes in app logs
kubectl logs deployment/quantivis-production -n quantivis-production | grep -i "insert\|update" | grep -i "fail"
```

**Solutions:**
```bash
# 1. If RLS policy too strict, adjust it
# See database schema documentation

# 2. If replication lag, wait for catch-up
# Monitor with:
PGPASSWORD=$DB_PASSWORD watch 'psql -h $DB_HOST -U postgres -d quantivis -c "SELECT write_lag FROM pg_stat_replication"'

# 3. If write failed, check application error handling
# Application should log exact errors

# 4. If data corruption suspected, do not modify
# Contact database team - may need restore from backup

# 5. For missing recent data (< 5 minutes old)
# Data might not be replicated yet - wait and retry
```

---

### Issue: External API Integration Failing

**Symptoms:**
- Stripe payments failing
- Sentry not receiving errors
- Email not sending

**Diagnosis:**
```bash
# Check network connectivity to external service
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  curl -I https://api.stripe.com/v1/health

# Check if API key is correct
kubectl get secret quantivis-secrets -n quantivis-production -o jsonpath='{.data.stripe-key}'

# Check logs for specific errors
kubectl logs deployment/quantivis-production -n quantivis-production | grep -i "stripe\|sentry\|email"

# Check if service is rate-limited
# Look for HTTP 429 responses in logs

# Verify firewall rules allow outbound traffic
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  telnet api.stripe.com 443
```

**Solutions:**
```bash
# 1. If network issue, check egress rules
# Find node:
NODE=$(kubectl get pod quantivis-production-xxx -n quantivis-production -o jsonpath='{.spec.nodeName}')

# Check firewall rules for node
gcloud compute firewall-rules list | grep $NODE

# 2. If API key invalid, rotate it
kubectl create secret generic quantivis-secrets \
  --from-literal=stripe-key=sk_live_... \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. If rate-limited, implement exponential backoff
# Check application code for retry logic

# 4. If service is down, implement graceful degradation
# App should handle external service failures

# 5. Retry failed operations
# For example, retrying failed Stripe charges
```

---

## 📊 Performance Investigation

### Finding Slow Endpoints

```bash
# View latency by endpoint
kubectl logs deployment/quantivis-production -n quantivis-production | \
  grep -oP '(?<=path=)[^ ]+|(?<=duration=)[^ ]+' | \
  paste - - | \
  sort -k2 -rn | \
  head -20
```

### Identifying Memory Leaks

```bash
# 1. Get heap snapshot
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  node -e "v8.writeHeapSnapshot()" 

# 2. Copy locally
kubectl cp quantivis-production/quantivis-xxx:heapsnapshot-* ./heap.heapsnapshot

# 3. Analyze in Chrome DevTools
# chrome://inspect -> Profiler -> Load
```

### CPU Profiling

```bash
# 1. Add sampling profiler
kubectl set env deployment/quantivis-production \
  NODE_OPTIONS="--prof --prof-process" \
  -n quantivis-production

# 2. Wait for profile
sleep 60

# 3. Extract and analyze
kubectl cp quantivis-production/quantivis-xxx:isolate*.log ./profile.log
node --prof-process profile.log > processed.txt
vim processed.txt  # Look for hot functions
```

---

## 🆘 When All Else Fails

### Escalation Checklist

- [ ] Reproduced the issue independently
- [ ] Checked application logs (last 1000 lines)
- [ ] Checked Sentry for related errors
- [ ] Checked database logs
- [ ] Restarted the pod(s)
- [ ] Checked recent deployments
- [ ] Verified infrastructure is healthy
- [ ] Contacted service owners for dependencies

### Emergency Contacts

- **Database Lead**: db-lead@quantivis.io
- **Infrastructure Lead**: infra-lead@quantivis.io
- **On-Call Engineer**: on-call@quantivis.io (PagerDuty)

### Debug Mode

```bash
# Enable verbose logging (production)
kubectl set env deployment/quantivis-production \
  LOG_LEVEL=debug \
  -n quantivis-production

# This will log everything - disable after debugging!
```

---

## 📝 Useful Commands Cheat Sheet

```bash
# Get pod details
kubectl describe pod <pod-name> -n quantivis-production

# Get pod logs with timestamps
kubectl logs <pod-name> -n quantivis-production --timestamps=true

# Get logs from multiple pods
kubectl logs -l app=quantivis-production -n quantivis-production --tail=100

# Get environment variables
kubectl exec <pod-name> -n quantivis-production -- env | sort

# Run command in pod
kubectl exec -it <pod-name> -n quantivis-production -- /bin/bash

# Port forward
kubectl port-forward <pod-name> 8000:5000 -n quantivis-production

# Get resource usage
kubectl top pods -n quantivis-production --containers

# Get events
kubectl get events -n quantivis-production --sort-by='.lastTimestamp'

# Database access
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis
```

---

## 🎓 Learning Resources

- [Kubernetes Troubleshooting](https://kubernetes.io/docs/tasks/debug-application-cluster/)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Analysis_Tools)
- [Node.js Profiling](https://nodejs.org/en/docs/guides/simple-profiling/)
- Internal Runbooks: [OPERATIONS.md](./OPERATIONS.md)
- Disaster Recovery: [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)
