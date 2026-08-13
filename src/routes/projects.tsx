import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Calendar, MapPin, Plus, Users } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCTION_TYPES, useStore } from "@/lib/store";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — SceneHire" },
      {
        name: "description",
        content:
          "Organize productions after your team is hired: crew, contracts, schedule and files in one calm workspace.",
      },
      { property: "og:title", content: "Projects — SceneHire" },
      {
        property: "og:description",
        content: "The operating system for temporary production teams.",
      },
    ],
  }),
  component: ProjectsPage,
});

function fmt(date: string) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ProjectsPage() {
  const { productions, addProduction } = useStore();

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <PageHeader
          title="Projects"
          description={`${productions.length} active production${productions.length === 1 ? "" : "s"}`}
          action={<NewProductionDialog onCreate={addProduction} />}
        />

        <div className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {productions.map((production) => {
            const signed = production.crew.filter((c) => c.status === "Signed").length;
            return (
              <Link
                key={production.id}
                to="/projects/$projectId"
                params={{ projectId: production.id }}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-card px-5 py-4 transition-colors hover:bg-accent/50 sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-[15px] font-medium">{production.name}</h2>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {production.type}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmt(production.startDate)} – {fmt(production.endDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {production.location || "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {signed}/{production.crew.length} signed
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            );
          })}
          {productions.length === 0 && (
            <p className="bg-card px-6 py-14 text-center text-sm text-muted-foreground">
              No productions yet. Create your first one.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function NewProductionDialog({
  onCreate,
}: {
  onCreate: (p: {
    name: string;
    startDate: string;
    endDate: string;
    location: string;
    type: string;
  }) => string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    location: "",
    type: "Commercial",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Plus className="h-4 w-4" /> New Production
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New production</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Production name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Enter production name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate")(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">End date</Label>
              <Input
                id="end"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => set("location")(e.target.value)}
              placeholder="Enter location"
            />
          </div>
          <div className="grid gap-2">
            <Label>Production type</Label>
            <Select value={form.type} onValueChange={set("type")}> 
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!form.name.trim()}
            onClick={() => {
              onCreate(form);
              setForm({ name: "", startDate: "", endDate: "", location: "", type: "Commercial" });
              setOpen(false);
            }}
          >
            Create production
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
