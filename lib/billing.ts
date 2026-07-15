export const BILLING_PLANS = [
  { id: 'free', title: 'Free' },
  { id: 'home', title: 'Home' },
  { id: 'pro', title: 'Pro' },
  { id: 'research', title: 'Research' },
] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number]['id'];
export type BillingPeriod = 'monthly' | 'annual';

export function getBillingPlanTitle(plan: string): string {
  return BILLING_PLANS.find((item) => item.id === plan)?.title || plan;
}
