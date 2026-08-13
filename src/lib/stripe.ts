/**
 * Stripe Connect boundary for SceneHire.
 *
 * Everything Stripe-related goes through this module. Today the calls resolve
 * locally so the full producer experience can be reviewed; when a Stripe secret
 * key (test mode) is configured, each function here becomes a server function
 * that calls the Stripe API:
 *
 *   createConnectOnboardingSession -> POST /v1/account_links (Stripe-hosted onboarding)
 *   fetchConnectedAccount          -> GET  /v1/accounts/{id}
 *   createTransfer                 -> POST /v1/transfers (or /v1/payouts)
 *
 * SceneHire never stores bank accounts, card numbers or Stripe credentials —
 * only the Stripe account id, transfer id and payment status.
 */

export type StripeMode = "test" | "live";

export type StripeConnection = {
  status: "connected";
  accountId: string;
  accountName: string;
  mode: StripeMode;
  connectedAt: string;
};

export type StripeTransfer = {
  id: string;
  status: "succeeded" | "failed";
  error?: string;
};

/** True once a Stripe secret key is wired into the project. */
export const STRIPE_LIVE_API_CONFIGURED = false;

const rid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Starts Stripe's official Connect onboarding. With a key configured this
 * returns an account link URL that the producer is redirected to; the local
 * stand-in resolves with the account Stripe would hand back on return.
 */
export async function createConnectOnboardingSession(businessName: string): Promise<StripeConnection> {
  await wait(900);
  return {
    status: "connected",
    accountId: rid("acct"),
    accountName: businessName,
    mode: "test",
    connectedAt: new Date().toISOString().slice(0, 10),
  };
}

/** Stripe Express dashboard link for the connected account. */
export function connectDashboardUrl(accountId: string) {
  return `https://dashboard.stripe.com/${accountId}`;
}

/** Sends money to a team member from the connected account. */
export async function createTransfer(input: {
  accountId: string;
  amount: number;
  description: string;
}): Promise<StripeTransfer> {
  await wait(1400);
  if (!input.accountId) {
    return { id: "", status: "failed", error: "No connected Stripe account." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { id: "", status: "failed", error: "Amount must be greater than zero." };
  }
  return { id: rid("tr"), status: "succeeded" };
}
