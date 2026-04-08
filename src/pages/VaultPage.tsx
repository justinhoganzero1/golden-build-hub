import { useState } from "react";
import { CreditCard, Lock, Plus, Eye, EyeOff, Copy, Trash2, Shield, Key, Globe } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

interface VaultItem {
  id: string;
  type: "password" | "card";
  title: string;
  username?: string;
  password?: string;
  url?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  cardHolder?: string;
}

const demoItems: VaultItem[] = [
  { id: "1", type: "password", title: "Gmail", username: "user@gmail.com", password: "••••••••••", url: "gmail.com" },
  { id: "2", type: "password", title: "Netflix", username: "user@email.com", password: "••••••••••", url: "netflix.com" },
  { id: "3", type: "card", title: "Visa Platinum", cardNumber: "•••• •••• •••• 4521", expiry: "12/27", cvv: "•••", cardHolder: "JOHN DOE" },
];

const VaultPage = () => {
  const [items, setItems] = useState<VaultItem[]>(demoItems);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"password" | "card">("password");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "password" | "card">("all");

  const [form, setForm] = useState({ title: "", username: "", password: "", url: "", cardNumber: "", expiry: "", cvv: "", cardHolder: "" });

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (!form.title) { toast.error("Title is required"); return; }
    const newItem: VaultItem = {
      id: Date.now().toString(),
      type: addType,
      title: form.title,
      ...(addType === "password" ? { username: form.username, password: form.password, url: form.url } : { cardNumber: form.cardNumber, expiry: form.expiry, cvv: form.cvv, cardHolder: form.cardHolder }),
    };
    setItems(prev => [newItem, ...prev]);
    setForm({ title: "", username: "", password: "", url: "", cardNumber: "", expiry: "", cvv: "", cardHolder: "" });
    setShowAdd(false);
    toast.success("Item added to vault");
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Item removed");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      {/* Header */}
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Secure Vault</h1>
            <p className="text-muted-foreground text-xs">AES-256 encrypted storage</p>
          </div>
        </div>
        {/* Security status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border mt-3">
          <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-active))] animate-pulse" />
          <span className="text-xs text-muted-foreground">Vault locked • Biometric ready</span>
          <Lock className="w-3 h-3 text-primary ml-auto" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 mb-4">
        {(["all", "password", "card"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
            {f === "all" ? "All" : f === "password" ? "Passwords" : "Cards"}
          </button>
        ))}
        <button onClick={() => setShowAdd(true)} className="ml-auto p-2 rounded-full bg-primary text-primary-foreground">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      <div className="px-4 space-y-3">
        {filtered.map(item => (
          <div key={item.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  {item.type === "password" ? <Key className="w-4 h-4 text-primary" /> : <CreditCard className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  {item.url && <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" />{item.url}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleReveal(item.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                  {revealedIds.has(item.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {item.type === "password" ? (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">Username</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground">{item.username}</span>
                    <button onClick={() => handleCopy(item.username || "")}><Copy className="w-3 h-3 text-primary" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground font-mono">{revealedIds.has(item.id) ? "MyP@ss123!" : item.password}</span>
                    <button onClick={() => handleCopy("MyP@ss123!")}><Copy className="w-3 h-3 text-primary" /></button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-4 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">{item.cardHolder}</p>
                  <p className="text-sm font-mono text-foreground tracking-widest">{revealedIds.has(item.id) ? "4521 8932 1104 4521" : item.cardNumber}</p>
                  <div className="flex justify-between mt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">EXPIRY</p>
                      <p className="text-xs text-foreground">{item.expiry}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">CVV</p>
                      <p className="text-xs text-foreground">{revealedIds.has(item.id) ? "321" : item.cvv}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary mb-4">Add to Vault</h3>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setAddType("password")} className={`flex-1 py-2 rounded-lg text-xs font-medium ${addType === "password" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Password</button>
              <button onClick={() => setAddType("card")} className={`flex-1 py-2 rounded-lg text-xs font-medium ${addType === "card" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Card</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
              {addType === "password" ? (
                <>
                  <input placeholder="Username / Email" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                  <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                  <input placeholder="Website URL" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                </>
              ) : (
                <>
                  <input placeholder="Card Number" value={form.cardNumber} onChange={e => setForm(p => ({ ...p, cardNumber: e.target.value }))} className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                  <div className="flex gap-2">
                    <input placeholder="MM/YY" value={form.expiry} onChange={e => setForm(p => ({ ...p, expiry: e.target.value }))} className="flex-1 px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                    <input placeholder="CVV" value={form.cvv} onChange={e => setForm(p => ({ ...p, cvv: e.target.value }))} className="w-24 px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                  </div>
                  <input placeholder="Cardholder Name" value={form.cardHolder} onChange={e => setForm(p => ({ ...p, cardHolder: e.target.value }))} className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none" />
                </>
              )}
            </div>
            <button onClick={handleAdd} className="w-full mt-4 py-3 bg-primary text-primary-foreground font-bold rounded-lg">Save to Vault</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaultPage;
