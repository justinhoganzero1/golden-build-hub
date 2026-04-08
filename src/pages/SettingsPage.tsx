import { useState } from "react";
import { Settings, User, Bell, Shield, Palette, Globe, Moon, Volume2, HelpCircle, LogOut, ChevronRight, Smartphone, Watch, Heart, Activity, Bluetooth } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const WEARABLES = [
  { name: "Apple Watch", icon: "⌚", connected: false },
  { name: "Fitbit", icon: "📟", connected: false },
  { name: "Samsung Galaxy Watch", icon: "⌚", connected: false },
  { name: "Garmin", icon: "🏃", connected: false },
  { name: "Google Pixel Watch", icon: "⌚", connected: false },
  { name: "Whoop", icon: "💪", connected: false },
  { name: "Oura Ring", icon: "💍", connected: false },
  { name: "Amazfit", icon: "⌚", connected: false },
];

const SettingsPage = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [showWearables, setShowWearables] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);

  const handleLogout = async () => { await signOut(); toast.success("Signed out"); navigate("/"); };

  const toggleWearable = (name: string) => {
    setConnectedDevices(prev =>
      prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]
    );
    toast.success(connectedDevices.includes(name) ? `${name} disconnected` : `${name} connected`);
  };

  const sections = [
    { title: "Account", items: [
      { icon: <User className="w-5 h-5" />, label: "Profile", action: () => navigate("/profile") },
      { icon: <Shield className="w-5 h-5" />, label: "Privacy & Security" },
      { icon: <Bell className="w-5 h-5" />, label: "Notifications", toggle: true, value: notifications, onChange: setNotifications },
    ]},
    { title: "Devices", items: [
      { icon: <Watch className="w-5 h-5" />, label: "Wearable Devices", subtitle: `${connectedDevices.length} connected`, action: () => setShowWearables(!showWearables) },
      { icon: <Bluetooth className="w-5 h-5" />, label: "Bluetooth Devices" },
    ]},
    { title: "Preferences", items: [
      { icon: <Moon className="w-5 h-5" />, label: "Dark Mode", toggle: true, value: darkMode, onChange: setDarkMode },
      { icon: <Volume2 className="w-5 h-5" />, label: "Sound Effects", toggle: true, value: sound, onChange: setSound },
      { icon: <Globe className="w-5 h-5" />, label: "Language", subtitle: "English" },
      { icon: <Palette className="w-5 h-5" />, label: "Theme", subtitle: "Gold & Black" },
    ]},
    { title: "About", items: [
      { icon: <Smartphone className="w-5 h-5" />, label: "App Version", subtitle: "1.0.0" },
      { icon: <HelpCircle className="w-5 h-5" />, label: "Help & Support" },
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
                  {item.toggle ? (
                    <button onClick={e => { e.stopPropagation(); item.onChange?.(!item.value); }}
                      className={`w-10 h-6 rounded-full transition-colors relative ${item.value ? "bg-primary" : "bg-muted"}`}>
                      <div className={`w-4 h-4 rounded-full bg-primary-foreground absolute top-1 transition-transform ${item.value ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  ) : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Wearables Panel */}
        {showWearables && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Connect Wearable</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {WEARABLES.map(w => (
                <button key={w.name} onClick={() => toggleWearable(w.name)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
                  <span className="text-xl">{w.icon}</span>
                  <span className="flex-1 text-sm text-foreground">{w.name}</span>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${connectedDevices.includes(w.name) ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-4 h-4 rounded-full bg-primary-foreground absolute top-1 transition-transform ${connectedDevices.includes(w.name) ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-primary" /><h3 className="text-xs font-semibold text-foreground">Health Data Sync</h3></div>
              <p className="text-[10px] text-muted-foreground">Connected wearables will sync heart rate, steps, sleep data, and stress levels to enhance Mind Hub, Haptic Escape, and wellness features.</p>
            </div>
          </div>
        )}

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-destructive/10 text-destructive font-medium rounded-xl">
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
