import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type EmailProvider = "google" | "microsoft";

export type EmailConnectionStatus = "connected" | "expired" | "disconnected";

export type EmailConnection = {
  id: string;
  provider: EmailProvider;
  providerName: string;
  name?: string;
  email: string;
  status: EmailConnectionStatus;
  connectedAt: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
};

export type EmailAuthUrlInput = {
  provider: EmailProvider;
  mode?: string;
};

export type EmailOAuthCallbackInput = {
  provider: EmailProvider;
  code: string;
  state?: string;
};

const googleScopes = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.modify",
  "openid",
  "email",
  "profile",
];

const microsoftScopes = [
  "openid",
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Mail.ReadWrite",
  "Mail.ReadWrite.Shared",
];

const getEnv = (key: string): string => {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const buildGoogleAuthUrl = (provider: EmailProvider, mode = "connect") => {
  const clientId = getEnv("VITE_GOOGLE_CLIENT_ID");
  const redirectUri = getEnv("VITE_GOOGLE_OAUTH_REDIRECT_URI");
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent(
    googleScopes.join(" "),
  )}&state=${encodeURIComponent(`${provider}:${mode}`)}`;
};

const buildMicrosoftAuthUrl = (provider: EmailProvider) => {
  const clientId = getEnv("VITE_MICROSOFT_CLIENT_ID");
  const redirectUri = getEnv("VITE_MICROSOFT_OAUTH_REDIRECT_URI");
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&response_mode=query&scope=${encodeURIComponent(
    microsoftScopes.join(" "),
  )}&state=${encodeURIComponent(provider)}`;
};

const exchangeGoogleCode = async (code: string) => {
  const clientId = getEnv("VITE_GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getEnv("VITE_GOOGLE_OAUTH_REDIRECT_URI");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google OAuth exchange failed (${tokenResponse.status})`);
  }

  const tokenJson = await tokenResponse.json();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!profileResponse.ok) {
    throw new Error(`Failed to fetch Google profile (${emailResponse.status})`);
  }

  const profile = await profileResponse.json();

  return {
    name: (profile.name as string | undefined) ?? (profile.given_name as string | undefined),
    email: profile.email as string,
    accessToken: tokenJson.access_token as string,
    refreshToken: tokenJson.refresh_token as string,
    expiresIn: Number(tokenJson.expires_in) || 3600,
    scopes: (tokenJson.scope as string)?.split(" ") ?? googleScopes,
  };
};

const exchangeMicrosoftCode = async (code: string) => {
  const clientId = getEnv("VITE_MICROSOFT_CLIENT_ID");
  const clientSecret = getEnv("MICROSOFT_CLIENT_SECRET");
  const redirectUri = getEnv("VITE_MICROSOFT_OAUTH_REDIRECT_URI");

  const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Microsoft OAuth exchange failed (${tokenResponse.status})`);
  }

  const tokenJson = await tokenResponse.json();
  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!profileResponse.ok) {
    throw new Error(`Failed to fetch Microsoft profile (${profileResponse.status})`);
  }

  const profile = await profileResponse.json();
  const email = profile.mail || profile.userPrincipalName;

  return {
    name: profile.displayName as string | undefined,
    email: email as string,
    accessToken: tokenJson.access_token as string,
    refreshToken: tokenJson.refresh_token as string,
    expiresIn: Number(tokenJson.expires_in) || 3600,
    scopes: (tokenJson.scope as string)?.split(" ") ?? microsoftScopes,
  };
};

const providerName = (provider: EmailProvider) =>
  provider === "google" ? "Google Workspace" : "Microsoft 365";

export const getEmailAuthUrl = createServerFn({ method: "POST" })
  .validator(
    z.object({
      provider: z.enum(["google", "microsoft"]),
      mode: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.provider === "google") {
      return { url: buildGoogleAuthUrl(data.provider, data.mode) };
    }
    return { url: buildMicrosoftAuthUrl(data.provider) };
  });

export const completeEmailOAuthConnection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      provider: z.enum(["google", "microsoft"]),
      code: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const result =
      data.provider === "google"
        ? await exchangeGoogleCode(data.code)
        : await exchangeMicrosoftCode(data.code);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + result.expiresIn * 1000).toISOString();

    return {
      id: `${data.provider}_${Math.random().toString(36).slice(2, 10)}`,
      provider: data.provider,
      providerName: providerName(data.provider),
      name: result.name,
      email: result.email,
      status: "connected" as const,
      connectedAt: now.toISOString(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt,
      scopes: result.scopes,
    };
  });

const makeGoogleMessage = async (subject: string, from: string, to: string[], cc: string[], body: string) => {
  const messageParts = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    cc.length ? `Cc: ${cc.join(", ")}` : "",
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body,
  ];
  const encodedMessage = btoa(messageParts.join("\r\n")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return encodedMessage;
};

const makeMicrosoftMessage = ({
  subject,
  body,
  to,
  cc,
}: {
  subject: string;
  body: string;
  to: string[];
  cc: string[];
}) => ({
  message: {
    subject,
    body: { contentType: "Text", content: body },
    toRecipients: to.map((address) => ({ emailAddress: { address } })),
    ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
  },
});

export const sendEmailMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      provider: z.enum(["google", "microsoft"]),
      email: z.string().email(),
      accessToken: z.string(),
      subject: z.string(),
      body: z.string(),
      to: z.array(z.string().email()),
      cc: z.array(z.string().email()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const cc = data.cc ?? [];
    if (data.provider === "google") {
      const raw = await makeGoogleMessage(data.subject, data.email, data.to, cc, data.body);
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(`Google send failed: ${json.error?.message ?? response.statusText}`);
      }
      return { providerMessageId: json.id as string, threadId: json.threadId as string | null };
    }

    const microsoftPayload = makeMicrosoftMessage({ subject: data.subject, body: data.body, to: data.to, cc });
    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(microsoftPayload),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft send failed: ${error}`);
    }
    return { providerMessageId: `${Math.random().toString(36).slice(2, 10)}`, threadId: null };
  });

export const fetchEmailThreads = createServerFn({ method: "POST" })
  .validator(
    z.object({
      provider: z.enum(["google", "microsoft"]),
      accessToken: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.provider === "google") {
      const listResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=20",
        { headers: { Authorization: `Bearer ${data.accessToken}` } },
      );
      if (!listResponse.ok) {
        throw new Error(`Google inbox fetch failed: ${listResponse.statusText}`);
      }
      const listJson = await listResponse.json();
      const messages = Array.isArray(listJson.messages) ? listJson.messages.slice(0, 20) : [];
      const threads = await Promise.all(
        messages.map(async (message: { id: string }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${data.accessToken}` } },
          );
          const msgJson = await msgRes.json();
          const headers = Array.isArray(msgJson.payload?.headers) ? msgJson.payload.headers : [];
          const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value ?? "";
          return {
            id: msgJson.id as string,
            providerThreadId: msgJson.threadId as string,
            subject: getHeader("Subject") || "(No subject)",
            from: getHeader("From"),
            to: getHeader("To"),
            snippet: msgJson.snippet as string,
            timestamp: new Date(getHeader("Date") || Date.now()).toISOString(),
          };
        }),
      );
      return { threads };
    }

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,conversationId,hasAttachments,bodyPreview",
      { headers: { Authorization: `Bearer ${data.accessToken}` } },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft inbox fetch failed: ${text}`);
    }
    const dataJson = await response.json();
    const threads = (dataJson.value ?? []).map((message: any) => ({
      id: message.id as string,
      providerThreadId: message.conversationId as string,
      subject: message.subject || "(No subject)",
      from: message.from?.emailAddress?.address ?? "",
      to: (message.toRecipients ?? []).map((recipient: any) => recipient.emailAddress.address).join(", "),
      snippet: message.bodyPreview as string,
      timestamp: new Date(message.receivedDateTime).toISOString(),
    }));
    return { threads };
  });
