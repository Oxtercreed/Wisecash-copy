import { useState } from "react";
import { Banknote, Pencil, Plus, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSuppliers, useSupplierActions } from "@/hooks/modules";
import { formatMoney, parseAmount } from "@/lib/money";
import type { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: suppliers = [], isLoading } = useSuppliers();
  const { create, update, payDebt } = useSupplierActions();

  const [dialog, setDialog] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [init, setInit] = useState(false);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState("");

  if (dialog.open && !init) {
    setInit(true);
    setName(dialog.supplier?.name ?? "");
    setPhone(dialog.supplier?.phone ?? "");
    setNote(dialog.supplier?.note ?? "");
  }
  if (!dialog.open && init) setInit(false);

  const totalOwed = suppliers.reduce((s, x) => s + x.pending_payment, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Suppliers</h1>
          <p className="text-xs text-muted-foreground">
            {suppliers.length} supplier(s) · you owe {formatMoney(totalOwed, currency)}
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, supplier: null })}>
          <Plus className="h-4 w-4" /> Add supplier
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : suppliers.length === 0 ? (
        <EmptyState icon={<Truck className="h-5 w-5" />} title="No suppliers yet" description="Track who you buy stock from and what you owe them." />
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Truck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.phone ?? "—"}</p>
              </div>
              {s.pending_payment > 0 ? (
                <>
                  <Badge variant="warning">you owe {formatMoney(s.pending_payment, currency)}</Badge>
                  <Button size="sm" onClick={() => { setPaying(s); setPayAmount(""); }}>
                    <Banknote className="h-3.5 w-3.5" /> Pay
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">settled</Badge>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDialog({ open: true, supplier: s })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, supplier: null })} title={dialog.supplier ? "Edit supplier" : "Add supplier"}>
        <div className="flex flex-col gap-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kariakoo Wholesalers" /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" /></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What they supply…" /></Field>
          <Button
            loading={create.isPending || update.isPending}
            onClick={async () => {
              if (!name.trim()) return toast("Name is required", "error");
              try {
                if (dialog.supplier) await update.mutateAsync({ id: dialog.supplier.id, name: name.trim(), phone: phone.trim() || null, note: note.trim() || null });
                else await create.mutateAsync({ name: name.trim(), phone: phone.trim() || null, note: note.trim() || null });
                toast("Supplier saved", "success");
                setDialog({ open: false, supplier: null });
              } catch (err) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            Save supplier
          </Button>
        </div>
      </Dialog>

      <Dialog open={Boolean(paying)} onClose={() => setPaying(null)} title={`Pay ${paying?.name ?? ""}`}>
        <div className="space-y-3">
          <p className="rounded-lg bg-amberbrand-400/10 px-3 py-2 text-sm font-bold text-amberbrand-600">
            Outstanding: {formatMoney(paying?.pending_payment ?? 0, currency)}
          </p>
          <Field label="Amount"><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
          <Button
            className="w-full"
            loading={payDebt.isPending}
            onClick={async () => {
              const amt = parseAmount(payAmount);
              if (!paying || amt <= 0) return toast("Enter an amount", "error");
              if (amt > paying.pending_payment) return toast("Amount exceeds what you owe", "error");
              try {
                await payDebt.mutateAsync({ p_supplier_id: paying.id, p_amount: amt, p_method: "cash", p_note: null });
                toast("Payment recorded", "success");
                setPaying(null);
              } catch (err) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            Record payment
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
