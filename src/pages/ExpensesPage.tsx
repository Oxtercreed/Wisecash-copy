import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Wallet } from "lucide-react";
import { Segmented } from "@/components/ui/misc";
import { useOtherIncome, useOtherIncomeActions } from "@/hooks/modules";
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
  const { data: income = [] } = useOtherIncome();
  const { create: createIncome, remove: removeIncome } = useOtherIncomeActions();
  const [tab, setTab] = useState<"expenses" | "income">("expenses");
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeTitle, setIncomeTitle] = useState("");
  const [incomeSource, setIncomeSource] = useState("Other");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(todayISO());

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
          <h1 className="text-xl font-extrabold">Money</h1>
          <p className="text-xs text-muted-foreground">Money out (expenses) and other money in</p>
        </div>
        {tab === "expenses" ? (
          <Button onClick={() => setOpen(true)}>
            <ArrowUpCircle className="h-4 w-4" /> Record expense
          </Button>
        ) : (
          <Button onClick={() => setIncomeOpen(true)}>
            <ArrowDownCircle className="h-4 w-4" /> Record income
          </Button>
        )}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "expenses", label: "Expenses" },
          { value: "income", label: "Other income" },
        ]}
        className="w-full sm:w-auto"
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Spent today" value={formatMoneyCompact(today, currency)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="This month" value={formatMoneyCompact(thisMonth, currency)} icon={<Wallet className="h-4 w-4" />} tone="negative" />
      </div>

      {tab === "income" && (
        <div className="space-y-2">
          {income.length === 0 && (
            <EmptyState
              icon={<ArrowDownCircle className="h-5 w-5" />}
              title="No other income recorded"
              description="Money that didn't come from sales — e.g. phone-charging fees, airtime commission, sublet rent."
            />
          )}
          {income.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <ArrowDownCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{i.title}</p>
                <p className="text-xs text-muted-foreground">{i.source} · {new Date(i.earned_on + "T00:00:00").toLocaleDateString("en", { day: "numeric", month: "short" })}</p>
              </div>
              <span className="text-sm font-extrabold text-brand-700">+{formatMoney(i.amount, currency)}</span>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (!window.confirm(`Delete "${i.title}"?`)) return;
                  try {
                    await removeIncome.mutateAsync(i.id);
                    toast("Income deleted", "success");
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

      {tab === "expenses" && (isLoading ? (
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
      ))}

      <Dialog open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Record other income">
        <div className="flex flex-col gap-3">
          <Field label="What was it?">
            <Input value={incomeTitle} onChange={(e) => setIncomeTitle(e.target.value)} placeholder="e.g. Airtime commission" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Select value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)}>
                {["Other", "Airtime commission", "Phone charging", "Sublet rent", "Services", "Sale of scraps"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} />
            </Field>
          </div>
          <Field label={`Amount (${currency})`}>
            <Input type="number" min={0} value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
          <Button
            className="w-full"
            loading={createIncome.isPending}
            onClick={async () => {
              if (!incomeTitle.trim()) return toast("What was it?", "error");
              if (parseAmount(incomeAmount) <= 0) return toast("Enter an amount", "error");
              try {
                await createIncome.mutateAsync({ title: incomeTitle.trim(), source: incomeSource, amount: parseAmount(incomeAmount), earned_on: incomeDate });
                toast("Income recorded", "success");
                setIncomeOpen(false);
                setIncomeTitle("");
                setIncomeAmount("");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            Save income
          </Button>
        </div>
      </Dialog>

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
