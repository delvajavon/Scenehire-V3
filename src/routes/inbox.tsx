import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — SceneHire" },
      { name: "description", content: "View your production inbox and recent email threads." },
      { property: "og:title", content: "Inbox — SceneHire" },
      { property: "og:description", content: "View your production inbox and recent email threads." },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <PageHeader
          title="Inbox"
          description="Your inbox for production emails and conversation threads."
        />
        <div className="mt-6 rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <p className="text-base font-medium text-foreground">Inbox content is coming soon.</p>
          <p className="mt-3">Connect an email account from Settings to start viewing production email threads and sending messages from SceneHire.</p>
        </div>
      </div>
    </AppShell>
  );
}
