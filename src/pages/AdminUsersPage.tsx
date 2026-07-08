import { useCallback, useEffect, useState } from "react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Users, Coins, Infinity as InfinityIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

type Row = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  balance_cents: number;
  total_spent_cents: number;
  free_for_life: boolean;
  last_charge_at: string | null;
};

const AdminUsersPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [topupCents, setTopupCents] = useState<string>("500");
  const [setCents, setSetCents] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_users", {
        _search: search || null,
        _limit: 200,
        _offset: 0,
      });
      if (error) throw error;
      setRows((data as Row[]) || []);
    } catch (e: any) {
      toast.error(e?.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    await load();
    if (selected) {
      const fresh = rows.find(r => r.user_id === selected.user_id);
      if (fresh) setSelected(fresh);
    }
  };

  const doTopup = async () => {
    if (!selected) return;
    const amt = parseInt(topupCents, 10);
    if (!Number.isFinite(amt) || amt === 0) return toast.error("Enter cents (positive = grant, negative = debit).");
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_topup_user", {
        _user_id: selected.user_id, _amount_cents: amt, _note: "admin_dashboard",
      });
      if (error) throw error;
      toast.success(`Adjusted balance by ${(amt/100).toFixed(2)}`);
      await load();
      setSelected(s => s ? { ...s, balance_cents: s.balance_cents + amt } : s);
    } catch (e: any) { toast.error(e?.message || "Top-up failed."); }
    finally { setSaving(false); }
  };

  const doSet = async () => {
    if (!selected) return;
    const amt = parseInt(setCents, 10);
    if (!Number.isFinite(amt) || amt < 0) return toast.error("Enter a non-negative cents value.");
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_set_wallet_balance", {
        _user_id: selected.user_id, _cents: amt,
      });
      if (error) throw error;
      toast.success(`Balance set to $${(amt/100).toFixed(2)}`);
      await load();
      setSelected(s => s ? { ...s, balance_cents: amt } : s);
    } catch (e: any) { toast.error(e?.message || "Set failed."); }
    finally { setSaving(false); }
  };

  const toggleFreeForLife = async (enabled: boolean) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_set_free_for_life", {
        _user_id: selected.user_id, _enabled: enabled,
      });
      if (error) throw error;
      toast.success(enabled ? "Free for life granted." : "Free for life revoked.");
      setSelected(s => s ? { ...s, free_for_life: enabled } : s);
      await load();
    } catch (e: any) { toast.error(e?.message || "Update failed."); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Users & Wallets — Admin" description="Per-user wallet control for Oracle Lunar." path="/admin/users" />
      <UniversalBackButton />
      <div className="px-4 pt-14 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Users className="w-6 h-6 text-primary" /></div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Users & Wallets</h1>
            <p className="text-xs text-muted-foreground">Every user has their own wallet. Click a row to edit their version of the app.</p>
          </div>
          <Button size="icon" variant="outline" onClick={refresh}><RefreshCw className="w-4 h-4"/></Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by email or name…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            className="pl-9" />
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_60px] gap-2 text-xs text-muted-foreground bg-card/60 px-3 py-2 border-b border-border">
            <div>User</div><div className="text-right">Balance</div><div className="text-right">Spent</div><div className="text-center">FFL</div>
          </div>
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No users found.</div>
          ) : rows.map((r) => (
            <button key={r.user_id} onClick={() => { setSelected(r); setSetCents(String(r.balance_cents)); }}
              className="w-full grid grid-cols-[1fr_100px_100px_60px] gap-2 items-center px-3 py-2 border-b border-border/50 hover:bg-primary/5 text-left">
              <div className="min-w-0">
                <div className="text-sm truncate">{r.display_name || r.email || r.user_id.slice(0,8)}</div>
                <div className="text-[10px] text-muted-foreground truncate">{r.email}</div>
              </div>
              <div className="text-right text-sm tabular-nums">${(r.balance_cents/100).toFixed(2)}</div>
              <div className="text-right text-xs text-muted-foreground tabular-nums">${(r.total_spent_cents/100).toFixed(2)}</div>
              <div className="text-center">{r.free_for_life ? <InfinityIcon className="w-4 h-4 mx-auto text-primary"/> : <span className="text-muted-foreground">·</span>}</div>
            </button>
          ))}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-primary">{selected.display_name || selected.email}</SheetTitle>
                <SheetDescription className="text-xs break-all">{selected.email}<br/>ID: {selected.user_id}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-4">
                  <div className="text-xs text-muted-foreground">Current balance</div>
                  <div className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Coins className="w-5 h-5"/> ${(selected.balance_cents/100).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total spent: ${(selected.total_spent_cents/100).toFixed(2)}</div>
                </div>

                <div className="rounded-xl border border-border p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Free for life</div>
                    <div className="text-xs text-muted-foreground">Bypasses all paid-AI charges.</div>
                  </div>
                  <Switch checked={selected.free_for_life} onCheckedChange={toggleFreeForLife} disabled={saving} />
                </div>

                <div className="rounded-xl border border-border p-3 space-y-2">
                  <div className="text-sm font-medium">Adjust balance (cents)</div>
                  <div className="flex gap-2">
                    <Input value={topupCents} onChange={(e) => setTopupCents(e.target.value)} placeholder="500" />
                    <Button onClick={doTopup} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "Apply"}</Button>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Positive = grant, negative = debit. 100 = $1.</div>
                </div>

                <div className="rounded-xl border border-border p-3 space-y-2">
                  <div className="text-sm font-medium">Set exact balance (cents)</div>
                  <div className="flex gap-2">
                    <Input value={setCents} onChange={(e) => setSetCents(e.target.value)} placeholder="0" />
                    <Button variant="outline" onClick={doSet} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "Set"}</Button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Joined {new Date(selected.created_at).toLocaleDateString()} ·
                  {selected.last_charge_at ? ` last charged ${new Date(selected.last_charge_at).toLocaleString()}` : " never charged"}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminUsersPage;
