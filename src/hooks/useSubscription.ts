import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { SubscriptionInfo } from "@/lib/subscription";

/** The shop's billing state (computed server-side, no cron needed). */
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async (): Promise<SubscriptionInfo> => {
      const { data, error } = await supabase.rpc("my_subscription");
      if (error) throw error;
      return data as SubscriptionInfo;
    },
    staleTime: 60_000,
  });
}

export function usePlatformAdmin() {
  const queryClient = useQueryClient();
  const { data: isPlatform, isLoading } = useQuery({
    queryKey: ["is_platform_admin"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 300_000,
  });

  const claim = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("claim_platform_admin");
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["is_platform_admin"] });
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  return { isPlatform: isPlatform ?? false, claim, isLoading: isLoading ?? false };
}

export function useMyPayments() {
  return useQuery({
    queryKey: ["subscription_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      channel: string;
      phone: string;
      amount: number;
      months: number;
      reference: string | null;
    }) => {
      const { data, error } = await supabase.rpc("submit_subscription_payment", {
        p_channel: input.channel,
        p_phone: input.phone,
        p_amount: input.amount,
        p_months: input.months,
        p_reference: input.reference,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["subscription_payments"] }),
  });
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, points }: { customerId: string; points: number }) => {
      const { data, error } = await supabase.rpc("redeem_points", {
        p_customer_id: customerId,
        p_points: points,
      });
      if (error) throw error;
      return Number(data);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}
