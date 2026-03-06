# 🆘 Disaster Recovery Plan

**Last Updated**: March 6, 2026  
**Recovery Time Objective (RTO)**: 1 hour  
**Recovery Point Objective (RPO)**: 5 minutes

---

## 📋 Disaster Scenarios

### Scenario 1: Database Corruption

**Impact**: 🔴 CRITICAL - Data integrity compromised  
**Symptoms**: Consistency check failures, unexpected NULL values, primary key violations

**Recovery Steps**:

```bash
# 1. Assess damage (READ ONLY)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
-- Check integrity
SELECT COUNT(*) as total_decisions FROM decision_ledger;
SELECT COUNT(*) as total_metrics FROM metrics;
PRAGMA integrity_check;  -- SQLite only
EOF

# 2. Identify last good state
ls -lt backups/ | head -5

# 3. If < 5 min of data lost is acceptable:
BACKUP_FILE=backups/quantivis_production_20260306_120000.sql.gz

# 4. Create isolated restore environment
gzip -dc "$BACKUP_FILE" | psql -h $DB_HOST -U postgres -d quantivis_restore_test

# 5. Validate restored data
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis_restore_test << EOF
SELECT COUNT(*) FROM decision_ledger;
SELECT MAX(created_at) FROM decision_ledger;
EOF

# 6. If valid, swap production connection (with data sync)
# 7. Monitor for issues

# Recovery Time: ~30 minutes
# Data Loss: ~5 minutes (last backup)
```

---

### Scenario 2: Complete Service Outage

**Impact**: 🔴 CRITICAL - All services down  
**Symptoms**: Pod crashes, no response on all endpoints, ingress errors

**Recovery Steps**:

```bash
# 1. Verify cluster is accessible
kubectl cluster-info
kubectl get nodes

# If cluster down, switch to backup region:
kubectl config use-context quantivis-failover

# 2. Check what's down
kubectl get deployments -n quantivis-production
kubectl get pods -n quantivis-production

# 3. If pods crashing, check logs
kubectl logs deployment/quantivis-production -n quantivis-production --tail=100

# 4. If database issue
az sql instance failover --instance quantivis-prod

# 5. Rollback to last known good version
kubectl rollout undo deployment/quantivis-production -n quantivis-production
kubectl rollout status deployment/quantivis-production

# 6. If still down, restore from snapshot
kubectl set image deployment/quantivis-production \
  quantivis=quantivis-registry.azurecr.io/quantivis:last-known-good \
  -n quantivis-production

# 7. Verify endpoints responding
curl -I https://api.quantivis.io/health

# Recovery Time: ~15-20 minutes
```

---

### Scenario 3: Data Center / Region Failure

**Impact**: 🔴 CRITICAL - Geographic outage  
**Symptoms**: Entire region unreachable, all DNS pointing to dead zone

**Recovery Steps**:

```bash
# 1. Verify home region is completely down
ping quantivis-us-east.azurecontainers.io  # Should fail

# 2. Switch DNS to backup region
# Using Azure Traffic Manager:
az network traffic-manager endpoint update \
  --resource-group quantivis \
  --profile-name quantivis-traffic \
  --name quantivis-us-east \
  --status Disabled

# 3. DNS will auto-redirect to us-west (TTL 60s)
# 4. Monitor failover
az network traffic-manager profile check-dns --name quantivis-traffic

# 5. Restore services in failed region later
# 6. Switch back when stable
az network traffic-manager endpoint update \
  --resource-group quantivis \
  --profile-name quantivis-traffic \
  --name quantivis-us-east \
  --status Enabled

# Recovery Time: ~1-2 minutes (DNS TTL)
# Data: No loss (geo-replicated database)
```

---

### Scenario 4: Security Breach / Unauthorized Access

**Impact**: 🔴 CRITICAL - Confidentiality/Integrity compromise  
**Symptoms**: Suspicious activity in audit logs, unauthorized API access

**Recovery Steps**:

```bash
# 1. IMMEDIATE: Disable all access except admin
kubectl set image deployment/quantivis-production \
  quantivis=quantivis-registry.azurecr.io/quantivis:maintenance \
  -n quantivis-production

# 2. Preserve audit logs (do NOT delete)
kubectl exec deployment/quantivis-production -n quantivis-production -- \
  pg_dump -t audit_log $DB_NAME > /backup/audit_log_20260306.sql

# 3. Rotate ALL secrets immediately
for SECRET in supabase-key stripe-key sentry-dsn; do
  kubectl create secret generic quantivis-secrets-rotated \
    --from-literal=$(echo $SECRET)=$(openssl rand -base64 32) \
    --dry-run=client -o yaml | kubectl apply -f -
done

# 4. Analyze breach scope
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -d quantivis << EOF
-- Suspicious data access
SELECT * FROM audit_log 
WHERE action IN ('select', 'update', 'delete')
  AND created_at > now() - interval '24 hour'
  AND actor_id NOT IN ('admin-id', 'service-id')
ORDER BY created_at DESC;
EOF

# 5. Check what data was accessed/modified
# 6. Notify potentially affected users
# 7. File incident report
# 8. Bring back up on new credentials
kubectl set image deployment/quantivis-production \
  quantivis=quantivis-registry.azurecr.io/quantivis:latest \
  -n quantivis-production

# Recovery Time: ~30 minutes
# Action: Full security audit, legal/compliance notification
```

---

### Scenario 5: Ransomware / Data Locked

**Impact**: 🔴 CRITICAL - Data encrypted and inaccessible  
**Symptoms**: Cannot connect to database, files encrypted, suspicious processes

**Recovery Steps**:

```bash
# 1. DO NOT pay ransom - proceed to recovery
# 2. Isolate affected systems from network
kubectl patch deployment quantivis-production \
  -p '{"spec":{"replicas":0}}' -n quantivis-production

# 3. Kill any suspicious processes (restart cluster)
kubectl delete node [compromised-node] --ignore-daemonsets

# 4. Restore from airgapped backup
# (These backups are NOT stored on production systems)
BACKUP_LOCATION=s3://quantivis-backups-offline/

# 5. Create new database from backup
az sql db create --resource-group quantivis \
  --server quantivis-sql \
  --name quantivis-restored \
  --service-objective GP_Gen5_2

# 6. Restore data
gzip -dc s3://quantivis-backups-offline/latest.sql.gz | \
  psql -h quantivis-sql.database.windows.net \
       -U postgres \
       -d quantivis-restored

# 7. Validate integrity
# 8. Update connection strings
# 9. Bring application back online

# Recovery Time: 1-4 hours (depending on data size)
# Data Loss: Maximum 24 hours (offline backups daily)
```

---

## 🔄 Backup Strategy

### Backup Schedule

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Continuous WAL | Every 5min | 7 days | Azure SQLBackup |
| Daily snapshot | Daily 2 AM UTC | 30 days | Azure SQLBackup |
| Weekly archive | Every Sunday | 52 weeks | Cold storage |
| Monthly archive | 1st of month | 7 years | Cold storage |
| Offline backups | Weekly | 1 year | Airgapped S3 |

### Backup Verification

```bash
# Daily: Verify recovery time
./scripts/backup-test.sh production

# Weekly: Restore to test environment
./scripts/restore-test.sh latest

# Monthly: Full recovery drill
./scripts/disaster-recovery-drill.sh
```

---

## ✅ Recovery Checklist

### Immediate (First 15 minutes)

- [ ] Identify type of disaster
- [ ] Assess business impact
- [ ] Activate incident commander
- [ ] Notify customers/users
- [ ] Stop ongoing damage (isolate systems if needed)

### Short-term (15 minutes - 1 hour)

- [ ] Document incident timeline
- [ ] Activate recovery plan for scenario
- [ ] Initiate backup restoration
- [ ] Monitor recovery progress
- [ ] Prepare communication updates

### Medium-term (1-4 hours)

- [ ] Complete full recovery
- [ ] Verify data integrity
- [ ] Restore service to normal operations
- [ ] Monitor for issues
- [ ] Document root cause

### Post-incident (Next 24-48 hours)

- [ ] Root cause analysis
- [ ] Update runbooks/playbooks
- [ ] Implement preventive measures
- [ ] Post-mortem with team
- [ ] Customer notification / apology if needed

---

## 📞 Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Incident Commander | TBD | +1-XXX-XXX-XXXX | incident-commander@quantivis.io |
| Database Lead | TBD | +1-XXX-XXX-XXXX | db-lead@quantivis.io |
| Infrastructure Lead | TBD | +1-XXX-XXX-XXXX | infra-lead@quantivis.io |
| Security Lead | TBD | +1-XXX-XXX-XXXX | security-lead@quantivis.io |
| VP Engineering | TBD | +1-XXX-XXX-XXXX | vpeng@quantivis.io |

**Emergency Line**: +1-XXX-XXX-XXXX (conference bridge in war room)

---

## 🧪 Regular Drills

**Monthly disaster recovery drill**:
```bash
# Scheduled: First Friday of each month, 10 AM PT
./scripts/disaster-recovery-drill.sh

# This simulates:
# 1. Database corruption
# 2. Service failure  
# 3. Regional failover
# 4. Full recovery
# Time: ~2 hours
```

**Quarterly full-scale exercise**:
- Includes customer/stakeholder notifications
- Tests communication procedures
- Validates all runbooks

---

## 📊 Success Metrics

**Recovery was successful if**:
- ✅ RTO achieved (1 hour)
- ✅ RPO achieved (< 5 min data loss)
- ✅ All data integrity verified
- ✅ All services online and responding
- ✅ No data corruption
- ✅ Users able to login and use platform

**Post-incident**:
- ✅ Root cause identified
- ✅ Preventive changes implemented
- ✅ Team debriefing completed
- ✅ Runbooks updated
- ✅ Monitoring improved
