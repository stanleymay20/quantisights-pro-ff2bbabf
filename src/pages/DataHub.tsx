/**
 * Data Hub — Reference Intelligence Command Center
 *
 * Surfaces AICIS + Layer B reference signals (internal_reference_data) in an
 * executive-friendly view. Strict separation from client datasets:
 *   • client truth lives in /data-sources, /dataset-explorer
 *   • reference intelligence (macro, country, industry signals) lives here
 *
 * Tabs:
 *   1. Overview         — headline KPIs across all reference signals
 *   2. AICIS            — country-intelligence signals with filters
 *   3. Sync History     — vendor health, schedules, manual refresh
 *   4. Data Quality     — gaps, staleness, duplicates, provider breakdown
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Globe2,
  Database,
  Activity,
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReferenceRow {
  id: string;
  category: string;
  metric_name: string;
  value: number;
  unit: string | null;
  region: string | null;
  industry: string | null;
  period_start: string | null;
  period_end: string | null;
  source: string;
  source_url: string | null;
  confidence_grade: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface VendorSource {
  id: string;
  vendor_key: string;
  vendor_name: string;
  category: string;
  is_active: boolean;
  last_refreshed_at: string | null;
  next_refresh_at: string | null;
  refresh_interval_hours: number;
  trust_level: number;
  last_error: string | null;
  license_type: string | null;
}

const ALL = "__all__";
const AICIS_VENDOR_KEY = "aicis";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const num = (n: number, digits = 2) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";

const safeMeta = (row: ReferenceRow, key: string): string | number | null => {
  const m = row.metadata;
  if (!m || typeof m !== "object") return null;
  const v = (m as Record<string, unknown>)[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  return null;
};

const getProvider = (row: ReferenceRow): string => {
  const p = safeMeta(row, "source_provider");
  return (typeof p === "string" && p) || row.source;
};

const getDomain = (row: ReferenceRow): string => {
  const d = safeMeta(row, "domain");
  if (typeof d === "string" && d) return d;
  // fall back to second segment of metric key (aicis.<domain>.metric.ISO3)
  const parts = row.metric_name.split(".");
  return parts.length >= 3 ? parts[1] : row.category;
};

const getConfidence = (row: ReferenceRow): number | null => {
  const c = safeMeta(row, "confidence");
  if (typeof c === "number") return c <= 1 ? c * 100 : c;
  // Fallback from grade
  switch (row.confidence_grade) {
    case "A":
      return 90;
    case "B":
      return 75;
    case "C":
      return 60;
    case "D":
      return 40;
    default:
      return null;
  }
};

const getFreshness = (row: ReferenceRow): number | null => {
  const f = safeMeta(row, "freshness_score");
  if (typeof f === "number") return f <= 1 ? f * 100 : f;
  if (!row.period_start) return null;
  const days = (Date.now() - new Date(row.period_start).getTime()) / 86400000;
  if (days <= 1) return 100;
  if (days >= 30) return 30;
  return Math.max(30, 100 - days * 2);
};

const fmtAge = (iso: string | null) =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "—";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DataHub() {
  const { toast } = useToast();
  const { currentOrgId, loading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReferenceRow[]>([]);
  const [sources, setSources] = useState<VendorSource[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  // AICIS filters
  const [filterCountry, setFilterCountry] = useState<string>(ALL);
  const [filterDomain, setFilterDomain] = useState<string>(ALL);
  const [filterProvider, setFilterProvider] = useState<string>(ALL);
  const [filterPeriod, setFilterPeriod] = useState<string>("90"); // last N days

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [refRes, srcRes] = await Promise.all([
        supabase
          .from("internal_reference_data")
          .select("*")
          .eq("organization_id", currentOrgId)
          .order("updated_at", { ascending: false })
          .limit(5000),
        supabase
          .from("external_data_sources")
          .select(
            "id, vendor_key, vendor_name, category, is_active, last_refreshed_at, next_refresh_at, refresh_interval_hours, trust_level, last_error, license_type"
          )
          .eq("organization_id", currentOrgId)
          .order("vendor_key"),
      ]);

      if (refRes.error) throw refRes.error;
      if (srcRes.error) throw srcRes.error;

      setRows((refRes.data ?? []) as ReferenceRow[]);
      setSources((srcRes.data ?? []) as VendorSource[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to load reference data", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, toast]);

  useEffect(() => {
    if (!orgLoading) void load();
  }, [orgLoading, load]);

  // ── Sync trigger ─────────────────────────────────────────────────────────
  const triggerSync = async (sourceId: string, vendorName: string) => {
    setSyncing(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-external-signals", {
        body: { mode: "manual", source_id: sourceId },
      });
      if (error) throw error;
      toast({
        title: "Sync started",
        description: `${vendorName}: ${data?.rows_ingested ?? data?.message ?? "Refresh dispatched"}`,
      });
      // Refresh after a short delay to let the function update the row
      setTimeout(() => void load(), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Sync failed", description: msg, variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  };

  // ── Derived: AICIS subset ────────────────────────────────────────────────
  const aicisRows = useMemo(
    () => rows.filter((r) => r.source.toLowerCase().includes("aicis") || r.metric_name.startsWith("aicis.")),
    [rows]
  );

  const aicisCountries = useMemo(
    () => Array.from(new Set(aicisRows.map((r) => r.region).filter(Boolean) as string[])).sort(),
    [aicisRows]
  );
  const aicisDomains = useMemo(
    () => Array.from(new Set(aicisRows.map(getDomain).filter(Boolean))).sort(),
    [aicisRows]
  );
  const aicisProviders = useMemo(
    () => Array.from(new Set(aicisRows.map(getProvider).filter(Boolean))).sort(),
    [aicisRows]
  );

  const filteredAicis = useMemo(() => {
    const cutoff =
      filterPeriod === "all" ? 0 : Date.now() - Number(filterPeriod) * 86400000;
    return aicisRows.filter((r) => {
      if (filterCountry !== ALL && r.region !== filterCountry) return false;
      if (filterDomain !== ALL && getDomain(r) !== filterDomain) return false;
      if (filterProvider !== ALL && getProvider(r) !== filterProvider) return false;
      if (cutoff && r.period_start) {
        const t = new Date(r.period_start).getTime();
        if (t < cutoff) return false;
      }
      return true;
    });
  }, [aicisRows, filterCountry, filterDomain, filterProvider, filterPeriod]);

  // ── Overview KPIs ────────────────────────────────────────────────────────
  const overview = useMemo(() => {
    const totalSignals = rows.length;
    const activeSources = sources.filter((s) => s.is_active).length;
    const countries = new Set(rows.map((r) => r.region).filter(Boolean)).size;
    const domains = new Set(rows.map(getDomain).filter(Boolean)).size;
    const lastSync = sources
      .map((s) => s.last_refreshed_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] as string | undefined;
    const confidences = rows.map(getConfidence).filter((c): c is number => c !== null);
    const freshnesses = rows.map(getFreshness).filter((f): f is number => f !== null);
    const avgConfidence =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
    const avgFreshness =
      freshnesses.length > 0 ? freshnesses.reduce((a, b) => a + b, 0) / freshnesses.length : null;
    return { totalSignals, activeSources, countries, domains, lastSync, avgConfidence, avgFreshness };
  }, [rows, sources]);

  // ── Data Quality stats ───────────────────────────────────────────────────
  const quality = useMemo(() => {
    const missingRegion = rows.filter((r) => !r.region).length;
    const missingConfidence = rows.filter((r) => getConfidence(r) === null).length;
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const stale = rows.filter((r) => {
      const t = r.period_start ? new Date(r.period_start).getTime() : 0;
      return t > 0 && t < sevenDaysAgo;
    }).length;

    // Duplicate metric keys per (metric_name, period_start)
    const keys = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.metric_name}|${r.period_start ?? ""}`;
      keys.set(k, (keys.get(k) ?? 0) + 1);
    }
    const duplicates = Array.from(keys.values()).filter((n) => n > 1).length;

    const providerBreakdown = new Map<string, number>();
    for (const r of rows) {
      const p = getProvider(r);
      providerBreakdown.set(p, (providerBreakdown.get(p) ?? 0) + 1);
    }
    return {
      missingRegion,
      missingConfidence,
      stale,
      duplicates,
      providerBreakdown: Array.from(providerBreakdown.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const aicisSource = sources.find((s) => s.vendor_key === AICIS_VENDOR_KEY);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (orgLoading || (loading && rows.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              Reference Intelligence
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Read-only · Org-scoped
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Data Hub</h1>
          <p className="text-muted-foreground mt-1">
            Curated external intelligence signals — country, macro, industry —
            kept separate from your client datasets.
          </p>
        </div>
        <Button onClick={() => void load()} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="aicis">AICIS Intelligence</TabsTrigger>
          <TabsTrigger value="sync">Sync History</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<Database className="h-4 w-4" />}
              label="Total reference signals"
              value={num(overview.totalSignals, 0)}
              hint="Across all vendors"
            />
            <KpiCard
              icon={<Activity className="h-4 w-4" />}
              label="Active sources"
              value={`${overview.activeSources} / ${sources.length}`}
              hint="Vendor connections"
            />
            <KpiCard
              icon={<Globe2 className="h-4 w-4" />}
              label="Countries covered"
              value={num(overview.countries, 0)}
              hint="ISO3 regions"
            />
            <KpiCard
              icon={<Layers className="h-4 w-4" />}
              label="Domains covered"
              value={num(overview.domains, 0)}
              hint="e.g. climate, macro, energy"
            />
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label="Last sync"
              value={fmtAge(overview.lastSync ?? null)}
              hint={overview.lastSync ? format(new Date(overview.lastSync), "PPpp") : "Never"}
            />
            <KpiCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Average confidence"
              value={overview.avgConfidence !== null ? `${num(overview.avgConfidence, 1)}%` : "—"}
              hint="Weighted across providers"
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Average freshness"
              value={overview.avgFreshness !== null ? `${num(overview.avgFreshness, 0)}%` : "—"}
              hint="Recency-adjusted"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Data origin"
              value="External"
              hint="Reference, not client truth"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What lives here</CardTitle>
              <CardDescription>
                The Data Hub holds <span className="font-medium">reference intelligence</span> —
                external signals used to enrich, benchmark, and contextualise your
                decisions. Your client data (uploads, connectors) is kept separate
                under Data Sources and is never overwritten by this layer.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* ─── AICIS ──────────────────────────────────────────────────── */}
        <TabsContent value="aicis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary" />
                    AICIS — Country Intelligence Signals
                  </CardTitle>
                  <CardDescription>
                    Aggregated, licensed signals across {aicisCountries.length} countries
                    and {aicisDomains.length} domains.
                  </CardDescription>
                </div>
                {aicisSource && (
                  <Button
                    onClick={() => triggerSync(aicisSource.id, aicisSource.vendor_name)}
                    disabled={syncing === aicisSource.id}
                    size="sm"
                  >
                    {syncing === aicisSource.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync AICIS Now
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FilterSelect
                  icon={<Globe2 className="h-3.5 w-3.5" />}
                  label="Country"
                  value={filterCountry}
                  onChange={setFilterCountry}
                  options={aicisCountries}
                />
                <FilterSelect
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Domain"
                  value={filterDomain}
                  onChange={setFilterDomain}
                  options={aicisDomains}
                />
                <FilterSelect
                  icon={<Database className="h-3.5 w-3.5" />}
                  label="Provider"
                  value={filterProvider}
                  onChange={setFilterProvider}
                  options={aicisProviders}
                />
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Period
                  </label>
                  <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="365">Last year</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Showing {filteredAicis.length.toLocaleString()} of{" "}
                {aicisRows.length.toLocaleString()} signals
              </div>

              {aicisRows.length === 0 ? (
                <EmptyState
                  icon={<Globe2 className="h-8 w-8" />}
                  title="No AICIS signals yet"
                  description="The next scheduled sync will populate country intelligence. You can also trigger a manual sync above."
                />
              ) : (
                <ScrollArea className="h-[520px] rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                        <TableHead className="text-right">Freshness</TableHead>
                        <TableHead>Provider</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAicis.slice(0, 500).map((r) => {
                        const conf = getConfidence(r);
                        const fresh = getFreshness(r);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {r.region ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{getDomain(r)}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[260px] truncate" title={r.metric_name}>
                              {r.metric_name}
                            </TableCell>
                            <TableCell className="text-right font-medium">{num(r.value, 4)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.unit ?? "—"}</TableCell>
                            <TableCell className="text-xs">
                              {r.period_start ? format(new Date(r.period_start), "PP") : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {conf !== null ? `${num(conf, 0)}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {fresh !== null ? `${num(fresh, 0)}%` : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{getProvider(r)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredAicis.length > 500 && (
                    <div className="p-3 text-xs text-center text-muted-foreground border-t">
                      Showing first 500 rows. Refine filters to narrow results.
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SYNC HISTORY ─────────────────────────────────────────── */}
        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Sync Status</CardTitle>
              <CardDescription>
                Schedules, last refresh, and any recent failures across configured
                reference data sources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <EmptyState
                  icon={<Database className="h-8 w-8" />}
                  title="No data sources configured"
                  description="Configure vendor connections under Admin → Data Vendors to start ingesting reference intelligence."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last refreshed</TableHead>
                      <TableHead>Next refresh</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead>Trust</TableHead>
                      <TableHead>Recent issue</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.vendor_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{s.vendor_key}</div>
                        </TableCell>
                        <TableCell>
                          {s.is_active ? (
                            <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Paused</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{fmtAge(s.last_refreshed_at)}</div>
                          {s.last_refreshed_at && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(s.last_refreshed_at), "PPp")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.next_refresh_at ? format(new Date(s.next_refresh_at), "PPp") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">Every {s.refresh_interval_hours}h</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.trust_level}/100</Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {s.last_error ? (
                            <div className="flex items-start gap-1 text-xs text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                              <span className="truncate" title={s.last_error}>{s.last_error}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerSync(s.id, s.vendor_name)}
                            disabled={syncing === s.id || !s.is_active}
                          >
                            {syncing === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DATA QUALITY ─────────────────────────────────────────── */}
        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<Globe2 className="h-4 w-4" />}
              label="Missing region"
              value={num(quality.missingRegion, 0)}
              hint="Signals without ISO3 country tag"
              tone={quality.missingRegion > 0 ? "warn" : "ok"}
            />
            <KpiCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Missing confidence"
              value={num(quality.missingConfidence, 0)}
              hint="Signals lacking a confidence score"
              tone={quality.missingConfidence > 0 ? "warn" : "ok"}
            />
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label="Stale > 7 days"
              value={num(quality.stale, 0)}
              hint="Period start older than 7 days"
              tone={quality.stale > 50 ? "warn" : "ok"}
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Duplicate metric keys"
              value={num(quality.duplicates, 0)}
              hint="Same metric + period appears twice"
              tone={quality.duplicates > 0 ? "warn" : "ok"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Provider breakdown</CardTitle>
              <CardDescription>
                Where reference signals originate. A diverse, balanced mix
                reduces single-source dependency risk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quality.providerBreakdown.length === 0 ? (
                <EmptyState
                  icon={<Database className="h-8 w-8" />}
                  title="No providers yet"
                  description="Once data flows in, provider distribution will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Signals</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quality.providerBreakdown.map(([provider, count]) => {
                      const share = (count / rows.length) * 100;
                      return (
                        <TableRow key={provider}>
                          <TableCell className="font-medium">{provider}</TableCell>
                          <TableCell className="text-right">{num(count, 0)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.min(100, share)}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums w-12 text-right">
                                {num(share, 1)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-500/40"
      : tone === "ok"
        ? "border-emerald-500/30"
        : "";
  return (
    <Card className={toneClass}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground mb-3">{icon}</div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}
