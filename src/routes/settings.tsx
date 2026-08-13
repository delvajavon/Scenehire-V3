import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Check, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { connectDashboardUrl } from "@/lib/stripe";
import { getEmailAuthUrl, type EmailProvider } from "@/lib/email";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SceneHire" },
      { name: "description", content: "Manage your production company workspace defaults in SceneHire." },
      { property: "og:title", content: "Settings — SceneHire" },
      { property: "og:description", content: "Workspace defaults for your production company." },
    ],
  }),
  component: SettingsPage,
});

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12.5px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function EmailSection() {
  const { emailConnections, disconnectEmail } = useStore();
  const getEmailAuthUrlFn = useServerFn(getEmailAuthUrl);
  const [connectingProvider, setConnectingProvider] = useState<EmailProvider | null>(null);

  const providerLabel = (provider: EmailProvider) =>
    provider === "google" ? "Google Workspace" : "Microsoft 365";

  const connect = async (provider: EmailProvider) => {
    setConnectingProvider(provider);
    try {
      const result = await getEmailAuthUrlFn({ data: { provider } });
      if (result.url) {
        window.location.href = result.url;
      }
    } finally {
      setConnectingProvider(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/40 px-5 py-2.5 text-[12px] uppercase tracking-wide text-muted-foreground">
        Email
      </div>
      <div className="grid gap-4 bg-card px-5 py-5">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Production inbox</p>
          <p className="text-[12.5px] text-muted-foreground">
            Connect your Google Workspace or Microsoft 365 account to send production emails and manage inbox activity from SceneHire.
          </p>
        </div>

        {emailConnections.length > 0 ? (
          <div className="space-y-4">
            {emailConnections.map((connection) => (
              <div key={connection.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium">{connection.providerName}</p>
                    <p className="text-[12.5px] text-muted-foreground">{connection.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                      Connected
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => disconnectEmail(connection.id)}>
                      Disconnect
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Connected {new Date(connection.connectedAt).toLocaleDateString()}. SceneHire keeps a local connection record for this workspace.
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-[12.5px] text-muted-foreground">
              No inbox connected yet. Choose your provider to connect a production email account.
            </p>
            <div className="flex flex-wrap gap-3">
              {(["google", "microsoft"] as const).map((provider) => (
                <Button
                  key={provider}
                  size="sm"
                  disabled={connectingProvider !== null}
                  onClick={() => void connect(provider)}
                >
                  {connectingProvider === provider ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Connecting {providerLabel(provider)}…
                    </>
                  ) : (
                    `${providerLabel(provider)} Connect`
                  )}
                </Button>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground">
              SceneHire only requests email send and read permissions so your production team can use your existing inbox.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function StripeSection() {
  const { stripe, stripeConnecting, connectStripe, disconnectStripe } = useStore();
  const [name, setName] = useState("");

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/40 px-5 py-2.5 text-[12px] uppercase tracking-wide text-muted-foreground">
        Payments
      </div>
      <div className="grid gap-4 bg-card px-5 py-5">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Stripe Payments</p>
          <p className="text-[12.5px] text-muted-foreground">
            Connect your Stripe account to pay production team members directly through SceneHire.
          </p>
        </div>

        {stripe ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/30 bg-accent/50 px-2.5 py-0.5 text-[11px] font-medium">
                <Check className="h-3 w-3" /> Stripe Connected
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                {stripe.mode} mode
              </span>
            </div>
            <div className="grid gap-1 rounded-lg border border-border px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Connected account
              </p>
              <p className="text-[14px] font-medium">{stripe.accountName}</p>
              <p className="text-[12.5px] text-muted-foreground">
                {stripe.accountId} · connected {stripe.connectedAt}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={connectDashboardUrl(stripe.accountId)} target="_blank" rel="noreferrer">
                  Manage Connection <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnectStripe}>
                Disconnect
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              SceneHire stores only your Stripe account and payment identifiers — never bank
              accounts, card numbers or credentials.
            </p>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground">
              Stripe not connected — you can still manually track payments.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="stripe-business">Business name</Label>
              <Input
                id="stripe-business"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Business name on your Stripe account"
              />
            </div>
            <div>
              <Button
                size="sm"
                disabled={stripeConnecting || name.trim() === ""}
                onClick={() => void connectStripe(name.trim())}
              >
                {stripeConnecting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening Stripe…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3.5 w-3.5" /> Connect Stripe
                  </>
                )}
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Onboarding is handled by Stripe. SceneHire never sees your banking details.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <PageHeader title="Settings" description="Workspace defaults for your production company." />

        <div className="mt-8 space-y-6">
          <section className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/40 px-5 py-2.5 text-[12px] uppercase tracking-wide text-muted-foreground">
              Company
            </div>
            <div className="grid gap-4 bg-card px-5 py-5">
              <div className="grid gap-2">
                <Label htmlFor="company">Company name</Label>
                <Input id="company" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Home base</Label>
                <Input id="city" />
              </div>
            </div>
          </section>

          <EmailSection />
          <StripeSection />

          <section className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/40 px-5 py-2.5 text-[12px] uppercase tracking-wide text-muted-foreground">
              Preferences
            </div>
            <Row title="Require signed contracts" description="Block call sheets until every deal memo is signed.">
              <Switch defaultChecked />
            </Row>
            <Row title="Default call time" description="Applied when creating new schedule events.">
              <Input type="time" defaultValue="08:00" className="w-32" />
            </Row>
            <Row title="Show wrap reminders" description="Highlight the final shoot day on the calendar.">
              <Switch defaultChecked />
            </Row>
          </section>

          <div className="flex justify-end">
            <Button size="sm">Save changes</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
