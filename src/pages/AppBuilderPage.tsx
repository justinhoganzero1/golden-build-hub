import { useState } from "react";
import { Wrench, Code, Layers, Smartphone, Wand2, Plus, Play, X, Loader2, Download, MessageCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

interface AppProject { id: string; name: string; type: string; description: string; code: string; created: string; }

const TEMPLATES = [
  { type: "chatbot", icon: <MessageCircle className="w-5 h-5" />, title: "AI Chatbot", desc: "Simple AI chat assistant app" },
  { type: "todo", icon: <Layers className="w-5 h-5" />, title: "Task Manager", desc: "To-do list with categories" },
  { type: "calculator", icon: <Code className="w-5 h-5" />, title: "Calculator", desc: "Smart calculator app" },
  { type: "timer", icon: <Smartphone className="w-5 h-5" />, title: "Timer / Stopwatch", desc: "Countdown and stopwatch" },
  { type: "notes", icon: <Wand2 className="w-5 h-5" />, title: "Notes App", desc: "Quick notes with search" },
  { type: "custom", icon: <Plus className="w-5 h-5" />, title: "Custom App", desc: "Describe any app idea" },
];

const AppBuilderPage = () => {
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [appName, setAppName] = useState("");
  const [appDesc, setAppDesc] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [previewProject, setPreviewProject] = useState<AppProject | null>(null);

  const buildApp = async () => {
    if (!appName.trim()) { toast.error("Enter an app name"); return; }
    setIsBuilding(true);
    try {
      const template = TEMPLATES.find(t => t.type === selectedTemplate);
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          type: "assistant",
          prompt: `Generate a complete, working single-page HTML app. App name: "${appName}". Template: ${template?.title || "custom"}. Description: ${appDesc || template?.desc || "basic app"}. Requirements:
- Must be a COMPLETE self-contained HTML file with inline CSS and JavaScript
- Modern dark theme with gold accents (#FFD700)
- Responsive mobile-first design
- Fully functional with all interactive features working
- Include a header with the app name
- If it's a chatbot, include a mock AI chat that responds with pre-written helpful responses
- Include proper error handling
- Make it look professional and polished
Return ONLY the complete HTML code, nothing else.`
        }),
      });
      if (!resp.ok) { toast.error("Build failed"); return; }
      const data = await resp.json();
      const code = data.result || "<html><body><h1>App Build Failed</h1></body></html>";
      const project: AppProject = {
        id: Date.now().toString(),
        name: appName,
        type: selectedTemplate || "custom",
        description: appDesc || template?.desc || "",
        code,
        created: new Date().toLocaleDateString(),
      };
      setProjects(prev => [project, ...prev]);
      setPreviewProject(project);
      toast.success(`${appName} built! 🎉`);
      setShowCreate(false);
      setAppName("");
      setAppDesc("");
      setSelectedTemplate(null);
    } catch { toast.error("Build failed"); } finally { setIsBuilding(false); }
  };

  const downloadApp = (project: AppProject) => {
    const blob = new Blob([project.code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("App downloaded!");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Wrench className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">App Builder</h1><p className="text-muted-foreground text-xs">Build working mini-apps with AI</p></div>
        </div>

        {/* Preview */}
        {previewProject && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">Preview: {previewProject.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => downloadApp(previewProject)} className="text-xs text-primary flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
                <button onClick={() => setPreviewProject(null)} className="text-xs text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <iframe srcDoc={previewProject.code} className="w-full h-80 rounded-xl border border-border bg-white" sandbox="allow-scripts" title="App Preview" />
          </div>
        )}

        <button onClick={() => setShowCreate(!showCreate)} className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-4">
          {showCreate ? <><X className="w-5 h-5" /> Cancel</> : <><Plus className="w-5 h-5" /> New Project</>}
        </button>

        {showCreate && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Choose Template</h3>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.type} onClick={() => setSelectedTemplate(t.type)}
                  className={`p-3 rounded-xl border text-center ${selectedTemplate === t.type ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                  <div className="text-primary mx-auto mb-1">{t.icon}</div>
                  <p className="text-[10px] text-foreground font-medium">{t.title}</p>
                </button>
              ))}
            </div>
            <input value={appName} onChange={e => setAppName(e.target.value)} placeholder="App name" className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary" />
            <textarea value={appDesc} onChange={e => setAppDesc(e.target.value)} placeholder="Describe your app (optional)" rows={2}
              className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none" />
            <button onClick={buildApp} disabled={isBuilding || !appName.trim()}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {isBuilding ? <><Loader2 className="w-4 h-4 animate-spin" /> Building...</> : <><Wand2 className="w-4 h-4" /> Build App</>}
            </button>
          </div>
        )}

        {/* My Projects */}
        {projects.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-foreground mb-3">My Projects</h2>
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="text-primary">{TEMPLATES.find(t => t.type === p.type)?.icon || <Code className="w-5 h-5" />}</div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{p.created}</p>
                  </div>
                  <button onClick={() => setPreviewProject(p)} className="text-xs text-primary"><Play className="w-4 h-4" /></button>
                  <button onClick={() => downloadApp(p)} className="text-xs text-primary"><Download className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </>
        )}

        {projects.length === 0 && !showCreate && (
          <div className="text-center py-12">
            <Wrench className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <p className="text-xs text-muted-foreground">Create your first AI-powered app above!</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default AppBuilderPage;
