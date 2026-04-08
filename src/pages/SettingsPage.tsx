import { useState, useCallback } from "react";
import { Settings, User, Bell, Shield, Palette, Globe, Moon, Volume2, HelpCircle, LogOut, ChevronRight, Smartphone, Watch, Activity, Bluetooth, Check, ArrowLeft, Loader2, X, Signal, FileText } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PairedDevice {
  id: string;
  name: string;
  type: string;
  icon: string;
  connected: boolean;
  battery?: number;
  lastSeen?: string;
  gattServer?: any;
}

const WEARABLE_SERVICES: Record<string, { name: string; icon: string; services: string[] }> = {
  heart_rate: { name: "Heart Rate Monitor", icon: "❤️", services: ["heart_rate"] },
  fitness: { name: "Fitness Tracker", icon: "🏃", services: ["running_speed_and_cadence", "cycling_speed_and_cadence"] },
  watch: { name: "Smartwatch", icon: "⌚", services: ["device_information", "battery_service"] },
  health: { name: "Health Device", icon: "🩺", services: ["health_thermometer", "blood_pressure"] },
};

const KNOWN_WEARABLES = [
  { name: "Apple Watch", icon: "⌚", type: "watch" },
  { name: "Fitbit", icon: "📟", type: "fitness" },
  { name: "Samsung Galaxy Watch", icon: "⌚", type: "watch" },
  { name: "Garmin", icon: "🏃", type: "fitness" },
  { name: "Google Pixel Watch", icon: "⌚", type: "watch" },
  { name: "Whoop", icon: "💪", type: "fitness" },
  { name: "Oura Ring", icon: "💍", type: "health" },
  { name: "Amazfit", icon: "⌚", type: "watch" },
];

const THEME_COLORS = [
  { name: "Gold & Black", primary: "45 100% 50%", bg: "0 0% 3%" },
  { name: "Royal Blue", primary: "220 90% 56%", bg: "220 15% 5%" },
  { name: "Emerald", primary: "160 84% 39%", bg: "160 10% 4%" },
  { name: "Ruby Red", primary: "0 72% 51%", bg: "0 10% 4%" },
  { name: "Purple Rain", primary: "270 76% 53%", bg: "270 15% 4%" },
  { name: "Sunset Orange", primary: "25 95% 53%", bg: "25 10% 4%" },
  { name: "Teal", primary: "180 70% 45%", bg: "180 10% 4%" },
  { name: "Hot Pink", primary: "330 80% 55%", bg: "330 10% 4%" },
  { name: "Lime", primary: "90 76% 45%", bg: "90 10% 4%" },
  { name: "Cyan", primary: "190 85% 50%", bg: "190 10% 4%" },
  { name: "Coral", primary: "16 100% 66%", bg: "16 10% 4%" },
  { name: "Indigo", primary: "240 80% 62%", bg: "240 15% 4%" },
  { name: "Amber", primary: "38 92% 50%", bg: "38 10% 4%" },
  { name: "Rose", primary: "350 65% 55%", bg: "350 10% 4%" },
  { name: "Sky Blue", primary: "200 85% 55%", bg: "200 10% 4%" },
  { name: "Violet", primary: "280 68% 55%", bg: "280 12% 4%" },
  { name: "Mint", primary: "150 60% 50%", bg: "150 10% 4%" },
  { name: "Peach", primary: "20 80% 65%", bg: "20 10% 5%" },
  { name: "Sapphire", primary: "225 73% 57%", bg: "225 15% 4%" },
  { name: "Forest", primary: "140 50% 35%", bg: "140 15% 4%" },
  { name: "Magenta", primary: "300 75% 50%", bg: "300 10% 4%" },
  { name: "Ocean", primary: "195 80% 45%", bg: "195 15% 4%" },
  { name: "Lavender", primary: "260 50% 65%", bg: "260 10% 5%" },
  { name: "Crimson", primary: "348 83% 47%", bg: "348 10% 4%" },
  { name: "Turquoise", primary: "174 72% 44%", bg: "174 10% 4%" },
  { name: "Marigold", primary: "43 96% 56%", bg: "43 10% 4%" },
  { name: "Plum", primary: "290 47% 43%", bg: "290 10% 4%" },
  { name: "Bronze", primary: "33 55% 45%", bg: "33 10% 4%" },
  { name: "Electric Blue", primary: "210 100% 60%", bg: "210 15% 4%" },
  { name: "Chartreuse", primary: "80 80% 50%", bg: "80 10% 4%" },
  { name: "Slate", primary: "215 16% 47%", bg: "215 15% 5%" },
  { name: "Copper", primary: "20 70% 50%", bg: "20 10% 4%" },
  { name: "Navy", primary: "230 55% 45%", bg: "230 20% 4%" },
  { name: "Olive", primary: "80 40% 40%", bg: "80 10% 4%" },
  { name: "Burgundy", primary: "345 55% 35%", bg: "345 10% 4%" },
  { name: "Aquamarine", primary: "160 50% 55%", bg: "160 10% 4%" },
  { name: "Tangerine", primary: "30 100% 55%", bg: "30 10% 4%" },
  { name: "Steel", primary: "210 14% 53%", bg: "210 10% 5%" },
  { name: "Champagne", primary: "40 55% 65%", bg: "40 8% 5%" },
  { name: "Jade", primary: "155 55% 40%", bg: "155 12% 4%" },
  // Light themes
  { name: "Classic Light", primary: "220 70% 50%", bg: "0 0% 98%", light: true },
  { name: "Warm Light", primary: "25 90% 50%", bg: "30 20% 96%", light: true },
  { name: "Cool Light", primary: "200 80% 50%", bg: "200 10% 97%", light: true },
  { name: "Nature Light", primary: "140 60% 40%", bg: "140 10% 97%", light: true },
  { name: "Pastel Pink", primary: "340 60% 55%", bg: "340 15% 96%", light: true },
  { name: "Pastel Blue", primary: "210 60% 55%", bg: "210 15% 96%", light: true },
];

type SettingsTab = "main" | "theme" | "wearables" | "privacy" | "language" | "notifications" | "help";

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Korean", "Chinese", "Portuguese", "Italian", "Arabic", "Hindi", "Russian"];

const SettingsPage = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>("main");
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState("Gold & Black");
  const [language, setLanguage] = useState("English");
  const [privacySettings, setPrivacySettings] = useState({ shareData: false, locationTracking: true, crashReports: true, personalizedAds: false });

  const handleLogout = async () => { await signOut(); toast.success("Signed out"); navigate("/"); };

  const scanBluetooth = useCallback(async () => {
    if (!(navigator as any).bluetooth) {
      toast.error("Bluetooth not supported in this browser. Use Chrome on Android or desktop.");
      return;
    }
    setIsScanning(true);
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["heart_rate", "battery_service", "device_information", "health_thermometer", "running_speed_and_cadence"],
      });
      if (!device) { setIsScanning(false); return; }

      let battery: number | undefined;
      let gattServer: any;
      try {
        gattServer = await device.gatt?.connect();
        try {
          const batteryService = await gattServer?.getPrimaryService("battery_service");
          const batteryChar = await batteryService?.getCharacteristic("battery_level");
          const val = await batteryChar?.readValue();
          battery = val?.getUint8(0);
        } catch { /* device may not support battery service */ }
      } catch { /* GATT connection optional */ }

      const newDevice: PairedDevice = {
        id: device.id || Date.now().toString(),
        name: device.name || "Unknown Device",
        type: "watch",
        icon: "⌚",
        connected: !!gattServer?.connected,
        battery,
        lastSeen: new Date().toLocaleTimeString(),
        gattServer,
      };

      // Match to known wearable type
      const known = KNOWN_WEARABLES.find(w => device.name?.toLowerCase().includes(w.name.split(" ")[0].toLowerCase()));
      if (known) { newDevice.icon = known.icon; newDevice.type = known.type; }

      setPairedDevices(prev => {
        const exists = prev.find(d => d.id === newDevice.id);
        if (exists) return prev.map(d => d.id === newDevice.id ? newDevice : d);
        return [...prev, newDevice];
      });
      setConnectedDevices(prev => prev.includes(newDevice.name) ? prev : [...prev, newDevice.name]);
      toast.success(`${newDevice.name} paired successfully!${battery !== undefined ? ` Battery: ${battery}%` : ""}`);
    } catch (e: any) {
      if (e.name !== "NotFoundError") toast.error(e.message || "Bluetooth scan failed");
    } finally { setIsScanning(false); }
  }, []);

  const disconnectDevice = useCallback((device: PairedDevice) => {
    try { device.gattServer?.disconnect(); } catch {}
    setPairedDevices(prev => prev.filter(d => d.id !== device.id));
    setConnectedDevices(prev => prev.filter(n => n !== device.name));
    toast.success(`${device.name} disconnected`);
  }, []);

  const applyTheme = (theme: typeof THEME_COLORS[0]) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--background", theme.bg);
    root.style.setProperty("--accent", theme.primary);
    root.style.setProperty("--ring", theme.primary);
    root.style.setProperty("--gold", theme.primary);
    if (theme.light) {
      root.style.setProperty("--foreground", "0 0% 10%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--card-foreground", "0 0% 10%");
      root.style.setProperty("--muted-foreground", "0 0% 40%");
      root.style.setProperty("--border", `${theme.primary.split(" ")[0]} 20% 80%`);
    } else {
      root.style.setProperty("--foreground", theme.primary);
      root.style.setProperty("--card", theme.bg.replace(/\d+%$/, (m) => `${Math.min(parseInt(m) + 5, 15)}%`));
      root.style.setProperty("--card-foreground", theme.primary);
      root.style.setProperty("--muted-foreground", `${theme.primary.split(" ")[0]} 30% 55%`);
      root.style.setProperty("--border", `${theme.primary.split(" ")[0]} 60% 20%`);
    }
    setCurrentTheme(theme.name);
    toast.success(`Theme: ${theme.name}`);
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={`w-10 h-6 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-muted"}`}>
      <div className={`w-4 h-4 rounded-full bg-primary-foreground absolute top-1 transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );

  if (tab !== "main") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-4 pb-4">
          <button onClick={() => setTab("main")} className="flex items-center gap-2 text-sm text-primary mb-4"><ArrowLeft className="w-4 h-4" /> Settings</button>

          {tab === "theme" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Theme & Colors</h1>
              <p className="text-xs text-muted-foreground mb-4">Current: <span className="text-primary font-medium">{currentTheme}</span></p>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dark Themes</h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {THEME_COLORS.filter(t => !t.light).map(t => (
                  <button key={t.name} onClick={() => applyTheme(t)} className={`p-2 rounded-xl border text-center ${currentTheme === t.name ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                    <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ background: `hsl(${t.primary})` }} />
                    <span className="text-[8px] text-foreground">{t.name}</span>
                    {currentTheme === t.name && <Check className="w-3 h-3 text-primary mx-auto mt-0.5" />}
                  </button>
                ))}
              </div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Light Themes</h3>
              <div className="grid grid-cols-4 gap-2">
                {THEME_COLORS.filter(t => t.light).map(t => (
                  <button key={t.name} onClick={() => applyTheme(t)} className={`p-2 rounded-xl border text-center ${currentTheme === t.name ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                    <div className="w-6 h-6 rounded-full mx-auto mb-1 border border-border" style={{ background: `hsl(${t.primary})` }} />
                    <span className="text-[8px] text-foreground">{t.name}</span>
                    {currentTheme === t.name && <Check className="w-3 h-3 text-primary mx-auto mt-0.5" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "wearables" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Wearable Devices</h1>
              
              {/* Scan button */}
              <button onClick={scanBluetooth} disabled={isScanning}
                className="w-full flex items-center justify-center gap-3 py-4 mb-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50">
                {isScanning ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Bluetooth className="w-5 h-5 text-primary" />}
                <span className="text-sm font-medium text-primary">{isScanning ? "Scanning for devices..." : "Scan for Bluetooth Devices"}</span>
              </button>

              {/* Paired devices */}
              {pairedDevices.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Paired Devices</h3>
                  <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {pairedDevices.map(device => (
                      <div key={device.id} className="flex items-center gap-3 px-4 py-3.5">
                        <span className="text-xl">{device.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{device.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Signal className={`w-3 h-3 ${device.connected ? "text-green-500" : "text-muted-foreground"}`} />
                            <span className="text-[10px] text-muted-foreground">{device.connected ? "Connected" : "Disconnected"}</span>
                            {device.battery !== undefined && <span className="text-[10px] text-primary">🔋 {device.battery}%</span>}
                            {device.lastSeen && <span className="text-[10px] text-muted-foreground">• {device.lastSeen}</span>}
                          </div>
                        </div>
                        <button onClick={() => disconnectDevice(device)} className="p-1.5 rounded-full hover:bg-destructive/10"><X className="w-4 h-4 text-destructive" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatible devices info */}
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Compatible Devices</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {KNOWN_WEARABLES.map(w => {
                  const isPaired = pairedDevices.some(d => d.name.toLowerCase().includes(w.name.split(" ")[0].toLowerCase()));
                  return (
                    <div key={w.name} className="flex items-center gap-3 px-4 py-3 text-left">
                      <span className="text-xl">{w.icon}</span>
                      <span className="flex-1 text-sm text-foreground">{w.name}</span>
                      {isPaired ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">Paired</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Not paired</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Health data sync info */}
              <div className="mt-3 bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-primary" /><h3 className="text-xs font-semibold text-foreground">Health Data Sync</h3></div>
                <p className="text-[10px] text-muted-foreground mb-2">Connected wearables sync heart rate, steps, sleep, and stress data to Mind Hub, Haptic Escape, and wellness features.</p>
                <div className="flex flex-wrap gap-1">
                  {["Heart Rate", "Steps", "Sleep", "SpO2", "Stress", "Calories", "Temperature"].map(metric => (
                    <span key={metric} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{metric}</span>
                  ))}
                </div>
              </div>

              {/* Link another device */}
              <button onClick={scanBluetooth} className="w-full mt-3 py-3 text-sm font-medium text-primary bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors">
                + Link Another Device
              </button>
            </>
          )}

          {tab === "privacy" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Privacy & Security</h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {[
                  { label: "Share Analytics Data", key: "shareData" as const, desc: "Help improve Solace with anonymous usage data" },
                  { label: "Location Tracking", key: "locationTracking" as const, desc: "For Crisis Hub, Radar, and location-based features" },
                  { label: "Crash Reports", key: "crashReports" as const, desc: "Auto-send crash reports to improve stability" },
                  { label: "Personalized Ads", key: "personalizedAds" as const, desc: "Show relevant sponsored content" },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex-1"><p className="text-sm text-foreground">{item.label}</p><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                    <Toggle value={privacySettings[item.key]} onChange={v => setPrivacySettings(p => ({ ...p, [item.key]: v }))} />
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-3 bg-destructive/10 text-destructive font-medium rounded-xl text-sm">Delete Account</button>
            </>
          )}

          {tab === "language" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Language</h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {LANGUAGES.map(l => (
                  <button key={l} onClick={() => { setLanguage(l); toast.success(`Language set to ${l}`); }} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 text-left">
                    <span className="flex-1 text-sm text-foreground">{l}</span>
                    {language === l && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "notifications" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Notifications</h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {[
                  { label: "Push Notifications", value: true, onChange: () => {} },
                  { label: "Sound Effects", value: true, onChange: () => {} },
                  { label: "Oracle Reminders", value: true, onChange: () => {} },
                  { label: "Calendar Alerts", value: true, onChange: () => {} },
                  { label: "Family Hub Updates", value: true, onChange: () => {} },
                  { label: "Marketing Notifications", value: false, onChange: () => {} },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="flex-1 text-sm text-foreground">{item.label}</span>
                    <Toggle value={item.value} onChange={item.onChange} />
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "help" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Help & Support</h1>
              <div className="space-y-3">
                {[
                  { title: "FAQ", desc: "Common questions and answers" },
                  { title: "Contact Support", desc: "Get help from our team" },
                  { title: "Report a Bug", desc: "Let us know about issues" },
                  { title: "Feature Request", desc: "Suggest new features" },
                  { title: "Terms of Service", desc: "Our terms and policies" },
                  { title: "Privacy Policy", desc: "How we handle your data" },
                ].map(item => (
                  <button key={item.title} className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const sections = [
    { title: "Account", items: [
      { icon: <User className="w-5 h-5" />, label: "Profile", action: () => navigate("/profile") },
      { icon: <Shield className="w-5 h-5" />, label: "Privacy & Security", action: () => setTab("privacy") },
      { icon: <Bell className="w-5 h-5" />, label: "Notifications", action: () => setTab("notifications") },
    ]},
    { title: "Devices", items: [
      { icon: <Watch className="w-5 h-5" />, label: "Wearable Devices", subtitle: `${pairedDevices.length} paired`, action: () => setTab("wearables") },
      { icon: <Bluetooth className="w-5 h-5" />, label: "Scan Bluetooth", action: () => { setTab("wearables"); setTimeout(scanBluetooth, 300); } },
    ]},
    { title: "Preferences", items: [
      { icon: <Palette className="w-5 h-5" />, label: "Theme & Colors", subtitle: currentTheme, action: () => setTab("theme") },
      { icon: <Globe className="w-5 h-5" />, label: "Language", subtitle: language, action: () => setTab("language") },
    ]},
    { title: "About", items: [
      { icon: <Smartphone className="w-5 h-5" />, label: "About Solace", action: () => navigate("/about") },
      { icon: <Shield className="w-5 h-5" />, label: "Privacy Policy", action: () => navigate("/privacy-policy") },
      { icon: <FileText className="w-5 h-5" />, label: "Terms of Service", action: () => navigate("/terms-of-service") },
      { icon: <HelpCircle className="w-5 h-5" />, label: "Help & Support", action: () => setTab("help") },
    ]},
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10"><Settings className="w-7 h-7 text-primary" /></div>
          <h1 className="text-xl font-bold text-primary">Settings</h1>
        </div>
        {sections.map(section => (
          <div key={section.title} className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{section.title}</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {section.items.map(item => (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
                  <span className="text-primary">{item.icon}</span>
                  <span className="flex-1 text-sm text-foreground">{item.label}</span>
                  {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-destructive/10 text-destructive font-medium rounded-xl">
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </div>
  );
};
export default SettingsPage;
