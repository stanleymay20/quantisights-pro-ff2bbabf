# 📈 Production Monitoring Setup

**Last Updated**: March 6, 2026  
**Platform**: Prometheus + Datadog + Sentry + Grafana

---

## 🎯 Monitoring Tiers

### Tier 1: Infrastructure
- Pod health and resource usage
- Node resource utilization
- Network connectivity
- Storage availability

### Tier 2: Application
- API request rates and latencies
- Error rates and types
- Database query performance
- Cache hit rates
- Authentication requests

### Tier 3: Business
- Decisions created/updated
- Calibration runs
- Portfolio companies tracked
- Data accuracy metrics
- User activity

---

## 🚨 Alert Rules

### Critical Alerts (P1 - Page On-Call)

```yaml
# High Error Rate
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
for: 5m
annotations:
  summary: "High error rate ({{ $value | humanizePercentage }})"
  action: "Check logs: kubectl logs -f deployment/quantivis-production"
  
# Service Down
alert: ServiceDown
expr: up{job="quantivis"} == 0
for: 1m
annotations:
  summary: "Service is down"
  action: "kubectl get pods -n quantivis-production"

# Database Unavailable
alert: DatabaseDown
expr: pg_database_datconnlimit == -1  # connection limit query
for: 1m
annotations:
  summary: "Database connection failed"
  action: "Check database logs and connection pool"

# Out of Memory
alert: PodOOM
expr: container_last_seen_timestamp{pod=~"quantivis.*"} - container_memory_usage_bytes > 0.9 * container_spec_memory_limit_bytes
for: 1m
annotations:
  summary: "Pod approaching OOM: {{ $labels.pod }}"
  action: "Scale up memory: kubectl set resources deployment quantivis-production --limits=memory=2Gi"
```

### High Alerts (P2 - Page On-Call, 15min delay)

```yaml
# High Latency
alert: HighLatency
expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
for: 15m
annotations:
  summary: "p95 latency > 1s: {{ $value | humanizeDuration }}"
  action: "Check slow queries: EXPLAIN ANALYZE"

# High CPU Usage
alert: HighCPU
expr: node_cpu_guest_seconds_total > 0.8
for: 10m
annotations:
  summary: "Node CPU > 80%: {{ $labels.node }}"
  action: "Scale horizontally or optimize queries"

# Database Replication Lag
alert: ReplicationLag
expr: pg_replication_lag_seconds > 30
for: 5m
annotations:
  summary: "Replication lag > 30s"
  action: "Check backup jobs and network"
```

### Medium Alerts (P3 - No page, check in morning)

```yaml
# Slow Query
alert: SlowQueries
expr: count(pg_stat_statements_query_seconds > 5) > 10
for: 10m
annotations:
  summary: "{{ $value }} slow queries detected"

# Cache Evictions
alert: CacheEvictions
expr: redis_evicted_keys_total > 100
for: 15m
annotations:
  summary: "Cache eviction rate high"
  action: "Increase cache memory or optimize cache keys"
```

---

## 📊 Key Metrics to Monitor

### Availability

```promql
# Uptime
avg(up{job="quantivis"})

# Success rate
rate(http_requests_total{status="200"}[5m]) / rate(http_requests_total[5m])

# Endpoint availability by path
sum by (path) (rate(http_requests_total{status="200"}[5m])) / 
sum by (path) (rate(http_requests_total[5m]))
```

### Performance

```promql
# Request latency p50, p95, p99
histogram_quantile(0.50, http_request_duration_seconds)
histogram_quantile(0.95, http_request_duration_seconds)
histogram_quantile(0.99, http_request_duration_seconds)

# Database query latency
histogram_quantile(0.95, db_query_duration_seconds)

# Cache hit rate
rate(cache_hits[5m]) / (rate(cache_hits[5m]) + rate(cache_misses[5m]))
```

### Reliability

```promql
# Error rate by endpoint
sum by (path) (rate(http_requests_total{status=~"5.."}[5m])) / 
sum by (path) (rate(http_requests_total[5m]))

# Error types
sum by (error_type) (rate(app_errors_total[5m]))

# Failed authentication attempts
rate(auth_failures_total[5m])
```

### Resource Usage

```promql
# Memory usage ratio
container_memory_usage_bytes / container_spec_memory_limit_bytes

# CPU usage
container_cpu_usage_seconds_total

# Disk usage
node_filesystem_avail_bytes / node_filesystem_size_bytes

# Network I/O
rate(container_network_transmit_bytes_total[5m])
rate(container_network_receive_bytes_total[5m])
```

### Business Metrics

```promql
# Decisions created per minute
rate(app_decisions_created_total[1m])

# Calibration runs per hour
rate(app_calibration_runs_total[1h])

# Active users (from metrics)
active_user_sessions

# Data uploaded (GB/hour)
rate(app_data_uploaded_bytes_total[1h]) / 1e9
```

---

## 🔍 Datadog Configuration

### Create Dashboard

```bash
# API call to create Datadog dashboard
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
  -d @k8s/datadog-dashboard.json
```

### Datadog Monitors

```bash
# CPU monitor
{
  "type": "metric alert",
  "query": "avg(last_5m):avg:system.cpu.user{k8s_namespace:quantivis-production} > 0.7",
  "name": "High CPU usage",
  "options": {
    "thresholds": {"critical": 0.7, "warning": 0.5},
    "notify_audit": true
  }
}

# Memory monitor
{
  "type": "metric alert",
  "query": "avg(last_5m):avg:kubernetes.memory.requests_pct{k8s_namespace:quantivis-production} > 0.8",
  "name": "High memory usage"
}
```

---

## 📋 Sentry Configuration

### Error Tracking

```python
# src/lib/logger.ts configuration
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  
  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Add releases for tracking
  release: process.env.VERSION,
  
  // Filter out noise
  beforeSend(event, hint) {
    // Ignore 404s
    if (event.status === 404) return null;
    
    // Ignore network errors (likely client issue)
    if (hint.originalException?.message?.includes('Network')) return null;
    
    return event;
  },
  
  // Track performance
  integrations: [
    new Sentry.Replay({ maskAllText: true, blockAllMedia: true })
  ]
});

// Capture user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  organization: user.organization_id
});

// Breadcrumbs
Sentry.captureMessage("User created decision", "info", {
  tags: { decision_id: id }
});
```

### Sentry Alerts

```bash
# Alert on new error type
curl -X POST "https://sentry.io/api/0/projects/quantivis/quantivis/rules/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -d '{
    "actionMatch": "any",
    "actions": [
      {
        "service": "slack",
        "channel": "#quantivis-alerts",
        "workspace": "quantivis-workspace"
      }
    ],
    "conditions": [
      {
        "id": "sentry.rules.conditions.first_seen_event"
      }
    ],
    "name": "Alert on new error types",
    "frequency": 30
  }'
```

---

## 🔔 Alert Channels

### Slack Integration

```yaml
# Send to #quantivis-alerts
channels:
  critical: "#quantivis-critical"
  warnings: "#quantivis-alerts"
  info: "#quantivis-monitoring"

# Configure notification format
format: |
  🚨 {{ alert.name }}
  Severity: {{ alert.severity }}
  Service: {{ alert.labels.service }}
  Value: {{ alert.value }}
  Runbook: https://quantivis.io/docs/runbooks/{{ alert.name }}
```

### PagerDuty Integration

```bash
# Create incidents for P1 alerts
curl -X POST "https://events.pagerduty.com/v2/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "'$PAGERDUTY_KEY'",
    "event_action": "trigger",
    "payload": {
      "summary": "High error rate detected",
      "severity": "critical",
      "source": "Prometheus",
      "component": "quantivis-api"
    }
  }'
```

### Email Alerts

```yaml
# Critical issues only
to: on-call@quantivis.io
subject: "[CRITICAL] {{ alert.name }}"
```

---

## 📈 SLA Monitoring

### Service Level Indicators (SLIs)

```promql
# Availability SLI: 99.9%
rate(http_requests_total{status!="5.."}[5m]) / rate(http_requests_total[5m]) > 0.999

# Latency SLI: p99 < 1s
histogram_quantile(0.99, http_request_duration_seconds) < 1

# Error Budget SLI: <0.1% errors
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) < 0.001
```

### SLA Reporting

**Monthly SLA Report** (auto-generated):
- Uptime: 99.95% ✅ (Target: 99.9%)
- Latency p99: 450ms ✅ (Target: 1s)
- Error rate: 0.05% ✅ (Target: 0.1%)
- Error budget remaining: 43.2 minutes

---

## 🧪 Testing Alerts

```bash
# Send test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "labels": {
        "alertname": "TestAlert",
        "severity": "critical"
      },
      "annotations": {
        "summary": "This is a test alert"
      }
    }
  ]'
```

---

## 📚 Dashboards to Create

- **Overview**: Uptime, error rate, latency, resource usage
- **Performance**: Latency p50/p95/p99, throughput, slow queries
- **Errors**: Error rate by endpoint, error types, stack traces
- **Resources**: CPU, memory, network, disk
- **Business**: Decisions/hour, users online, data uploaded
- **Dependencies**: Database, cache, external APIs
- **Incidents**: Recent issues, alert history, MTTR

---

## 🔗 Links

- **Prometheus**: http://prometheus.quantivis.io
- **Grafana**: http://grafana.quantivis.io
- **Datadog**: https://app.datadoghq.com/dashboard/quantivis
- **Sentry**: https://sentry.io/organizations/quantivis
- **PagerDuty**: https://quantivis.pagerduty.com
- **Status Page**: https://status.quantivis.io
