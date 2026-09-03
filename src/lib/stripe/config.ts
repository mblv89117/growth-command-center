export const STRIPE_TRIAL_DAYS = 14;
export const STANDALONE_PLAN_KEY = "starter" as const;

export const STRIPE_PLANS = {
  starter: {
    name: "Growth Command Center",
    price: 14900,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? process.env.STRIPE_PRICE_ID ?? "",
    users: 5,
    features: [
      "Executive dashboard & 13-week cash forecast",
      "CSV, Excel, and PDF financial import",
      "AI CFO advisor with source-aware answers",
      "KPI tracking and value-creation intelligence",
      "Native connectors as certified",
    ],
  },
  growth: {
    name: "Growth",
    price: 49900,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID ?? "",
    users: 15,
    features: ["Everything in Starter", "Scenarios", "Reports export", "Priority support"],
  },
  enterprise: {
    name: "Enterprise",
    price: 99900,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
    users: 999,
    features: ["Everything in Growth", "Unlimited users", "Custom integrations", "Dedicated support"],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStandalonePriceId(): string {
  return STRIPE_PLANS.starter.priceId;
}
