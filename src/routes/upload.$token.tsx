import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, Clock, FileText, Film, Upload as UploadIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, useStore } from "@/lib/store";

export const Route = createFileRoute("/upload/$token")({
  head: () => ({
    meta: [
      { title: "Upload your production documents — SceneHire" },
      {
        name: "description",
        content:
          "Securely upload the documents your production requested. No account or login required.",
      },
      { property: "og:title", content: "Upload your production documents — SceneHire" },
      {
        property: "og:description",
        content: "Securely upload requested production documents — no SceneHire account needed.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const { token } = Route.useParams();
  const { findByToken, submitUploads } = useStore();
  const found = findByToken(token);
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<Record<string, { name: string; size: number }>>({});
  const [target, setTarget] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!found) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
        <h1 className="text-lg font-semibold">This upload link isn't valid</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          The link may have expired or been replaced. Ask your producer for a new one.
        </p>
      </main>
    );
  }

  const { production, member } = found;
  const requests = member.docRequests ?? [];
  const pending = requests.filter((r) => r.status !== "Uploaded");
  const done = requests.filter((r) => r.status === "Uploaded").length;
  const stagedCount = Object.keys(staged).length;

  const pick = (requestId: string) => {
    setTarget(requestId);
    inputRef.current?.click();
  };

  const submit = () => {
    submitUploads(
      token,
      Object.entries(staged).map(([requestId, f]) => ({
        requestId,
        fileName: f.name,
        size: f.size,
      })),
    );
    setStaged({});
    setSubmitted(true);
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Film className="h-4 w-4" /> SceneHire
      </div>

      <h1 className="mt-6 text-[22px] font-semibold tracking-tight">Document request</h1>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">
        {production.name} · {member.name} — {member.role}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: requests.length ? `${(done / requests.length) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-[12px] text-muted-foreground">
          {done} of {requests.length} complete
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && target) {
            setStaged((prev) => ({ ...prev, [target]: { name: file.name, size: file.size } }));
            setSubmitted(false);
          }
          e.target.value = "";
        }}
      />

      <ul className="mt-6 grid gap-2.5">
        {requests.map((r) => {
          const file = staged[r.id];
          const uploaded = r.status === "Uploaded";
          return (
            <li key={r.id} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-3">
                {uploaded ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{r.label}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {uploaded
                      ? `Uploaded ${r.uploadedAt} · ${r.fileName}`
                      : file
                        ? `Ready to submit · ${file.name} (${formatBytes(file.size)})`
                        : "Pending"}
                  </p>
                </div>
                {uploaded ? (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : file ? (
                  <button
                    aria-label={`Remove file for ${r.label}`}
                    onClick={() =>
                      setStaged((prev) => {
                        const next = { ...prev };
                        delete next[r.id];
                        return next;
                      })
                    }
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => pick(r.id)}>
                    <UploadIcon className="h-3.5 w-3.5" /> Choose
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pending.length > 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (!files.length) return;
            setStaged((prev) => {
              const next = { ...prev };
              const slots = pending.filter((r) => !next[r.id]);
              files.forEach((f, i) => {
                const slot = slots[i];
                if (slot) next[slot.id] = { name: f.name, size: f.size };
              });
              return next;
            });
            setSubmitted(false);
          }}
          className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center"
        >
          <UploadIcon className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Drop files here, or use Choose on each document above.
          </p>
        </div>
      )}

      <Button
        className="mt-5 w-full"
        size="lg"
        disabled={stagedCount === 0}
        onClick={submit}
      >
        {stagedCount === 0
          ? "Select documents to submit"
          : `Submit ${stagedCount} document${stagedCount === 1 ? "" : "s"}`}
      </Button>

      {submitted && (
        <p className="mt-3 text-center text-[13px]">
          Thanks — your documents were sent to {production.name}.
        </p>
      )}

      <p className="mt-8 text-center text-[11.5px] text-muted-foreground">
        Secure private link · no SceneHire account required
      </p>
    </main>
  );
}
