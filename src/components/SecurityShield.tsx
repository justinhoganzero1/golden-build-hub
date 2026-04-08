import { useState } from "react";
import { Shield, Lock, Eye, Fingerprint, Wifi, Globe, Server, Key, AlertTriangle, ShieldCheck, Scan, Bug, Zap, Brain, Radio, Database, FileWarning, ShieldAlert, MonitorSmartphone, UserCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIGuard {
  id: number;
  name: string;
  category: string;
  description: string;
  status: "active" | "monitoring" | "scanning";
}

const categories = [
  "Network Defense",
  "Malware Shield",
  "Identity Guard",
  "Data Fortress",
  "Intrusion Detection",
  "Encryption Engine",
  "Behavioral Analysis",
  "Threat Intelligence",
  "Firewall Matrix",
  "Privacy Sentinel",
];

const guardNames = [
  "Sentinel", "Warden", "Guardian", "Protector", "Defender",
  "Watchdog", "Enforcer", "Interceptor", "Blocker", "Scanner",
  "Analyzer", "Detector", "Monitor", "Tracker", "Hunter",
  "Neutralizer", "Firewall", "Barrier", "Filter", "Validator",
  "Verifier", "Authenticator", "Encryptor", "Shielder", "Patroller",
  "Observer", "Inspector", "Auditor", "Lockdown", "Quarantine",
  "Terminator", "Purifier", "Cleaner", "Sweeper", "Screener",
];

const threatTypes = [
  "phishing attacks", "SQL injection", "cross-site scripting (XSS)", "brute force login attempts",
  "session hijacking", "man-in-the-middle attacks", "DDoS floods", "ransomware payloads",
  "trojan horses", "keyloggers", "rootkits", "spyware", "adware injection",
  "zero-day exploits", "buffer overflow attacks", "DNS spoofing", "ARP poisoning",
  "packet sniffing", "credential stuffing", "privilege escalation", "backdoor access",
  "worm propagation", "botnet recruitment", "cryptojacking scripts", "data exfiltration",
  "API abuse", "token theft", "cookie manipulation", "clickjacking", "form tampering",
  "malicious redirects", "drive-by downloads", "watering hole attacks", "supply chain attacks",
  "social engineering", "reverse engineering", "memory scraping", "file-less malware",
  "polymorphic viruses", "logic bombs", "time bombs", "email spoofing", "URL poisoning",
  "browser fingerprinting", "WebSocket hijacking", "CORS exploitation", "JWT manipulation",
  "OAuth token abuse", "XML external entity attacks", "server-side request forgery",
  "insecure deserialization",
];

function generateGuards(): AIGuard[] {
  const guards: AIGuard[] = [];
  for (let i = 1; i <= 101; i++) {
    const catIdx = (i - 1) % categories.length;
    const nameIdx = (i - 1) % guardNames.length;
    const threatIdx = (i - 1) % threatTypes.length;
    const statuses: AIGuard["status"][] = ["active", "monitoring", "scanning"];
    guards.push({
      id: i,
      name: `${guardNames[nameIdx]}-${String(i).padStart(3, "0")}`,
      category: categories[catIdx],
      description: `AI agent specializing in detecting and neutralizing ${threatTypes[threatIdx]}. Runs continuous deep-pattern analysis with real-time response.`,
      status: statuses[i % 3],
    });
  }
  return guards;
}

const allGuards = generateGuards();

const categoryIcons: Record<string, React.ReactNode> = {
  "Network Defense": <Wifi className="w-4 h-4" />,
  "Malware Shield": <Bug className="w-4 h-4" />,
  "Identity Guard": <Fingerprint className="w-4 h-4" />,
  "Data Fortress": <Database className="w-4 h-4" />,
  "Intrusion Detection": <AlertTriangle className="w-4 h-4" />,
  "Encryption Engine": <Key className="w-4 h-4" />,
  "Behavioral Analysis": <Brain className="w-4 h-4" />,
  "Threat Intelligence": <Eye className="w-4 h-4" />,
  "Firewall Matrix": <ShieldAlert className="w-4 h-4" />,
  "Privacy Sentinel": <Lock className="w-4 h-4" />,
};

const statusColors: Record<string, string> = {
  active: "text-green-400 bg-green-400/10",
  monitoring: "text-blue-400 bg-blue-400/10",
  scanning: "text-yellow-400 bg-yellow-400/10",
};

const SecurityShield = () => {
  const [open, setOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<AIGuard | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const filtered = filterCat ? allGuards.filter(g => g.category === filterCat) : allGuards;

  return (
    <>
      {/* Shield Button */}
      <button
        onClick={() => setOpen(true)}
        className="relative group flex flex-col items-center gap-1"
      >
        <div className="relative">
          {/* Outer pulse ring – uses box-shadow so it doesn't affect layout */}
          <div className="absolute inset-0 rounded-full animate-pulse" style={{ boxShadow: "0 0 12px 4px hsl(var(--primary) / 0.35)", animationDuration: "3s" }} />
          {/* Shield icon */}
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary via-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-primary/50">
            <ShieldCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          {/* Status dot */}
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
        </div>
        <span className="text-[9px] font-bold text-primary tracking-wider">101 AI GUARDS</span>
        <span className="text-[8px] text-green-400 font-medium">ALL ACTIVE</span>
      </button>

      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] bg-background border-primary/30 p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b border-border bg-gradient-to-r from-primary/5 via-green-500/5 to-blue-500/5">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-6 h-6" />
              SOLACE Security Fortress
            </DialogTitle>
            <p className="text-xs text-muted-foreground">101 AI Security Agents protecting you 24/7</p>
            {/* Stats bar */}
            <div className="flex gap-2 mt-2">
              {[
                { label: "Active", count: allGuards.filter(g => g.status === "active").length, color: "text-green-400" },
                { label: "Monitoring", count: allGuards.filter(g => g.status === "monitoring").length, color: "text-blue-400" },
                { label: "Scanning", count: allGuards.filter(g => g.status === "scanning").length, color: "text-yellow-400" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1 px-2 py-1 rounded-full bg-card border border-border text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.color.replace("text-", "bg-")}`} />
                  <span className="text-muted-foreground">{s.count} {s.label}</span>
                </div>
              ))}
            </div>
          </DialogHeader>

          {/* Category filter */}
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterCat(null)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                !filterCat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              All (101)
            </button>
            {categories.map(cat => {
              const count = allGuards.filter(g => g.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                    filterCat === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {categoryIcons[cat]}
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Guard list */}
          <ScrollArea className="flex-1 px-4 pb-4" style={{ maxHeight: "50vh" }}>
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(guard => (
                <button
                  key={guard.id}
                  onClick={() => setSelectedGuard(guard)}
                  className="text-left p-2.5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-green-500/20 flex items-center justify-center text-primary">
                      {categoryIcons[guard.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-foreground truncate">{guard.name}</p>
                      <p className="text-[8px] text-muted-foreground truncate">{guard.category}</p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium ${statusColors[guard.status]}`}>
                    <span className={`w-1 h-1 rounded-full ${statusColors[guard.status].split(" ")[0].replace("text-", "bg-")}`} />
                    {guard.status.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Guard detail dialog */}
      <Dialog open={!!selectedGuard} onOpenChange={() => setSelectedGuard(null)}>
        <DialogContent className="max-w-sm bg-background border-primary/30">
          {selectedGuard && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary text-sm">
                  {categoryIcons[selectedGuard.category]}
                  {selectedGuard.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${statusColors[selectedGuard.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusColors[selectedGuard.status].split(" ")[0].replace("text-", "bg-")}`} />
                    {selectedGuard.status.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-full bg-card border border-border">
                    {selectedGuard.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedGuard.description}</p>
                <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Threat Level: None Detected
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-1">Last scan: just now • 0 threats blocked in this session</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Uptime", value: "99.99%" },
                    { label: "Response", value: "<1ms" },
                    { label: "Blocked", value: "0" },
                  ].map(stat => (
                    <div key={stat.label} className="text-center p-2 rounded-lg bg-card border border-border">
                      <p className="text-xs font-bold text-primary">{stat.value}</p>
                      <p className="text-[8px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SecurityShield;
