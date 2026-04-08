import { useState } from "react";
import { Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, TrendingUp, DollarSign } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const transactions = [
  { id: 1, type: "in", label: "Received from John", amount: "+$250.00", date: "Today, 2:30 PM" },
  { id: 2, type: "out", label: "Netflix Subscription", amount: "-$15.99", date: "Yesterday" },
  { id: 3, type: "in", label: "Salary Deposit", amount: "+$3,200.00", date: "Mar 28" },
  { id: 4, type: "out", label: "Grocery Store", amount: "-$87.42", date: "Mar 27" },
];

const WalletPage = () => {
  const [showBalance, setShowBalance] = useState(true);
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Wallet className="w-7 h-7 text-primary" /></div>
          <h1 className="text-xl font-bold text-primary">Wallet</h1>
        </div>
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
          <button onClick={() => setShowBalance(!showBalance)} className="text-left">
            <h2 className="text-3xl font-bold text-primary">{showBalance ? "$4,322.09" : "••••••"}</h2>
          </button>
          <div className="flex items-center gap-1 mt-2"><TrendingUp className="w-3 h-3 text-[hsl(var(--status-active))]" /><span className="text-xs text-[hsl(var(--status-active))]">+2.4% this month</span></div>
          <div className="flex gap-3 mt-4">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium"><ArrowUpRight className="w-4 h-4" /> Send</button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium border border-border"><ArrowDownLeft className="w-4 h-4" /> Receive</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[{ icon: <CreditCard className="w-5 h-5" />, label: "Cards" }, { icon: <DollarSign className="w-5 h-5" />, label: "Pay Bills" }, { icon: <TrendingUp className="w-5 h-5" />, label: "Invest" }].map(a => (
            <button key={a.label} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-primary transition-colors"><span className="text-primary">{a.icon}</span><span className="text-xs text-muted-foreground">{a.label}</span></button>
          ))}
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
      </div>
    </div>
  );
};

export default WalletPage;
