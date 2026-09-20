import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Generic shop-scoped table access. Every Phase 2 module is plain CRUD + the
 * occasional RPC, so one factory keeps it all consistent (and tiny).
 */

export function useShopRows<T>(
  key: readonly unknown[],
  table: string,
  orderBy: { column: string; ascending?: boolean },
  options: { limit?: number; select?: string } = {}
) {
  const { shop } = useAuth();
  return useQuery({
    queryKey: key,
    enabled: Boolean(shop),
    queryFn: async (): Promise<T[]> => {
      let q = supabase.from(table).select(options.select ?? "*").order(orderBy.column, {
        ascending: orderBy.ascending ?? false,
      });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useShopCrud<T extends { id: string }>(table: string, invalidateKeys: string[][]) {
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    for (const key of invalidateKeys) void queryClient.invalidateQueries({ queryKey: key });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { error } = await supabase.from(table).insert(input);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const update = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      const { error } = await supabase.from(table).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  return { create, update, remove };
}

export function useRpc<TArgs extends Record<string, unknown>, TResult = unknown>(
  fn: string,
  invalidateKeys: string[][]
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs): Promise<TResult> => {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw error;
      return data as TResult;
    },
    onSuccess: () => {
      for (const key of invalidateKeys) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
