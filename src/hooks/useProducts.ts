import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Category, Product } from "@/lib/types";

export function useProducts() {
  const { shop } = useAuth();
  return useQuery({
    queryKey: ["products"],
    enabled: Boolean(shop),
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export function useCategories() {
  const { shop } = useAuth();
  return useQuery({
    queryKey: ["categories"],
    enabled: Boolean(shop),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export interface ProductInput {
  name: string;
  category_id: string | null;
  barcode: string | null;
  unit: string;
  buying_price: number;
  selling_price: number;
  stock: number;
  tracks_stock: boolean;
  low_stock_at: number;
}

export function useProductMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const create = useMutation({
    mutationFn: async (input: ProductInput) => {
      const { error } = await supabase.from("products").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ProductInput & { id: string }) => {
      const { error } = await supabase.from("products").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const adjustStock = useMutation({
    mutationFn: async ({ productId, delta, reason }: { productId: string; delta: number; reason: string }) => {
      const { error } = await supabase.rpc("adjust_stock", {
        p_product_id: productId,
        p_delta: delta,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("categories").insert({ name }).select().single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: invalidate,
  });

  return { create, update, archive, adjustStock, createCategory };
}
