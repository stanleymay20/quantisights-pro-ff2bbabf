# 🚨 Production Operations Runbook

**Last Updated**: March 6, 2026  
**Version**: 1.0.0  
**Audience**: DevOps, SRE, Platform Engineers

---

## 📋 Quick Links

- **Status Dashboard**: https://status.quantivis.io
- **Monitoring**: https://dash.datadoghq.com/dashboard/quantivis-prod
- **Sentry**: https://sentry.io/organizations/quantivis/issues/
- **Logs**: ELK stack at https://logs.quantivis.io
- **Slack**: #quantivis-alerts, #quantivis-incidents

---

## 🏥 Health Checks

### Daily Verification

```bash
# Check deployment status
kubectl get deployment quantivis-production -n quantivis-production
kubectl get pods -n quantivis-production

# Check logs
kubectl logs -f deployment/quantivis-production -n quantivis-production

# Check performance
kubectl top pods -n quantivis-production
```

### Automated Monitoring

**Prometheus metrics** (scraped every 30s):
- `http_requests_total` — Total HTTP requests
- `http_request_duration_seconds` — Request latency
- `app_decisions_created` — Decisions logged
- `app_calibration_updates` — Calibration runs
- `db_query_duration_ms` — Database performance

**Alerts configured**:
- ✅ High error rate (>5% 5xx)
- ✅ High latency (p95 > 1s)
- ✅ Memory usage (>80%)
- ✅ CPU usage (>70%)
- ✅ Database connection issues
- ✅ Authentication failures (>100/min)

### Manual Health Check

```bash
# Test API endpoint
curl -I https://api.quantivis.io/health

# Expected: HTTP 200 OK
# Response time: <500ms
```

---

## 🔧 Common Operations

### View Real-time Logs

```bash
# All pods
kubectl logs -f deployment/quantivis-production -n quantivis-production

# Specific pod
kubectl logs -f pod/quantivis-production-xxx -n quantivis-production

# Last 100 lines
kubectl logs --tail=100 deployment/quantivis-production -n quantivis-production

# Since specific time
kubectl logs --since=1h deployment/quantivis-production -n quantivis-production
```

### Scale Deployment

```bash
# Scale to 5 replicas
kubectl scale deployment quantivis-production --replicas=5 -n quantivis-production

# Check HPA status
kubectl get hpa quantivis-hpa -n quantivis-production
```

### Access Database

```bash
# Port forward to local machine
kubectl port-forward svc/supabase-db 5432:5432 -n quantivis-production

# Connect via psql
psql -h localhost -U postgres -d quantivis
```

### Run Database Query

```bash
# Query without connecting
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  psql -h $DB_HOST -U postgres -d quantivis -c "SELECT count(*) FROM decisions;"
```

### Update Secrets

```bash
# Create new secret
kubectl create secret generic quantivis-secrets \
  --from-literal=supabase-url=https://... \
  --from-literal=sentry-dsn=https://... \
  -n quantivis-production \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secrets
kubectl rollout restart deployment/quantivis-production -n quantivis-production
```

### Emergency Rollback

```bash
# View rollout history
kubectl rollout history deployment/quantivis-production -n quantivis-production

# Rollback to previous version
kubectl rollout undo deployment/quantivis-production -n quantivis-production

# Rollback to specific revision
kubectl rollout undo deployment/quantivis-production --to-revision=3 -n quantivis-production

# Watch rollback
kubectl rollout status deployment/quantivis-production -n quantivis-production --watch
```

---

## 🚨 Incident Response

### High Error Rate (>5%)

**Detection**: Sentry alert + PagerDuty page

**Investigation**:
```bash
# 1. Check logs for errors
kubectl logs -f deployment/quantivis-production -n quantivis-production | grep ERROR

# 2. Check database connectivity
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  curl -I https://$DB_HOST/health

# 3. Check dependent services
curl -I https://api.stripe.com/health
curl -I $SUPABASE_URL/health

# 4. Review recent deployments
kubectl rollout history deployment/quantivis-production -n quantivis-production
```

**Response**:
1. If recent deployment caused it → Rollback
2. If database issue → Check database logs
3. If service dependency → Contact that team
4. If spike in traffic → Check CloudFlare analytics
5. Unknown → Scale up resources temporarily

```bash
# Temporary scaling
kubectl scale deployment quantivis-production --replicas=10 -n quantivis-production

# Then investigate root cause
```

### High Latency (p95 > 1s)

**Detection**: Datadog alert

**Investigation**:
```bash
# Check slow queries
kubectl logs deployment/quantivis-production -n quantivis-production | grep "took.*ms" | tail -20

# Check database performance
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
EOF

# Check resource usage
kubectl top pods -n quantivis-production
```

**Response**:
1. If database slow → Run ANALYZE or check query plans
2. If memory high → Check for memory leak or scale up
3. If CPU high → Profile CPU usage

### Database Connection Issues

**Detection**: Application logs show connection timeouts

**Response**:
```bash
# Check database logs
gcloud sql instances describe quantivis-prod --describe

# Check connection pool status
kubectl logs deployment/quantivis-production -n quantivis-production | grep "pool"

# Restart database connections
kubectl set env deployment/quantivis-production \
  DB_POOL_RESET=$(date +%s) \
  -n quantivis-production

# If still failing, scale down and up
kubectl set replicas deployment/quantivis-production 0 -n quantivis-production
kubectl set replicas deployment/quantivis-production 3 -n quantivis-production
```

### OOM (Out of Memory) Kill

**Detection**: Pod restarts or OOMKilled status

```bash
# Check memory usage
kubectl describe pod <pod-name> -n quantivis-production

# If OOMKilled:
# 1. Increase memory limits in deployment.yaml
# 2. Investigate memory leak in application
kubectl set resources deployment quantivis-production \
  --limits=memory=2Gi \
  -n quantivis-production
```

### Data Corruption / Data Loss

**Detection**: Consistency check failures in logs

**Response** (DO NOT PANIC):
```bash
# 1. STOP: Do not restart immediately
# 2. Assess damage: Check what data was affected
# 3. Notify stakeholders immediately
# 4. Initiate incident response (see section below)
# 5. Restore from backup (see Disaster Recovery)
```

---

## 💾 Backup & Restore

### Create Manual Backup

```bash
./scripts/backup-database.sh production
```

### List Available Backups

```bash
# Local backups
ls -lh backups/

# Cloud backups
az storage blob list --account-name quantivisbackups --container-name production
```

### Restore from Backup

```bash
# This is DESTRUCTIVE - confirm twice
# 1. Pick backup file
BACKUP_FILE=backups/quantivis_production_20260306_120000.sql.gz

# 2. Create new database (do not overwrite)
# 3. Restore
gzip -dc "$BACKUP_FILE" | psql -h $DB_HOST -U postgres -d quantivis_restored

# 4. Verify data integrity
psql -h $DB_HOST -U postgres -d quantivis_restored << EOF
SELECT count(*) FROM decision_ledger;
SELECT count(*) FROM audit_log;
EOF

# 5. If good, swap connection string
# 6. If bad, rollback connection string
```

---

## 📊 Monitoring Dashboard Setup

### Prometheus Alerts

Check `k8s/prometheus-rules.yaml` for alert definitions

### Grafana Dashboards

**Main Production Dashboard**:
- Pod status and resource usage
- HTTP request rates and latencies
- Database performance
- Error rates by endpoint
- Business metrics (decisions created, etc.)

**Access**: https://grafana.quantivis.io (use Kubernetes auth)

### Setting Up New Alerts

```yaml
# In k8s/prometheus-rules.yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
for: 5m
annotations:
  summary: "High error rate detected"
  action: "Check logs, consider rollback"
```

---

## 🔐 Security Incidents

### Suspected Compromise

**Immediate actions**:
```bash
# 1. Rotate all secrets
kubectl create secret generic quantivis-secrets \
  --from-literal=new-secret-key=$(openssl rand -base64 32) \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Restart all pods
kubectl rollout restart deployment/quantivis-production -n quantivis-production

# 3. Review audit logs
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
SELECT actor_id, action, created_at, ip_address 
FROM audit_log 
WHERE created_at > now() - interval '1 hour' 
ORDER BY created_at DESC;
EOF

# 4. Trace suspicious activity
# 5. Isolate affected resources
# 6. Contact security team
```

### Exposed Secret

**Immediate actions**:
```bash
# 1. Identify which secret was exposed
# 2. Rotate it immediately
# 3. Revoke/regenerate the secret at source (Stripe, SendGrid, etc.)
# 4. In git history: git filter-branch (see SECURITY.md)
# 5. Audit logs for unauthorized use
```

---

## 📞 Escalation

| Issue | Severity | First Contact | Escalate If |
|-------|----------|---------------|-------------|
| High error rate | P1 | On-call engineer | Oncall → Manager → VP Eng |
| Latency spike | P2 | On-call engineer | Persists >15min |
| Single pod crash | P3 | Logs/monitoring | Repeating |
| Data corruption | P1 | Immediately VP Eng | Incident commander |
| Security incident | P1 | Security + Eng | Confirm compromise |

**Incident Commander** (on escalation):
- `incident-commander@quantivis.io`
- Called via PagerDuty

---

## ✅ Daily Checklist

- [ ] Verify all pods are running: `kubectl get pods -n quantivis-production`
- [ ] Check error rates < 1%: Sentry dashboard
- [ ] Verify backup completed: Last backup time
- [ ] Review any new alerts from Datadog
- [ ] Check database disk space: `df -h`
- [ ] Monitor application metrics

---

## 📚 Documentation

- **Deployment**: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Configuration**: [.env.production.example](.env.production.example)
- **Database**: [Database Schema](./docs/database-schema.md)
- **API**: [API Documentation](./docs/api.md)
- **Security**: [SECURITY.md](./SECURITY.md)

---

## 🆘 Getting Help

- **For deployment issues**: Check deploy.sh logs
- **For pod issues**: `kubectl describe pod <pod-name>`
- **For database issues**: Check CloudSQL logs
- **For application bugs**: Check Sentry + application logs
- **For infrastructure**: Check Kubernetes events + cluster logs

```bash
# Collect common diagnostics
kubectl cluster-info
kubectl get nodes
kubectl describe nodes
kubectl get events -n quantivis-production --sort-by='.lastTimestamp'
```
