import { createFileRoute } from "@tanstack/react-router";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export const Route = createFileRoute("/login/sso-callback")({
  component: LoginSsoCallbackPage,
});

function LoginSsoCallbackPage() {
  return <AuthenticateWithRedirectCallback signInForceRedirectUrl="/projects" />;
}
