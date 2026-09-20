/** Billing constants — OUR product, OUR prices. Update numbers to yours. */

export const SUBSCRIPTION_PRICE_TZS = 25_000;
export const LOYALTY_POINT_VALUE = 200; // 1 point redeems for Sh 200
export const LOYALTY_EARN_PER = 10_000; // 1 point per Sh 10,000 spent

export interface Plan {
  months: 1 | 3 | 6 | 12;
  price: number;
  label: string;
  note?: string;
}

export const PLANS: Plan[] = [
  { months: 1, price: 25_000, label: "1 month" },
  { months: 3, price: 70_000, label: "3 months", note: "save 7%" },
  { months: 6, price: 135_000, label: "6 months", note: "save 10%" },
  { months: 12, price: 250_000, label: "12 months", note: "save 17%" },
];

export const PAYMENT_CHANNELS = [
  { value: "Mpesa", label: "M-Pesa (Vodacom)", number: "0754 000 000", name: "Your Name" },
  { value: "Halopesa", label: "HaloPesa (Halotel)", number: "0614 000 000", name: "Your Name" },
  { value: "Airtel", label: "Airtel Money", number: "0788 000 000", name: "Your Name" },
  { value: "MixxYas", label: "Mixx by Yas (Tigo)", number: "0714 000 000", name: "Your Name" },
] as const;

export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number]["value"];

export interface SubscriptionInfo {
  state: "trialing" | "active" | "grace" | "expired";
  days_left: number;
  trial_end: string | null;
  period_end: string | null;
  monthly_price: number;
  currency: string;
  is_platform: boolean;
}

export function planFor(months: number): Plan | undefined {
  return PLANS.find((p) => p.months === months);
}
