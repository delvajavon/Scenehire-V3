import { createFileRoute, Link } from "@tanstack/react-router";
import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SceneHire" },
      {
        name: "description",
        content: "Sign in with Google to access the SceneHire dashboard operating system.",
      },
      { property: "og:title", content: "Sign in — SceneHire" },
      {
        property: "og:description",
        content: "Sign in with Google to access your production operating system dashboard.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-20 sm:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-10 shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="mb-8 flex flex-col gap-4 text-center">
            <span className="mx-auto inline-flex rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.32em] text-slate-300">
              Sign in to SceneHire
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Sign in and open your private dashboard.
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-7 text-slate-300">
              SceneHire uses Clerk for secure authentication and session management.
            </p>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-400">
              Private dashboard access is restricted to the owner.
            </p>
          </div>

          {hasClerkKey ? (
            <div className="grid gap-4">
              <SignedOut>
                <div className="mx-auto">
                  <SignIn path="/login" routing="path" forceRedirectUrl="/projects" />
                </div>
              </SignedOut>
              <SignedIn>
                <p className="text-center text-sm text-slate-300">
                  You are already signed in. <a href="/projects" className="underline">Open dashboard</a>
                </p>
              </SignedIn>
            </div>
          ) : (
            <p className="text-center text-sm text-red-300">
              Clerk is not configured. Add VITE_CLERK_PUBLISHABLE_KEY to .env.
            </p>
          )}

          <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-slate-400">
            <p>Not ready yet?</p>
            <Link
              to="/scenehire-landing.html"
              className="text-white underline transition hover:text-slate-200"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
