## Full Platform Hardening Plan

### Phase 1: Fix Fake Embeddings (Critical)
- Replace LLM-prompted pseudo-embeddings with deterministic TF-IDF-inspired hash-based vectors
- Use consistent, reproducible vector generation via cryptographic hashing + n-gram decomposition
- Ensure cosine similarity produces meaningful results
- Update `embeddings.ts` shared module

### Phase 2: Add Real ML Capabilities
- Implement server-side **k-means clustering** engine for customer segmentation
- Implement **ARIMA/auto-correlation forecasting** beyond Holt's smoothing
- Add **decision tree classifier** using entropy-based splitting
- Add **feature importance** ranking via permutation-based scoring
- Create `ml-engine` edge function with proper statistical ML

### Phase 3: Strengthen Data Engineering
- Add **schema evolution tracking** table + migration
- Add **time-based partitioning indexes** on metrics table (immutable date_trunc)
- Implement **entity resolution** utility for fuzzy matching across data sources
- Add **data lineage graph** tracking (source → transform → output)
- Create **materialized aggregate refresh** via database function

### Phase 4: Enhance Data Analysis
- Implement proper **cohort analysis engine** with retention curves
- Add **A/B testing framework** with statistical significance calculator
- Implement **pivot table engine** for ad-hoc exploration
- Add **geospatial aggregation** support for region-based metrics

### Phase 5: Database Migrations
- `decision_embeddings` improvements (if needed)
- `schema_evolution_log` table
- `data_lineage` table
- `ab_experiments` table
- `cohort_definitions` table
- Partitioning indexes on large tables
