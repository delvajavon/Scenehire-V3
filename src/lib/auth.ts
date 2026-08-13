export type ScenehireUser = {
  name?: string;
  email?: string;
  role?: string;
};

export const AUTH_KEY = "scenehire.authenticated";
export const USER_KEY = "scenehire.current-user.v1";
export const PROFILE_KEY = "scenehire.profile.v1";

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function getOwnerEmail(): string | null {
  const configured = normalizeEmail(import.meta.env.VITE_OWNER_EMAIL);
  return configured || null;
}

export function isOwnerEmail(email?: string | null): boolean {
  const owner = getOwnerEmail();
  if (!owner) return false;
  return normalizeEmail(email) === owner;
}

export function readCurrentUser(): ScenehireUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ScenehireUser) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthorizedDashboardUser(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const isAuthenticated = localStorage.getItem(AUTH_KEY) === "true";
  if (!isAuthenticated) return false;

  const user = readCurrentUser();
  if (!user?.email) return false;

  return isOwnerEmail(user.email);
}
