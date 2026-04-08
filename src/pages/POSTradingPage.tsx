import { ShoppingCart, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const assets = [{ name: "BTC/USD", price: "$67,432", change: "+2.4%", up: true },{ name: "ETH/USD", price: "$3,521", change: "+1.8%", up: true },{ name: "SOL/USD", price: "$148.20", change: "-0.5%", up: false },{ name: "AAPL", price: "$189.45", change: "+0.3%", up: true }];
const POSTradingPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><ShoppingCart className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">POS Trading</h1><p className="text-muted-foreground text-xs">Trading tools & analytics</p></div></div>
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 mb-6"><p className="text-xs text-muted-foreground">Portfolio Value</p><p className="text-3xl font-bold text-primary">$12,847.23</p><div className="flex items-center gap-1 mt-1"><TrendingUp className="w-3 h-3 text-[hsl(var(--status-active))]" /><span className="text-xs text-[hsl(var(--status-active))]">+3.2% today</span></div></div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Watchlist</h2>
      <div className="space-y-2">{assets.map(a => (<div key={a.name} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4"><div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-4 h-4 text-primary" /></div><div className="flex-1"><p className="text-sm font-semibold text-foreground">{a.name}</p><p className="text-xs text-muted-foreground">{a.price}</p></div><span className={`text-sm font-semibold flex items-center gap-1 ${a.up ? "text-[hsl(var(--status-active))]" : "text-destructive"}`}>{a.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{a.change}</span></div>))}</div>
    </div>
  </div>
);
export default POSTradingPage;
