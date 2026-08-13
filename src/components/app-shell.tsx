import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, Settings, User, Clapperboard, Mail, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SignedOut, RedirectToSignIn, useAuth, useUser } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";
import { getOwnerEmail, isOwnerEmail } from "@/lib/auth";

type CurrentUser = {
  name?: string;
  email?: string;
  role?: string;
};

const nav = [
  { label: "Home", to: "/scenehire-landing.html", icon: Clapperboard, match: (p: string) => p === "/scenehire-landing.html" },
  { label: "Projects", to: "/projects", icon: FolderOpen, match: (p: string) => p === "/projects" || p.startsWith("/projects/") },
  { label: "Inbox", to: "/inbox", icon: Mail, match: (p: string) => p === "/inbox" },
  { label: "Settings", to: "/settings", icon: Settings, match: (p: string) => p === "/settings" },
  { label: "Profile", to: "/profile", icon: User, match: (p: string) => p === "/profile" },
];

export function AppShell({ children }: { children: ReactNode }) {
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">Authentication is not configured</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Set VITE_CLERK_PUBLISHABLE_KEY in your .env file to access the private dashboard.
        </p>
        <a href="/scenehire-landing.html" className="mt-6 inline-block text-sm underline">
          Return home
        </a>
      </div>
    );
  }

  return <ClerkProtectedShell>{children}</ClerkProtectedShell>;
}

function ClerkProtectedShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { isLoaded, userId, signOut } = useAuth();
  const { user } = useUser();
  const ownerEmail = getOwnerEmail();
  const currentUser: CurrentUser = { role: "Producer" };
  const derivedName = user?.fullName || user?.firstName || user?.username;
  const derivedEmail = user?.primaryEmailAddress?.emailAddress;
  if (derivedName) currentUser.name = derivedName;
  if (derivedEmail) currentUser.email = derivedEmail;

  if (!isLoaded) {
    return <div className="p-6 text-sm text-muted-foreground">Loading secure dashboard…</div>;
  }

  if (!userId) {
    return (
      <SignedOut>
        <RedirectToSignIn redirectUrl={pathname} />
      </SignedOut>
    );
  }

  if (!isOwnerEmail(currentUser.email)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This dashboard is restricted to the owner.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {ownerEmail ? `Allowed owner: ${ownerEmail}` : "Set VITE_OWNER_EMAIL in .env."}
        </p>
        <button
          onClick={() => signOut({ redirectUrl: "/login?denied=1" })}
          className="mt-6 inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>
    );
  }

  const handleSignOut = () => {
    signOut({ redirectUrl: "/scenehire-landing.html" });
    setOpen(false);
  };

  const links = (
    <nav className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active = item.match(pathname);
        if (item.label === "Home") {
          return (
            <a
              key={item.label}
              href={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </a>
          );
        }
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div>
          <a href="/scenehire-landing.html" className="mb-7 flex items-center gap-2 px-1.5">
            <Clapperboard className="h-[18px] w-[18px]" />
            <span className="text-[15px] font-semibold tracking-tight">SceneHire</span>
          </a>
          {links}
        </div>
        <div className="space-y-3 border-t border-sidebar-border pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {((currentUser?.name || currentUser?.email || "Signed in user").match(/\b\w/g) ?? ["S", "I"]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{currentUser?.name || currentUser?.email || "Signed in user"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{currentUser?.role || "Producer"}</p>
            </div>
          </div>
          <Link
            to="/login"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            Sign out
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button aria-label="Toggle navigation" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold tracking-tight">SceneHire</span>
        </header>
        {open && (
          <div className="border-b border-border bg-sidebar p-3 md:hidden">
            {links}
            <Link
              to="/login"
              onClick={handleSignOut}
              className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-sidebar-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              Sign out
            </Link>
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
