import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Upload,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtMoney } from "@/lib/extract";
import { connectDashboardUrl } from "@/lib/stripe";
import {
  COMPENSATION_TYPES,
  contractStatus,
  formatBytes,
  paymentTotals,
  useStore,
  type ContractInfo,
  type CrewMember,
  type Payment,
  type PaymentStatus,
  type PaymentMode,
  type Production,
  type UploadedDoc,
} from "@/lib/store";

/** Statuses the producer can set by hand. Processing/Paid/Failed come from Stripe. */
const MANUAL_STATUSES: PaymentStatus[] = ["Pending", "Approved"];

/* ---------------- shared bits ---------------- */

function Badge({ children, solid }: { children: React.ReactNode; solid?: boolean }) {
  return (
    <span
      className={
        solid
          ? "shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground"
          : "shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-[13.5px]">{value ?? "—"}</p>
    </div>
  );
}

const or = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

/* ---------------- payments summary ---------------- */

export function PaymentsSummary({ production }: { production: Production }) {
  const { stripe } = useStore();
  const t = paymentTotals(production);
  const missingConfirmed = production.contracts.filter(
    (c) => c.confirmed && c.confirmed.compensationAmount === null,
  );

  const cards = [
    { label: "Total", value: t.total },
    { label: "Pending", value: t.pending },
    { label: "Approved", value: t.approved },
    { label: "Processing", value: t.processing },
    { label: "Paid", value: t.paid },
  ];

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        {stripe ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/30 bg-accent/50 px-2.5 py-0.5 text-[11px] font-medium">
            <Check className="h-3 w-3" /> Stripe Connected
          </span>
        ) : (
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Stripe not connected — tracking only
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-[19px] font-semibold tracking-tight">{fmtMoney(c.value)}</p>
          </div>
        ))}
      </div>

      {missingConfirmed.length > 0 && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-foreground/25 bg-accent/50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-[13px]">
            {missingConfirmed.length} confirmed contract
            {missingConfirmed.length === 1 ? "" : "s"} without a payment amount —{" "}
            <span className="text-muted-foreground">
              {missingConfirmed.map((c) => c.name).join(", ")}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- contracts tab ---------------- */

export function ContractsTab({ production }: { production: Production }) {
  const { addDocs, removeDoc, assignContract } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = production.contracts.find((c) => c.id === openId) ?? null;

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    addDocs(
      production.id,
      "contracts",
      Array.from(list).map((f) => ({ name: f.name, size: f.size })),
    );
  };

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium">Contracts</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {production.contracts.length}{" "}
            {production.contracts.length === 1 ? "document" : "documents"} ·{" "}
            {production.contracts.filter((c) => c.confirmed).length} confirmed
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </div>

      <p className="mt-3 text-[12.5px] text-muted-foreground">
        Upload → assign a team member → extract information → review → confirm → payment created.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf"
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
        className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border"
      >
        {production.contracts.map((d) => {
          const member = production.crew.find((c) => c.id === d.memberId);
          const status = contractStatus(d);
          return (
            <div key={d.id} className="group bg-card px-4 py-3.5 sm:px-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <button
                  onClick={() => setOpenId(d.id)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{d.name}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {member ? `${member.name} · ${member.role}` : "Unassigned"} ·{" "}
                      {formatBytes(d.size)} · {d.uploadedAt}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge solid={status === "Confirmed"}>{status}</Badge>
                  {d.confirmed && (
                    <span className="hidden text-[13px] font-medium sm:inline">
                      {d.confirmed.compensationAmount === null
                        ? "No amount"
                        : fmtMoney(d.confirmed.compensationAmount)}
                    </span>
                  )}
                  <Button size="sm" variant="ghost" className="text-[12px]" onClick={() => setOpenId(d.id)}>
                    Open
                  </Button>
                  <button
                    aria-label={`Remove ${d.name}`}
                    onClick={() => removeDoc(production.id, "contracts", d.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {!d.memberId && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5">
                  <span className="text-[12.5px] text-muted-foreground">Assign to team member</span>
                  <Select onValueChange={(v) => assignContract(production.id, d.id, v)}>
                    <SelectTrigger className="h-8 w-full sm:w-64">
                      <SelectValue placeholder="Select person" />
                    </SelectTrigger>
                    <SelectContent>
                      {production.crew.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
        {production.contracts.length === 0 && (
          <p className="bg-card px-5 py-14 text-center text-sm text-muted-foreground">
            Drop signed PDF contracts here, or use Upload.
          </p>
        )}
      </div>

      <ContractDialog
        production={production}
        contract={open}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

/* ---------------- contract detail dialog ---------------- */

export function ContractDialog({
  production,
  contract,
  onClose,
}: {
  production: Production;
  contract: UploadedDoc | null;
  onClose: () => void;
}) {
  const { assignContract, extractContract, confirmContract } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContractInfo | null>(null);

  const member = production.crew.find((c) => c.id === contract?.memberId);
  const status = contract ? contractStatus(contract) : "Unassigned";
  const payment = production.payments.find((p) => p.contractId === contract?.id);

  const close = () => {
    setEditing(false);
    setDraft(null);
    onClose();
  };

  const startEdit = (info: ContractInfo) => {
    setDraft({ ...info });
    setEditing(true);
  };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        {contract && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 text-left text-[16px] leading-snug">{contract.name}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              {/* file + linkage */}
              <div className="rounded-xl border border-border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Team member" value={member ? member.name : "Unassigned"} />
                  <Field label="Role" value={or(member?.role)} />
                  <Field label="Upload date" value={contract.uploadedAt} />
                  <Field label="Contract status" value={status} />
                  <Field label="File" value={`PDF · ${formatBytes(contract.size)}`} />
                  <Field
                    label="Payment"
                    value={payment ? `${fmtMoney(payment.amount)} · ${payment.status}` : "Not created"}
                  />
                </div>
                {!contract.memberId && (
                  <div className="mt-3 grid gap-2">
                    <Label>Associate with team member</Label>
                    <Select onValueChange={(v) => assignContract(production.id, contract.id, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {production.crew.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* preview / file info */}
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Document preview
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                  {contract.sourceText ??
                    `No text preview available for this upload. ${contract.name} · ${formatBytes(contract.size)}`}
                </p>
              </div>

              {/* extraction */}
              <div className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                    <Sparkles className="h-3.5 w-3.5" /> AI Extracted Information
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!contract.memberId}
                    onClick={() => extractContract(production.id, contract.id)}
                  >
                    {contract.extracted ? "Re-extract" : "Extract Contract Information"}
                  </Button>
                </div>

                {!contract.memberId && (
                  <p className="mt-2 text-[12.5px] text-muted-foreground">
                    Assign a team member first.
                  </p>
                )}

                {contract.extracted && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Full name" value={or(contract.extracted.fullName)} />
                      <Field label="Role" value={or(contract.extracted.role)} />
                      <Field
                        label="Compensation"
                        value={
                          contract.extracted.compensationAmount === null ? (
                            <span className="text-muted-foreground">Compensation not detected</span>
                          ) : (
                            fmtMoney(contract.extracted.compensationAmount)
                          )
                        }
                      />
                      <Field label="Compensation type" value={or(contract.extracted.compensationType)} />
                      <Field
                        label="Rate"
                        value={contract.extracted.rate === null ? "—" : fmtMoney(contract.extracted.rate)}
                      />
                      <Field label="Days" value={or(contract.extracted.days)} />
                      <Field label="Start date" value={or(contract.extracted.startDate)} />
                      <Field label="End date" value={or(contract.extracted.endDate)} />
                      <Field label="Payment terms" value={or(contract.extracted.paymentTerms)} />
                      <Field
                        label="Overtime rate"
                        value={
                          contract.extracted.overtimeRate === null
                            ? "—"
                            : fmtMoney(contract.extracted.overtimeRate)
                        }
                      />
                    </div>
                    <p className="mt-3 text-[12px] text-muted-foreground">
                      AI extraction can be wrong — review before confirming.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => confirmContract(production.id, contract.id, contract.extracted!)}
                      >
                        <Check className="h-4 w-4" /> Confirm Information
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(contract.extracted!)}>
                        <Pencil className="h-4 w-4" /> Edit Information
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* confirmed */}
              {contract.confirmed && !editing && (
                <div className="rounded-xl border border-foreground/25 bg-accent/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                      <Check className="h-3.5 w-3.5" /> Confirmed Contract Information
                    </p>
                    <Button size="sm" variant="outline" onClick={() => startEdit(contract.confirmed!)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Full name" value={or(contract.confirmed.fullName)} />
                    <Field label="Role" value={or(contract.confirmed.role)} />
                    <Field
                      label="Compensation"
                      value={
                        contract.confirmed.compensationAmount === null ? (
                          <span className="text-muted-foreground">Compensation not detected</span>
                        ) : (
                          fmtMoney(contract.confirmed.compensationAmount)
                        )
                      }
                    />
                    <Field label="Compensation type" value={or(contract.confirmed.compensationType)} />
                    <Field
                      label="Rate"
                      value={contract.confirmed.rate === null ? "—" : fmtMoney(contract.confirmed.rate)}
                    />
                    <Field label="Days" value={or(contract.confirmed.days)} />
                    <Field label="Start date" value={or(contract.confirmed.startDate)} />
                    <Field label="End date" value={or(contract.confirmed.endDate)} />
                    <Field label="Payment terms" value={or(contract.confirmed.paymentTerms)} />
                    <Field
                      label="Overtime rate"
                      value={
                        contract.confirmed.overtimeRate === null
                          ? "—"
                          : fmtMoney(contract.confirmed.overtimeRate)
                      }
                    />
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    {payment
                      ? `Payment record ${fmtMoney(payment.amount)} · ${payment.status}`
                      : "No payment record yet."}
                  </p>
                </div>
              )}

              {/* editor */}
              {editing && draft && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-[13px] font-medium">Edit contract information</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Full name</Label>
                      <Input
                        value={draft.fullName ?? ""}
                        onChange={(e) => setDraft({ ...draft, fullName: e.target.value || null })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Role</Label>
                      <Input
                        value={draft.role ?? ""}
                        onChange={(e) => setDraft({ ...draft, role: e.target.value || null })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Compensation amount</Label>
                      <Input
                        type="number"
                        placeholder="Not detected — enter manually"
                        value={draft.compensationAmount ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, compensationAmount: num(e.target.value) })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Compensation type</Label>
                      <Select
                        value={draft.compensationType ?? ""}
                        onValueChange={(v) => setDraft({ ...draft, compensationType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPENSATION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Rate</Label>
                      <Input
                        type="number"
                        value={draft.rate ?? ""}
                        onChange={(e) => setDraft({ ...draft, rate: num(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Days</Label>
                      <Input
                        type="number"
                        value={draft.days ?? ""}
                        onChange={(e) => setDraft({ ...draft, days: num(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Start date</Label>
                      <Input
                        type="date"
                        value={draft.startDate ?? ""}
                        onChange={(e) => setDraft({ ...draft, startDate: e.target.value || null })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>End date</Label>
                      <Input
                        type="date"
                        value={draft.endDate ?? ""}
                        onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment terms</Label>
                      <Input
                        value={draft.paymentTerms ?? ""}
                        onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value || null })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Overtime rate</Label>
                      <Input
                        type="number"
                        value={draft.overtimeRate ?? ""}
                        onChange={(e) => setDraft({ ...draft, overtimeRate: num(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        confirmContract(production.id, contract.id, draft);
                        setEditing(false);
                        setDraft(null);
                      }}
                    >
                      <Check className="h-4 w-4" /> Save & confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- payments tab ---------------- */

export function PaymentsTab({ production }: { production: Production }) {
  const { stripe, setPaymentMode } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const payment = production.payments.find((p) => p.id === openId) ?? null;
  const contract = production.contracts.find((c) => c.id === contractId) ?? null;

  const rows = useMemo(
    () =>
      production.payments.map((pay) => ({
        pay,
        member: production.crew.find((c) => c.id === pay.memberId),
        contract: production.contracts.find((c) => c.id === pay.contractId),
      })),
    [production],
  );

  return (
    <div>
      <div className="min-w-0">
        <h2 className="text-[15px] font-medium">Payments</h2>
        <p className="text-[12.5px] text-muted-foreground">
          {production.payments.length} record{production.payments.length === 1 ? "" : "s"} created from
          confirmed contracts
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Production payment settings
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(
            [
              { mode: "tracking" as PaymentMode, label: "Payment tracking only" },
              { mode: "stripe" as PaymentMode, label: "Pay through Stripe" },
            ]
          ).map(({ mode, label }) => (
            <Button
              key={mode}
              size="sm"
              variant={(production.paymentMode ?? "tracking") === mode ? "default" : "outline"}
              disabled={mode === "stripe" && !stripe}
              onClick={() => setPaymentMode(production.id, mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        {!stripe && (
          <p className="mt-2.5 text-[12.5px] text-muted-foreground">
            Connecting Stripe enables direct payments to team members through SceneHire.{" "}
            <Link to="/settings" className="underline">
              Connect Stripe
            </Link>
          </p>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] gap-4 border-b border-border bg-muted/50 px-5 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Team member</span>
          <span>Role</span>
          <span className="text-right">Amount</span>
          <span>Contract</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map(({ pay, member, contract: c }) => (
            <button
              key={pay.id}
              onClick={() => setOpenId(pay.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-card px-4 py-3.5 text-left hover:bg-accent/40 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] sm:px-5"
            >
              <span className="truncate text-[14px] font-medium">{member?.name ?? "—"}</span>
              <span className="hidden truncate text-[13px] text-muted-foreground sm:block">
                {member?.role ?? "—"}
              </span>
              <span className="text-right text-[14px] font-medium">
                {pay.amount === null ? (
                  <span className="text-[12.5px] font-normal text-muted-foreground">No amount</span>
                ) : (
                  fmtMoney(pay.amount)
                )}
              </span>
              <span className="hidden sm:block">
                <Badge>{c?.confirmed ? "Confirmed" : c ? contractStatus(c) : "—"}</Badge>
              </span>
              <span>
                <Badge solid={pay.status === "Paid"}>{pay.status}</Badge>
              </span>
            </button>
          ))}
          {production.payments.length === 0 && (
            <p className="bg-card px-5 py-14 text-center text-sm text-muted-foreground">
              No payments yet. Confirm a contract's compensation to create one automatically.
            </p>
          )}
        </div>
      </div>

      <PaymentDialog
        production={production}
        payment={payment}
        onClose={() => setOpenId(null)}
        onOpenContract={(id) => {
          setOpenId(null);
          setContractId(id);
        }}
      />
      <ContractDialog production={production} contract={contract} onClose={() => setContractId(null)} />
    </div>
  );
}

export function PaymentDialog({
  production,
  payment,
  onClose,
  onOpenContract,
}: {
  production: Production;
  payment: Payment | null;
  onClose: () => void;
  onOpenContract?: (contractId: string) => void;
}) {
  const { updatePayment, markPaidManually, stripe, payWithStripe } = useStore();
  const member = production.crew.find((c) => c.id === payment?.memberId);
  const contract = production.contracts.find((c) => c.id === payment?.contractId);
  const [amount, setAmount] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  return (
    <Dialog
      open={!!payment}
      onOpenChange={(o) => {
        if (!o) {
          setAmount("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {payment && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left text-[16px]">
                {member?.name ?? "Payment"} — {fmtMoney(payment.amount)}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
                <Field label="Team member" value={or(member?.name)} />
                <Field label="Role" value={or(member?.role)} />
                <Field label="Created" value={payment.createdAt} />
                <Field label="Compensation type" value={or(contract?.confirmed?.compensationType)} />
              </div>

              {payment.amount === null && (
                <div className="flex items-start gap-2.5 rounded-lg border border-foreground/25 bg-accent/50 px-3.5 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-[12.5px]">
                    Compensation not detected on the contract — enter the amount manually.
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="pay-amount">Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="pay-amount"
                    type="number"
                    placeholder={payment.amount === null ? "Enter amount" : String(payment.amount)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={amount.trim() === ""}
                    onClick={() => {
                      updatePayment(production.id, payment.id, { amount: Number(amount) });
                      setAmount("");
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  {MANUAL_STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={payment.status === s ? "default" : "outline"}
                      className="flex-1"
                      disabled={payment.status === "Processing"}
                      onClick={() => updatePayment(production.id, payment.id, { status: s })}
                    >
                      {s}
                    </Button>
                  ))}
                  {(payment.status === "Processing" ||
                    payment.status === "Paid" ||
                    payment.status === "Failed") && (
                    <Badge solid={payment.status === "Paid"}>{payment.status}</Badge>
                  )}
                </div>
                {payment.status === "Pending" && (
                  <p className="text-[12px] text-muted-foreground">
                    Approve this payment before it can be sent.
                  </p>
                )}
              </div>

              {payment.status === "Paid" && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-accent/40 p-4">
                  <Field label="Paid date" value={or(payment.paidAt)} />
                  <Field label="Paid via" value={or(payment.paidVia ?? "Manual")} />
                  <Field label="Amount" value={fmtMoney(payment.amount)} />
                  <Field label="Stripe reference" value={or(payment.stripeReference)} />
                </div>
              )}

              {payment.status === "Failed" && (
                <div className="flex items-start gap-2.5 rounded-lg border border-foreground/25 bg-accent/50 px-3.5 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-[12.5px]">
                    Payment failed — {or(payment.failureReason)}. You can retry it below.
                  </p>
                </div>
              )}

              {payment.status !== "Paid" && (
                <div className="grid gap-2 rounded-xl border border-border p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Send payment
                  </p>
                  {stripe ? (
                    <>
                      <Button
                        className="w-full"
                        disabled={
                          payment.status === "Processing" ||
                          payment.amount === null ||
                          (payment.status !== "Approved" && payment.status !== "Failed")
                        }
                        onClick={() => setConfirming(true)}
                      >
                        {payment.status === "Processing" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5" />
                            {payment.status === "Failed" ? "Retry with Stripe" : "Pay with Stripe"}
                          </>
                        )}
                      </Button>
                      {production.paymentMode !== "stripe" && (
                        <p className="text-[12px] text-muted-foreground">
                          This production is set to payment tracking only. Switch it to Stripe in the
                          Payments tab to send payments.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-muted-foreground">
                        Stripe is not connected. Connect Stripe to pay team members directly through
                        SceneHire.
                      </p>
                      <Button variant="outline" className="w-full" asChild>
                        <Link to="/settings">Connect Stripe</Link>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={payment.status === "Processing" || payment.amount === null}
                    onClick={() => markPaidManually(production.id, payment.id)}
                  >
                    Mark as Paid Manually
                  </Button>
                </div>
              )}

              {contract && (
                <button
                  onClick={() => onOpenContract?.(contract.id)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-left text-[13px] hover:bg-accent/40"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{contract.name}</span>
                  <Badge solid={!!contract.confirmed}>{contractStatus(contract)}</Badge>
                </button>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>

            <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-left text-[16px]">
                    Pay {member?.name ?? "team member"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
                  <Field label="Role" value={or(member?.role)} />
                  <Field label="Amount" value={fmtMoney(payment.amount)} />
                  <Field label="Source" value={or(contract?.name)} />
                  <Field label="Payment method" value="Stripe" />
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  Confirm &amp; Pay initiates a real payment to this team member through your
                  connected Stripe account. This cannot be undone from SceneHire.
                </p>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
                    Cancel
                  </Button>
                  <Button
                    disabled={sending}
                    onClick={async () => {
                      setSending(true);
                      await payWithStripe(production.id, payment.id);
                      setSending(false);
                      setConfirming(false);
                    }}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Paying…
                      </>
                    ) : (
                      "Confirm & Pay"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- crew member contract + payment summary ---------------- */

export function MemberContractSummary({
  production,
  member,
}: {
  production: Production;
  member: CrewMember;
}) {
  const [openContract, setOpenContract] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);
  const contract = production.contracts.find((c) => c.memberId === member.id);
  const payment = production.payments.find((p) => p.memberId === member.id);

  if (!contract && !payment) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background px-3.5 py-3 sm:ml-11">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Contract
          </p>
          {contract ? (
            <button
              onClick={() => setOpenContract(true)}
              className="mt-1 flex min-w-0 items-center gap-1.5 text-left text-[13px] hover:underline"
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Uploaded{contract.confirmed ? " · Confirmed" : ` · ${contractStatus(contract)}`}
              </span>
            </button>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">Not uploaded</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Compensation
          </p>
          <p className="mt-1 text-[13px]">
            {contract?.confirmed?.compensationAmount != null
              ? `${fmtMoney(contract.confirmed.compensationAmount)}${
                  contract.confirmed.compensationType ? ` · ${contract.confirmed.compensationType}` : ""
                }`
              : contract?.confirmed
                ? "Compensation not detected"
                : "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Payment
          </p>
          {payment ? (
            <button
              onClick={() => setOpenPayment(true)}
              className="mt-1 flex items-center gap-2 text-left text-[13px] hover:underline"
            >
              <span>{payment.amount === null ? "No amount" : fmtMoney(payment.amount)}</span>
              <Badge solid={payment.status === "Paid"}>{payment.status}</Badge>
            </button>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <ContractDialog
        production={production}
        contract={openContract && contract ? contract : null}
        onClose={() => setOpenContract(false)}
      />
      <PaymentDialog
        production={production}
        payment={openPayment && payment ? payment : null}
        onClose={() => setOpenPayment(false)}
        onOpenContract={() => {
          setOpenPayment(false);
          setOpenContract(true);
        }}
      />
    </div>
  );
}
