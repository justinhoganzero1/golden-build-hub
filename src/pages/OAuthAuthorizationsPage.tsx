import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Trash2, RefreshCw, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import SEO from "@/components/SEO";

// Lets the signed-in user view every external app / MCP client that has been
// granted OAuth access to their Oracle Lunar account, revoke individual grants,
// and force re-consent for a client so the next connection has to go through
// the /.lovable/oauth/consent screen again.

interface Authorization {
  id: string;
  client_id?: string;
  client_name?: string;
  client_uri?: string;
  scope?: string;
  created_at?: string;
  last_used_at?: string;
  redirect_uri?: string;
}

// The Supabase auth.oauth namespace is beta and not fully in the SDK's public
// TypeScript surface yet — declare only the methods we actually call.
type OAuthClientApi = {
  listAuthorizations: () => Promise<{
    data: { authorizations?: Authorization[] } | Authorization[] | null;
    error: { message: string } | null;
  }>;
  revokeAuthorization: (id: string) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function oauthApi(): OAuthClientApi | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (supabase.auth as any)?.oauth as OAuthClientApi | undefined;
  return api && typeof api.listAuthorizations === "function" ? api : null;
}

function normalize(res: { authorizations?: Authorization[] } | Authorization[] | null): Authorization[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  return res.authorizations ?? [];
}

export default function OAuthAuthorizationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    const api = oauthApi();
    if (!api) {
      setSupported(false);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await api.listAuthorizations();
      if (error) {
        setError(error.message);
        setItems([]);
      } else {
        setItems(normalize(data));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) void load();
  }, [user]);

  async function revoke(a: Authorization, opts?: { forceReconsent?: boolean }) {
    const api = oauthApi();
    if (!api) return;
    setRevokingId(a.id);
    try {
      const { error } = await api.revokeAuthorization(a.id);
      if (error) {
        toast.error(`Could not revoke: ${error.message}`);
        return;
      }
      void trackEvent("oauth_authorization_revoked", {
        source: opts?.forceReconsent ? "force_reconsent" : "revoke",
        detail: a.client_name ?? a.client_id ?? a.id,
      });
      toast.success(
        opts?.forceReconsent
          ? `${a.client_name ?? "That client"} will need to ask for consent again next time it connects.`
          : `Revoked access for ${a.client_name ?? "that client"}.`,
      );
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <SEO
        title="Connected apps & MCP clients — Oracle Lunar"
        description="View and revoke OAuth access that external apps and MCP clients have to your Oracle Lunar account."
      />

      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/settings" aria-label="Back to settings" className="p-2 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Connected apps
            </h1>
            <p className="text-sm text-muted-foreground">
              External apps and AI clients (ChatGPT, Claude, Cursor, custom MCP tools) that can act as you inside Oracle Lunar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {!supported && (
          <Card className="p-4 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">OAuth authorization management isn't available in this build.</p>
                <p className="text-muted-foreground mt-1">
                  The Supabase client on this project doesn't expose <code>auth.oauth.listAuthorizations</code> yet. Nothing has been granted from this app — connected clients will still appear here after the SDK updates.
                </p>
              </div>
            </div>
          </Card>
        )}

        {error && supported && (
          <Card className="p-4 border-destructive/40 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Could not load authorizations</p>
                <p className="text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {supported && loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading connected apps…
          </div>
        )}

        {supported && !loading && items.length === 0 && !error && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No external apps or MCP clients are currently connected to your account.
          </Card>
        )}

        {supported && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{a.client_name ?? a.client_id ?? "Unknown client"}</div>
                      {a.client_uri && (
                        <a
                          href={a.client_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline break-all"
                        >
                          {a.client_uri}
                        </a>
                      )}
                      {a.redirect_uri && (
                        <div className="text-[11px] text-muted-foreground mt-1 break-all">
                          <span className="font-medium text-foreground/70">Redirect:</span> {a.redirect_uri}
                        </div>
                      )}
                      {a.scope && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          <span className="font-medium text-foreground/70">Scope:</span> {a.scope}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {a.created_at && <>Granted {new Date(a.created_at).toLocaleDateString()} · </>}
                        {a.last_used_at ? `Last used ${new Date(a.last_used_at).toLocaleDateString()}` : "Not used yet"}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revokingId === a.id}
                        onClick={() => revoke(a, { forceReconsent: true })}
                        title="Revoke access so the client must ask for consent the next time it connects."
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> Force re-consent
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokingId === a.id}
                        onClick={() => revoke(a)}
                      >
                        {revokingId === a.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Revoke
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Card className="p-4 bg-muted/30 text-xs text-muted-foreground">
          <p>
            "Revoke" and "Force re-consent" both invalidate the client's current OAuth session — the difference is copy: use "Force re-consent" when the client should be able to reconnect but you want the consent screen to appear again.
          </p>
        </Card>
      </div>
    </main>
  );
}
