import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileSignature,
  FileText,
  MapPin,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import {
  ContractsTab,
  MemberContractSummary,
  PaymentsSummary,
  PaymentsTab,
} from "@/components/contract-payments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  formatBytes,
  STANDARD_DOCS,
  useStore,
  type CrewMember,
  type Production,
  type UploadedDoc,
} from "@/lib/store";
import { fetchEmailThreads, type EmailConnection } from "@/lib/email";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Production dashboard — SceneHire" },
      {
        name: "description",
        content: "Crew, contracts, schedule and files for a single production, in one place.",
      },
      { property: "og:title", content: "Production dashboard — SceneHire" },
      {
        property: "og:description",
        content: "Crew, contracts, schedule and files for a single production, in one place.",
      },
    ],
  }),
  component: ProductionPage,
});

function fmtRange(a: string, b: string) {
  const f = (d: string) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  return `${f(a)} – ${f(b)}`;
}

function ProductionPage() {
  const { projectId } = Route.useParams();
  const { productions } = useStore();
  const production = productions.find((p) => p.id === projectId);

  if (!production) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-xl font-semibold">Production not found</h1>
          <Link to="/projects" className="mt-4 inline-block text-sm underline">
            Back to projects
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </Link>

        <div className="mt-4 border-b border-border pb-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{production.name}</h1>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {production.type}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {fmtRange(production.startDate, production.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {production.location || "—"}
            </span>
          </div>
        </div>

        <PaymentsSummary production={production} />

        <Tabs defaultValue="crew" className="mt-6">
          <TabsList>
            <TabsTrigger value="crew">Crew</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          <TabsContent value="crew" className="mt-6">
            <CrewTab production={production} />
          </TabsContent>
          <TabsContent value="contracts" className="mt-6">
            <ContractsTab production={production} />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <PaymentsTab production={production} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab production={production} />
          </TabsContent>
          <TabsContent value="files" className="mt-6">
            <DocsTab production={production} docKey="files" />
          </TabsContent>
          <TabsContent value="email" className="mt-6">
            <EmailTab production={production} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SectionHeader({ title, count, action }: { title: string; count: string; action?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-medium">{title}</h2>
        <p className="text-[12.5px] text-muted-foreground">{count}</p>
      </div>
      {action}
    </div>
  );
}

/* ---------------- Crew ---------------- */

function CrewTab({ production }: { production: Production }) {
  const { addCrew, toggleCrewStatus, removeCrew } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "", status: "Invited" as "Invited" | "Signed" });
  const signed = production.crew.filter((c) => c.status === "Signed").length;

  return (
    <div>
      <SectionHeader
        title="Crew & talent"
        count={`${production.crew.length} people · ${signed} signed`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0">
                <Plus className="h-4 w-4" /> Add person
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add person</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="c-name">Name</Label>
                  <Input
                    id="c-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-role">Role</Label>
                  <Input
                    id="c-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Enter role"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-email">Email</Label>
                  <Input
                    id="c-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as "Invited" | "Signed" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Invited">Invited</SelectItem>
                      <SelectItem value="Signed">Signed</SelectItem>
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
                    addCrew(production.id, form);
                    setForm({ name: "", role: "", email: "", status: "Invited" });
                    setOpen(false);
                  }}
                >
                  Add to production
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {production.crew.map((c) => (
          <CrewRow key={c.id} production={production} member={c} />
        ))}
        {production.crew.length === 0 && (
          <p className="bg-card px-5 py-14 text-center text-sm text-muted-foreground">
            No one added yet.
          </p>
        )}
      </div>
    </div>
  );
}

function uploadUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/upload/${token}`;
}

function CrewRow({ production, member }: { production: Production; member: CrewMember }) {
  const { toggleCrewStatus, removeCrew } = useStore();
  const [copied, setCopied] = useState(false);
  const requests = member.docRequests ?? [];
  const done = requests.filter((r) => r.status === "Uploaded").length;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(uploadUrl(token));
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="bg-card px-4 py-3.5 sm:px-5">
      <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">
            {member.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{member.name}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">
              {member.role}
              {member.email ? ` · ${member.email}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RequestDocsDialog production={production} member={member} />
          <button
            onClick={() => toggleCrewStatus(production.id, member.id)}
            title="Toggle status"
            className={
              member.status === "Signed"
                ? "rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
                : "rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {member.status}
          </button>
          <button
            aria-label={`Remove ${member.name}`}
            onClick={() => removeCrew(production.id, member.id)}
            className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-background px-3.5 py-3 sm:ml-11">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Documents
            </p>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] text-muted-foreground">
                {done} of {requests.length} document{requests.length === 1 ? "" : "s"} complete
              </span>
              <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${(done / requests.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <ul className="mt-2.5 grid gap-1.5">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px]">
                {r.status === "Uploaded" ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className={r.status === "Uploaded" ? "" : "text-muted-foreground"}>
                  {r.label}
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  {r.status === "Uploaded" ? `· ${r.fileName}` : "· Pending"}
                </span>
              </li>
            ))}
          </ul>
          {member.uploadToken && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-[11.5px] text-muted-foreground">
                /upload/{member.uploadToken}
              </code>
              <Button size="sm" variant="outline" onClick={() => copy(member.uploadToken!)}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy upload link"}
              </Button>
            </div>
          )}
        </div>
      )}

      <MemberContractSummary production={production} member={member} />
    </div>
  );
}

function RequestDocsDialog({ production, member }: { production: Production; member: CrewMember }) {
  const { requestDocuments } = useStore();
  const [open, setOpen] = useState(false);
  const existing = member.docRequests ?? [];
  const [selected, setSelected] = useState<string[]>(() => existing.map((r) => r.label));
  const [custom, setCustom] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const customLabels = selected.filter((l) => !STANDARD_DOCS.includes(l));

  const reset = () => {
    setSelected(existing.map((r) => r.label));
    setCustom("");
    setToken(null);
    setCopied(false);
  };

  const toggle = (label: string) =>
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const addCustom = () => {
    const label = custom.trim();
    if (!label || selected.includes(label)) return;
    setSelected((prev) => [...prev, label]);
    setCustom("");
  };

  const copyLink = async (t: string) => {
    try {
      await navigator.clipboard.writeText(uploadUrl(t));
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
        else reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="shrink-0 text-[12px]">
          <FileSignature className="h-3.5 w-3.5" /> Request documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request documents</DialogTitle>
        </DialogHeader>

        {token ? (
          <div className="grid gap-3">
            <p className="text-[13px] text-muted-foreground">
              Secure upload link for <span className="text-foreground">{member.name}</span> on{" "}
              {production.name}. No account needed — they just open it and upload.
            </p>
            <code className="break-all rounded-md bg-muted px-3 py-2 font-mono text-[12px]">
              {uploadUrl(token)}
            </code>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => copyLink(token)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button variant="outline" asChild>
                <a href={uploadUrl(token)} target="_blank" rel="noreferrer">
                  Preview
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-2.5">
              {[...STANDARD_DOCS, ...customLabels].map((label) => {
                const uploaded = existing.find((r) => r.label === label)?.status === "Uploaded";
                return (
                  <label
                    key={label}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-[13.5px]"
                  >
                    <Checkbox
                      checked={selected.includes(label)}
                      onCheckedChange={() => toggle(label)}
                    />
                    <span className="flex-1">{label}</span>
                    {uploaded && <span className="text-[11.5px] text-muted-foreground">Uploaded</span>}
                  </label>
                );
              })}
              <div className="flex gap-2">
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder="Other — e.g. Certificate of Insurance"
                />
                <Button variant="outline" onClick={addCustom} disabled={!custom.trim()}>
                  Add
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={selected.length === 0}
                onClick={() => setToken(requestDocuments(production.id, member.id, selected))}
              >
                Generate upload link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Contracts / Files ---------------- */

function DocsTab({
  production,
  docKey,
  accept,
}: {
  production: Production;
  docKey: "contracts" | "files";
  accept?: string;
}) {
  const { addDocs, removeDoc } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const docs: UploadedDoc[] = production[docKey];
  const isContracts = docKey === "contracts";

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    addDocs(
      production.id,
      docKey,
      Array.from(list).map((f) => ({ name: f.name, size: f.size })),
    );
  };

  return (
    <div>
      <SectionHeader
        title={isContracts ? "Contracts" : "Production files"}
        count={`${docs.length} ${docs.length === 1 ? "document" : "documents"}`}
        action={
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        }
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        {...(accept ? { accept } : {})}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
        className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border"
      >
        {docs.map((d) => (
          <div
            key={d.id}
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-card px-4 py-3.5 sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium">{d.name}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {formatBytes(d.size)} · uploaded {d.uploadedAt}
                </p>
              </div>
            </div>
            <button
              aria-label={`Remove ${d.name}`}
              onClick={() => removeDoc(production.id, docKey, d.id)}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {docs.length === 0 && (
          <p className="bg-card px-5 py-14 text-center text-sm text-muted-foreground">
            Drop {isContracts ? "signed PDF contracts" : "files"} here, or use Upload.
          </p>
        )}
      </div>
    </div>
  );
}

function EmailTab({ production }: { production: Production }) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(production.emailConnectionId ?? null);
  const [threads, setThreads] = useState<Array<{ id: string; subject: string; snippet: string; from?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const getThreads = useServerFn(fetchEmailThreads);
  const { emailConnections: connections, setProductionEmailConnection } = useStore();
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) ?? null;

  useEffect(() => {
    if (!selectedConnection) {
      setThreads([]);
      return;
    }

    const loadThreads = async () => {
      setIsLoading(true);
      try {
        const result = await getThreads({ data: { provider: selectedConnection.provider, accessToken: selectedConnection.accessToken } });
        setThreads(result.threads ?? []);
      } finally {
        setIsLoading(false);
      }
    };

    loadThreads();
  }, [selectedConnection, getThreads]);

  return (
    <div>
      <SectionHeader
        title="Production email"
        count={selectedConnection ? `Connected to ${selectedConnection.providerName}` : "No email account connected"}
      />

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-2">
          <Label>Connected account</Label>
          <Select
            value={selectedConnectionId ?? ""}
            onValueChange={(value) => {
              const connectionId = value || null;
              setSelectedConnectionId(connectionId);
              setProductionEmailConnection(production.id, connectionId);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select connected inbox" />
            </SelectTrigger>
            <SelectContent>
              {connections.length === 0 ? (
                <SelectItem value="">No connected accounts</SelectItem>
              ) : (
                connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.providerName} — {connection.email}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Production inbox</Label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading recent conversations…</p>
          ) : threads.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border bg-background">
              {threads.map((thread) => (
                <div key={thread.id} className="px-4 py-3 hover:bg-muted">
                  <p className="text-sm font-medium">{thread.subject || "No subject"}</p>
                  <p className="text-[13px] text-muted-foreground">{thread.from ?? "Unknown sender"}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{thread.snippet}</p>
                </div>
              ))}
            </div>
          ) : selectedConnection ? (
            <p className="text-sm text-muted-foreground">No recent email threads found.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Select an account to show recent messages.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Schedule ---------------- */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ScheduleTab({ production }: { production: Production }) {
  const { addEvent, removeEvent } = useStore();
  const anchor = production.startDate ? new Date(`${production.startDate}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: production.startDate, time: "08:00", location: "" });

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) {
      out.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      );
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const sorted = [...production.events].sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );

  return (
    <div>
      <SectionHeader
        title="Schedule"
        count={`${production.events.length} events`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0">
                <Plus className="h-4 w-4" /> Add event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add schedule event</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="e-title">Event</Label>
                  <Input
                    id="e-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Shoot Day 1 — Studio"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="e-date">Date</Label>
                    <Input
                      id="e-date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="e-time">Call time</Label>
                    <Input
                      id="e-time"
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="e-loc">Location</Label>
                  <Input
                    id="e-loc"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Stage 4, Culver"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!form.title.trim() || !form.date}
                  onClick={() => {
                    addEvent(production.id, form);
                    setForm({ title: "", date: production.startDate, time: "08:00", location: "" });
                    setOpen(false);
                  }}
                >
                  Add event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-medium">
            {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous month"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Next month"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            const dayEvents = iso ? production.events.filter((e) => e.date === iso) : [];
            const inRange =
              iso && production.startDate && production.endDate
                ? iso >= production.startDate && iso <= production.endDate
                : false;
            return (
              <div
                key={i}
                className={`min-h-[68px] rounded-md border p-1.5 text-left ${
                  iso ? (inRange ? "border-foreground/25 bg-accent/50" : "border-border") : "border-transparent"
                }`}
              >
                {iso && (
                  <>
                    <span className="text-[11px] text-muted-foreground">{Number(iso.slice(-2))}</span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.map((e) => (
                        <p
                          key={e.id}
                          title={`${e.time} ${e.title}`}
                          className="truncate rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground"
                        >
                          {e.time} {e.title}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {sorted.map((e) => (
          <div
            key={e.id}
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-card px-4 py-3.5 sm:px-5"
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{e.title}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {new Date(`${e.date}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {e.time}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </div>
            <button
              aria-label={`Remove ${e.title}`}
              onClick={() => removeEvent(production.id, e.id)}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            No events scheduled yet.
          </p>
        )}
      </div>
    </div>
  );
}
