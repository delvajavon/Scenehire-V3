import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { completeEmailOAuthConnection, type EmailProvider } from "@/lib/email";

export const Route = createFileRoute("/email-callback")({
  head: () => ({
    meta: [
      { title: "Connect production email — SceneHire" },
      {
        name: "description",
        content: "Complete OAuth connection for Google Workspace or Microsoft 365.",
      },
    ],
  }),
  component: EmailCallbackPage,
});

function EmailCallbackPage() {
  const { connectEmail } = useStore();
  const completeEmailOAuthConnectionFn = useServerFn(completeEmailOAuthConnection);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Completing your inbox connection…");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const [provider] = state?.split(":") ?? [];
    if (!code || !provider || (provider !== "google" && provider !== "microsoft")) {
      setStatus("error");
      setMessage("Missing or invalid OAuth callback data.");
      return;
    }

    void (async () => {
      try {
        const connection = await completeEmailOAuthConnectionFn({ data: { provider: provider as EmailProvider, code } });
        connectEmail(connection);
        setStatus("success");
        setMessage(`Connected ${connection.providerName} as ${connection.email}. Redirecting to Settings…`);
        window.setTimeout(() => {
          window.location.href = "/settings";
        }, 1400);
      } catch (error) {
        console.error(error);
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to complete the email connection. Please try again.",
        );
      }
    })();
  }, [completeEmailOAuthConnectionFn, connectEmail]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <PageHeader
          title={status === "success" ? "Connection complete" : status === "error" ? "Connection failed" : "Connecting inbox"}
          description={message}
          action={
            status === "error" ? (
              <Button size="sm" onClick={() => window.location.replace("/settings")}>
                Back to settings
              </Button>
            ) : null
          }
        />
      </div>
    </AppShell>
  );
}
