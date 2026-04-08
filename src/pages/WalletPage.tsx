import { useState } from "react";
import { Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, TrendingUp, DollarSign, FileText, Bot, Send, Receipt, Building, QrCode, Calculator, Loader2, X } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

interface Transaction {
  id: string; type: "in" | "out"; label: string; amount: string; date: string; category?: string;
}

const SERVICE_FEE = 0.03;

const WalletPage = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [balance, setBalance] = useState(4322.09);
  const [activeTab, setActiveTab] = useState<"home" | "pay" | "send" | "receive" | "cards" | "accounting">("home");
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: "1", type: "in", label: "Received from John", amount: "+$250.00", date: "Today, 2:30 PM" },
    { id: "2", type: "out", label: "Netflix Subscription", amount: "-$15.99", date: "Yesterday", category: "Entertainment" },
    { id: "3", type: "in", label: "Salary Deposit", amount: "+$3,200.00", date: "Mar 28", category: "Income" },
    { id: "4", type: "out", label: "Grocery Store", amount: "-$87.42", date: "Mar 27", category: "Groceries" },
  ]);

  // Bill Pay state
  const [payMethod, setPayMethod] = useState<"bpay" | "payid">("bpay");
  const [billerCode, setBillerCode] = useState("");
  const [reference, setReference] = useState("");
  const [payIdValue, setPayIdValue] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [paying, setPaying] = useState(false);

  // Send state
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");

  // Accounting AI
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const processBillPayment = () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (payMethod === "bpay" && (!billerCode || !reference)) { toast.error("Enter biller code and reference"); return; }
    if (payMethod === "payid" && !payIdValue) { toast.error("Enter PayID"); return; }

    const fee = amount * SERVICE_FEE;
    const total = amount + fee;
    if (total > balance) { toast.error("Insufficient funds"); return; }

    setPaying(true);
    setTimeout(() => {
      setBalance(prev => prev - total);
      const tx: Transaction = {
        id: Date.now().toString(), type: "out",
        label: payMethod === "bpay" ? `BPay: ${billerCode}` : `PayID: ${payIdValue}`,
        amount: `-$${total.toFixed(2)}`,
        date: "Just now", category: "Bill Payment"
      };
      setTransactions(prev => [tx, ...prev]);
      toast.success(`Paid $${amount.toFixed(2)} + $${fee.toFixed(2)} service fee`);
      setBillerCode(""); setReference(""); setPayIdValue(""); setPayAmount(""); setPayDesc("");
      setPaying(false);
      setActiveTab("home");
    }, 1500);
  };

  const processSend = () => {
    const amount = parseFloat(sendAmount);
    if (!amount || !sendTo) { toast.error("Enter recipient and amount"); return; }
    if (amount > balance) { toast.error("Insufficient funds"); return; }
    setBalance(prev => prev - amount);
    setTransactions(prev => [{ id: Date.now().toString(), type: "out", label: `Sent to ${sendTo}`, amount: `-$${amount.toFixed(2)}`, date: "Just now" }, ...prev]);
    toast.success(`$${amount.toFixed(2)} sent to ${sendTo}`);
    setSendTo(""); setSendAmount(""); setSendNote("");
    setActiveTab("home");
  };

  const askAccountingAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const txSummary = transactions.slice(0, 10).map(t => `${t.label}: ${t.amount} (${t.date})`).join("\n");
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are an AI accountant. The user's balance is $${balance.toFixed(2)}. Recent transactions:\n${txSummary}\nHelp with bill tracking, budgeting, and financial advice. Be concise.` },
            { role: "user", content: aiQuery }
          ]
        }),
      });
      if (!resp.ok) throw new Error();
      const text = await resp.text();
      let content = "";
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try { const j = JSON.parse(line.slice(6)); content += j.choices?.[0]?.delta?.content || ""; } catch {}
        }
      }
      setAiResponse(content || "I couldn't process that. Try asking about your spending or bills.");
    } catch { setAiResponse("AI unavailable right now."); }
    finally { setAiLoading(false); setAiQuery(""); }
  };

  const tabs = [
    { id: "home" as const, icon: <Wallet className="w-4 h-4" />, label: "Home" },
    { id: "pay" as const, icon: <Receipt className="w-4 h-4" />, label: "Pay Bills" },
    { id: "send" as const, icon: <ArrowUpRight className="w-4 h-4" />, label: "Send" },
    { id: "receive" as const, icon: <ArrowDownLeft className="w-4 h-4" />, label: "Receive" },
    { id: "cards" as const, icon: <CreditCard className="w-4 h-4" />, label: "Cards" },
    { id: "accounting" as const, icon: <Calculator className="w-4 h-4" />, label: "AI Accountant" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Wallet className="w-7 h-7 text-primary" /></div>
          <h1 className="text-xl font-bold text-primary">Wallet</h1>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
          <button onClick={() => setShowBalance(!showBalance)} className="text-left">
            <h2 className="text-3xl font-bold text-primary">{showBalance ? `$${balance.toFixed(2)}` : "••••••"}</h2>
          </button>
          <div className="flex items-center gap-1 mt-2"><TrendingUp className="w-3 h-3 text-[hsl(var(--status-active))]" /><span className="text-xs text-[hsl(var(--status-active))]">+2.4% this month</span></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Home Tab */}
        {activeTab === "home" && (
          <>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setActiveTab("send")} className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium"><ArrowUpRight className="w-4 h-4" /> Send</button>
              <button onClick={() => setActiveTab("receive")} className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium border border-border"><ArrowDownLeft className="w-4 h-4" /> Receive</button>
            </div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Recent Transactions</h2>
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
                  <div className={`p-2 rounded-lg ${tx.type === "in" ? "bg-[hsl(var(--status-active))]/10" : "bg-destructive/10"}`}>
                    {tx.type === "in" ? <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--status-active))]" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1"><p className="text-sm text-foreground font-medium">{tx.label}</p><p className="text-xs text-muted-foreground">{tx.date}</p></div>
                  <span className={`text-sm font-semibold ${tx.type === "in" ? "text-[hsl(var(--status-active))]" : "text-foreground"}`}>{tx.amount}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pay Bills Tab */}
        {activeTab === "pay" && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <button onClick={() => setPayMethod("bpay")} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${payMethod === "bpay" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                <Building className="w-4 h-4" /> BPay
              </button>
              <button onClick={() => setPayMethod("payid")} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${payMethod === "payid" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                <QrCode className="w-4 h-4" /> PayID
              </button>
            </div>

            {payMethod === "bpay" ? (
              <>
                <input value={billerCode} onChange={e => setBillerCode(e.target.value)} placeholder="Biller Code" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
                <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference Number" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
              </>
            ) : (
              <input value={payIdValue} onChange={e => setPayIdValue(e.target.value)} placeholder="PayID (email, phone, or ABN)" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            )}

            <input value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" placeholder="Amount ($)" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            <input value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />

            {payAmount && parseFloat(payAmount) > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="text-foreground">${parseFloat(payAmount).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Service Fee (3%)</span><span className="text-foreground">${(parseFloat(payAmount) * SERVICE_FEE).toFixed(2)}</span></div>
                <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-bold"><span className="text-foreground">Total</span><span className="text-primary">${(parseFloat(payAmount) * (1 + SERVICE_FEE)).toFixed(2)}</span></div>
              </div>
            )}

            <button onClick={processBillPayment} disabled={paying} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {paying ? "Processing..." : "Pay Now"}
            </button>
          </div>
        )}

        {/* Send Tab */}
        {activeTab === "send" && (
          <div className="space-y-4">
            <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="Recipient (name, email, or phone)" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            <input value={sendAmount} onChange={e => setSendAmount(e.target.value)} type="number" placeholder="Amount ($)" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            <input value={sendNote} onChange={e => setSendNote(e.target.value)} placeholder="Note (optional)" className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            <button onClick={processSend} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2">
              <ArrowUpRight className="w-4 h-4" /> Send Money
            </button>
          </div>
        )}

        {/* Receive Tab */}
        {activeTab === "receive" && (
          <div className="text-center py-8">
            <QrCode className="w-24 h-24 text-primary mx-auto mb-4" />
            <p className="text-sm text-foreground font-medium mb-1">Your QR Code</p>
            <p className="text-xs text-muted-foreground mb-4">Share this to receive money</p>
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <p className="text-xs text-muted-foreground">Your PayID</p>
              <p className="text-sm text-foreground font-medium">user@solace.app</p>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText("user@solace.app"); toast.success("PayID copied!"); }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium">Copy PayID</button>
          </div>
        )}

        {/* Cards Tab */}
        {activeTab === "cards" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-primary to-primary/60 rounded-2xl p-6 text-primary-foreground">
              <p className="text-xs opacity-80 mb-4">Virtual Card</p>
              <p className="text-lg font-mono tracking-wider mb-4">•••• •••• •••• 4829</p>
              <div className="flex justify-between"><div><p className="text-[10px] opacity-60">VALID THRU</p><p className="text-sm">12/28</p></div><div><p className="text-[10px] opacity-60">CVV</p><p className="text-sm">•••</p></div></div>
            </div>
            <button className="w-full py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground">Add Physical Card</button>
            <button className="w-full py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground">Freeze Card</button>
          </div>
        )}

        {/* Accounting AI Tab */}
        {activeTab === "accounting" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Bot className="w-5 h-5 text-primary" /><h3 className="text-sm font-semibold text-foreground">AI Accountant</h3></div>
              <p className="text-xs text-muted-foreground">Ask about your spending, set up recurring bills, get budgeting advice, or generate reports.</p>
            </div>
            {aiResponse && (
              <div className="bg-card border border-border rounded-xl p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{aiResponse}</pre>
              </div>
            )}
            <div className="flex gap-2">
              <input value={aiQuery} onChange={e => setAiQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAccountingAI()}
                placeholder="Ask your AI accountant..." className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
              <button onClick={askAccountingAI} disabled={aiLoading} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Show my spending summary", "Set up a recurring bill", "How can I save more?", "Generate expense report"].map(q => (
                <button key={q} onClick={() => { setAiQuery(q); }} className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground hover:border-primary transition-colors text-left">{q}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
