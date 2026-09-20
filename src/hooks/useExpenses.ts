import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Expense } from "@/lib/types";

export const EXPENSE_CATEGORIES = [
  "General",
  "Rent",
  "Salaries",
  "Electricity",
  "Transport",
  "Supplies",
  "Marketing",
  "Other",
];

export function useExpenses(days = 90) {
  const { shop } = useAuth();
  return useQuery({
    queryKey: ["expenses", days],
    enabled: Boolean(shop),
    queryFn: async (): Promise<Expense[]> => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("spent_on", d.toISOString().slice(0, 10))
        .order("spent_on", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export function useExpenseMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["expenses"] });

  const create = useMutation({
    mutationFn: async (input: { title: string; category: string; amount: number; spent_on: string }) => {
      const { error } = await supabase.from("expenses").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, remove };
}
