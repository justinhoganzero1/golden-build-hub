import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CallSession {
  id: string;
  user_id: string;
  direction: "inbound" | "outbound";
  twilio_call_sid: string | null;
  caller_number: string | null;
  caller_name: string | null;
  intent: string | null;
  status: "ringing" | "connected" | "on_hold" | "awaiting_user" | "replying" | "ended";
  last_caller_message: string | null;
  pending_user_reply: string | null;
  hold_started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

/**
 * Subscribes to the most recent active call session for the logged-in user.
 * Returns whichever session needs the user's attention (status `awaiting_user`),
 * or the latest connected/ringing one. Realtime keeps it in sync.
 */
export function useActiveCallSession(): CallSession | null {
  const { user } = useAuth();
  const [session, setSession] = useState<CallSession | null>(null);

  useEffect(() => {
    if (!user) {
      setSession(null);
      return;
    }
    let mounted = true;

    const refresh = async () => {
      const { data } = await supabase
        .from("call_sessions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["ringing", "connected", "on_hold", "awaiting_user", "replying"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setSession((data as CallSession | null) || null);
    };
    refresh();

    const channel = supabase
      .channel(`call-sessions-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_sessions", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return session;
}

export async function submitCallReply(sessionId: string, reply: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const r = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-call-reply`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId, reply }),
    },
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Failed to relay reply");
  }
}

export async function placeOutboundCall(to: string, intent: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const r = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-call-outbound`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, intent }),
    },
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Failed to place call");
  }
  return r.json() as Promise<{ session_id: string; sid: string }>;
}
