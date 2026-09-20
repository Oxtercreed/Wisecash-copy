import { useMemo, useState } from "react";
import { Banknote, Clock, LogIn, LogOut, Plus, UserRound, UserRoundPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, Segmented, StatCard } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceRpc, useSalaryActions, useSalaryPayments, useStaff, useStaffActions } from "@/hooks/modules";
import { formatMoney, formatMoneyCompact, parseAmount } from "@/lib/money";
import { todayISO } from "@/lib/utils";
import type { StaffMember } from "@/lib/types";

export default function HrmPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: staff = [], isLoading } = useStaff();
  const { create: createStaff, update: updateStaff } = useStaffActions();
  const { checkIn, checkOut } = useAttendanceRpc();
  const { data: salaries = [] } = useSalaryPayments();
  const { create: createSalary } = useSalaryActions();

  const [tab, setTab] = useState<"staff" | "salaries">("staff");
  const [dialog, setDialog] = useState<{ open: boolean; member: StaffMember | null }>({ open: false, member: null });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("Staff");
  const [salary, setSalary] = useState("");
  const [init, setInit] = useState(false);
  const [paying, setPaying] = useState<StaffMember | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMonth, setPayMonth] = useState(new Date().toISOString().slice(0, 7));

  if (dialog.open && !init) {
    setInit(true);
    setFullName(dialog.member?.full_name ?? "");
    setPhone(dialog.member?.phone ?? "");
    setPosition(dialog.member?.position ?? "Staff");
    setSalary(dialog.member ? String(dialog.member.salary) : "");
  }
  if (!dialog.open && init) setInit(false);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlySalaryBill = useMemo(
    () => staff.filter((s) => s.status === "active").reduce((sum, s) => sum + s.salary, 0),
    [staff]
  );
  const paidThisMonth = useMemo(
    () => salaries.filter((p) => p.month === thisMonth).reduce((sum, p) => sum + p.amount, 0),
    [salaries, thisMonth]
  );
  const salaryByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of salaries.filter((x) => x.month === thisMonth)) {
      map.set(p.staff_id, (map.get(p.staff_id) ?? 0) + p.amount);
    }
    return map;
  }, [salaries, thisMonth]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Team</h1>
          <p className="text-xs text-muted-foreground">Employees, attendance & salary payments</p>
        </div>
        <Button onClick={() => setDialog({ open: true, member: null })}>
          <UserRoundPlus className="h-4 w-4" /> Add employee
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Monthly salary bill" value={formatMoneyCompact(monthlySalaryBill, currency)} sub={`${staff.filter((s) => s.status === "active").length} active`} icon={<UserRound className="h-4 w-4" />} />
        <StatCard label="Paid this month" value={formatMoneyCompact(paidThisMonth, currency)} sub={`of ${formatMoney(monthlySalaryBill, currency)}`} icon={<Banknote className="h-4 w-4" />} tone="positive" />
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "staff", label: "Employees & attendance" },
          { value: "salaries", label: "Salary history" },
        ]}
        className="w-full"
      />

      {tab === "staff" && (
        isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : staff.length === 0 ? (
          <EmptyState icon={<UserRound className="h-5 w-5" />} title="No employees yet" description="Add your team to track attendance and pay." />
        ) : (
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="rounded-lg border bg-card p-3 shadow-soft">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">
                    {s.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{s.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.position} · {formatMoney(s.salary, currency)}/mo</p>
                  </div>
                  {salaryByStaff.has(s.id) && <Badge variant="success">paid {formatMoney(salaryByStaff.get(s.id) ?? 0, currency)}</Badge>}
                  {s.status === "inactive" && <Badge variant="outline">inactive</Badge>}
                  <Button size="sm" variant="outline" onClick={() => { setPaying(s); setPayAmount(String(s.salary)); }}>
                    <Banknote className="h-3.5 w-3.5" /> Pay
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void checkIn.mutateAsync({ p_staff_id: s.id }).catch(() => toast("Already checked in", "info"))}>
                    <LogIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void checkOut.mutateAsync({ p_staff_id: s.id }).catch(() => toast("No check-in today", "error"))}>
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, member: s })}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "salaries" && (
        salaries.length === 0 ? (
          <EmptyState icon={<Clock className="h-5 w-5" />} title="No salary payments yet" description="Payments you record appear here per month." />
        ) : (
          <div className="space-y-2">
            {salaries.slice(0, 40).map((p) => {
              const member = staff.find((s) => s.id === p.staff_id);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{member?.full_name ?? "Staff"}</p>
                    <p className="text-xs text-muted-foreground">{p.month}</p>
                  </div>
                  <span className="text-sm font-extrabold text-destructive">-{formatMoney(p.amount, currency)}</span>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Staff dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, member: null })} title={dialog.member ? "Edit employee" : "Add employee"}>
        <div className="flex flex-col gap-3">
          <Field label="Full name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Employee name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07xx xxx xxx" /></Field>
            <Field label="Position"><Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Salesperson" /></Field>
          </div>
          <Field label={`Monthly salary (${currency})`}><Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
          {dialog.member && (
            <Field label="Status">
              <Select
                value={dialog.member.status}
                onChange={(e) => void updateStaff.mutateAsync({ id: dialog.member!.id, status: e.target.value } as unknown as Record<string, unknown>)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          )}
          <Button
            loading={createStaff.isPending || updateStaff.isPending}
            onClick={async () => {
              if (!fullName.trim()) return toast("Name is required", "error");
              const payload = { full_name: fullName.trim(), phone: phone.trim() || null, position: position.trim() || "Staff", salary: parseAmount(salary) };
              try {
                if (dialog.member) await updateStaff.mutateAsync({ id: dialog.member.id, ...payload } as unknown as Record<string, unknown>);
                else await createStaff.mutateAsync(payload);
                toast("Employee saved", "success");
                setDialog({ open: false, member: null });
              } catch (err) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            Save employee
          </Button>
        </div>
      </Dialog>

      {/* Pay salary */}
      <Dialog open={Boolean(paying)} onClose={() => setPaying(null)} title={`Pay salary — ${paying?.full_name ?? ""}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Month"><Input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} /></Field>
          </div>
          <Button
            className="w-full"
            loading={createSalary.isPending}
            onClick={async () => {
              const amt = parseAmount(payAmount);
              if (!paying || amt <= 0) return toast("Enter an amount", "error");
              try {
                await createSalary.mutateAsync({ staff_id: paying.id, amount: amt, month: payMonth });
                toast(`Salary paid to ${paying.full_name}`, "success");
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
