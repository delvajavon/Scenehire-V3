import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

type CurrentUser = {
  name?: string;
  email?: string;
  role?: string;
};

const USER_KEY = "scenehire.current-user.v1";
const PROFILE_KEY = "scenehire.profile.v1";

function readCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

function readSavedProfile(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SceneHire" },
      { name: "description", content: "Your producer profile and production history in SceneHire." },
      { property: "og:title", content: "Profile — SceneHire" },
      { property: "og:description", content: "Your producer profile and production history." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { productions } = useStore();
  const people = productions.reduce((n, p) => n + p.crew.length, 0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => readCurrentUser());
  const [name, setName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const user = readSavedProfile() || readCurrentUser();
    setCurrentUser(user);
    setName(user?.name || "");
    setEmail(user?.email || "");
    setBio((user as { bio?: string } | null)?.bio || "");
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          name: name.trim() || email.trim() || "Signed in user",
          email: email.trim() || undefined,
          role: "Producer",
          bio,
        }),
      );
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({
          name: name.trim() || email.trim() || "Signed in user",
          email: email.trim() || undefined,
          role: "Producer",
        }),
      );
      setCurrentUser({
        name: name.trim() || email.trim() || "Signed in user",
        email: email.trim() || undefined,
        role: "Producer",
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <PageHeader title="Profile" description="How you appear to crew and talent." />

        <div className="mt-8 flex min-w-0 items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {((currentUser?.name || currentUser?.email || "Signed in user").match(/\b\w/g) ?? ["S", "I"]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium">{currentUser?.name || currentUser?.email || "Your name"}</p>
            <p className="truncate text-[13px] text-muted-foreground">{currentUser?.role || "Producer"}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
          {[
            ["Productions", productions.length],
            ["People hired", people],
            ["Years producing", "—"],
          ].map(([label, value]) => (
            <div key={String(label)} className="px-4 py-4 text-center">
              <p className="text-xl font-semibold tabular-nums">{value}</p>
              <p className="text-[12px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-2">
            <Label htmlFor="p-name">Full name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-email">Email</Label>
            <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-bio">Bio</Label>
            <Textarea id="p-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Describe your producer profile." />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave}>Save profile</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
