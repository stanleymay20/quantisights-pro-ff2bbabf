
-- Add onboarding fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS size_band text,
ADD COLUMN IF NOT EXISTS revenue_band text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- KPI templates table
CREATE TABLE public.kpi_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text NOT NULL,
  description text,
  kpis jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users
CREATE POLICY "Authenticated users can view templates"
ON public.kpi_templates FOR SELECT
TO authenticated
USING (true);

-- Seed 3 KPI templates
INSERT INTO public.kpi_templates (name, industry, description, kpis) VALUES
(
  'SaaS Growth',
  'saas',
  'Standard SaaS metrics for recurring revenue businesses',
  '[
    {"name": "Monthly Recurring Revenue", "formula": "revenue", "aggregation_type": "sum", "description": "Total recurring revenue per month"},
    {"name": "Customer Acquisition Cost", "formula": "marketing_spend / new_customers", "aggregation_type": "average", "description": "Cost to acquire each new customer"},
    {"name": "Customer Lifetime Value", "formula": "revenue / churn_rate", "aggregation_type": "average", "description": "Projected revenue per customer"},
    {"name": "Net Revenue Retention", "formula": "(revenue + expansion - contraction - churn) / revenue * 100", "aggregation_type": "average", "description": "Revenue retention including expansion"},
    {"name": "Burn Multiple", "formula": "net_burn / net_new_arr", "aggregation_type": "average", "description": "Capital efficiency metric"},
    {"name": "Gross Margin", "formula": "(revenue - cogs) / revenue * 100", "aggregation_type": "average", "description": "Revenue after cost of goods sold"}
  ]'::jsonb
),
(
  'Manufacturing Operations',
  'manufacturing',
  'Key metrics for manufacturing and supply chain operations',
  '[
    {"name": "Overall Equipment Effectiveness", "formula": "availability * performance * quality", "aggregation_type": "average", "description": "Combined production efficiency"},
    {"name": "Yield Rate", "formula": "good_units / total_units * 100", "aggregation_type": "average", "description": "Percentage of defect-free output"},
    {"name": "Inventory Turnover", "formula": "cogs / average_inventory", "aggregation_type": "sum", "description": "How quickly inventory is sold"},
    {"name": "Order Fulfillment Rate", "formula": "fulfilled_orders / total_orders * 100", "aggregation_type": "average", "description": "Percentage of orders delivered on time"},
    {"name": "Cost Per Unit", "formula": "total_costs / units_produced", "aggregation_type": "average", "description": "Production cost efficiency"},
    {"name": "Scrap Rate", "formula": "scrap_material / total_material * 100", "aggregation_type": "average", "description": "Material waste percentage"}
  ]'::jsonb
),
(
  'Retail & E-Commerce',
  'retail',
  'Performance metrics for retail and e-commerce businesses',
  '[
    {"name": "Revenue Per Visitor", "formula": "revenue / visitors", "aggregation_type": "average", "description": "Average revenue generated per site visitor"},
    {"name": "Conversion Rate", "formula": "purchases / visitors * 100", "aggregation_type": "average", "description": "Percentage of visitors who purchase"},
    {"name": "Average Order Value", "formula": "revenue / orders", "aggregation_type": "average", "description": "Average transaction size"},
    {"name": "Cart Abandonment Rate", "formula": "(carts_created - purchases) / carts_created * 100", "aggregation_type": "average", "description": "Rate of incomplete purchases"},
    {"name": "Customer Retention Rate", "formula": "returning_customers / total_customers * 100", "aggregation_type": "average", "description": "Percentage of repeat customers"},
    {"name": "Gross Merchandise Volume", "formula": "revenue", "aggregation_type": "sum", "description": "Total value of merchandise sold"}
  ]'::jsonb
);
