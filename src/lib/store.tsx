import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { extractContractInfo } from "./extract";
import {
  createConnectOnboardingSession,
  createTransfer,
  type StripeConnection,
} from "./stripe";
import type { EmailConnection } from "./email";


export type CrewStatus = "Invited" | "Signed";

export type DocRequestStatus = "Pending" | "Uploaded";

export type DocRequest = {
  id: string;
  label: string;
  status: DocRequestStatus;
  fileName?: string;
  size?: number;
  uploadedAt?: string;
};

export type CrewMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: CrewStatus;
  docRequests?: DocRequest[];
  uploadToken?: string;
};

export const STANDARD_DOCS = ["Deal Memo", "NDA", "W-9"];

export type UploadedDoc = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  /** Contracts only — the crew member this contract belongs to. */
  memberId?: string;
  /** Contracts only — mock source text used by the extraction step. */
  sourceText?: string;
  extracted?: ContractInfo | null;
  confirmed?: ContractInfo | null;
};

export type ContractInfo = {
  fullName: string | null;
  role: string | null;
  compensationAmount: number | null;
  compensationType: string | null;
  rate: number | null;
  days: number | null;
  startDate: string | null;
  endDate: string | null;
  paymentTerms: string | null;
  overtimeRate: number | null;
};

export const COMPENSATION_TYPES = ["Flat Fee", "Day Rate", "Weekly Rate", "Hourly Rate"];

export type ContractStatus = "Unassigned" | "Uploaded" | "Extracted" | "Confirmed";

export function contractStatus(d: UploadedDoc): ContractStatus {
  if (d.confirmed) return "Confirmed";
  if (d.extracted) return "Extracted";
  if (d.memberId) return "Uploaded";
  return "Unassigned";
}

export type PaymentStatus = "Pending" | "Approved" | "Processing" | "Paid" | "Failed";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "Pending",
  "Approved",
  "Processing",
  "Paid",
  "Failed",
];

export type Payment = {
  id: string;
  contractId: string;
  memberId: string;
  amount: number | null;
  status: PaymentStatus;
  createdAt: string;
  /** Set when the payment reaches Paid. */
  paidAt?: string | undefined;
  /** "Stripe" or "Manual" — how the money actually moved. */
  paidVia?: "Stripe" | "Manual" | undefined;
  /** Stripe transfer id. No bank or card data is ever stored. */
  stripeReference?: string | undefined;
  failureReason?: string | undefined;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  time: string;
  location: string;
};

/** Payments can be tracked only, or sent through the connected Stripe account. */
export type PaymentMode = "tracking" | "stripe";

export type Production = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  type: string;
  paymentMode?: PaymentMode;
  crew: CrewMember[];
  contracts: UploadedDoc[];
  events: ScheduleEvent[];
  files: UploadedDoc[];
  payments: Payment[];
  emailConnectionId?: string;
};


export const PRODUCTION_TYPES = [
  "Commercial",
  "Music Video",
  "Short Film",
  "Feature Film",
  "Photoshoot",
  "Live Event",
];

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyInfo = (): ContractInfo => ({
  fullName: null,
  role: null,
  compensationAmount: null,
  compensationType: null,
  rate: null,
  days: null,
  startDate: null,
  endDate: null,
  paymentTerms: null,
  overtimeRate: null,
});

/* ---------------- Seed data ---------------- */

type Store = {
  productions: Production[];
  addProduction: (
    p: Omit<Production, "id" | "crew" | "contracts" | "events" | "files" | "payments">,
  ) => string;
  addCrew: (pid: string, c: Omit<CrewMember, "id">) => void;
  toggleCrewStatus: (pid: string, cid: string) => void;
  removeCrew: (pid: string, cid: string) => void;
  addDocs: (pid: string, key: "contracts" | "files", docs: { name: string; size: number }[]) => void;
  removeDoc: (pid: string, key: "contracts" | "files", id: string) => void;
  addEvent: (pid: string, e: Omit<ScheduleEvent, "id">) => void;
  removeEvent: (pid: string, id: string) => void;
  requestDocuments: (pid: string, cid: string, labels: string[]) => string;
  findByToken: (token: string) => { production: Production; member: CrewMember } | null;
  submitUploads: (
    token: string,
    uploads: { requestId: string; fileName: string; size: number }[],
  ) => boolean;
  /* Contract intelligence + payments */
  assignContract: (pid: string, contractId: string, memberId: string | null) => void;
  extractContract: (pid: string, contractId: string) => void;
  confirmContract: (pid: string, contractId: string, info: ContractInfo) => void;
  updatePayment: (pid: string, paymentId: string, patch: Partial<Pick<Payment, "amount" | "status">>) => void;
  markPaidManually: (pid: string, paymentId: string) => void;
  /* Stripe Connect */
  stripe: StripeConnection | null;
  stripeConnecting: boolean;
  connectStripe: (businessName: string) => Promise<void>;
  disconnectStripe: () => void;
  /* Email Connect */
  emailConnections: EmailConnection[];
  connectEmail: (connection: EmailConnection) => void;
  disconnectEmail: (connectionId: string) => void;
  setProductionEmailConnection: (pid: string, connectionId: string | null) => void;
  setPaymentMode: (pid: string, mode: PaymentMode) => void;
  payWithStripe: (
    pid: string,
    paymentId: string,
  ) => Promise<{ ok: boolean; error?: string | undefined }>;
};

const StoreContext = createContext<Store | null>(null);
const KEY = "scenehire.productions.v5";
const STRIPE_KEY = "scenehire.stripe.v1";
const EMAIL_KEY = "scenehire.email.v1";

const seed: Production[] = [];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [productions, setProductions] = useState<Production[]>(seed);
  const [stripe, setStripe] = useState<StripeConnection | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);

  // Only the Stripe account identifier + display name are persisted.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STRIPE_KEY);
      if (raw) setStripe(JSON.parse(raw) as StripeConnection);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (stripe) localStorage.setItem(STRIPE_KEY, JSON.stringify(stripe));
      else localStorage.removeItem(STRIPE_KEY);
    } catch {
      /* ignore */
    }
  }, [stripe]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMAIL_KEY);
      if (raw) setEmailConnections(JSON.parse(raw) as EmailConnection[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (emailConnections.length) localStorage.setItem(EMAIL_KEY, JSON.stringify(emailConnections));
      else localStorage.removeItem(EMAIL_KEY);
    } catch {
      /* ignore */
    }
  }, [emailConnections]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProductions(JSON.parse(raw) as Production[]);
    } catch {
      /* ignore */
    }
    // Keep the producer view in sync when a crew member uploads in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        setProductions(JSON.parse(e.newValue) as Production[]);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(productions));
    } catch {
      /* ignore */
    }
  }, [productions]);

  const patch = useCallback((pid: string, fn: (p: Production) => Production) => {
    setProductions((prev) => prev.map((p) => (p.id === pid ? fn(p) : p)));
  }, []);

  const value = useMemo<Store>(
    () => ({
      productions,
      addProduction: (p) => {
        const id = uid();
        setProductions((prev) => [
          { ...p, id, crew: [], contracts: [], events: [], files: [], payments: [] },
          ...prev,
        ]);
        return id;
      },
      addCrew: (pid, c) => patch(pid, (p) => ({ ...p, crew: [...p.crew, { ...c, id: uid() }] })),
      toggleCrewStatus: (pid, cid) =>
        patch(pid, (p) => ({
          ...p,
          crew: p.crew.map((c) =>
            c.id === cid ? { ...c, status: c.status === "Signed" ? "Invited" : "Signed" } : c,
          ),
        })),
      removeCrew: (pid, cid) => patch(pid, (p) => ({ ...p, crew: p.crew.filter((c) => c.id !== cid) })),
      addDocs: (pid, key, docs) =>
        patch(pid, (p) => ({
          ...p,
          [key]: [
            ...docs.map((d) => ({
              id: uid(),
              name: d.name,
              size: d.size,
              uploadedAt: new Date().toISOString().slice(0, 10),
            })),
            ...p[key],
          ],
        })),
      removeDoc: (pid, key, id) =>
        patch(pid, (p) => ({
          ...p,
          [key]: p[key].filter((d) => d.id !== id),
          ...(key === "contracts"
            ? { payments: p.payments.filter((pay) => pay.contractId !== id) }
            : {}),
        })),
      addEvent: (pid, e) => patch(pid, (p) => ({ ...p, events: [...p.events, { ...e, id: uid() }] })),
      removeEvent: (pid, id) => patch(pid, (p) => ({ ...p, events: p.events.filter((e) => e.id !== id) })),
      requestDocuments: (pid, cid, labels) => {
        const existing = productions.find((p) => p.id === pid)?.crew.find((c) => c.id === cid);
        const token = existing?.uploadToken ?? `${uid()}${uid()}`;
        patch(pid, (p) => ({
          ...p,
          crew: p.crew.map((c) => {
            if (c.id !== cid) return c;
            const prev = c.docRequests ?? [];
            const next: DocRequest[] = labels.map((label) => {
              const match = prev.find((r) => r.label === label);
              return match ?? { id: uid(), label, status: "Pending" };
            });
            return { ...c, uploadToken: token, docRequests: next };
          }),
        }));
        return token;
      },
      findByToken: (token) => {
        for (const production of productions) {
          const member = production.crew.find((c) => c.uploadToken === token);
          if (member) return { production, member };
        }
        return null;
      },
      submitUploads: (token, uploads) => {
        let found = false;
        const today = new Date().toISOString().slice(0, 10);
        setProductions((prev) =>
          prev.map((p) => ({
            ...p,
            crew: p.crew.map((c) => {
              if (c.uploadToken !== token) return c;
              found = true;
              return {
                ...c,
                docRequests: (c.docRequests ?? []).map((r) => {
                  const up = uploads.find((u) => u.requestId === r.id);
                  return up
                    ? {
                        ...r,
                        status: "Uploaded" as const,
                        fileName: up.fileName,
                        size: up.size,
                        uploadedAt: today,
                      }
                    : r;
                }),
              };
            }),
          })),
        );
        return found;
      },

      assignContract: (pid, contractId, memberId) =>
        patch(pid, (p) => ({
          ...p,
          contracts: p.contracts.map((d) => {
            if (d.id !== contractId) return d;
            const { memberId: _drop, ...rest } = d;
            return memberId ? { ...rest, memberId } : rest;
          }),
        })),

      extractContract: (pid, contractId) =>
        patch(pid, (p) => ({
          ...p,
          contracts: p.contracts.map((d) => {
            if (d.id !== contractId) return d;
            const member = p.crew.find((c) => c.id === d.memberId);
            const parsed = extractContractInfo(d.sourceText ?? d.name);
            return {
              ...d,
              extracted: {
                ...parsed,
                fullName: parsed.fullName ?? member?.name ?? null,
                role: parsed.role ?? member?.role ?? null,
              },
            };
          }),
        })),

      confirmContract: (pid, contractId, info) =>
        patch(pid, (p) => {
          const contract = p.contracts.find((d) => d.id === contractId);
          if (!contract?.memberId) return p;
          const memberId = contract.memberId;
          const existing = p.payments.find((pay) => pay.contractId === contractId);
          const payments = existing
            ? p.payments.map((pay) =>
                pay.contractId === contractId
                  ? { ...pay, amount: info.compensationAmount, memberId }
                  : pay,
              )
            : [
                ...p.payments,
                {
                  id: uid(),
                  contractId,
                  memberId,
                  amount: info.compensationAmount,
                  status: "Pending" as PaymentStatus,
                  createdAt: new Date().toISOString().slice(0, 10),
                },
              ];
          return {
            ...p,
            contracts: p.contracts.map((d) => (d.id === contractId ? { ...d, confirmed: info } : d)),
            payments,
          };
        }),

      updatePayment: (pid, paymentId, changes) =>
        patch(pid, (p) => ({
          ...p,
          payments: p.payments.map((pay) => (pay.id === paymentId ? { ...pay, ...changes } : pay)),
        })),

      markPaidManually: (pid, paymentId) =>
        patch(pid, (p) => ({
          ...p,
          payments: p.payments.map((pay) =>
            pay.id === paymentId
              ? {
                  ...pay,
                  status: "Paid" as PaymentStatus,
                  paidAt: new Date().toISOString().slice(0, 10),
                  paidVia: "Manual" as const,
                  stripeReference: undefined,
                  failureReason: undefined,
                }
              : pay,
          ),
        })),

      stripe,
      stripeConnecting,
      emailConnections,

      connectStripe: async (businessName) => {
        setStripeConnecting(true);
        try {
          setStripe(await createConnectOnboardingSession(businessName));
        } finally {
          setStripeConnecting(false);
        }
      },

      disconnectStripe: () => setStripe(null),

      connectEmail: (connection) => {
        setEmailConnections((prev) => {
          const existing = prev.findIndex((item) => item.provider === connection.provider);
          if (existing !== -1) {
            const next = [...prev];
            next[existing] = connection;
            return next;
          }
          return [...prev, connection];
        });
      },

      disconnectEmail: (connectionId) => setEmailConnections((prev) => prev.filter((conn) => conn.id !== connectionId)),

      setProductionEmailConnection: (pid, connectionId) =>
        patch(pid, (p) => {
          if (!connectionId) {
            const { emailConnectionId, ...rest } = p;
            return rest;
          }
          return { ...p, emailConnectionId: connectionId };
        }),

      setPaymentMode: (pid, mode) => patch(pid, (p) => ({ ...p, paymentMode: mode })),

      payWithStripe: async (pid, paymentId) => {
        const production = productions.find((p) => p.id === pid);
        const payment = production?.payments.find((pay) => pay.id === paymentId);
        if (!production || !payment) return { ok: false, error: "Payment not found." };
        if (!stripe) return { ok: false, error: "Stripe is not connected." };
        if (payment.amount === null) return { ok: false, error: "Enter a payment amount first." };
        if (payment.status !== "Approved" && payment.status !== "Failed") {
          return { ok: false, error: "Approve the payment before sending it." };
        }

        const member = production.crew.find((c) => c.id === payment.memberId);
        const setStatus = (changes: Partial<Payment>) =>
          patch(pid, (p) => ({
            ...p,
            payments: p.payments.map((pay) => (pay.id === paymentId ? { ...pay, ...changes } : pay)),
          }));

        setStatus({ status: "Processing", failureReason: undefined });

        const result = await createTransfer({
          accountId: stripe.accountId,
          amount: payment.amount,
          description: `${production.name} — ${member?.name ?? "Team member"}`,
        });

        if (result.status === "failed") {
          setStatus({ status: "Failed", failureReason: result.error ?? "Stripe declined the transfer." });
          return { ok: false, error: result.error };
        }

        setStatus({
          status: "Paid",
          paidAt: new Date().toISOString().slice(0, 10),
          paidVia: "Stripe",
          stripeReference: result.id,
          failureReason: undefined,
        });
        return { ok: true };
      },
    }),
    [productions, patch, stripe, stripeConnecting, emailConnections],
  );


  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function paymentTotals(p: Production) {
  const sum = (f: (pay: Payment) => boolean) =>
    p.payments.filter(f).reduce((acc, pay) => acc + (pay.amount ?? 0), 0);
  return {
    total: sum(() => true),
    pending: sum((pay) => pay.status === "Pending"),
    approved: sum((pay) => pay.status === "Approved"),
    processing: sum((pay) => pay.status === "Processing"),
    paid: sum((pay) => pay.status === "Paid"),
    failed: sum((pay) => pay.status === "Failed"),
    missingAmount: p.payments.filter((pay) => pay.amount === null).length,
  };

}
