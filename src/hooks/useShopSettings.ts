import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const COUNTRIES = [
  { code: "TZ", name: "Tanzania", currency: "TZS" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "UG", name: "Uganda", currency: "UGX" },
  { code: "RW", name: "Rwanda", currency: "RWF" },
] as const;

export function useShopSettings() {
  const { shop, profile } = useAuth();
  const queryClient = useQueryClient();

  const updateShop = useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string | null;
      address: string | null;
      currency: string;
      tax_rate: number;
      receipt_footer: string;
    }) => {
      if (!shop) throw new Error("No shop loaded");
      const { error } = await supabase.from("shops").update(input).eq("id", shop.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      // Reload the profile via auth context refresh
      window.location.reload();
    },
  });

  return { shop, profile, updateShop };
}
