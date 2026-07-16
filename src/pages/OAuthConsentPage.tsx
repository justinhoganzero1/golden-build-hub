import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Consent screen for external MCP clients (ChatGPT, Claude, Cursor, etc.)
// requesting OAuth access to this Oracle Lunar user account.
// Routed at /.lovable/oauth/consent — do not rename or move.

type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string };
  redirect_uri?: string;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthApi;
}

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the full consent URL so sign-in returns the user here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/sign-in?redirect=" + encodeURIComponent(next);
        return;
      }
      const api = oauthApi();
      if (!api?.getAuthorizationDetails) {
        setError("OAuth server is not available on this project.");
        return;
      }
      const { data, error } = await api.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const api = oauthApi();
      const { data, error } = approve
        ? await api.approveAuthorization(authorizationId)
        : await api.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("No redirect returned by the authorization server.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const clientName = details?.client?.name ?? "an application";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md rounded-2xl p-7 border border-primary/30"
        style={{
          background: "linear-gradient(160deg, hsl(0 0% 6% / 0.95), hsl(265 35% 9% / 0.92) 50%, hsl(0 0% 4% / 0.95))",
          boxShadow: "0 0 26px hsl(45 100% 55% / 0.25)",
        }}
      >
        <h1 className="text-2xl font-bold text-primary mb-2">
          Connect {clientName} to Oracle Lunar
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {clientName} will be able to use this app's enabled tools while you are signed in. This does not bypass Oracle Lunar's permissions or backend policies.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!details && !error && (
          <p className="text-sm text-muted-foreground">Loading authorization request…</p>
        )}

        {details && (
          <div className="space-y-4">
            {details.redirect_uri && (
              <div className="text-xs text-muted-foreground">
                <div className="font-semibold text-foreground mb-1">Redirects to</div>
                <div className="break-all">{details.redirect_uri}</div>
              </div>
            )}

            <div className="text-sm">
              <div className="font-semibold text-foreground mb-2">This will share</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Your basic profile (user id, email)</li>
                <li>Access to your enabled Oracle Lunar tools</li>
                {scopes
                  .filter((s) => !["openid", "email", "profile"].includes(s))
                  .map((s) => (
                    <li key={s}>Additional permission requested: {s}</li>
                  ))}
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 rounded-md bg-primary text-primary-foreground font-semibold py-2.5 disabled:opacity-60"
              >
                {busy ? "Working…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 rounded-md border border-border py-2.5 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
