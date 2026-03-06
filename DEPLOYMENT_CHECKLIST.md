# ✅ Production Deployment Checklist

**Last Updated**: March 6, 2026  
**Version**: 1.0.0  
**Audience**: DevOps, Platform Engineering, Product Managers

---

## 📋 Pre-Deployment (24 hours before)

### Code Readiness
- [ ] All tests passing: `bun test`
- [ ] ESLint no errors: `bun run lint`
- [ ] TypeScript strict: `bun run type-check`
- [ ] No console logs: `grep -r "console\." src/ | grep -v "logger"` returns empty
- [ ] No hardcoded credentials: `grep -r "sk_live\|pk_live\|password=" src/` returns empty
- [ ] All dependencies are pinned: Check `package.json` and `bun.lockb`
- [ ] Security audit clean: `npm audit` or `bun audit`

### Documentation
- [ ] Change log updated: [CHANGELOG.md](./CHANGELOG.md)
- [ ] API docs updated if endpoint changes made
- [ ] Database migrations documented
- [ ] Configuration changes documented in `.env.production.example`

### Testing
- [ ] Ran critical path tests: `bun test -- src/test/critical-path.test.ts`
- [ ] Ran full test suite: `bun test`
- [ ] Tested in staging environment (matches production)
- [ ] Load testing completed: Target 100 concurrent users
- [ ] Security scan completed: OWASP top 10 not found

### Dependency Review
- [ ] No new major dependencies added
- [ ] All dependencies have security patches applied
- [ ] License compliance checked (no GPL in production)
- [ ] Performance impact of new dependencies assessed

### Database
- [ ] All migrations tested: `./scripts/migrate.sh staging`
- [ ] Rollback plan documented
- [ ] Database backup verified: Last backup < 5 minutes
- [ ] Replication lag < 100ms

---

## 📦 Build & Container Preparation

### Docker Image
- [ ] `Dockerfile.prod` reviewed for security
- [ ] Image built successfully: `docker build -f Dockerfile.prod -t quantivis:vX.Y.Z .`
- [ ] Image scanned for vulnerabilities: `trivy image quantivis:vX.Y.Z`
- [ ] Image size reasonable: < 200MB
- [ ] Multi-stage build removes build dependencies
- [ ] Non-root user configured: `RUN useradd -m app`

### Push to Registry
- [ ] Image tagged correctly: `quantivis-registry.azurecr.io/quantivis:vX.Y.Z`
- [ ] Image pushed successfully: `docker push quantivis-registry.azurecr.io/quantivis:vX.Y.Z`
- [ ] Image with 'latest' tag also pushed
- [ ] Registry access logs show successful push

### Configuration Files
- [ ] `k8s/deployment.yaml` updated with correct image tag
- [ ] `.env.production` all values correct (copy from `.env.production.example`)
- [ ] All secrets loaded in Kubernetes: `kubectl get secret quantivis-secrets -n quantivis-production`
- [ ] ConfigMaps created: `kubectl get cm -n quantivis-production`

---

## 🧪 Staging Deployment Validation

### Staging Environment
- [ ] Deploy to staging first: `./scripts/deploy.sh staging vX.Y.Z`
- [ ] All pods running: `kubectl get pods -n quantivis-staging`
- [ ] No pod restarts: `kubectl get pods -n quantivis-staging -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}'` = 0
- [ ] Logs clean: `kubectl logs deployment/quantivis-staging -n quantivis-staging | tail -20`

### Staging Validation
- [ ] Health endpoint responds: `curl https://staging.quantivis.io/health`
- [ ] API endpoints responding
- [ ] Database migrations ran successfully
- [ ] Can login with test account
- [ ] Can create/read/update/delete decision
- [ ] Stripe webhooks received (if payment code changed)
- [ ] Sentry receiving errors (if error handling changed)
- [ ] Performance within SLA: p95 latency < 1s

### Staging Monitoring
- [ ] No errors in Sentry for past 30 minutes
- [ ] Error rate < 1%: `kubectl logs deployment/quantivis-staging -n quantivis-staging | grep ERROR | wc -l`
- [ ] Memory usage stable: Not increasing over 5 minutes
- [ ] CPU usage reasonable: < 50%

### Staging Rollback Test (Optional)
- [ ] Note current version: `kubectl rollout history deployment/quantivis-staging -n quantivis-staging`
- [ ] Rollback to previous: `kubectl rollout undo deployment/quantivis-staging -n quantivis-staging`
- [ ] Verify old version works
- [ ] Roll forward: `kubectl rollout redo deployment/quantivis-staging -n quantivis-staging`

---

## 🚨 Pre-Deployment Final Checks

### Team & Communication
- [ ] PagerDuty on-call confirmed (can be reached)
- [ ] Slack channels ready: #quantivis-alerts, #quantivis-incidents
- [ ] War room bridge available: Zoom/conference link ready
- [ ] Stakeholders notified of deployment window

### Risk Assessment
- [ ] No business-critical features blocked by this change
- [ ] No customer meetings/calls during deployment window
- [ ] Low-traffic time selected (usually 2-4 AM)
- [ ] Rollback plan documented and tested
- [ ] Database backup running

### Infrastructure Health
- [ ] Kubernetes cluster healthy: `kubectl cluster-info`
- [ ] All nodes healthy: `kubectl get nodes` = all Ready
- [ ] Pod quota not exceeded: `kubectl get resourcequota -n quantivis-production`
- [ ] Network connectivity verified: No firewall changes
- [ ] Database replication lag < 30s

### Service Dependencies
- [ ] Supabase status: https://status.supabase.io
- [ ] Stripe status: https://status.stripe.com
- [ ] SendGrid status: https://status.sendgrid.com
- [ ] All dependencies up and responding

---

## 🚀 Deployment (Production)

### Deployment Execution
- [ ] Start deployment: `./scripts/deploy.sh production vX.Y.Z`
- [ ] Monitor deployment progress: `kubectl rollout status deployment/quantivis-production -n quantivis-production --watch`
- [ ] All pods starting successfully: 0 pod restarts
- [ ] New version deployed: `kubectl get deployment quantivis-production -n quantivis-production -o jsonpath='{.spec.template.spec.containers[0].image}'`

### Immediate Health Checks (first 5 minutes)
- [ ] API responding: `curl -I https://api.quantivis.io/health`
- [ ] Dashboard page loads: Check website
- [ ] No 502/503 errors
- [ ] Error rate < 1%
- [ ] Latency normal: p95 < 1s
- [ ] Sentry not showing spike in errors

### Extended Validation (5-30 minutes)
- [ ] Monitor pod logs: `kubectl logs -f deployment/quantivis-production -n quantivis-production`
- [ ] Check Datadog dashboard for any red zones
- [ ] Monitor memory usage: Not increasing > 10%
- [ ] Monitor CPU usage: Normal baseline
- [ ] Database query performance normal
- [ ] All external integrations working (Stripe, SendGrid, Sentry)

---

## 🔄 Post-Deployment Verification

### Functional Verification
- [ ] Core user flows work (login → create decision → view)
- [ ] All API endpoints responding correctly
- [ ] Database queries returning correct results
- [ ] File uploads working
- [ ] Calculations/calibrations running correctly
- [ ] Audit logs recording transactions

### Performance Verification
- [ ] **Availability**: 100% successful requests (no 5xx)
- [ ] **Latency p50**: < 200ms
- [ ] **Latency p95**: < 500ms
- [ ] **Latency p99**: < 1s
- [ ] **Error rate**: < 0.1%
- [ ] **Database query latency**: < 100ms (p95)

### Security Verification
- [ ] HTTPS working: All traffic encrypted
- [ ] Security headers correct: `curl -I https://api.quantivis.io | grep -i security`
- [ ] No sensitive data in logs
- [ ] CORS headers correct
- [ ] RLS policies working: Data isolation verified

### Integration Verification
- [ ] Stripe webhooks received and processed
- [ ] SendGrid emails sending
- [ ] Sentry errors being logged
- [ ] Prometheus metrics collected
- [ ] Datadog monitoring active

---

## 📊 Monitoring & Observability

### First Hour
- [ ] Every 5 minutes: Check error logs
- [ ] Every 10 minutes: Check latency dashboard
- [ ] Every 15 minutes: Check resource usage
- [ ] Maintain active presence in Slack/war room

### First Day
- [ ] Every hour: Full health check
- [ ] Review error patterns: Any new error types?
- [ ] Check performance trends: Any regressions?
- [ ] Monitor database: Any slow query patterns?
- [ ] Business metrics: Data flowing normally?

### First Week
- [ ] Daily health check
- [ ] Review Sentry issues: Any patterns?
- [ ] Database maintenance: Any bloat?
- [ ] Performance trending: Any degradation?
- [ ] User feedback: Any complaints?

### Metrics to Track
- ✅ Uptime: Target 99.9%
- ✅ Latency p95: Target < 500ms
- ✅ Error rate: Target < 0.1%
- ✅ Success rate: Target > 99.9%

---

## 🚨 Rollback Conditions

**Auto-rollback if**:
- [ ] Error rate > 5%
- [ ] Latency p95 > 2s
- [ ] Pod crash loop (>3 restarts in 5 minutes)
- [ ] Database connection failures
- [ ] Critical feature broken

**Manual rollback if**:
- [ ] Unexpected behavior discovered
- [ ] Security issue found
- [ ] Data corruption detected
- [ ] Customer-impacting issue

```bash
# Immediate rollback
kubectl rollout undo deployment/quantivis-production -n quantivis-production
kubectl rollout status deployment/quantivis-production -n quantivis-production --watch

# Verify rolled back
curl -I https://api.quantivis.io/health  # Should be old version

# If rollback doesn't work, contact on-call
```

---

## 📝 Post-Deployment Documentation

After deployment completes:

- [ ] Update `CHANGELOG.md` with actual deployment time
- [ ] Document any issues encountered
- [ ] Update runbooks if procedures changed
- [ ] Commit deployment notes to git
- [ ] Close deployment-related tickets
- [ ] Send post-deployment summary to stakeholders

---

## 🎯 Deployment Window Template

**Version**: vX.Y.Z  
**Deploy Date**: [DATE]  
**Deploy Time**: [TIME] UTC  
**Expected Duration**: 15 minutes  
**Change Type**: [Bugfix|Feature|Performance|Security]  
**Rollback Plan**: See [OPERATIONS.md](./OPERATIONS.md)

**Changes**:
- 

**Testing Done**:
- 

**Monitoring**:
- Sentry: https://sentry.io/organizations/quantivis
- Datadog: https://app.datadoghq.com/dashboard/quantivis
- Kubernetes: `kubectl get deployment -n quantivis-production -o wide`

**On-Call**: @[person] via PagerDuty

---

## 🆘 When Deployment Goes Wrong

### Immediate Actions
1. Declare incident in Slack: `@channel INCIDENT: Deployment vX.Y.Z failed`
2. Trigger incident commander
3. Pause deployment: Stop any ongoing changes
4. Assessed impact: How many users affected?

### Triage (5 minutes)
1. Check deployment logs: `kubectl logs -n quantivis-production | tail -100`
2. Check pod status: `kubectl get pods -n quantivis-production`
3. Check recent errors: Sentry dashboard
4. Determine fix: Rollback vs. Fast fix

### Recovery
```bash
# If obvious error and quick fix
git fix bug
git push
docker build ...
./scripts/deploy.sh production vX.Y.Z-hotfix

# If uncertain, ROLLBACK FIRST
kubectl rollout undo deployment/quantivis-production -n quantivis-production
# Then investigate
```

---

## 📚 Related Documents

- [OPERATIONS.md](./OPERATIONS.md) - Production operations runbook
- [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) - Disaster recovery procedures
- [MONITORING.md](./MONITORING.md) - Monitoring and alerting setup
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide
- [scripts/deploy.sh](./scripts/deploy.sh) - Deployment automation script
- [.github/workflows/ci.yml](./.github/workflows/ci.yml) - CI/CD pipeline

---

## 🔗 Quick Links

- **Status Page**: https://status.quantivis.io
- **Monitoring Dashboard**: https://app.datadoghq.com/dashboard/quantivis
- **Error Tracking**: https://sentry.io/organizations/quantivis
- **Logs**: https://logs.quantivis.io
- **Kubernetes Dashboard**: https://dashboard.quantivis.io
