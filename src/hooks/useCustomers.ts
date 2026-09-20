import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Customer } from "@/lib/types";

export function useCustomers() {
  const { shop } = useAuth();
  return useQuery({
    queryKey: ["customers"],
    enabled: Boolean(shop),
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("credit_balance", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["customers"] });

  const create = useMutation({
    mutationFn: async (input: { name: string; phone: string | null; note: string | null }) => {
      const { data, error } = await supabase.from("customers").insert(input).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name: string; phone: string | null; note: string | null }) => {
      const { error } = await supabase.from("customers").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const recordPayment = useMutation({
    mutationFn: async ({ customerId, amount, method, reference }: { customerId: string; amount: number; method: string; reference: string | null }) => {
      const { data, error } = await supabase.rpc("record_customer_payment", {
        p_customer_id: customerId,
        p_amount: amount,
        p_method: method,
        p_reference: reference,
      });
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, recordPayment };
}
