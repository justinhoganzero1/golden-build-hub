import { useState } from "react";
import { Home, Users, Calendar, ShoppingCart, MapPin, Heart, Plus, Check, Trash2, MessageSquare, Loader2, Send } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

interface FamilyMember {
  name: string; status: string; avatar: string;
}

interface ShoppingItem {
  id: string; text: string; done: boolean;
}

interface FamilyGoal {
  id: string; text: string; progress: number;
}

type Tab = "home" | "calendar" | "shopping" | "location" | "goals" | "chat";

const FamilyHubPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [members, setMembers] = useState<FamilyMember[]>([
    { name: "Mom", status: "Home", avatar: "👩" },
    { name: "Dad", status: "Work", avatar: "👨" },
    { name: "Emma", status: "School", avatar: "👧" },
    { name: "Max", status: "Home", avatar: "🐕" },
  ]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([
    { id: "1", text: "Milk", done: false },
    { id: "2", text: "Bread", done: false },
    { id: "3", text: "Eggs", done: true },
  ]);
  const [newItem, setNewItem] = useState("");
  const [goals, setGoals] = useState<FamilyGoal[]>([
    { id: "1", text: "Family vacation fund", progress: 65 },
    { id: "2", text: "Weekly game night", progress: 80 },
    { id: "3", text: "Eat dinner together 5x/week", progress: 40 },
  ]);
  const [newGoal, setNewGoal] = useState("");
  const [newMember, setNewMember] = useState("");
  const [newMemberEmoji, setNewMemberEmoji] = useState("👤");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role:string;content:string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Calendar events
  const [events] = useState([
    { date: "Today", time: "3:00 PM", title: "Emma's Soccer Practice", color: "bg-blue-500" },
    { date: "Today", time: "6:30 PM", title: "Family Dinner", color: "bg-primary" },
    { date: "Tomorrow", time: "9:00 AM", title: "Dad's Meeting", color: "bg-orange-500" },
    { date: "Saturday", time: "10:00 AM", title: "Family Outing", color: "bg-green-500" },
  ]);

  const addShoppingItem = () => {
    if (!newItem.trim()) return;
    setShoppingList(prev => [...prev, { id: Date.now().toString(), text: newItem.trim(), done: false }]);
    setNewItem("");
  };

  const toggleItem = (id: string) => setShoppingList(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const removeItem = (id: string) => setShoppingList(prev => prev.filter(i => i.id !== id));

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setGoals(prev => [...prev, { id: Date.now().toString(), text: newGoal.trim(), progress: 0 }]);
    setNewGoal("");
  };

  const addMember = () => {
    if (!newMember.trim()) return;
    setMembers(prev => [...prev, { name: newMember.trim(), status: "Home", avatar: newMemberEmoji }]);
    setNewMember(""); setNewMemberEmoji("👤");
    toast.success("Member added!");
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    const msgs = [...chatHistory, { role: "user", content: chatInput }];
    setChatHistory(msgs);
    setChatInput("");
    try {
      const memberInfo = members.map(m => `${m.name} (${m.avatar}) - ${m.status}`).join(", ");
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are a family AI assistant. Family members: ${memberInfo}. Help with scheduling, meal planning, chores, activities, and family coordination. Be warm and helpful.` },
            ...msgs
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
      setChatHistory([...msgs, { role: "assistant", content }]);
    } catch { toast.error("AI unavailable"); }
    finally { setChatLoading(false); }
  };

  const tabs = [
    { id: "home" as const, icon: <Home className="w-4 h-4" />, label: "Home" },
    { id: "calendar" as const, icon: <Calendar className="w-4 h-4" />, label: "Calendar" },
    { id: "shopping" as const, icon: <ShoppingCart className="w-4 h-4" />, label: "Shopping" },
    { id: "goals" as const, icon: <Heart className="w-4 h-4" />, label: "Goals" },
    { id: "chat" as const, icon: <MessageSquare className="w-4 h-4" />, label: "AI Helper" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Home className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Family Hub</h1><p className="text-muted-foreground text-xs">Your family command center</p></div>
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

        {/* Home */}
        {activeTab === "home" && (
          <>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Family Members</h2>
            <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
              {members.map(m => (
                <div key={m.name} className="flex flex-col items-center gap-1 min-w-[72px]">
                  <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center text-2xl">{m.avatar}</div>
                  <p className="text-xs font-medium text-foreground">{m.name}</p>
                  <span className="text-[10px] text-muted-foreground">{m.status}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1 min-w-[72px]">
                <button onClick={() => setActiveTab("home")} className="w-14 h-14 rounded-full bg-card border border-dashed border-primary/50 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </button>
                <p className="text-xs text-muted-foreground">Add</p>
              </div>
            </div>

            {/* Add member */}
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <h3 className="text-xs font-semibold text-foreground mb-2">Add Family Member</h3>
              <div className="flex gap-2">
                <select value={newMemberEmoji} onChange={e => setNewMemberEmoji(e.target.value)} className="w-16 px-2 py-2 rounded-lg bg-input border border-border text-lg">
                  {["👤","👩","👨","👧","👦","👶","🧓","🧑","🐕","🐈"].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Name" className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
                <button onClick={addMember} className="p-2 rounded-lg bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Upcoming */}
            <h2 className="text-sm font-semibold text-foreground mb-3">Today's Schedule</h2>
            <div className="space-y-2">
              {events.filter(e => e.date === "Today").map(ev => (
                <div key={ev.title} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-1 h-10 rounded-full ${ev.color}`} />
                  <div><p className="text-sm text-foreground font-medium">{ev.title}</p><p className="text-xs text-muted-foreground">{ev.time}</p></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Calendar */}
        {activeTab === "calendar" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground mb-2">Family Calendar</h2>
            {events.map(ev => (
              <div key={ev.title} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-1.5 h-12 rounded-full ${ev.color}`} />
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{ev.date} at {ev.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Shopping */}
        {activeTab === "shopping" && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Shopping List</h2>
            <div className="flex gap-2 mb-4">
              <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addShoppingItem()}
                placeholder="Add item..." className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
              <button onClick={addShoppingItem} className="p-3 rounded-xl bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {shoppingList.map(item => (
                <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <button onClick={() => toggleItem(item.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${item.done ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                    {item.done && <Check className="w-3 h-3 text-primary-foreground" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
                  <button onClick={() => removeItem(item.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        {activeTab === "goals" && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Family Goals</h2>
            <div className="flex gap-2 mb-4">
              <input value={newGoal} onChange={e => setNewGoal(e.target.value)} onKeyDown={e => e.key === "Enter" && addGoal()}
                placeholder="Add a family goal..." className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
              <button onClick={addGoal} className="p-3 rounded-xl bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {goals.map(g => (
                <div key={g.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-sm text-foreground font-medium">{g.text}</p>
                    <span className="text-xs text-primary font-bold">{g.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Chat */}
        {activeTab === "chat" && (
          <div>
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">Family AI Assistant</h3>
              <p className="text-xs text-muted-foreground">Ask about meal planning, activity ideas, chore scheduling, or anything family-related.</p>
            </div>
            <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm ${msg.role === "user" ? "bg-primary/10 text-foreground ml-8" : "bg-card border border-border text-foreground mr-4"}`}>
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
              ))}
              {chatLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</div>}
            </div>
            {chatHistory.length === 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {["Plan tonight's dinner", "Fun weekend activities", "Create a chore chart", "Help with homework schedule"].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); }} className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground hover:border-primary transition-colors text-left">{q}</button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask your family AI..." className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyHubPage;
