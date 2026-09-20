import { useMemo, useState } from "react";
import { Banknote, Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomerMutations, useCustomers } from "@/hooks/useCustomers";
import { formatMoney, parseAmount } from "@/lib/money";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: customers = [], isLoading } = useCustomers();
  const { create, update, remove, recordPayment } = useCustomerMutations();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "debtors">("all");
  const [dialog, setDialog] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [paying, setPaying] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === "debtors" && c.credit_balance <= 0) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
    });
  }, [customers, search, filter]);

  const totalDebt = customers.reduce((s, c) => s + c.credit_balance, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Customers</h1>
          <p className="text-xs text-muted-foreground">
            {customers.length} customer(s) · {formatMoney(totalDebt, currency)} owed to you
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, customer: null })}>
          <UserPlus className="h-4 w-4" /> Add customer
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone…" className="pl-9" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "debtors", label: "Owing" },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No customers found" description="Add customers to track credit sales (mabao / book debts)." />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.phone ?? "—"}</p>
              </div>
              {c.credit_balance > 0 && <Badge variant="warning">owes {formatMoney(c.credit_balance, currency)}</Badge>}
              {c.credit_balance > 0 && (
                <Button size="sm" onClick={() => setPaying(c)}>
                  <Banknote className="h-3.5 w-3.5" /> Collect
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDialog({ open: true, customer: c })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={async () => {
                  if (c.credit_balance > 0) return toast("Customer still owes money — collect first", "error");
                  if (!window.confirm(`Delete ${c.name}?`)) return;
                  try {
                    await remove.mutateAsync(c.id);
                    toast("Customer removed", "success");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Failed", "error");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <CustomerDialog
        open={dialog.open}
        customer={dialog.customer}
        onClose={() => setDialog({ open: false, customer: null })}
        saving={create.isPending || update.isPending}
        onSave={async (name, phone, note) => {
          try {
            if (dialog.customer) {
              await update.mutateAsync({ id: dialog.customer.id, name, phone, note });
              toast("Customer updated", "success");
            } else {
              await create.mutateAsync({ name, phone, note });
              toast("Customer added", "success");
            }
            setDialog({ open: false, customer: null });
          } catch (err) {
            toast(err instanceof Error ? err.message : "Failed", "error");
          }
        }}
      />

      <CollectDialog
        customer={paying}
        currency={currency}
        onClose={() => setPaying(null)}
        saving={recordPayment.isPending}
        onSubmit={async (amount, method, ref) => {
          if (!paying) return;
          try {
            await recordPayment.mutateAsync({ customerId: paying.id, amount, method, reference: ref });
            toast(`${formatMoney(amount, currency)} received from ${paying.name}`, "success");
            setPaying(null);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Failed", "error");
          }
        }}
      />
    </div>
  );
}

function CustomerDialog({
  open,
  customer,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSave: (name: string, phone: string | null, note: string | null) => Promise<void>;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (open && !initialized) {
    setInitialized(true);
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setNote(customer?.note ?? "");
  }
  if (!open && initialized) setInitialized(false);

  return (
    <Dialog open={open} onClose={onClose} title={customer ? "Edit customer" : "Add customer"}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return toast("Name is required", "error");
          await onSave(name.trim(), phone.trim() || null, note.trim() || null);
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. shopkeeper at Kariakoo" />
        </Field>
        <Button type="submit" loading={saving}>Save customer</Button>
      </form>
    </Dialog>
  );
}

function CollectDialog({
  customer,
  currency,
  onClose,
  onSubmit,
  saving,
}: {
  customer: Customer | null;
  currency: string;
  onClose: () => void;
  onSubmit: (amount: number, method: string, ref: string | null) => Promise<void>;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");

  return (
    <Dialog open={Boolean(customer)} onClose={onClose} title={`Collect payment — ${customer?.name ?? ""}`}>
      <div className="space-y-3">
        <p className="rounded-lg bg-amberbrand-400/10 px-3 py-2 text-sm font-bold text-amberbrand-600">
          Outstanding: {formatMoney(customer?.credit_balance ?? 0, currency)}
        </p>
        <Field label={`Amount (${currency})`}>
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(customer?.credit_balance ?? 0)} inputMode="decimal" />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
          </Select>
        </Field>
        {method === "mpesa" && (
          <Field label="Reference (optional)">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Confirmation code" />
          </Field>
        )}
        <Button
          className="w-full"
          loading={saving}
          onClick={async () => {
            const amt = parseAmount(amount);
            if (amt <= 0) return toast("Enter an amount", "error");
            if (customer && amt > customer.credit_balance) return toast("Amount exceeds what they owe", "error");
            await onSubmit(amt, method, ref.trim() || null);
            setAmount("");
            setRef("");
          }}
        >
          Record payment
        </Button>
      </div>
    </Dialog>
  );
}
