import { useState } from "react";
import { CheckSquare, Plus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useTodoActions, useTodos } from "@/hooks/modules";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/utils";

export default function TodosPage() {
  const { toast } = useToast();
  const { data: todos = [], isLoading } = useTodos();
  const { create, update, remove } = useTodoActions();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());

  const openTodos = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);
  const today = todayISO();

  async function add() {
    if (!title.trim()) return toast("What needs doing?", "error");
    try {
      await create.mutateAsync({ title: title.trim(), due_date: dueDate || null });
      toast("Task added", "success");
      setTitle("");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">To-Do</h1>
          <p className="text-xs text-muted-foreground">{openTodos.length} open task(s) · {done.length} done</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : todos.length === 0 ? (
        <EmptyState icon={<CheckSquare className="h-5 w-5" />} title="Nothing to do — nice!" description="Add reminders like 'call supplier' or 'count the till'." />
      ) : (
        <div className="space-y-2">
          {openTodos.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
              <button
                onClick={() => void update.mutateAsync({ id: t.id, completed: true } as unknown as Record<string, unknown>).catch(() => toast("Failed", "error"))}
                className="text-brand-600"
              >
                <Square className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.title}</p>
                {t.due_date && (
                  <p className={cn("text-xs", t.due_date < today ? "font-bold text-destructive" : "text-muted-foreground")}>
                    {t.due_date === today ? "Due today" : `Due ${new Date(t.due_date + "T00:00:00").toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                  </p>
                )}
              </div>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => void remove.mutateAsync(t.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {done.length > 0 && <p className="pt-2 text-xs font-bold text-muted-foreground">COMPLETED</p>}
          {done.slice(0, 15).map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card/60 p-3 opacity-70">
              <button
                onClick={() => void update.mutateAsync({ id: t.id, completed: false } as unknown as Record<string, unknown>)}
                className="text-muted-foreground"
              >
                <CheckSquare className="h-5 w-5" />
              </button>
              <p className="min-w-0 flex-1 truncate text-sm line-through">{t.title}</p>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => void remove.mutateAsync(t.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add task">
        <div className="flex flex-col gap-3">
          <Field label="Task"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Restock soda crates" /></Field>
          <Field label="Due date (optional)"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Button loading={create.isPending} onClick={() => void add()}>Add task</Button>
        </div>
      </Dialog>
    </div>
  );
}
