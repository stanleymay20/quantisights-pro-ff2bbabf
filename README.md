# Quantivis — Historical Feature/Research Snapshot

> **Status: not the maintained production repository. Preserve for lineage and unique-work review.**

The maintained Quantivis repository is:

**https://github.com/stanleymay20/quantisights-pro-c6abd242**

This repository contains substantial July 2026 Quantivis engineering and research. Part of that work is already integrated into the maintained lineage—for example commit `28a6a08b80cebbe9a3250e2781eb6e743d1fdd37` is directly reachable from the canonical repository.

However, this is **not a disposable duplicate**. Later branch-only work is not reachable from canonical history, including:

- `7a4948edf2f6c5d80a0f6f72580064377493efef` — homepage live-trust metrics work;
- `74366d7b3eccee8633701e0ed658d76e0a17cfae` — Phase 2 structured-ingestion persistence design and migration proposal.

The Phase 2 migration was explicitly a proposal and was not applied to a production database. It should therefore be preserved as architectural/research evidence and reassessed against the current canonical schema before any future migration work.

## Development rule

Do not start new product development here. New work belongs in `quantisights-pro-c6abd242` unless a controlled handoff explicitly says otherwise.

Do not archive or delete this repository until its remaining unique work has been reviewed and either deliberately migrated, documented as superseded, or retained as research evidence.

See `LINEAGE.md` in the canonical Quantivis repository for the family-level evidence and consolidation rules.