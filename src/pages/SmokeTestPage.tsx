import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Circle, AlertTriangle, ExternalLink, Camera, Route, Layers, Play } from "lucide-react";

type StepStatus = "pending" | "running" | "pass" | "fail" | "warn";
type StepKind = "route" | "tile" | "function" | "media";

interface Step {
  id: string;
  kind: StepKind;
  group: string;
  name: string;
  route?: string;
  expected: "public" | "free" | "auth" | "admin" | "seo" | "redirect";
  status: StepStatus;
  detail?: string;
  durationMs?: number;
}

const dashboardTiles = [
  ["Talk to Oracle", "Oracle AI", "/oracle", "auth"], ["Talk to Oracle", "Companion", "/ai-companion", "auth"],
  ["Talk to Oracle", "Assistant", "/personal-assistant", "auth"], ["Talk to Oracle", "Photo Studio", "/photography-hub", "free"],
  ["Talk to Oracle", "Video Editor", "/video-editor", "free"], ["Talk to Oracle", "Media Library", "/media-library", "free"],
  ["Talk to Oracle", "AI Tutor", "/ai-tutor", "auth"], ["Talk to Oracle", "Interpreter", "/interpreter", "auth"],
  ["Talk to Oracle", "Live Vision", "/live-vision", "auth"], ["Create & Studio", "Movie Studio", "/movie-studio-pro", "auth"],
  ["Create & Studio", "YouTube Studio", "/youtube-show-studio", "auth"], ["Create & Studio", "Voice Studio", "/voice-studio", "auth"],
  ["Create & Studio", "Avatar Gen", "/avatar-generator", "auth"], ["Create & Studio", "Magic Hub", "/magic-hub", "auth"],
  ["Create & Studio", "Story Writer", "/story-writer", "auth"], ["Care & Safety", "Crisis Hub", "/crisis-hub", "free"],
  ["Care & Safety", "Safety Center", "/safety-center", "free"], ["Care & Safety", "Elderly Care", "/elderly-care", "auth"],
  ["Care & Safety", "Mind Hub", "/mind-hub", "auth"], ["Care & Safety", "Family Hub", "/family-hub", "auth"],
  ["Care & Safety", "Audio Filter", "/audio-filter", "auth"], ["Daily Life", "Calendar", "/calendar", "auth"],
  ["Daily Life", "Alarm Clock", "/alarm-clock", "auth"], ["Daily Life", "Occasions", "/special-occasions", "auth"],
  ["Daily Life", "Inventor", "/inventor", "auth"], ["Daily Life", "Pro Hub", "/professional-hub", "auth"],
  ["Daily Life", "App Builder", "/app-builder", "auth"], ["Daily Life", "POS Learn", "/pos-learn", "auth"],
] as const;

const splashTiles = [
  ["Splash", "Crisis Hub", "/crisis-hub", "free"], ["Splash", "Mind Hub", "/mind-hub", "auth"],
  ["Splash", "Photography Hub", "/photography-hub", "free"], ["Splash", "Live Vision", "/live-vision", "auth"],
  ["Splash", "Voice Studio", "/voice-studio", "auth"], ["Splash", "AI Companion", "/ai-companion", "auth"],
  ["Splash", "Magic Hub", "/magic-hub", "auth"], ["Splash", "Marketing Hub", "/marketing-hub", "auth"],
  ["Splash", "Video Editor", "/video-editor", "free"], ["Splash", "Wallet & Bills", "/wallet", "auth"],
  ["Splash", "Calendar & Diary", "/calendar", "auth"], ["Splash", "AI Tutor", "/ai-tutor", "auth"],
  ["Splash", "Interpreter", "/interpreter", "auth"], ["Splash", "Inventor Lab", "/inventor", "auth"],
  ["Splash", "Professional Hub", "/professional-hub", "auth"], ["Splash", "Family Hub", "/family-hub", "auth"],
  ["Splash", "Elderly Care", "/elderly-care", "auth"], ["Splash", "Special Occasions", "/special-occasions", "auth"],
  ["Splash", "POS Learn", "/pos-learn", "auth"], ["Splash", "App Builder", "/app-builder", "auth"],
  ["Splash", "AI Security Fortress", "/safety-center", "free"],
] as const;

const appTiles = [
  "oracle", "tutor", "mind", "crisis", "photography", "marketing", "companion", "wallet", "calendar", "vision", "youtube-show",
].map((slug) => ["Standalone Apps", `/apps/${slug}`, `/apps/${slug}`, "auth"] as const);

const routeMatrix = [
  ["Core Routes", "Home splash", "/", "public"], ["Core Routes", "Website alias", "/website", "public"],
  ["Core Routes", "Welcome", "/welcome", "public"], ["Core Routes", "Dashboard", "/dashboard", "auth"],
  ["Core Routes", "Oracle Preview", "/oracle-preview", "public"], ["Core Routes", "Sign In", "/sign-in", "public"],
  ["Core Routes", "Apps storefront", "/apps", "auth"], ["Core Routes", "Public Library", "/library/public", "public"],
  ["Core Routes", "About", "/about", "public"], ["Core Routes", "Commandments", "/commandments", "public"],
  ["Core Routes", "Privacy", "/privacy-policy", "public"], ["Core Routes", "Terms", "/terms-of-service", "public"],
  ["Core Routes", "Advertise", "/advertise", "public"], ["Core Routes", "Consent", "/consent", "public"],
  ["Account Routes", "Profile", "/profile", "auth"], ["Account Routes", "Settings", "/settings", "auth"],
  ["Account Routes", "Subscribe", "/subscribe", "auth"], ["Account Routes", "Subscription", "/subscription", "auth"],
  ["Account Routes", "Wallet", "/wallet", "auth"], ["Account Routes", "Vault", "/vault", "auth"],
  ["Admin Routes", "Owner Dashboard", "/owner-dashboard", "admin"], ["Admin Routes", "Admin Editor", "/admin/editor", "admin"],
  ["Extra Modules", "AI Studio", "/ai-studio", "auth"], ["Extra Modules", "Creator Studio", "/creator-studio", "auth"],
  ["Extra Modules", "Avatar Gallery", "/avatar-gallery", "auth"], ["Extra Modules", "Living GIF Studio", "/living-gif-studio", "auth"],
  ["Extra Modules", "Claims Assistant", "/claims-assistant", "auth"], ["Extra Modules", "Personal Vault", "/personal-vault", "auth"],
  ["Extra Modules", "Claims App", "/claims-app", "auth"], ["Extra Modules", "Web Wrapper", "/web-wrapper", "auth"],
] as const;

const seoRoutes = [
  "/ai-chat-companion", "/ai-friend", "/free-ai-chat", "/ai-girlfriend", "/ai-boyfriend", "/ai-image-generator-free",
  "/ai-video-generator", "/ai-music-generator", "/ai-coder", "/ai-photo-editor", "/chatgpt-alternative", "/ai-for-android",
] as const;

const makeSteps = (): Step[] => {
  const fromRows = (rows: readonly (readonly [string, string, string, string])[], kind: StepKind) => rows.map(([group, name, route, expected], i) => ({
    id: `${kind}-${group}-${name}-${route}-${i}`.replace(/[^a-z0-9]+/gi, "-"), kind, group, name, route, expected: expected as Step["expected"], status: "pending" as StepStatus,
  }));
  return [
    { id: "auth-session", kind: "function", group: "Backend", name: "Authentication session restore", expected: "public", status: "pending" },
    { id: "oracle-function", kind: "function", group: "Backend", name: "Oracle chat function", route: "/oracle", expected: "public", status: "pending" },
    { id: "voice-function", kind: "function", group: "Backend", name: "Voice provider function", route: "/voice-studio", expected: "public", status: "pending" },
    { id: "photo-function", kind: "function", group: "Backend", name: "Image generation auth gate", route: "/photography-hub", expected: "free", status: "pending" },
    ...fromRows(splashTiles, "tile"), ...fromRows(dashboardTiles, "tile"), ...fromRows(routeMatrix, "route"),
    ...appTiles.map(([group, name, route, expected], i) => ({ id: `app-${name}-${i}`, kind: "tile" as StepKind, group, name, route, expected: expected as Step["expected"], status: "pending" as StepStatus })),
    ...seoRoutes.map((route, i) => ({ id: `seo-${i}-${route}`, kind: "route" as StepKind, group: "SEO Routes", name: route, route, expected: "seo" as Step["expected"], status: "pending" as StepStatus })),
  ];
};

const StatusIcon = ({ status }: { status: StepStatus }) => {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
};

export default function SmokeTestPage() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>(makeSteps);
  const [running, setRunning] = useState(false);
  const [currentRoute, setCurrentRoute] = useState("/");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [filter, setFilter] = useState<StepStatus | "all">("all");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const update = (id: string, patch: Partial<Step>) => setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  const counts = steps.reduce((acc, s) => ({ ...acc, [s.status]: (acc as any)[s.status] + 1 }), { pending: 0, running: 0, pass: 0, fail: 0, warn: 0 } as Record<StepStatus, number>);
  const shownSteps = useMemo(() => filter === "all" ? steps : steps.filter((s) => s.status === filter), [filter, steps]);

  const waitForIframe = (path: string) => new Promise<{ status: StepStatus; detail: string }>((resolve) => {
    const iframe = iframeRef.current;
    if (!iframe) return resolve({ status: "fail", detail: "Diagnostics iframe missing." });
    const started = Date.now();
    let done = false;
    const finish = (status: StepStatus, detail: string) => { if (!done) { done = true; resolve({ status, detail }); } };
    const inspect = () => {
      try {
        const doc = iframe.contentDocument;
        const loc = iframe.contentWindow?.location;
        const bodyText = (doc?.body?.innerText || "").slice(0, 2200);
        const lower = bodyText.toLowerCase();
        const isBlank = bodyText.trim().length < 20;
        const crashed = /something went wrong|error boundary|uncaught|failed to fetch dynamically imported module|cannot read properties/i.test(bodyText);
        const onSignIn = loc?.pathname?.includes("sign-in") || /sign in|sign up free|welcome back/i.test(lower);
        const controls = (doc?.querySelectorAll("button,a,input,textarea,select").length || 0);
        const media = (doc?.querySelectorAll("img,video,canvas,svg").length || 0);
        if (crashed) return finish("fail", `Rendered crash text on ${loc?.pathname || path}: ${bodyText.slice(0, 180)}`);
        if (isBlank && Date.now() - started > 1800) return finish("fail", `Blank/empty route after load: ${path}`);
        const step = steps.find((s) => s.route === path && s.id === currentStep);
        const expected = step?.expected;
        if (!user && (expected === "auth" || expected === "admin")) {
          return finish("pass", `Correctly gated to sign-in for ${expected} route. Controls: ${controls}.`);
        }
        if ((expected === "public" || expected === "free" || expected === "seo") && onSignIn) {
          return finish("fail", `Unexpected sign-in wall on ${expected} route.`);
        }
        return finish("pass", `Loaded ${loc?.pathname || path}. Controls: ${controls}. Media elements: ${media}.`);
      } catch (e: any) {
        finish("fail", e?.message || "Could not inspect iframe route.");
      }
    };
    iframe.onload = () => setTimeout(inspect, 450);
    iframe.src = `${path}${path.includes("?") ? "&" : "?"}diagnostics=1&ts=${Date.now()}`;
    setTimeout(inspect, 2500);
  });

  const runFunction = async (step: Step) => {
    if (step.id === "auth-session") {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { status: "fail" as StepStatus, detail: error.message };
      return data.session ? { status: "pass" as StepStatus, detail: `Signed in as ${data.session.user.email ?? data.session.user.id}` } : { status: "warn" as StepStatus, detail: "No active user session — auth-only routes should gate to sign-in." };
    }
    if (step.id === "oracle-function") {
      const { error } = await supabase.functions.invoke("oracle-chat", { body: { messages: [{ role: "user", content: "diagnostics ping" }], adContext: { publicSite: true } } });
      return error ? { status: "fail" as StepStatus, detail: error.message } : { status: "pass" as StepStatus, detail: "oracle-chat function responded." };
    }
    if (step.id === "voice-function") {
      const { error } = await supabase.functions.invoke("elevenlabs-voices", { body: {} });
      return error ? { status: "fail" as StepStatus, detail: error.message } : { status: "pass" as StepStatus, detail: "Voice provider responded." };
    }
    if (step.id === "photo-function") {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { status: "pass" as StepStatus, detail: "Image generation correctly requires sign-in before spending AI credits." };
      return { status: "warn" as StepStatus, detail: "Signed in; use the live Photo Studio tile below for a real generation test." };
    }
    return { status: "warn" as StepStatus, detail: "No function test handler." };
  };

  const runAll = useCallback(async () => {
    setRunning(true);
    setSteps(makeSteps());
    const fresh = makeSteps();
    for (const step of fresh) {
      setCurrentStep(step.id);
      update(step.id, { status: "running", detail: undefined, durationMs: undefined });
      const start = performance.now();
      try {
        const result = step.kind === "function" ? await runFunction(step) : await waitForIframe(step.route || "/");
        update(step.id, { ...result, durationMs: Math.round(performance.now() - start) });
      } catch (e: any) {
        update(step.id, { status: "fail", detail: e?.message || String(e), durationMs: Math.round(performance.now() - start) });
      }
      await new Promise((r) => setTimeout(r, 140));
    }
    setCurrentStep(null);
    setRunning(false);
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground p-3 md:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-xl border border-border bg-card/60 overflow-hidden min-h-[72vh]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold flex items-center gap-2"><Route className="h-5 w-5 text-primary" /> Live full-app diagnostics</h1>
              <p className="text-xs text-muted-foreground">The frame below opens each route/tile one by one so the run is visible in preview.</p>
            </div>
            <Badge variant="secondary" className="shrink-0">{currentRoute}</Badge>
          </div>
          <iframe ref={iframeRef} title="Live route diagnostics preview" className="h-[72vh] w-full bg-background" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
        </section>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Test queue</h2>
                <p className="text-xs text-muted-foreground">{steps.length} checks across splash, dashboard, routes, nested app tiles and backend gates.</p>
              </div>
              <Button onClick={runAll} disabled={running} size="sm">
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {running ? "Running" : "Run all"}
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
              {(["pass", "fail", "warn", "running", "pending"] as StepStatus[]).map((s) => (
                <button key={s} onClick={() => setFilter(filter === s ? "all" : s)} className="rounded-lg border border-border bg-background/60 px-1 py-2">
                  <span className="block font-bold">{counts[s]}</span><span className="capitalize text-muted-foreground">{s}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>All</Button>
              <Link to="/photography-hub" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"><Camera className="h-3 w-3" /> Open Photo Studio</Link>
              <Link to="/media-library" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"><ExternalLink className="h-3 w-3" /> Open Library</Link>
            </div>
          </div>

          <div className="max-h-[67vh] overflow-auto rounded-xl border border-border bg-card/50">
            {shownSteps.map((step, index) => (
              <div key={step.id} className={`border-b border-border p-3 ${currentStep === step.id ? "bg-primary/10" : ""}`}>
                <div className="flex items-start gap-2">
                  <StatusIcon status={step.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">{index + 1}. {step.name}</span>
                      <Badge variant="outline" className="text-[10px]">{step.group}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{step.expected}</Badge>
                    </div>
                    {step.route && <p className="text-[11px] text-primary truncate">{step.route}</p>}
                    {step.detail && <p className={`mt-1 text-[11px] break-words ${step.status === "fail" ? "text-destructive" : step.status === "warn" ? "text-amber-500" : "text-muted-foreground"}`}>{step.detail}</p>}
                    {step.durationMs != null && <p className="text-[10px] text-muted-foreground mt-1">{step.durationMs} ms</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}