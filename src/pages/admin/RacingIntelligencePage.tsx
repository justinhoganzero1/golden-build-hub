// Oracle Racing Intelligence — owner-only section of the Owner Dashboard.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/racing-hero.jpg";
import { useRacingTable, useRacingRefresh } from "@/components/racing/racingData";
import {
  DashboardScreen, CalendarScreen, DiscoveryScreen, RecommendedScreen, RaceAnalysisScreen, HorsesScreen, PeopleScreen,
  VisionScreen, PredictionsScreen, LabScreen, AccuracyScreen, ControlRoomScreen, ProvidersScreen, SettingsScreen,
} from "@/components/racing/RacingScreens";

const SCREENS = [
  ["recommended", "Recommended Races"], ["dashboard", "Global Dashboard"], ["calendar", "Racing Calendar"], ["discovery", "Race Discovery"],
  ["race", "Race Analysis"], ["horses", "Horse Profiles"], ["people", "Jockeys & Trainers"], ["paddock", "Live Paddock Vision"],
  ["training", "Training Footage"], ["live", "Live Race Vision"], ["predictions", "Predicted Orders"], ["lab", "Prediction Laboratory"],
  ["accuracy", "Accuracy"], ["control", "Control Room"], ["providers", "Data Providers"], ["settings", "Settings"],
] as const;
type ScreenId = typeof SCREENS[number][0];

export default function RacingIntelligencePage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenId>("recommended");
  const [raceId, setRaceId] = useState<string | null>(null);
  const refresh = useRacingRefresh();
  const settingsQ = useRacingTable("settings", () => supabase.from("racing_settings").select("*").eq("id", 1));
  const settings = settingsQ.data?.[0];
  const tz = settings?.display_timezone ?? "Australia/Brisbane";
  const openRace = (id: string) => { setRaceId(id); setScreen("race"); };

  return (
    <div className="racing-theme min-h-screen bg-background text-foreground">
      <header className="relative overflow-hidden border-b border-border">
        <img src={heroImg} alt="Racehorses galloping under gold light" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/owner-dashboard")}><ArrowLeft className="mr-1 h-4 w-4" />Owner Dashboard</Button>
          <h1 className="racing-gold-text mt-4 text-4xl font-black tracking-[0.18em] md:text-6xl">ORACLE RACING</h1>
          <p className="mt-1 text-sm font-semibold tracking-[0.3em] text-primary md:text-base">GLOBAL RACING INTELLIGENCE</p>
          <p className="mt-2 text-sm text-muted-foreground">Seven Intelligence Engines. One Predictive Brain. Global Racing Coverage.</p>
        </div>
      </header>

      <nav className="mx-auto flex max-w-7xl flex-wrap gap-1.5 px-4 py-3" aria-label="Racing screens">
        {SCREENS.map(([id, label]) => (
          <button key={id} onClick={() => setScreen(id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${screen === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/70 text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-7xl px-4 pb-16">
        {screen === "recommended" && <RecommendedScreen tz={tz} onOpenRace={openRace} />}
        {screen === "dashboard" && <DashboardScreen tz={tz} />}
        {screen === "calendar" && <CalendarScreen tz={tz} />}
        {screen === "discovery" && <DiscoveryScreen tz={tz} />}
        {screen === "race" && <RaceAnalysisScreen tz={tz} raceId={raceId} onPick={setRaceId} />}
        {screen === "horses" && <HorsesScreen />}
        {screen === "people" && <PeopleScreen />}
        {screen === "paddock" && <VisionScreen tz={tz} engine="paddock_vision" kinds={["paddock"]} title="Live paddock vision" rules={[
          "Identifies each horse by saddlecloth number, race details and verified reference information.",
          "Separates objective measurements (stride, symmetry, sweating) from AI interpretations.",
          "Never claims to diagnose internal health from ordinary video.",
          "Unclear, missing or wrongly identified footage is marked unavailable.",
        ]} />}
        {screen === "training" && <VisionScreen tz={tz} engine="training_vision" kinds={["training", "trial", "warmup", "owner_upload"]} title="Training footage intelligence" rules={[
          "Only authorised APIs, licensed archives, permitted embeds and your own recordings — never scraped or protected footage.",
          "Records source, date, activity type, identification confidence and footage quality.",
          "Builds a movement profile comparing each horse against itself over time.",
          "If no footage exists, Oracle says so.",
        ]} />}
        {screen === "live" && <VisionScreen tz={tz} engine="race_vision" kinds={["race"]} title="Live race vision" rules={[
          "Tracks starts, position changes, pace and finishing effort where authorised live video exists.",
          "Footage recorded after a race is used only for learning — never as evidence for that race's prediction.",
        ]} />}
        {screen === "predictions" && <PredictionsScreen tz={tz} />}
        {screen === "lab" && <LabScreen />}
        {screen === "accuracy" && <AccuracyScreen />}
        {screen === "control" && <ControlRoomScreen />}
        {screen === "providers" && <ProvidersScreen tz={tz} />}
        {screen === "settings" && settings && <SettingsScreen key={settings.updated_at} settings={settings} tz={tz} onSaved={refresh} />}
      </main>
    </div>
  );
}
