/**
 * Industry Detection & Domain-Specific Analysis Frameworks
 * 
 * Auto-detects industry from metric names and dataset characteristics,
 * then provides domain-specific KPI benchmarks, analysis frameworks,
 * and anomaly root-cause hypotheses.
 */

export interface IndustryProfile {
  industry: string;
  subIndustry?: string;
  confidence: number;
  matchedSignals: string[];
  kpiFramework: KPIFramework[];
  anomalyHypotheses: Record<string, string[]>;
  benchmarks: Record<string, { p25: number; p50: number; p75: number; unit: string }>;
  analysisFramework: string;
}

export interface KPIFramework {
  metric: string;
  importance: "critical" | "high" | "medium";
  direction: "higher_better" | "lower_better" | "target_range";
  context: string;
}

// ═══════════════════════════════════════════════════════
// INDUSTRY SIGNAL PATTERNS
// ═══════════════════════════════════════════════════════

interface IndustrySignal {
  industry: string;
  subIndustry?: string;
  metricPatterns: RegExp[];
  segmentPatterns?: RegExp[];
  weight: number;
}

const INDUSTRY_SIGNALS: IndustrySignal[] = [
  // SaaS / Software
  { industry: "SaaS", metricPatterns: [/mrr/i, /arr/i, /churn.?rate/i, /ltv/i, /cac/i, /nrr/i, /net.?revenue.?retention/i, /arpu/i, /dau/i, /mau/i, /activation/i, /trial/i, /conversion.?rate/i, /expansion.?revenue/i], weight: 3 },
  { industry: "SaaS", subIndustry: "PLG", metricPatterns: [/product.?qualified/i, /pql/i, /free.?to.?paid/i, /viral/i, /k.?factor/i, /time.?to.?value/i], weight: 4 },
  
  // E-Commerce / Retail
  { industry: "E-Commerce", metricPatterns: [/gmv/i, /aov/i, /average.?order/i, /cart.?abandon/i, /repeat.?purchase/i, /basket.?size/i, /sku/i, /inventory.?turnover/i, /return.?rate/i, /fulfillment/i], weight: 3 },
  { industry: "Retail", metricPatterns: [/same.?store/i, /foot.?traffic/i, /sales.?per.?sqft/i, /shrinkage/i, /markdown/i, /sell.?through/i], weight: 4 },

  // Financial Services
  { industry: "Financial Services", metricPatterns: [/aum/i, /assets.?under/i, /nim/i, /net.?interest/i, /loan/i, /deposit/i, /credit.?loss/i, /npl/i, /non.?performing/i, /capital.?ratio/i, /tier.?1/i, /rwa/i], weight: 3 },
  { industry: "Financial Services", subIndustry: "Fintech", metricPatterns: [/tpv/i, /total.?payment/i, /take.?rate/i, /interchange/i, /transaction.?volume/i], weight: 4 },

  // Healthcare
  { industry: "Healthcare", metricPatterns: [/patient/i, /readmission/i, /bed.?occupancy/i, /length.?of.?stay/i, /clinical/i, /diagnosis/i, /mortality/i, /infection.?rate/i, /wait.?time/i], weight: 3 },
  { industry: "Healthcare", subIndustry: "Pharma", metricPatterns: [/pipeline/i, /clinical.?trial/i, /fda/i, /approval/i, /drug/i, /compound/i], weight: 4 },

  // Manufacturing
  { industry: "Manufacturing", metricPatterns: [/oee/i, /overall.?equipment/i, /yield/i, /defect.?rate/i, /cycle.?time/i, /throughput/i, /scrap/i, /downtime/i, /capacity.?utilization/i, /lead.?time/i], weight: 3 },

  // Logistics / Supply Chain
  { industry: "Logistics", metricPatterns: [/on.?time.?delivery/i, /otd/i, /freight/i, /shipment/i, /warehouse/i, /fill.?rate/i, /order.?accuracy/i, /transit.?time/i, /backorder/i], weight: 3 },

  // Media / AdTech
  { industry: "Media", metricPatterns: [/cpm/i, /cpc/i, /ctr/i, /impression/i, /reach/i, /engagement.?rate/i, /viewability/i, /roas/i, /ad.?spend/i, /subscriber/i, /watch.?time/i], weight: 3 },

  // Real Estate
  { industry: "Real Estate", metricPatterns: [/occupancy/i, /rent/i, /noi/i, /net.?operating.?income/i, /cap.?rate/i, /lease/i, /vacancy/i, /price.?per.?sqft/i], weight: 3 },

  // Education
  { industry: "Education", metricPatterns: [/enrollment/i, /graduation/i, /retention.?rate/i, /student/i, /completion.?rate/i, /course/i, /gpa/i, /attendance/i], weight: 3 },

  // Energy
  { industry: "Energy", metricPatterns: [/kwh/i, /mwh/i, /generation/i, /capacity.?factor/i, /load.?factor/i, /emission/i, /carbon/i, /renewable/i, /grid/i], weight: 3 },

  // Telecom
  { industry: "Telecom", metricPatterns: [/arpu/i, /subscriber/i, /churn/i, /network.?uptime/i, /data.?usage/i, /minutes.?of.?use/i, /sms/i, /bandwidth/i], weight: 2 },

  // General Business (fallback signals)
  { industry: "General Business", metricPatterns: [/revenue/i, /cost/i, /profit/i, /margin/i, /expense/i, /headcount/i, /employee/i, /ebitda/i, /growth/i], weight: 1 },
];

// ═══════════════════════════════════════════════════════
// DETECTION ENGINE
// ═══════════════════════════════════════════════════════

export function detectIndustry(
  metricTypes: string[],
  segments?: string[],
  regions?: string[],
  datasetName?: string,
): IndustryProfile {
  const scores = new Map<string, { score: number; signals: string[]; subIndustry?: string }>();

  for (const signal of INDUSTRY_SIGNALS) {
    for (const pattern of signal.metricPatterns) {
      for (const metric of metricTypes) {
        if (pattern.test(metric)) {
          const key = signal.subIndustry || signal.industry;
          const existing = scores.get(key) || { score: 0, signals: [], subIndustry: signal.subIndustry };
          existing.score += signal.weight;
          existing.signals.push(metric);
          scores.set(key, existing);
        }
      }
    }
  }

  // Also check dataset name for industry hints
  if (datasetName) {
    for (const signal of INDUSTRY_SIGNALS) {
      for (const pattern of signal.metricPatterns) {
        if (pattern.test(datasetName)) {
          const key = signal.subIndustry || signal.industry;
          const existing = scores.get(key) || { score: 0, signals: [], subIndustry: signal.subIndustry };
          existing.score += 1;
          scores.set(key, existing);
        }
      }
    }
  }

  // Find best match
  let bestIndustry = "General Business";
  let bestScore = 0;
  let bestSignals: string[] = [];
  let bestSubIndustry: string | undefined;

  scores.forEach((data, key) => {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestIndustry = key;
      bestSignals = [...new Set(data.signals)];
      bestSubIndustry = data.subIndustry;
    }
  });

  // If sub-industry matched, use parent
  const parentIndustry = bestSubIndustry 
    ? INDUSTRY_SIGNALS.find(s => s.subIndustry === bestIndustry)?.industry || bestIndustry
    : bestIndustry;

  const confidence = Math.min(95, 30 + bestScore * 10);

  return {
    industry: parentIndustry,
    subIndustry: bestSubIndustry,
    confidence,
    matchedSignals: bestSignals,
    kpiFramework: getKPIFramework(parentIndustry),
    anomalyHypotheses: getAnomalyHypotheses(parentIndustry),
    benchmarks: getBenchmarks(parentIndustry),
    analysisFramework: getAnalysisFramework(parentIndustry),
  };
}

// ═══════════════════════════════════════════════════════
// DOMAIN-SPECIFIC KPI FRAMEWORKS
// ═══════════════════════════════════════════════════════

function getKPIFramework(industry: string): KPIFramework[] {
  const frameworks: Record<string, KPIFramework[]> = {
    "SaaS": [
      { metric: "Net Revenue Retention", importance: "critical", direction: "higher_better", context: "NRR >120% indicates strong expansion; <100% signals contraction" },
      { metric: "CAC Payback Period", importance: "critical", direction: "lower_better", context: "Target <18 months; >24 months signals unsustainable growth" },
      { metric: "LTV/CAC Ratio", importance: "critical", direction: "higher_better", context: "Healthy range: 3-5x; <3x means inefficient acquisition" },
      { metric: "Gross Margin", importance: "high", direction: "higher_better", context: "Best-in-class SaaS: >80%; below 60% raises scalability concerns" },
      { metric: "Rule of 40", importance: "high", direction: "higher_better", context: "Growth% + Profit% should exceed 40 for elite SaaS" },
      { metric: "Monthly Churn Rate", importance: "critical", direction: "lower_better", context: "Enterprise: <1%/month; SMB: <3%/month" },
    ],
    "E-Commerce": [
      { metric: "Customer Acquisition Cost", importance: "critical", direction: "lower_better", context: "Must be recouped within first 2 orders for sustainability" },
      { metric: "Average Order Value", importance: "high", direction: "higher_better", context: "AOV growth through cross-sell/upsell is more capital-efficient than new customer acquisition" },
      { metric: "Cart Abandonment Rate", importance: "high", direction: "lower_better", context: "Industry average: 70%; optimize checkout flow below 65%" },
      { metric: "Repeat Purchase Rate", importance: "critical", direction: "higher_better", context: "Target >30%; below 20% indicates product-market fit issues" },
      { metric: "Inventory Turnover", importance: "high", direction: "higher_better", context: "Low turnover ties up working capital; target >6x/year" },
    ],
    "Financial Services": [
      { metric: "Net Interest Margin", importance: "critical", direction: "higher_better", context: "Compressed NIM signals rate environment pressure" },
      { metric: "Cost-to-Income Ratio", importance: "critical", direction: "lower_better", context: "Best-in-class: <50%; above 65% signals operational inefficiency" },
      { metric: "Non-Performing Loan Ratio", importance: "critical", direction: "lower_better", context: "Above 3% requires enhanced credit risk management" },
      { metric: "Capital Adequacy Ratio", importance: "critical", direction: "target_range", context: "Regulatory minimum varies; buffer of 2-3% above minimum recommended" },
      { metric: "Return on Assets", importance: "high", direction: "higher_better", context: "Industry benchmark: 1-2% for commercial banks" },
    ],
    "Healthcare": [
      { metric: "Patient Satisfaction", importance: "critical", direction: "higher_better", context: "Directly impacts reimbursement rates under value-based care" },
      { metric: "Readmission Rate", importance: "critical", direction: "lower_better", context: "30-day readmission >15% triggers CMS penalties" },
      { metric: "Bed Occupancy Rate", importance: "high", direction: "target_range", context: "Optimal: 80-85%; above 90% creates safety risks" },
      { metric: "Average Length of Stay", importance: "high", direction: "lower_better", context: "Shorter stays with good outcomes indicate efficiency" },
    ],
    "Manufacturing": [
      { metric: "Overall Equipment Effectiveness", importance: "critical", direction: "higher_better", context: "World-class: >85%; below 60% signals major improvement opportunities" },
      { metric: "First Pass Yield", importance: "critical", direction: "higher_better", context: "Target >95%; below 90% indicates process control issues" },
      { metric: "Capacity Utilization", importance: "high", direction: "target_range", context: "Optimal: 80-90%; above 95% limits flexibility for demand spikes" },
      { metric: "Cycle Time", importance: "high", direction: "lower_better", context: "Reduction directly impacts throughput and working capital" },
    ],
    "Media": [
      { metric: "ROAS", importance: "critical", direction: "higher_better", context: "Minimum viable ROAS varies by margin: 3x for 30% margin products" },
      { metric: "Engagement Rate", importance: "high", direction: "higher_better", context: "Platform-dependent benchmarks; declining engagement signals content fatigue" },
      { metric: "Subscriber Growth", importance: "critical", direction: "higher_better", context: "Net adds trending negative for 2+ quarters signals churn crisis" },
      { metric: "CPM", importance: "high", direction: "target_range", context: "Too low = inventory quality issues; too high = unsustainable" },
    ],
    "General Business": [
      { metric: "Revenue Growth", importance: "critical", direction: "higher_better", context: "Organic growth >10% YoY is healthy for most industries" },
      { metric: "Gross Margin", importance: "high", direction: "higher_better", context: "Margin compression signals pricing pressure or cost inflation" },
      { metric: "Operating Expense Ratio", importance: "high", direction: "lower_better", context: "Operating leverage improves as revenue scales faster than costs" },
      { metric: "Cash Conversion Cycle", importance: "high", direction: "lower_better", context: "Shorter cycles free working capital for growth investment" },
    ],
  };

  return frameworks[industry] || frameworks["General Business"];
}

// ═══════════════════════════════════════════════════════
// ANOMALY ROOT-CAUSE HYPOTHESES BY INDUSTRY
// ═══════════════════════════════════════════════════════

function getAnomalyHypotheses(industry: string): Record<string, string[]> {
  const hypotheses: Record<string, Record<string, string[]>> = {
    "SaaS": {
      "revenue_spike": ["Enterprise deal closed", "Annual billing cycle effect", "Price increase rollout", "Expansion revenue from existing accounts"],
      "revenue_drop": ["Large customer churn", "Billing system issue", "Free trial conversion decline", "Seasonal slowdown in procurement"],
      "churn_spike": ["Product quality incident", "Competitor launched alternative", "Price increase backlash", "Support quality degradation", "Contract renewal cycle"],
      "cost_spike": ["Infrastructure scaling event", "New hire cohort onboarded", "Marketing campaign launched", "Compliance/audit costs"],
    },
    "E-Commerce": {
      "revenue_spike": ["Seasonal sale event (Black Friday, Prime Day)", "Viral product moment", "Marketing campaign ROI realization", "New product launch"],
      "revenue_drop": ["Supply chain disruption", "Website/app outage", "Payment processor issue", "Competitor pricing war", "Seasonal trough"],
      "cost_spike": ["Shipping rate increase", "Return surge from quality issue", "Ad spend scaling", "Warehouse expansion"],
    },
    "Financial Services": {
      "revenue_spike": ["Interest rate change benefit", "Large deal origination", "Trading volume surge", "Fee restructuring"],
      "revenue_drop": ["Market downturn impact on AUM", "Regulatory fine/settlement", "Rate environment compression", "Client attrition"],
      "cost_spike": ["Compliance remediation", "Technology infrastructure upgrade", "Legal/regulatory action", "Risk provision increase"],
    },
    "Healthcare": {
      "revenue_spike": ["Elective procedure backlog clearance", "Reimbursement rate increase", "New service line launch", "Insurance contract renegotiation"],
      "revenue_drop": ["Pandemic-related volume reduction", "Payer contract dispute", "Physician departure", "Regulatory penalty"],
      "cost_spike": ["Staffing shortage premium labor costs", "Equipment/technology upgrade", "Malpractice claim", "Infection control response"],
    },
    "Manufacturing": {
      "revenue_spike": ["Large order fulfillment", "Backlog clearance", "Price increase pass-through", "New product line ramp-up"],
      "revenue_drop": ["Supply chain disruption", "Quality recall", "Customer demand contraction", "Raw material shortage"],
      "cost_spike": ["Raw material price surge", "Equipment breakdown/replacement", "Overtime for backlog", "Environmental compliance"],
    },
    "General Business": {
      "revenue_spike": ["New customer acquisition surge", "Price adjustment", "Seasonal demand peak", "Product launch"],
      "revenue_drop": ["Market contraction", "Competitive pressure", "Operational disruption", "Customer loss"],
      "cost_spike": ["One-time expense", "Scaling investment", "Regulatory compliance", "Market expansion"],
    },
  };

  return hypotheses[industry] || hypotheses["General Business"];
}

// ═══════════════════════════════════════════════════════
// INDUSTRY BENCHMARKS
// ═══════════════════════════════════════════════════════

function getBenchmarks(industry: string): Record<string, { p25: number; p50: number; p75: number; unit: string }> {
  const benchmarks: Record<string, Record<string, { p25: number; p50: number; p75: number; unit: string }>> = {
    "SaaS": {
      "gross_margin": { p25: 65, p50: 72, p75: 82, unit: "%" },
      "net_revenue_retention": { p25: 95, p50: 110, p75: 130, unit: "%" },
      "monthly_churn": { p25: 3, p50: 1.5, p75: 0.8, unit: "%" },
      "cac_payback_months": { p25: 24, p50: 15, p75: 10, unit: "months" },
    },
    "E-Commerce": {
      "gross_margin": { p25: 25, p50: 35, p75: 50, unit: "%" },
      "cart_abandonment": { p25: 75, p50: 70, p75: 60, unit: "%" },
      "repeat_purchase_rate": { p25: 15, p50: 25, p75: 40, unit: "%" },
    },
    "Financial Services": {
      "cost_to_income": { p25: 70, p50: 58, p75: 48, unit: "%" },
      "net_interest_margin": { p25: 1.8, p50: 2.5, p75: 3.2, unit: "%" },
      "roa": { p25: 0.5, p50: 1.0, p75: 1.5, unit: "%" },
    },
    "Manufacturing": {
      "oee": { p25: 55, p50: 65, p75: 85, unit: "%" },
      "first_pass_yield": { p25: 85, p50: 92, p75: 97, unit: "%" },
      "capacity_utilization": { p25: 65, p50: 78, p75: 88, unit: "%" },
    },
  };

  return benchmarks[industry] || {};
}

// ═══════════════════════════════════════════════════════
// ANALYSIS FRAMEWORK SELECTION
// ═══════════════════════════════════════════════════════

function getAnalysisFramework(industry: string): string {
  const frameworks: Record<string, string> = {
    "SaaS": `ANALYZE USING SaaS METRICS FRAMEWORK:
- Unit Economics: LTV/CAC ratio, CAC payback, gross margin per cohort
- Growth Quality: Organic vs paid, NRR expansion, logo vs revenue churn
- Efficiency: Rule of 40, burn multiple, magic number
- Cohort Analysis: Retention curves by acquisition cohort, expansion revenue timing
- Red Flags: Rising CAC with flat NRR, gross margin compression, increasing churn velocity`,

    "E-Commerce": `ANALYZE USING RETAIL/E-COMMERCE FRAMEWORK:
- Customer Economics: CAC, AOV, repeat rate, LTV by channel
- Funnel Health: Traffic → Browse → Cart → Purchase conversion at each stage
- Inventory: Turnover ratio, days of supply, sell-through rate, markdown %
- Channel Mix: Revenue attribution by channel, ROAS by channel, organic %
- Seasonality: Compare same-period YoY (not sequential), holiday impact quantification`,

    "Financial Services": `ANALYZE USING FINANCIAL SERVICES FRAMEWORK:
- Profitability: NIM spread analysis, fee income diversification, cost-to-income trending
- Risk: NPL ratios, provision coverage, concentration risk (top-10 exposure)
- Capital: CET1/Tier 1 trajectory, RWA density, stress test buffer
- Growth: Loan book growth vs GDP, deposit stickiness, cross-sell penetration
- Regulatory: Capital adequacy buffer trend, compliance cost trajectory`,

    "Healthcare": `ANALYZE USING HEALTHCARE FRAMEWORK:
- Clinical Quality: Readmission rates, infection rates, mortality benchmarks
- Operational: Bed turnover, OR utilization, length of stay optimization
- Financial: Revenue per adjusted patient day, payer mix analysis, bad debt %
- Volume: Patient volume trending, referral patterns, market share
- Compliance: Quality measure scores, accreditation status, patient satisfaction`,

    "Manufacturing": `ANALYZE USING MANUFACTURING FRAMEWORK:
- Productivity: OEE decomposition (availability × performance × quality), throughput
- Quality: Defect rate trending, first pass yield, cost of quality (prevention vs failure)
- Efficiency: Cycle time analysis, capacity utilization, changeover time
- Supply Chain: Lead time variability, supplier on-time delivery, inventory days
- Cost: Variable cost per unit trending, energy cost per unit, labor productivity`,

    "General Business": `ANALYZE USING GENERAL BUSINESS FRAMEWORK:
- Financial Health: Revenue growth rate, gross margin trend, operating leverage
- Efficiency: Cost structure analysis, revenue per employee, working capital cycle
- Growth: Customer/segment concentration risk, market share proxies
- Risk: Volatility patterns, trend sustainability, anomaly root causes
- Actionability: Specific metrics with specific thresholds triggering specific actions`,
  };

  return frameworks[industry] || frameworks["General Business"];
}

// ═══════════════════════════════════════════════════════
// ROOT-CAUSE HYPOTHESIS GENERATOR
// ═══════════════════════════════════════════════════════

export function generateRootCauseHypotheses(
  metricType: string,
  anomalyDirection: "spike" | "drop",
  industry: string,
  contextMetrics?: { type: string; correlation: number }[],
): string[] {
  const hypotheses = getAnomalyHypotheses(industry);
  const key = `${metricType.replace(/[_\s]+/g, "_").toLowerCase()}_${anomalyDirection}`;
  
  // Try exact match first
  let results = hypotheses[key] || [];
  
  // Fallback: try generic revenue/cost/churn patterns
  if (results.length === 0) {
    const genericKey = metricType.toLowerCase().includes("revenue") ? `revenue_${anomalyDirection}`
      : metricType.toLowerCase().includes("cost") || metricType.toLowerCase().includes("expense") ? `cost_${anomalyDirection}`
      : metricType.toLowerCase().includes("churn") ? `churn_${anomalyDirection}`
      : null;
    if (genericKey) results = hypotheses[genericKey] || [];
  }

  // Add correlation-based hypotheses
  if (contextMetrics) {
    for (const cm of contextMetrics) {
      if (Math.abs(cm.correlation) > 0.6) {
        const direction = cm.correlation > 0 ? "positively" : "inversely";
        results.push(`Correlated with ${cm.type.replace(/_/g, " ")} (r=${cm.correlation.toFixed(2)}, ${direction}) — investigate shared driver`);
      }
    }
  }

  return results.length > 0 ? results : [
    "Data quality issue (collection error, system migration)",
    "External market event (regulatory, competitive, macroeconomic)",
    "Internal operational change (pricing, staffing, process)",
    "Seasonal or cyclical pattern",
  ];
}
