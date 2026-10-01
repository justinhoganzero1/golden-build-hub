import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import FounderBadge from "@/components/FounderBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";

interface Listing { id: string; seller_id: string; founder_number: number; price_cents: number; status: string }

const aud = (c: number) => `A$${(c / 100).toFixed(2)}`;

const FounderSeatsPage = () => {
  const { user } = useAuth();
  const { membership, refresh } = useMembership();
  const [params] = useSearchParams();
  const [left, setLeft] = useState<number | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const mySeat = membership?.founder_number ?? null;
  const myListing = listings.find((l) => l.seller_id === user?.id && l.status === "active");

  const load = async () => {
    const [{ data: n }, { data: l }] = await Promise.all([
      supabase.rpc("public_founder_seats_left" as never),
      supabase.from("founder_seat_listings" as never).select("id,seller_id,founder_number,price_cents,status").eq("status", "active").order("price_cents"),
    ]);
    setLeft(typeof n === "number" ? n : null);
    setListings((l as unknown as Listing[]) ?? []);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const b = params.get("bought");
    if (b) { toast.success(`Payment received — Seat #${b} moves to you as soon as the payment confirms.`); setTimeout(() => { refresh(); void load(); }, 4000); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyNew = async () => {
    setBusy("new");
    const { data, error } = await supabase.functions.invoke("membership", { body: { action: "checkout", plan: "founder" } });
    setBusy(null);
    if (error || !data?.url) return toast.error(data?.error === "founder_seats_gone" ? "All 500 founder seats are taken." : "Couldn't open checkout.");
    window.location.href = data.url;
  };

  const buyResale = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("seat-checkout", { body: { listing_id: id } });
    setBusy(null);
    if (error || !data?.url) return toast.error(data?.error || "Couldn't open checkout.");
    window.location.href = data.url;
  };

  const listSeat = async () => {
    const cents = Math.round(Number(price) * 100);
    if (!user || !mySeat) return;
    if (!cents || cents < 100) return toast.error("Minimum price is A$1.00");
    setBusy("list");
    const { error } = await supabase.from("founder_seat_listings" as never).insert({ seller_id: user.id, founder_number: mySeat, price_cents: cents } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Your seat is listed in the Creators Shop.");
    setPrice(""); void load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("founder_seat_listings" as never).update({ status: "cancelled" } as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Listing removed."); void load();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Founder Seats — Creators Shop | Oracle Lunar" description="Buy or resell one of 500 lifetime Oracle Lunar founder seats." path="/founder-seats" />
      <UniversalBackButton />
      <div className="px-4 pt-14 max-w-3xl mx-auto space-y-5">
        <div className="text-center space-y-2">
          <Crown className="w-10 h-10 mx-auto" style={{ color: "hsl(var(--gold))" }} />
          <h1 className="text-2xl font-bold text-primary">Founder Seats</h1>
          <p className="text-sm text-muted-foreground">500 lifetime seats. Part of the Creators Shop.</p>
          {mySeat && <FounderBadge number={mySeat} />}
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">New seats left</p>
            <p className="text-3xl font-bold text-primary">{left ?? "…"} <span className="text-base text-muted-foreground">of 500</span></p>
            <p className="text-xs text-muted-foreground">Price: A$1.00 one-off, lifetime membership</p>
          </div>
          {!mySeat && (left ?? 0) > 0 && (
            <Button onClick={buyNew} disabled={busy === "new"}>{busy === "new" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Buy a new seat — A$1</Button>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="font-bold text-foreground">Seats for resale ({listings.length})</p>
          {listings.length === 0 && <p className="text-xs text-muted-foreground">No founder is selling a seat right now.</p>}
          {listings.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-t border-border pt-3">
              <FounderBadge number={l.founder_number} size="sm" />
              <span className="flex-1 font-semibold text-foreground">{aud(l.price_cents)}</span>
              {l.seller_id === user?.id ? (
                <Button size="sm" variant="outline" onClick={() => cancel(l.id)}>Remove</Button>
              ) : !mySeat ? (
                <Button size="sm" onClick={() => buyResale(l.id)} disabled={busy === l.id}>{busy === l.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Buy</Button>
              ) : null}
            </div>
          ))}
        </div>

        {mySeat && !myListing && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="font-bold text-foreground">Sell my seat #{mySeat}</p>
            <p className="text-xs text-muted-foreground">Oracle Lunar keeps a 20% fee; you get 80%. To be paid out, connect your payout account in the <Link to="/creators" className="text-primary underline">Creator Studio</Link>. When it sells, your badge and Vault move to the buyer.</p>
            <div className="flex gap-2 max-w-sm">
              <Input type="number" min={1} step="0.01" placeholder="Price in A$" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Button onClick={listSeat} disabled={busy === "list"}>List it</Button>
            </div>
            {price && Number(price) >= 1 && (
              <p className="text-[11px] text-muted-foreground">You'd receive {aud(Math.round(Number(price) * 80))} · fee {aud(Math.round(Number(price) * 100) - Math.round(Number(price) * 80))}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FounderSeatsPage;
