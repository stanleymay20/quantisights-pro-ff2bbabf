# 🚀 Quantivis Production Deployment Guide

**Version**: 1.0.0  
**Last Updated**: March 6, 2026  
**Status**: ✅ Production-Ready

---

## 📚 Documentation Overview

This directory contains complete production deployment and operations documentation for Quantivis.

### Core Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Step-by-step deployment guidelines | DevOps, Platform Engineers |
| [OPERATIONS.md](./OPERATIONS.md) | Daily operations runbook and procedures | SRE, Operations Team |
| [MONITORING.md](./MONITORING.md) | Monitoring setup and alert configuration | Platform Engineers, DevOps |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions | All Engineers |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | Backup, recovery, and incident procedures | SRE, Infrastructure |
| [PERFORMANCE.md](./PERFORMANCE.md) | Performance optimization techniques | Backend Engineers, DevOps |
| [SECURITY.md](./SECURITY.md) | Security best practices and hardening | All Engineers, Security |

---

## 🏗️ Architecture Components

### Application Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Quantivis Production Stack                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Kubernetes Cluster (HA)                │   │
│  │  • 3+ nodes for high availability                   │   │
│  │  • HPA: 3-10 pod replicas (auto-scaling)           │   │
│  │  • RollingUpdate strategy (zero downtime)           │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │   Nginx Reverse Proxy (SSL/TLS)             │  │   │
│  │  │  • Rate limiting: 10r/s API, 100r/s general │  │   │
│  │  │  • Gzip compression (6 level)                │  │   │
│  │  │  • Security headers (CSP, X-Frame, etc)     │  │   │
│  │  │  • Connection pooling (keepalive 32)         │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                      ↓                             │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │     Quantivis Application Pods              │  │   │
│  │  │  • Alpine Linux 3 (minimal footprint)       │  │   │
│  │  │  • Non-root user for security               │  │   │
│  │  │  • Health checks: liveness + readiness      │  │   │
│  │  │  • Resource limits: 1 CPU, 1Gi memory       │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                      ↓                             │   │
│  │  ┌──────────────────────────────┬────────────────┐ │   │
│  │  │   PostgreSQL Database        │  Redis Cache   │ │   │
│  │  │  • Multi-tenant with RLS     │  • In-memory   │ │   │
│  │  │  • Immutable audit logging   │  • TTL: 5min   │ │   │
│  │  │  • Replication for backup    │  • Hit rate>80%│ │   │
│  │  │  • Automated backups (5min)  │  • Cluster OK  │ │   │
│  │  └──────────────────────────────┴────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Monitoring & Observability                         │   │
│  │  • Prometheus metrics: ./metrics endpoint            │   │
│  │  • Datadog APM: Request tracing                      │   │
│  │  • Sentry: Error tracking with releases             │   │
│  │  • Structured logging: JSON to observability         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  External Integrations                              │   │
│  │  • Supabase: User auth, database                    │   │
│  │  • Stripe: Payment processing                       │   │
│  │  • SendGrid: Transactional email                    │   │
│  │  • Azure Storage: File uploads & backups            │   │
│  │  • CloudFlare: CDN & DDoS protection                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Deployment Files

### Docker & Containerization

```
Dockerfile.prod          # Multi-stage production build
                        # - Builder stage: compile/build
                        # - Alpine runtime: 80MB footprint
                        # - Non-root user: security
                        # - Health checks: startup + running

docker-compose.prod.yml # Local production testing
                        # - Quantivis app service
                        # - Nginx reverse proxy
                        # - Network isolation
                        # - Volume mounts
```

### Kubernetes Orchestration

```
k8s/deployment.yaml     # Production deployment configuration
                        # - 3+ replicas for HA
                        # - HPA: 3-10 replicas (CPU/Memory)
                        # - RollingUpdate: zero downtime
                        # - Security context: non-root, read-only
                        # - Resource limits: 1 CPU / 1Gi memory
                        # - Liveness & Readiness probes
                        # - Init container: database migrations
                        # - Pod anti-affinity: spread across nodes
                        # - Prometheus metrics: /metrics endpoint
```

### Configuration

```
.env.production.example # Production environment variables (template)
                        # - 100+ configuration parameters
                        # - Organized by service/feature
                        # - Comments for each variable
                        # - DO NOT commit actual .env.production
```

### Automation Scripts

```
scripts/deploy.sh           # Automated deployment orchestration
                            # - Pre-deployment checks
                            # - Run critical path tests
                            # - Build & push Docker image
                            # - Database backup
                            # - Kubernetes deployment
                            # - Auto-rollback on failure
                            # - Sentry notification

scripts/backup-database.sh  # Database backup & recovery
                            # - pg_dump compression
                            # - Upload to Azure Storage
                            # - 7-day local rotation
                            # - Recovery scripts
```

### Network & Security

```
nginx.prod.conf         # Reverse proxy configuration
                        # - SSL/TLS 1.2 & 1.3
                        # - HTTP/2 support
                        # - Gzip compression
                        # - Security headers (CSP, etc)
                        # - Rate limiting
                        # - Connection pooling
                        # - Request buffering
```

### Testing

```
src/test/critical-path.test.ts  # Integration tests for production
                                # - Authentication flows
                                # - Decision CRUD
                                # - Data pipeline
                                # - Concurrent operations
                                # - Payment integration
                                # - Performance SLAs
```

---

## 🚀 Quick Start: Deploy to Production

### Prerequisites

```bash
# 1. Verify all prerequisites
✅ Kubernetes cluster accessible (kubeconfig configured)
✅ Docker build tools available (docker installed)
✅ Azure Container Registry access (az login done)
✅ Production secrets ready (.env.production filled in)
✅ Database backups working
✅ SSL certificates installed (Nginx)
```

### Step 1: Prepare

```bash
# Clone repository
git clone https://github.com/quantivis/quantisights-pro.git
cd quantisights-pro

# Install dependencies
bun install

# Create .env.production (copy from template)
cp .env.production.example .env.production
# Edit .env.production with real values

# Load secrets into Kubernetes
kubectl create secret generic quantivis-secrets \
  --from-env-file=.env.production \
  -n quantivis-production \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 2: Run Tests

```bash
# Run critical path tests
bun test -- src/test/critical-path.test.ts

# Run full test suite
bun test

# Check TypeScript
bun run type-check

# Check linting
bun run lint
```

### Step 3: Deploy (Staging First)

```bash
# Build Docker image
docker build -f Dockerfile.prod -t quantivis-registry.azurecr.io/quantivis:v1.0.0 .

# Push to registry
docker push quantivis-registry.azurecr.io/quantivis:v1.0.0

# Deploy to staging
./scripts/deploy.sh staging v1.0.0

# Monitor deployment
kubectl rollout status deployment/quantivis-staging -n quantivis-staging --watch
```

### Step 4: Validate Staging

- [ ] All pods running: `kubectl get pods -n quantivis-staging`
- [ ] Health check passing: `curl https://staging.quantivis.io/health`
- [ ] Can login with test account
- [ ] Can perform basic operations (create decision, upload data, etc.)
- [ ] No errors in Sentry for past 30 minutes
- [ ] Latency normal: p95 < 1 second

### Step 5: Deploy to Production

```bash
# Deploy to production
./scripts/deploy.sh production v1.0.0

# Monitor deployment
kubectl rollout status deployment/quantivis-production -n quantivis-production --watch

# Verify health
curl -I https://api.quantivis.io/health
```

### Step 6: Verify Production

- [ ] All pods running: `kubectl get pods -n quantivis-production`
- [ ] Error rate < 1%
- [ ] Latency p95 < 500ms
- [ ] No data corruption
- [ ] External integrations working (Stripe, SendGrid)
- [ ] Monitoring showing healthy metrics

---

## 📊 Service Level Objectives (SLOs)

**Availability**: 99.9% uptime
- Max acceptable downtime: 43 minutes/month
- Monitoring: Prometheus + Datadog
- Alerts: PagerDuty on outage

**Latency**: p95 < 500ms
- Target: < 200ms p50, < 1s p99
- Measured: Application logs + Datadog APM
- Alerts: Triggered if p95 > 1s for 15 minutes

**Error Rate**: < 0.1%
- Target: 99.9% success rate
- Measured: Sentry + application metrics
- Alerts: Triggered if > 5% errors for 5 minutes

**Recovery Time**: 
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 5 minutes

---

## 🔄 Daily Operations

```bash
# Morning health check (automated via cron)
kubectl get pods -n quantivis-production
kubectl get deployment quantivis-production -n quantivis-production -o wide

# Check logs
kubectl logs -f deployment/quantivis-production -n quantivis-production --tail=100

# Monitor metrics
# Datadog: https://app.datadoghq.com/dashboard/quantivis
# Sentry: https://sentry.io/organizations/quantivis

# Verify backups
ls -lt backups/ | head -5
az storage blob list --account-name quantivisbackups --container-name production | head -5
```

---

## 🚨 Incident Response

### During an Incident

1. **Declare incident**: Post to `#quantivis-incidents` on Slack
2. **Page on-call**: Trigger PagerDuty incident
3. **Assess impact**: How many users affected? What's broken?
4. **Stop bleeding**: Quick mitigation (scale up, restart pods, etc.)
5. **Root cause**: Investigate parallel to mitigation

### Post-Incident

1. **Document timeline**: When did incident start? When resolved?
2. **Root cause analysis**: Why did this happen?
3. **Preventive measures**: How do we prevent this in future?
4. **Post-mortem**: Team meeting to discuss and improve
5. **Update runbooks**: Keep docs current

---

## 📈 Performance Optimization

### Quick Wins (< 1 hour)

1. **Add database indexes** (100-500ms savings)
   ```sql
   CREATE INDEX idx_decisions_org_date ON decisions(organization_id, created_at DESC);
   ```

2. **Enable caching** (50-200ms savings)
   ```typescript
   const cached = await redis.get(`org:${orgId}`);
   ```

3. **Enable GZIP compression** (30-50% bandwidth savings)
   ```
   Nginx already configured in nginx.prod.conf
   ```

See [PERFORMANCE.md](./PERFORMANCE.md) for comprehensive optimization guide.

---

## 🔐 Security Checklist

- [ ] All secrets are encrypted at rest
- [ ] All communication over HTTPS/TLS
- [ ] Row-Level Security (RLS) enabled on all tables
- [ ] No hardcoded credentials in code
- [ ] Audit logging enabled on all tables
- [ ] Regular security scans (npm audit, trivy)
- [ ] Rate limiting enabled (nginx.prod.conf)
- [ ] CORS properly configured
- [ ] Security headers configured (nginx.prod.conf)

See [SECURITY.md](./SECURITY.md) for comprehensive security guide.

---

## 📞 Support & Escalation

| Issue | Severity | Response | Escalate |
|-------|----------|----------|----------|
| High error rate (>5%) | P1 | 5 min | On-call page |
| Latency spike (>2s) | P2 | 15 min | On-call page |
| Single pod crash | P3 | 30 min | Next morning |
| Data corruption | P1 | 5 min | VP Engineering |
| Security breach | P1 | 5 min | Security + VP Eng |

**Emergency Contacts**:
- On-Call Engineer: PagerDuty
- Engineering Manager: Slack
- VP Engineering: Emergency line

---

## 📚 Documentation Links

**For Different Roles**:

**Platform Engineers**:
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - How to safely deploy
- [MONITORING.md](./MONITORING.md) - Set up monitoring
- [scripts/deploy.sh](./scripts/deploy.sh) - Deployment automation

**SRE / Operations**:
- [OPERATIONS.md](./OPERATIONS.md) - Daily operations
- [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) - When things break
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

**Backend Engineers**:
- [PERFORMANCE.md](./PERFORMANCE.md) - Make it faster
- [src/test/critical-path.test.ts](./src/test/critical-path.test.ts) - What to test
- [SECURITY.md](./SECURITY.md) - Keep it secure

**All Engineers**:
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Debug common issues
- [README.md](./README.md) - General project info

---

## ✅ Pre-Production Checklist

Before going live:

- [ ] All documentation reviewed and approved
- [ ] All team members trained on deployment procedures
- [ ] Monitoring verified working (Datadog, Sentry, Prometheus)
- [ ] Backup/recovery tested and working
- [ ] Disaster recovery plan reviewed with team
- [ ] Incident response procedures documented and practiced
- [ ] Escalation paths clear to all team members
- [ ] On-call rotation established
- [ ] Customer support team notified of status page
- [ ] Performance baseline established
- [ ] Security audit passed
- [ ] Load testing completed (100+ concurrent users)

---

## 🎯 Key Metrics to Monitor

```promql
# Availability
avg(up{job="quantivis"})  # Target: 0.999 (99.9%)

# Latency
histogram_quantile(0.95, http_request_duration_seconds)  # Target: < 0.5s
histogram_quantile(0.99, http_request_duration_seconds)  # Target: < 1.0s

# Error Rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])  # Target: < 0.001 (0.1%)

# Resource Usage
container_memory_usage_bytes / container_spec_memory_limit_bytes  # Target: < 0.8
container_cpu_usage_seconds_total  # Target: < 1000m

# Business Metrics
rate(app_decisions_created_total[1m])  # Decisions per minute
rate(app_data_uploaded_bytes_total[1h]) / 1e9  # GB uploaded per hour
active_user_sessions  # Concurrent users
```

---

## 🔗 Important Links

**Monitoring & Observability**:
- Status Page: https://status.quantivis.io
- Datadog Dashboard: https://app.datadoghq.com/dashboard/quantivis
- Sentry Error Tracking: https://sentry.io/organizations/quantivis
- Prometheus Metrics: http://prometheus.quantivis.io
- Grafana Dashboards: http://grafana.quantivis.io

**Infrastructure**:
- Kubernetes Dashboard: https://dashboard.quantivis.io
- Container Registry: https://quantivis-registry.azurecr.io
- Log Aggregation: https://logs.quantivis.io

**Code & CI/CD**:
- GitHub Repository: https://github.com/quantivis/quantisights-pro
- GitHub Actions: https://github.com/quantivis/quantisights-pro/actions
- Deployment History: See [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## 🚀 Next Steps

1. **Immediate** (Before first deployment)
   - [ ] Review all documentation with team
   - [ ] Set up monitoring and alerts
   - [ ] Load test the production infrastructure
   - [ ] Practice disaster recovery procedures

2. **Week 1**
   - [ ] Deploy to staging
   - [ ] Run through deployment checklist
   - [ ] Verify all integrations working
   - [ ] Load test with production-like data volume

3. **Week 2**
   - [ ] Deploy to production
   - [ ] Monitor first 24 hours closely
   - [ ] Verify SLOs being met
   - [ ] Document any issues encountered

4. **Week 3+**
   - [ ] Optimize based on real-world performance
   - [ ] Tune alerts based on false positives
   - [ ] Scale based on actual usage patterns
   - [ ] Implement improvements from week 1-2

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-06 | Initial production deployment package |
| | | - Kubernetes deployment configuration |
| | | - Docker build & containerization |
| | | - Deployment automation scripts |
| | | - Operations runbook |
| | | - Disaster recovery procedures |
| | | - Monitoring & alerting setup |
| | | - Performance optimization guide |
| | | - Security hardening documentation |
| | | - Troubleshooting guide |
| | | - Critical path integration tests |

---

## 🎓 Additional Resources

**Learning**:
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

**Tools**:
- `kubectl` - Kubernetes CLI
- `psql` - PostgreSQL client
- `docker` - Container runtime
- `az` - Azure CLI
- `curl` - HTTP client

**Community**:
- Slack: #quantivis-alerts, #quantivis-incidents
- PagerDuty: quantivis-oncall (for incidents)
- GitHub: quantivis/quantisights-pro (for issues)

---

## 🤝 Contributing

Found an issue with deployment, operations, or documentation?

1. Create a GitHub issue with details
2. Submit a PR with fixes
3. Notify the platform team in Slack

---

**Questions?** Ask in #platform-engineering on Slack.

**Report an issue?** Create a GitHub issue or contact on-call engineer.

**Need help?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or escalate to platform team.
