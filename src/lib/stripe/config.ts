export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    price: 14900,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? "",
    users: 5,
    features: ["Dashboard", "Cash Forecast", "5 integrations"],
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
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
