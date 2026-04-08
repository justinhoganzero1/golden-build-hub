import { useState } from "react";
import { BookOpen, Play, Trophy, Clock, ArrowLeft, CheckCircle, ChevronRight } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const MODULES = [
  { title: "POS Basics", lessons: [
    { title: "What is a POS System?", content: "A Point of Sale (POS) system is where your customer makes a payment for products or services. Modern POS systems go beyond simple cash registers — they're complete business management tools that handle sales, inventory, customer data, and reporting.\n\n**Key Components:**\n- Hardware (terminal, scanner, receipt printer)\n- Software (transaction processing, inventory management)\n- Payment processing (credit cards, mobile payments)\n- Data analytics and reporting" },
    { title: "Types of POS Systems", content: "**Cloud-Based POS:** Stores data online, accessible anywhere. Examples: Square, Shopify POS.\n\n**On-Premise POS:** Data stored locally. More control but less flexibility.\n\n**Mobile POS (mPOS):** Uses tablets/phones. Perfect for pop-ups, food trucks.\n\n**Self-Service Kiosks:** Customer-operated. Common in fast food, retail.\n\n**Choosing the right type depends on:** Business size, budget, mobility needs, and integration requirements." },
    { title: "Setting Up Your First POS", content: "**Step 1: Choose Your Hardware**\n- Receipt printer\n- Barcode scanner\n- Card reader\n- Cash drawer\n\n**Step 2: Configure Software**\n- Add products/services\n- Set tax rates\n- Configure payment methods\n\n**Step 3: Staff Training**\n- Basic transaction processing\n- Refunds and voids\n- End-of-day procedures\n\n**Step 4: Go Live**\n- Test with practice transactions\n- Ensure backup systems work" },
    { title: "Processing Transactions", content: "**Basic Sale Flow:**\n1. Scan/enter items\n2. Apply discounts if applicable\n3. Calculate total with tax\n4. Accept payment (cash/card/mobile)\n5. Print receipt\n\n**Payment Types:**\n- Cash: Count, make change, verify bills\n- Credit/Debit: Swipe/tap/insert, verify signature\n- Mobile: NFC tap (Apple Pay, Google Pay)\n- Split payments: Multiple methods for one transaction" },
    { title: "End of Day Procedures", content: "**Daily Closing Steps:**\n1. Print Z-report (end-of-day summary)\n2. Count cash drawer and reconcile\n3. Process batch settlement for cards\n4. Review void/refund log\n5. Back up data\n\n**Key Metrics to Review:**\n- Total sales vs expected\n- Cash over/short\n- Top selling items\n- Average transaction value" },
  ]},
  { title: "Inventory Management", lessons: [
    { title: "Stock Tracking Basics", content: "**Why Track Inventory?**\n- Prevent stockouts and lost sales\n- Reduce excess inventory costs\n- Identify theft or shrinkage\n- Make data-driven purchasing decisions\n\n**Methods:**\n- Perpetual: Real-time updates with each sale\n- Periodic: Manual counts at intervals\n- ABC Analysis: Categorize by value (A=high, C=low)\n\n**Best Practice:** Use barcode scanning for accuracy. Schedule weekly spot checks and monthly full counts." },
    { title: "Purchase Orders", content: "**Creating Effective POs:**\n1. Review current stock levels\n2. Check reorder points\n3. Consider lead times\n4. Factor in seasonal demand\n5. Apply minimum order quantities\n\n**Key Fields:**\n- Vendor details\n- Item descriptions and SKUs\n- Quantities and unit costs\n- Expected delivery date\n- Payment terms (Net 30, COD, etc.)" },
    { title: "Receiving & Returns", content: "**Receiving Process:**\n1. Match delivery to PO\n2. Inspect for damage\n3. Count and verify quantities\n4. Update inventory in POS\n5. File receiving report\n\n**Handling Returns to Vendor:**\n- Document defective items\n- Contact vendor within warranty period\n- Create return authorization\n- Track credit memos" },
    { title: "Low Stock Alerts", content: "**Setting Up Alerts:**\n- Define reorder point for each item\n- Set minimum stock levels\n- Configure automatic PO generation\n- Set up email/SMS notifications\n\n**Reorder Point Formula:**\nReorder Point = (Average Daily Sales × Lead Time) + Safety Stock\n\n**Example:** If you sell 10 units/day with 7-day lead time and want 20 units safety stock:\nReorder Point = (10 × 7) + 20 = 90 units" },
  ]},
  { title: "Customer Analytics", lessons: [
    { title: "Customer Profiles", content: "**Building Customer Profiles:**\n- Purchase history and frequency\n- Average spend per visit\n- Preferred products/categories\n- Contact information\n- Loyalty points balance\n\n**Data Collection Methods:**\n- Loyalty programs\n- Email signup at checkout\n- Purchase tracking via payment method\n- Customer surveys\n\n**Privacy:** Always comply with local data protection laws. Get consent before collecting personal data." },
    { title: "Sales Reports", content: "**Essential Reports:**\n1. **Daily Sales Summary:** Total revenue, transactions, average ticket\n2. **Product Performance:** Best/worst sellers, margin analysis\n3. **Hourly Sales:** Peak times for staffing decisions\n4. **Category Reports:** Revenue by department\n5. **Employee Performance:** Sales per staff member\n\n**KPIs to Track:**\n- Revenue per square foot\n- Inventory turnover rate\n- Customer retention rate\n- Gross margin percentage" },
    { title: "Loyalty Programs", content: "**Types of Loyalty Programs:**\n1. **Points-Based:** Earn points per dollar spent\n2. **Tiered:** Bronze/Silver/Gold levels\n3. **Punch Cards:** Buy X get 1 free\n4. **Cashback:** Percentage back on purchases\n\n**Implementation Tips:**\n- Keep it simple to understand\n- Make rewards achievable\n- Personalize offers using purchase data\n- Track ROI of loyalty program\n- Integrate with POS for automatic tracking" },
  ]},
  { title: "Advanced Reporting", lessons: [
    { title: "Financial Reports", content: "**Key Financial Reports:**\n1. **P&L Statement:** Revenue minus costs\n2. **Cash Flow:** Money in vs money out\n3. **Balance Sheet:** Assets vs liabilities\n4. **Tax Reports:** Sales tax collected\n\n**POS-Generated Data:**\n- Gross sales and net sales\n- Discounts given\n- Refunds processed\n- Payment method breakdown\n- Tax collected by rate" },
    { title: "Forecasting", content: "**Sales Forecasting Methods:**\n1. **Historical Average:** Use past data to predict future\n2. **Trend Analysis:** Identify growth/decline patterns\n3. **Seasonal Adjustment:** Account for seasonal variations\n4. **Moving Average:** Smooth out short-term fluctuations\n\n**Tools:**\n- Export POS data to spreadsheet\n- Use built-in POS analytics\n- Third-party BI tools (Tableau, Power BI)\n\n**Accuracy Tips:** Compare forecasts to actuals monthly and adjust your model." },
    { title: "Multi-Location Management", content: "**Challenges:**\n- Consistent pricing across locations\n- Centralized vs local inventory\n- Standardized reporting\n- Staff management\n\n**Solutions:**\n- Cloud-based POS for real-time sync\n- Central product catalog\n- Role-based access (manager vs cashier)\n- Consolidated reporting dashboard\n- Inter-store transfers\n\n**Best Practices:**\n- Weekly cross-location performance reviews\n- Standardized SOPs\n- Central purchasing for volume discounts" },
  ]},
];

const POSLearnPage = () => {
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const [activeLesson, setActiveLesson] = useState<number | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  const toggleComplete = (key: string) => {
    setCompleted(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const getModuleProgress = (idx: number) => {
    const mod = MODULES[idx];
    const done = mod.lessons.filter((_, li) => completed.includes(`${idx}-${li}`)).length;
    return Math.round((done / mod.lessons.length) * 100);
  };

  if (activeModule !== null && activeLesson !== null) {
    const mod = MODULES[activeModule];
    const lesson = mod.lessons[activeLesson];
    const key = `${activeModule}-${activeLesson}`;
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-4 pb-4">
          <button onClick={() => setActiveLesson(null)} className="flex items-center gap-2 text-sm text-primary mb-4"><ArrowLeft className="w-4 h-4" /> {mod.title}</button>
          <h1 className="text-lg font-bold text-primary mb-4">{lesson.title}</h1>
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            {lesson.content.split("\n\n").map((p, i) => (
              <div key={i} className="mb-3">
                {p.startsWith("**") ? (
                  <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>').replace(/\n/g, '<br/>') }} />
                ) : (
                  <p className="text-sm text-foreground/80" dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>').replace(/\n/g, '<br/>') }} />
                )}
              </div>
            ))}
          </div>
          <button onClick={() => { toggleComplete(key); if (activeLesson < mod.lessons.length - 1) setActiveLesson(activeLesson + 1); }}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${completed.includes(key) ? "bg-[hsl(var(--status-active))]/20 text-[hsl(var(--status-active))]" : "bg-primary text-primary-foreground"}`}>
            {completed.includes(key) ? <><CheckCircle className="w-4 h-4" /> Completed</> : <><Play className="w-4 h-4" /> Mark Complete & Next</>}
          </button>
        </div>
      </div>
    );
  }

  if (activeModule !== null) {
    const mod = MODULES[activeModule];
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-4 pb-4">
          <button onClick={() => setActiveModule(null)} className="flex items-center gap-2 text-sm text-primary mb-4"><ArrowLeft className="w-4 h-4" /> All Modules</button>
          <h1 className="text-lg font-bold text-primary mb-1">{mod.title}</h1>
          <p className="text-xs text-muted-foreground mb-4">{mod.lessons.length} lessons • {getModuleProgress(activeModule)}% complete</p>
          <div className="space-y-2">
            {mod.lessons.map((l, i) => {
              const key = `${activeModule}-${i}`;
              return (
                <button key={i} onClick={() => setActiveLesson(i)} className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
                  {completed.includes(key) ? <CheckCircle className="w-5 h-5 text-[hsl(var(--status-active))]" /> : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />}
                  <span className="flex-1 text-sm text-foreground">{l.title}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><BookOpen className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">POS Learn</h1><p className="text-muted-foreground text-xs">Master point-of-sale systems</p></div>
        </div>
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3"><Trophy className="w-8 h-8 text-primary" /><div><p className="text-sm font-semibold text-foreground">{completed.length} / {MODULES.reduce((a, m) => a + m.lessons.length, 0)} lessons completed</p><p className="text-[10px] text-muted-foreground">Keep learning to master POS!</p></div></div>
        </div>
        <div className="space-y-3">
          {MODULES.map((m, i) => (
            <button key={m.title} onClick={() => setActiveModule(i)} className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{m.title}</h3>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{m.lessons.length} lessons</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${getModuleProgress(i)}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{getModuleProgress(i)}% complete</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
export default POSLearnPage;
