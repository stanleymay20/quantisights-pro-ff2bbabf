import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import {
  BookOpen, Download, ChevronRight, Brain, Database, Shield, Zap,
  BarChart3, Target, Layers, GitBranch, Activity, Scale, Timer,
  Network, ShieldAlert, GitCompare, Gauge, FileText, Users, Crown,
  Shuffle, Search, Upload, CreditCard, Settings, Building2, TrendingUp,
  Radio, Webhook, Globe, Key,
} from "lucide-react";

/* ─── Section data ─── */
const DOC_SECTIONS = [
  {
    id: "overview",
    title: "Platform Overview",
    icon: BookOpen,
    content: `
## Quantivis Global — Autonomous Executive Intelligence Infrastructure

Quantivis replaces traditional BI tools and strategy consultants with an AI-driven, probabilistic governance platform for institutional capital. It ingests multi-source operational data, computes KPIs via a formula engine, and delivers role-specific executive intelligence across CEO, CFO, CMO, and COO command modes.

### Core Value Proposition
- **Real-time strategic oversight** — not retrospective reporting
- **Probabilistic, not deterministic** — every output carries confidence scores
- **Autonomous** — 6-hour cron-driven orchestration loop replaces manual consulting cycles
- **Institutionally defensible** — epistemic confidence capping, audit trails, Bayesian calibration

### Architecture
The platform uses a React/TypeScript frontend with Tailwind CSS, backed by Lovable Cloud (PostgreSQL with Row-Level Security, Edge Functions, and scheduled tasks). AI capabilities are powered through the Lovable AI gateway supporting multiple models (Gemini, GPT-5).

### Target Users
- **C-Suite Executives** — CEO, CFO, CMO, COO with role-specific intelligence
- **Board Members** — governance reports, convergence analysis
- **Strategy Teams** — scenario modeling, Monte Carlo simulation
- **Data Teams** — multi-source ingestion, KPI formula engine
    `,
  },
  {
    id: "data-ingestion",
    title: "Data Ingestion & Sources",
    icon: Database,
    content: `
## Data Ingestion Pipeline

### Supported Connectors
| Connector | Type | Status |
|-----------|------|--------|
| CSV Upload | File | Production |
| Stripe | API | Production |
| Google Analytics 4 | API | Beta |
| HubSpot | API | Beta |
| Salesforce | API | Beta |
| QuickBooks | API | Beta |
| PostgreSQL | Database | Beta |
| MySQL | Database | Beta |
| BigQuery | Warehouse | Beta |
| Webhook/API | Custom | Production |
| Manual Entry | Form | Production |

### CSV Validation Engine
The CSV upload pipeline includes:
1. **Multi-step column mapping** — map CSV headers to metric types
2. **Data quality scoring** — completeness, consistency, format checks
3. **Statistical depth gate** — minimum 8 data points required for intelligence
4. **Idempotency** — composite unique index (organization_id, metric_type, date, source_id)

### Data Quality Checks
Every dataset ingestion triggers automated quality checks:
- **Completeness** — percentage of non-null values
- **Consistency** — cross-field validation
- **Freshness** — configurable staleness policy (default: 24h)
- **Provenance** — full lineage tracking (source_type, upload_id, uploader_id)

### Dataset Versioning
All datasets maintain version history with rollback capability. Each version records:
- Column mapping snapshot
- Row count
- Change summary
- Created by and timestamp
    `,
  },
  {
    id: "kpi-engine",
    title: "KPI Formula Engine",
    icon: BarChart3,
    content: `
## KPI Builder & Computation Engine

### Formula System
KPIs are defined using a formula DSL that references metric types:
\`\`\`
revenue / customer_count           → Revenue per Customer
(revenue - costs) / revenue * 100  → Gross Margin %
new_customers / total_leads * 100  → Conversion Rate %
\`\`\`

### Aggregation Types
- **sum** — total across all data points
- **avg** — arithmetic mean
- **latest** — most recent value
- **weighted_avg** — quality-weighted average

### Computation Pipeline
1. Edge Function \`compute-kpi\` fetches dependent metrics
2. Formula is evaluated against the metric dataset
3. Results are versioned with \`computation_version\` and \`formula_snapshot\`
4. KPI values are stored with full input traceability (\`input_metric_ids\`)

### KPI Templates
Industry-specific templates provide pre-configured KPI sets:
- SaaS (MRR, ARR, Churn Rate, LTV, CAC, LTV:CAC)
- E-commerce (AOV, Conversion Rate, Cart Abandonment)
- Professional Services (Utilization, Revenue per Employee)
- Manufacturing (OEE, Yield Rate, Cycle Time)

### Targets & Tracking
Each KPI supports target-setting with date-bound goals. The system computes gap-to-target and trend direction automatically.
    `,
  },
  {
    id: "decision-intelligence",
    title: "Decision Intelligence Framework",
    icon: Brain,
    content: `
## Decision Intelligence — 14 Institutional-Grade Frameworks

Quantivis implements a comprehensive Decision Intelligence suite based on the *Probabilistic Governance Framework for Institutional Capital*.

### 1. Decision Fatigue Index
Monitors organizational decision-making health by tracking pending decisions, stale items (>7 days), and in-progress executions. Score 0-100 with critical/elevated/healthy thresholds.

### 2. Decision Velocity Tracking
Measures time-to-decision (recommendation → approval), execution time (approval → completion), total cycle time, and velocity trend (improving/stable/degrading).

### 3. Model Calibration
Tracks prediction accuracy and calibration error across completed decisions. The system computes rolling accuracy and auto-adjusts confidence scaling after 10+ measured outcomes.

### 4. Portfolio Simulation
Aggregates all decision simulations into portfolio-level metrics: total expected net impact, portfolio ROI, P10/P90 bounds, and average probability of positive ROI.

### 5. Correlation-Adjusted Portfolio Risk
Upgrades naive portfolio risk by computing pairwise input-variable correlations (cosine similarity), then adjusting portfolio variance: σ²_portfolio = Σσ²_i + 2·Σ(ρ_ij·σ_i·σ_j). Outputs adjusted VaR(95%), concentration risk, and diversification ratios.

### 6. Sensitivity Analysis (Tornado Charts)
Identifies which input variables (Revenue Δ%, Cost Δ%, Churn Δ%, Implementation Cost) drive the most outcome variance across simulations.

### 7. Bayesian Prior → Posterior Visualization
Charts the evolution of confidence scores over time as more decisions provide calibration data. Shows raw confidence, capped confidence, and rolling accuracy.

### 8. Value of Information (VoI)
Calculates Expected Value of Perfect Information (EVPI) and Expected Value of Sample Information (EVSI) to determine whether gathering more data before deciding is worth the cost/delay.

### 9. Decision Tree & Option Value
Models branching outcomes (Act Now / Defer / Abandon) with embedded real options theory. Calculates option value = max(act, defer, abandon) - act, identifying when deferral creates economic value.

### 10. Regret Minimization
Minimax regret analysis comparing decisions by worst-case regret across optimistic, pessimistic, and expected states. Ranks decisions by minimum maximum regret.

### 11. Counterfactual Analysis
Post-decision analysis comparing actual outcomes against baseline (without action) to quantify the true impact of each decision and measure prediction accuracy.

### 12. Decision Ledger & Audit Trail
Full lifecycle tracking from AI recommendation → approval → execution → outcome measurement. Links to specific simulation IDs and advisory instances.

### 13. Model Learning Loop
After 10+ completed decisions, the system computes rolling calibration error and automatically adjusts the internal confidence scaling factor for future recommendations.

### 14. Epistemic Confidence Capping
All AI-generated confidence scores are capped based on data volume:
- < 12 data points → max 60%
- < 30 data points → max 75%
- ≥ 30 data points → max 90%
    `,
  },
  {
    id: "monte-carlo",
    title: "Monte Carlo & Simulation Engine",
    icon: Shuffle,
    content: `
## Strategic Simulation Engine

### Dual-Layer Architecture
1. **Deterministic War-Room** — multi-variable scenario modeling with direct parameter control
2. **Probabilistic Monte Carlo** — advanced risk quantification using stochastic simulation

### Monte Carlo Engine
- **Model**: Geometric Brownian Motion (GBM) for path simulation
- **Runs**: Configurable up to 50,000 paths per simulation
- **Correlation**: Cholesky decomposition for correlated multi-variable effects
- **Outputs**:
  - Expected value (mean)
  - Median (P50)
  - P10 (pessimistic) and P90 (optimistic) bounds
  - Value-at-Risk (VaR 95%)
  - Probability of positive ROI
  - Probability of cash-flow stress

### Decision Impact Simulation
Each pending decision can be modeled with:
- Revenue delta percentage
- Cost delta percentage
- Churn change percentage
- Implementation cost
- Time to impact (months)

### War-Room Mode
When projected risk exceeds 80, the system triggers War-Room Mode — a high-urgency UI state with emergency action plans and escalation protocols.

### Confidence Governance
All simulation outputs carry:
- Raw confidence (from model)
- Capped confidence (epistemic limit based on data)
- Data sufficiency rating (limited/moderate/sufficient)
- Sample size disclosure
- Variance score
    `,
  },
  {
    id: "executive-modes",
    title: "Executive Command Modes",
    icon: Crown,
    content: `
## Role-Specific Executive Intelligence

### Supported Roles
| Role | Focus | Priority KPIs |
|------|-------|---------------|
| CEO | Strategic alignment, growth trajectory | Revenue, Growth Rate, ECI |
| CFO | Financial risk, cash flow, compliance | Margins, Cash Flow, Burn Rate |
| CMO | Customer acquisition, retention, brand | CAC, LTV, Churn, Conversion |
| COO | Operational efficiency, execution | Utilization, Cycle Time, SLA |

### Strategic Risk Index
Each role receives a 0-100 risk score computed from:
- KPI deviation from targets
- Trend direction and velocity
- Cross-role conflict penalties
- Data quality index

### Executive Briefs
AI-generated strategic briefs are:
- Cached for 6 hours (cost optimization)
- Refreshed when risk score changes >10 points
- Structured as JSON for consistent UI rendering
- Available in text and downloadable formats

### Alert System
Persistent, database-driven alerts with:
- Severity levels (info, warning, critical)
- Role-specific routing
- Notification channels (in-app, email, Slack)
- Escalation thresholds (configurable per org)
    `,
  },
  {
    id: "convergence",
    title: "Multi-Role Convergence Engine",
    icon: Layers,
    content: `
## Executive Convergence Index (ECI)

### What It Measures
The ECI quantifies structural alignment across the C-suite on a 0-100 scale.

### Computation Method
\`\`\`
ECI = 100 - (Role Risk Dispersion × 0.4)
        - (Conflict Penalty × 0.35)
        - (Volatility Divergence × 0.25)
\`\`\`

### Alignment Status
| Score | Status | Meaning |
|-------|--------|---------|
| ≥ 70 | Aligned | C-suite priorities are structurally coherent |
| ≥ 40 | Tension | Some role conflicts need resolution |
| ≥ 20 | Misalignment | Significant strategic divergence |
| < 20 | Structural Conflict | Immediate board-level intervention required |

### Conflict Detection
The engine automatically identifies when role-specific priorities create zero-sum dynamics:
- CFO cost-cutting vs CMO growth investment
- COO efficiency mandates vs CEO innovation targets
- Revenue targets vs margin preservation

### Trigger Model
- **Automatic**: on KPI recomputation
- **Manual**: on-demand refresh
- **Scheduled**: every 6 hours via cron reconciliation

### Usage Limits
- Starter: Disabled
- Growth: 10 calls/day
- Enterprise: Unlimited
    `,
  },
  {
    id: "advisory",
    title: "Advisory Engine & Lifecycle",
    icon: Zap,
    content: `
## Prescriptive Advisory Engine

### Advisory Types
- **Strategic** — growth, market positioning, competitive response
- **Operational** — efficiency, process optimization, resource allocation
- **Financial** — cost management, revenue optimization, risk mitigation
- **Compliance** — regulatory, governance, audit readiness

### Lifecycle States
\`\`\`
open → in_progress → resolved | dismissed
\`\`\`

### Ranking Algorithm
Advisories are prioritized by Risk-Adjusted Score:
\`\`\`
Score = Expected Value × Probability of Success × (1 - Confidence Penalty)
\`\`\`

### Playbook System
Each advisory includes structured playbook steps with:
- Action description
- Expected outcome
- Resource requirements
- Timeline
- Dependencies

### Versioning & Auditability
- Each advisory is versioned with generation_version
- Links to specific data snapshots (data_snapshot_date)
- Full source evidence tracking
- Resolution summaries for closed items
    `,
  },
  {
    id: "reporting",
    title: "Reporting & Strategy Pack",
    icon: FileText,
    content: `
## Enterprise Reporting Suite

### Report Types
| Type | Content | Use Case |
|------|---------|----------|
| Executive Summary | KPI overview, risk score, key insights | Weekly board updates |
| Diagnostic Report | Root cause analysis, trend detection | Operational reviews |
| Risk & Compliance | Risk indices, convergence, conflicts | Governance meetings |
| Growth Analysis | Revenue trends, cohort analysis, forecasts | Strategy planning |

### Strategy Pack (5-Slide Consulting Deliverable)
1. **Executive Posture** — governance banner with overall health
2. **Risk Heatmap** — 4×4 matrix (role × risk dimension)
3. **Probabilistic Outlook** — Monte Carlo distributions with P10/P90
4. **Decision Comparison** — side-by-side ROI and impact modeling
5. **Transparency Panel** — evidence, rationale, and confidence logic

### Board Governance Report
Print-optimized document featuring:
- Color-coded Governance Posture Banner (Green/Amber/Red)
- 30-day ECI trend and role-specific risk movement
- Risk Attribution breakdown of ECI components
- AI-refined board intervention recommendations (Enterprise tier)

### Export Formats
All reports are print-optimized and can be exported as PDF via browser print.
    `,
  },
  {
    id: "orchestration",
    title: "Autonomous Orchestration Engine",
    icon: Activity,
    content: `
## 6-Hour Autonomous Intelligence Loop

The Executive Orchestration Engine replicates a full consulting engagement cycle automatically:

### Pipeline Steps (executed every 6 hours)
1. **Connector Sync** — pull latest data from all active integrations
2. **KPI Recomputation** — evaluate all active KPI formulas
3. **Diagnostic Analysis** — AI-driven root cause detection
4. **Advisory Generation** — prescriptive recommendations
5. **Risk Score Update** — recompute role-specific risk indices
6. **Convergence Reconciliation** — update ECI and detect conflicts
7. **Executive Brief Dispatch** — send memos to configured channels

### Trigger Types
- **Scheduled** — pg_cron every 6 hours
- **Manual** — admin-triggered on demand
- **Event-driven** — triggered by data upload or critical threshold breach

### Monitoring
Each orchestration run is logged with:
- Start/completion timestamps
- Duration in milliseconds
- Steps completed (as JSON array)
- Error messages (if any)
- Trigger type
    `,
  },
  {
    id: "security",
    title: "Security & Access Control",
    icon: Shield,
    content: `
## Enterprise Security Architecture

### Authentication
- Email/password with email verification
- Multi-Factor Authentication (MFA) via TOTP
- Password reset flow with secure token
- Session management with automatic refresh

### Authorization (RBAC)
| Role | Permissions |
|------|------------|
| Owner | Full access, billing, team management, data deletion |
| Admin | Data management, KPI creation, advisory access, settings |
| Member | Read access to dashboards, reports, insights |

### Row-Level Security (RLS)
Every table enforces organization-level data isolation:
- \`is_org_member(auth.uid(), organization_id)\` for read access
- \`get_user_org_role(auth.uid(), organization_id)\` for write access
- Service-role functions for system operations

### Data Protection
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Organization-scoped data isolation — no cross-tenant access
- Audit logging for all administrative actions
- GDPR-compliant data export endpoint
- Configurable data retention policies

### Compliance
- GDPR — Data Processing Agreement, Subprocessor disclosure
- SOC 2 Type II alignment (in progress)
- Cookie policy with consent management
- Right to data portability (/data-export)
    `,
  },
  {
    id: "billing",
    title: "Subscription & Billing",
    icon: CreditCard,
    content: `
## Stripe-Powered Subscription System

### Tier Structure
| Feature | Starter (€29) | Growth (€99) | Enterprise (€299) |
|---------|---------|--------|------------|
| Data Sources | 2 | 10 | Unlimited |
| KPIs | 5 | 25 | Unlimited |
| Simulations/day | 5 | 50 | Unlimited |
| Copilot messages/day | 20 | 100 | Unlimited |
| Convergence/day | — | 10 | Unlimited |
| Realtime Streaming | — | ✓ | ✓ |
| Executive Modes | 1 role | 4 roles | 4 roles + AI |
| Team Members | 1 | 5 | Unlimited |
| Reports | Basic | Full suite | Full + Board |
| Strategy Pack | — | ✓ | ✓ |
| Board Report | — | — | ✓ |
| API Access | — | — | ✓ |

### Billing Infrastructure
- Stripe Checkout for new subscriptions
- Stripe Customer Portal for management
- Webhook-driven status sync
- Server-side plan enforcement via Edge Function
- Prorated upgrades/downgrades
    `,
  },
  {
    id: "team",
    title: "Team & Organization",
    icon: Users,
    content: `
## Multi-Tenant Organization System

### Organization Model
Each user belongs to an organization created on signup. Organizations provide:
- Shared data namespace
- Team member management
- Role-based access control
- Subscription and billing scope

### Invitation System
1. Admin sends invitation (email + role)
2. Invitation token generated with 7-day expiry
3. Invitee receives email with accept link
4. On acceptance: email verification, membership creation
5. Token invalidated after use

### Roles
- **Owner** — created on org formation, full administrative control
- **Admin** — data and configuration management
- **Member** — read-only access to intelligence outputs

### Multi-Organization Support
Users can be members of multiple organizations via the organization_members table. An org switcher in the dashboard allows seamless context switching.
    `,
  },
  {
    id: "api-reference",
    title: "Edge Functions Reference",
    icon: Zap,
    content: `
## Backend Functions Reference

### Intelligence Functions
| Function | Method | Description |
|----------|--------|-------------|
| \`generate-insights\` | POST | AI-driven insight generation from KPI data |
| \`ai-kpi-analysis\` | POST | Deep KPI trend analysis with AI |
| \`ai-scenario-analysis\` | POST | AI-powered scenario evaluation |
| \`diagnostic-engine\` | POST | Automated root cause analysis |
| \`prescriptive-advisory\` | POST | Generate strategic recommendations |
| \`executive-brief\` | POST | Role-specific executive intelligence |
| \`executive-copilot\` | POST | Conversational AI copilot (SSE) |

### Simulation Functions
| Function | Method | Description |
|----------|--------|-------------|
| \`monte-carlo-sim\` | POST | Monte Carlo risk simulation |
| \`simulate-scenario\` | POST | Deterministic scenario modeling |
| \`decision-impact-sim\` | POST | Decision outcome simulation |
| \`strategic-simulation\` | POST | Multi-variable strategic simulation |

### Orchestration Functions
| Function | Method | Description |
|----------|--------|-------------|
| \`executive-orchestration\` | POST | Trigger full intelligence pipeline |
| \`convergence-reconcile\` | POST | ECI recomputation |
| \`compute-executive-signals\` | POST | Role-specific signal computation |
| \`compute-kpi\` | POST | KPI formula evaluation |

### Data Functions
| Function | Method | Description |
|----------|--------|-------------|
| \`connector-pull\` | POST | Sync data from external source |
| \`webhook-ingest\` | POST | Receive webhook payloads |
| \`seed-demo-data\` | POST | Generate demo dataset |
| \`data-export\` | POST | GDPR data portability export |
| \`rollback-dataset-version\` | POST | Revert dataset to prior version |

### Billing Functions
| Function | Method | Description |
|----------|--------|-------------|
| \`create-checkout\` | POST | Initiate Stripe Checkout |
| \`customer-portal\` | POST | Redirect to Stripe Portal |
| \`check-subscription\` | POST | Verify subscription status |
| \`stripe-webhook\` | POST | Handle Stripe events |

### Notification Functions
| Function | Method | Description |
|----------|--------|-------------|
| \`send-executive-alert\` | POST | Dispatch alert to channels |
| \`test-executive-alert\` | POST | Test alert delivery |
| \`weekly-executive-brief\` | POST | Scheduled weekly digest |

### Authentication
All functions require a valid JWT in the Authorization header (except \`stripe-webhook\` and \`webhook-ingest\` which use their own authentication).
    `,
  },
  {
    id: "data-model",
    title: "Data Model Reference",
    icon: Database,
    content: `
## Database Schema

### Core Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| \`organizations\` | Tenant container | Owner/member access |
| \`profiles\` | User profile data | Self + org member read |
| \`organization_members\` | Role assignments | Org-scoped |
| \`user_roles\` | App-level roles | Self-read |

### Intelligence Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| \`metrics\` | Raw operational data | Org member read, admin write |
| \`datasets\` | Dataset metadata | Org member read, uploader write |
| \`dataset_versions\` | Version history | Org member read |
| \`kpis\` | KPI definitions | Org member read, admin write |
| \`kpi_values\` | Computed KPI values | Org member read |
| \`kpi_targets\` | KPI goals | Org member read, admin write |
| \`insights\` | AI-generated insights | Org member read |

### Decision Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| \`decision_ledger\` | Decision lifecycle | Org member read, admin write |
| \`decision_simulations\` | Simulation results | Org member read, admin write |
| \`advisory_instances\` | Prescriptive advisories | Org member read, admin write |

### Executive Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| \`executive_modes\` | Role configurations | Org member read, admin write |
| \`executive_risk_index\` | Risk scores | Org member read |
| \`executive_briefs\` | AI briefs | Org member read |
| \`executive_alerts\` | Alert instances | Org member read |
| \`executive_conflicts\` | Cross-role conflicts | Org member read |
| \`executive_convergence_index\` | ECI snapshots | Org member read |

### Operational Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| \`data_sources\` | Connector configs | Org member read, admin write |
| \`data_sync_jobs\` | Sync job tracking | Org member read |
| \`data_quality_checks\` | Quality audit | Org member read |
| \`audit_log\` | Admin action log | Admin read only |
| \`intelligence_audit_trail\` | AI decision log | Admin read only |
| \`orchestration_runs\` | Pipeline runs | Org member read |
    `,
  },
  {
    id: "realtime-streaming",
    title: "Realtime Data Streaming",
    icon: Radio,
    content: `
## Realtime Metric Streaming (Growth+ Tier)

### Overview
The platform supports both **batch data ingestion** and **live realtime streaming**. When enabled, dashboards auto-update within milliseconds of new data arriving — no manual refresh required.

### Data Modes
| Mode | Mechanism | Tier | Latency |
|------|-----------|------|---------|
| Batch | CSV upload, connector sync, webhook POST | All tiers | On-demand |
| Realtime | PostgreSQL LISTEN/NOTIFY via WebSocket | Growth & Enterprise | < 500ms |

### How It Works
1. Data arrives via any ingestion channel (webhook, connector, CSV)
2. PostgreSQL fires a change event on the \`metrics\` table
3. The \`supabase_realtime\` publication broadcasts the event
4. Connected Growth/Enterprise clients receive the payload via WebSocket
5. Dashboard state updates in-place (sorted insert, no full refetch)

### Subscription Gating
Realtime streaming is gated by the \`useSubscriptionGate\` hook:
- **Starter**: Batch-only — data loads on page navigation
- **Growth**: Full realtime — INSERT, UPDATE, DELETE events streamed live
- **Enterprise**: Full realtime + priority channel allocation

### Events Handled
| Event | Behavior |
|-------|----------|
| INSERT | New metric sorted into timeline, derived KPIs recomputed |
| UPDATE | Existing metric replaced in-place |
| DELETE | Metric removed, derived values recalculated |

### UI Indicators
The \`useMetrics\` hook exposes:
- \`isStreaming\` — boolean, true when WebSocket is active and subscribed
- \`canStream\` — boolean, true when user's tier permits realtime access

These flags can be used to render a live pulse indicator or "LIVE" badge on dashboards.

### Technical Details
- Channel name: \`metrics-live-{organization_id}\`
- Filter: \`organization_id=eq.{orgId}\` (scoped to active tenant)
- Protocol: WebSocket via Supabase Realtime (Phoenix Channels)
- Reconnection: Automatic with exponential backoff
    `,
  },
  {
    id: "webhook-api",
    title: "Webhook Ingestion API",
    icon: Webhook,
    content: `
## Webhook Ingestion API

### Overview
The \`webhook-ingest\` Edge Function provides a production-grade HTTP endpoint for pushing metric data into the platform from external systems — CRMs, ERPs, payment processors, custom applications.

### Authentication
Webhook sources authenticate via a hashed API key:
1. When creating a data source of type \`webhook\`, a unique API key is generated
2. The key is SHA-256 hashed and stored in \`data_sources.credentials_key_hash\`
3. Callers include the raw key in the \`x-api-key\` header
4. The function hashes the incoming key and matches against stored hashes

### Required Headers
| Header | Description |
|--------|-------------|
| \`x-api-key\` | Data source API key (SHA-256 verified) |
| \`x-request-id\` | Unique request ID for idempotency |
| \`Content-Type\` | \`application/json\` |

### Request Body
\`\`\`json
{
  "records": [
    { "date": "2025-01-15", "value": 42500, "metric_type": "revenue" },
    { "date": "2025-01-15", "value": 120, "metric_type": "customers", "region": "US" }
  ]
}
\`\`\`
Also accepts: bare array, or object with \`data\` key.

### Field Mapping
Custom field names can be configured in the data source's \`config.field_mapping\`:
\`\`\`json
{ "date": "transaction_date", "value": "amount", "metric_type": "type" }
\`\`\`

### Validation Rules
- Dates must be valid ISO format and within 5 years
- Values must be finite numbers, |value| ≤ 1 trillion
- Maximum 10,000 records per request
- Maximum 100KB body size

### Rate Limits
- **Per request**: 10,000 records
- **Per hour per source**: 50,000 records
- Returns HTTP 429 when exceeded

### Idempotency
Duplicate \`x-request-id\` values return HTTP 409 (Conflict) — safe to retry on network errors.

### Response
\`\`\`json
{
  "success": true,
  "records_synced": 45,
  "records_skipped": 2,
  "validation_errors": ["Record 3: invalid date \\"abc\\""],
  "job_id": "uuid"
}
\`\`\`
    `,
  },
  {
    id: "legal-compliance",
    title: "Legal & Compliance",
    icon: Globe,
    content: `
## Legal Framework & GDPR Compliance

### Documentation Pages
| Document | Route | Purpose |
|----------|-------|---------|
| Terms of Service | \`/terms\` | Platform usage terms |
| Privacy Policy | \`/privacy\` | Data collection & processing |
| Cookie Policy | \`/cookie-policy\` | Cookie consent & management |
| Data Processing Agreement | \`/data-processing\` | GDPR DPA for enterprise |
| Data Retention Policy | \`/data-retention\` | Retention schedules by data type |
| Subprocessor Disclosure | \`/subprocessors\` | Third-party data processors |

### GDPR Rights Implemented
- **Right to Access** — users can view all personal data via the application
- **Right to Portability** — \`/data-export\` endpoint exports all organization data as JSON
- **Right to Erasure** — \`delete-account\` Edge Function removes all user data
- **Right to Rectification** — profile and organization data editable in settings

### Data Export
The \`data-export\` Edge Function provides a comprehensive export including:
- Organization profile and settings
- All metrics and KPI values
- Decision ledger entries
- Advisory instances
- Audit log entries

### Audit Trail
All administrative actions are logged in the \`audit_log\` table:
- Actor ID and type (user/system)
- Action type (create/update/delete)
- Resource type and ID
- IP address
- Full payload snapshot
- Timestamp
    `,
  },
];

/* ─── Downloadable section component ─── */
const DocSection = ({
  section,
  sectionRef,
}: {
  section: (typeof DOC_SECTIONS)[0];
  sectionRef: (el: HTMLDivElement | null) => void;
}) => {
  const handleDownload = () => {
    const blob = new Blob(
      [`# ${section.title}\n\n${section.content.trim()}`],
      { type: "text/markdown" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantivis-${section.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={sectionRef} id={section.id} className="glass-card rounded-xl p-8 scroll-mt-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <section.icon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-display">{section.title}</h2>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download .md
        </button>
      </div>
      <div className="prose prose-sm prose-invert max-w-none
        prose-headings:font-display prose-headings:text-foreground
        prose-h2:text-base prose-h2:mt-0 prose-h2:mb-3
        prose-h3:text-sm prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-muted-foreground prose-p:text-[13px] prose-p:leading-relaxed
        prose-li:text-muted-foreground prose-li:text-[13px]
        prose-strong:text-foreground
        prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border/30
        prose-table:text-[12px]
        prose-th:text-foreground prose-th:font-semibold prose-th:border-border/50 prose-th:px-3 prose-th:py-2
        prose-td:text-muted-foreground prose-td:border-border/30 prose-td:px-3 prose-td:py-1.5
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content.trim()}</ReactMarkdown>
      </div>
    </div>
  );
};

/* ─── Main Page ─── */
const Documentation = () => {
  const [activeSection, setActiveSection] = useState(DOC_SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleDownloadAll = () => {
    const fullDoc = DOC_SECTIONS.map(
      (s) => `# ${s.title}\n\n${s.content.trim()}`
    ).join("\n\n---\n\n");
    const blob = new Blob([fullDoc], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quantivis-full-documentation.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <SidebarMobileToggle />
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold font-display">Documentation</h1>
          </div>
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download All (.md)
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* TOC Sidebar */}
          <nav className="w-56 shrink-0 border-r border-border/30 overflow-y-auto py-4 px-3 hidden lg:block">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 mb-3">
              Contents
            </p>
            {DOC_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                  activeSection === s.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <s.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{s.title}</span>
                {activeSection === s.id && (
                  <ChevronRight className="w-3 h-3 ml-auto shrink-0" />
                )}
              </button>
            ))}
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-[900px] mx-auto space-y-6">
              {DOC_SECTIONS.map((s) => (
                <DocSection
                  key={s.id}
                  section={s}
                  sectionRef={(el) => {
                    sectionRefs.current[s.id] = el;
                  }}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
