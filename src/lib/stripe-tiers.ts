export const TIERS = {
  starter: {
    name: "Starter",
    price: 29,
    currency: "€",
    interval: "month",
    price_id: "price_1T3khzJYFlBeCvef3KOlui4z",
    product_id: "prod_U1oK4n5OQtsB9Z",
    features: [
      "1 organization",
      "1 dataset",
      "Core dashboard analytics",
      "Basic reporting",
    ],
  },
  growth: {
    name: "Growth",
    price: 99,
    currency: "€",
    interval: "month",
    price_id: "price_1T3kjjJYFlBeCvefUjLGgfI3",
    product_id: "prod_U1oMLeqLb7hF4O",
    features: [
      "Unlimited datasets",
      "AI-powered insights",
      "Executive PDF reports",
      "Anomaly detection",
      "Email alerts",
    ],
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    price: 299,
    currency: "€",
    interval: "month",
    price_id: "price_1T3kkcJYFlBeCvefRjlqhWSO",
    product_id: "prod_U1oN5CDeptb9uY",
    features: [
      "Multi-organization access",
      "Priority processing",
      "Advanced forecasting",
      "Dedicated support",
      "Custom integrations",
      "SSO & RBAC",
    ],
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const getTierByProductId = (productId: string | null): TierKey | null => {
  if (!productId) return null;
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.product_id === productId) return key as TierKey;
  }
  return null;
};
