import { useState } from "react";
import { CalendarClock, Check, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAppointmentActions, useAppointments } from "@/hooks/modules";

export default function AppointmentsPage() {
  const { toast } = useToast();
  const { data: appointments = [], isLoading } = useAppointments();
  const { create, update, remove } = useAppointmentActions();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");

  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.status === "scheduled" && new Date(a.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = appointments
    .filter((a) => a.status !== "scheduled" || new Date(a.starts_at) < now)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 20);

  async function add() {
    if (!title.trim()) return toast("What is the appointment?", "error");
    if (!startsAt) return toast("Pick a date & time", "error");
    try {
      await create.mutateAsync({
        title: title.trim(),
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        notes: notes.trim() || null,
      });
      toast("Appointment scheduled", "success");
      setOpen(false);
      setTitle("");
      setCustomerName("");
      setCustomerPhone("");
      setStartsAt("");
      setNotes("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Appointments</h1>
          <p className="text-xs text-muted-foreground">{upcoming.length} upcoming</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : appointments.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No appointments" description="Book customer visits, deliveries or meetings." />
      ) : (
        <div className="space-y-2">
          {upcoming.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmt(a.starts_at)}{a.customer_name ? ` · ${a.customer_name}` : ""}{a.customer_phone ? ` · ${a.customer_phone}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void update.mutateAsync({ id: a.id, status: "done" } as unknown as Record<string, unknown>).then(() => toast("Marked done", "success"))}>
                  <Check className="h-3.5 w-3.5" /> Done
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void update.mutateAsync({ id: a.id, status: "cancelled" } as unknown as Record<string, unknown>)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {a.notes && <p className="mt-1 truncate text-xs text-muted-foreground">{a.notes}</p>}
            </div>
          ))}

          {past.length > 0 && <p className="pt-2 text-xs font-bold text-muted-foreground">PAST</p>}
          {past.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-card/60 p-3 opacity-70">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{fmt(a.starts_at)}</p>
              </div>
              <Badge variant={a.status === "done" ? "success" : a.status === "cancelled" ? "destructive" : "secondary"}>{a.status}</Badge>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => void remove.mutateAsync(a.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Schedule appointment">
        <div className="flex flex-col gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cake tasting with Mama J" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
            <Field label="Phone"><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" /></Field>
          </div>
          <Field label="Date & time"><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
          <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details…" /></Field>
          <Button loading={create.isPending} onClick={() => void add()}>Schedule</Button>
        </div>
      </Dialog>
    </div>
  );
}
