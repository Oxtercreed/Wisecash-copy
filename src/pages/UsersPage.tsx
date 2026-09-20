import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Copy, ShieldCheck, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole, Profile } from "@/lib/types";

export default function UsersPage() {
  const { shop, profile: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["shop_users"],
    enabled: Boolean(shop),
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, disabled")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("set_staff_role", { p_profile_id: userId, p_role: role });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shop_users"] }),
  });

  const setDisabled = useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      const { error } = await supabase.rpc("set_staff_disabled", { p_profile_id: userId, p_disabled: disabled });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shop_users"] }),
  });

  const isOwner = me?.role === "owner";
  const joinCode = shop?.join_code ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Users</h1>
        <p className="text-xs text-muted-foreground">People who can open this shop in SmartDuka</p>
      </div>

      {/* Join code card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><UserCog className="h-4 w-4 text-brand-600" /> Invite a staff member</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(joinCode);
              toast("Join code copied", "success");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg bg-brand-950 px-4 py-3 text-center font-mono text-xl font-extrabold tracking-widest text-white">
            {joinCode || "…"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Tell them to sign up in SmartDuka and enter this code in the <b>"Shop code"</b> field. They join as a{" "}
            <b>cashier</b> and you can promote them below.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No users loaded" />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">
                  {u.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {u.full_name}
                    {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.phone ?? "—"}</p>
                </div>
                <Badge variant={u.role === "owner" ? "success" : u.role === "manager" ? "default" : "secondary"}>{u.role}</Badge>
                {u.disabled && <Badge variant="destructive">disabled</Badge>}
              </div>

              {isOwner && u.id !== me?.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={setRole.isPending && setRole.variables?.userId === u.id}
                    onClick={() => void setRole.mutateAsync({ userId: u.id, role: "manager" }).then(() => toast("Now a manager", "success")).catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed", "error"))}
                  >
                    Make manager
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setRole.mutateAsync({ userId: u.id, role: "cashier" }).then(() => toast("Now a cashier", "success")).catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed", "error"))}
                  >
                    Make cashier
                  </Button>
                  {u.disabled ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void setDisabled.mutateAsync({ userId: u.id, disabled: false }).then(() => toast("Access restored", "success")).catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed", "error"))}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Re-enable
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (!window.confirm(`Disable ${u.full_name}? They will be locked out immediately.`)) return;
                        void setDisabled.mutateAsync({ userId: u.id, disabled: true }).then(() => toast("User disabled", "success")).catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed", "error"));
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" /> Disable
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isOwner && (
        <p className="text-center text-xs text-muted-foreground">Only the owner can change roles or disable users.</p>
      )}
    </div>
  );
}
