import { useMemo, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { EXPENSE_CATEGORIES, useExpenseMutations, useExpenses } from "@/hooks/useExpenses";
import { formatMoney, formatMoneyCompact, parseAmount } from "@/lib/money";
import { todayISO } from "@/lib/utils";

export default function ExpensesPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: expenses = [], isLoading } = useExpenses(90);
  const { create, remove } = useExpenseMutations();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());

  const thisMonth = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    const monthExp = expenses.filter((e) => e.spent_on.startsWith(prefix));
    return monthExp.reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const today = useMemo(() => {
    const key = todayISO();
    return expenses.filter((e) => e.spent_on === key).reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  async function submit() {
    if (!title.trim()) return toast("What was the expense for?", "error");
    if (parseAmount(amount) <= 0) return toast("Enter an amount", "error");
    try {
      await create.mutateAsync({ title: title.trim(), category, amount: parseAmount(amount), spent_on: date });
      toast("Expense recorded", "success");
      setOpen(false);
      setTitle("");
      setAmount("");
      setCategory("General");
      setDate(todayISO());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Expenses</h1>
          <p className="text-xs text-muted-foreground">Money going out — rent, salaries, transport…</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record expense
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Spent today" value={formatMoneyCompact(today, currency)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="This month" value={formatMoneyCompact(thisMonth, currency)} icon={<Wallet className="h-4 w-4" />} tone="negative" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No expenses recorded"
          description="Recording expenses keeps your net profit honest."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record expense</Button>}
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{e.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.spent_on + "T00:00:00").toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <Badge variant="outline">{e.category}</Badge>
              <span className="text-sm font-extrabold text-destructive">-{formatMoney(e.amount, currency)}</span>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (!window.confirm(`Delete "${e.title}"?`)) return;
                  try {
                    await remove.mutateAsync(e.id);
                    toast("Expense deleted", "success");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Failed", "error");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Record expense">
        <div className="flex flex-col gap-3">
          <Field label="What was it for?">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Shop rent — September" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label={`Amount (${currency})`}>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
          <Button className="w-full" loading={create.isPending} onClick={() => void submit()}>
            Save expense
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
