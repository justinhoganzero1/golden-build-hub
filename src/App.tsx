import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MindHubPage = lazy(() => import("./pages/MindHubPage"));
const CrisisHubPage = lazy(() => import("./pages/CrisisHubPage"));
const VaultPage = lazy(() => import("./pages/VaultPage"));
const OraclePage = lazy(() => import("./pages/OraclePage"));
const ChatOraclePage = lazy(() => import("./pages/ChatOraclePage"));
const SpecialistsPage = lazy(() => import("./pages/SpecialistsPage"));
const VideoEditorPage = lazy(() => import("./pages/VideoEditorPage"));
const VideoStudioPage = lazy(() => import("./pages/VideoStudioPage"));
const MovieMakerPage = lazy(() => import("./pages/MovieMakerPage"));
const MediaLibraryPage = lazy(() => import("./pages/MediaLibraryPage"));
const LiveVisionPage = lazy(() => import("./pages/LiveVisionPage"));
const VoiceStudioPage = lazy(() => import("./pages/VoiceStudioPage"));
const PhotographyHubPage = lazy(() => import("./pages/PhotographyHubPage"));
const PersonalAssistantPage = lazy(() => import("./pages/PersonalAssistantPage"));
const AITutorPage = lazy(() => import("./pages/AITutorPage"));
const MyAIFriendsPage = lazy(() => import("./pages/MyAIFriendsPage"));
const InterpreterPage = lazy(() => import("./pages/InterpreterPage"));
const InventorPage = lazy(() => import("./pages/InventorPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const AlarmClockPage = lazy(() => import("./pages/AlarmClockPage"));
const SafetyCenterPage = lazy(() => import("./pages/SafetyCenterPage"));
const DiagnosticsPage = lazy(() => import("./pages/DiagnosticsPage"));
const ElderlyCarePage = lazy(() => import("./pages/ElderlyCarePage"));
const HapticEscapePage = lazy(() => import("./pages/HapticEscapePage"));
const AvatarGeneratorPage = lazy(() => import("./pages/AvatarGeneratorPage"));
const ProfessionalHubPage = lazy(() => import("./pages/ProfessionalHubPage"));
const FamilyHubPage = lazy(() => import("./pages/FamilyHubPage"));
const MagicHubPage = lazy(() => import("./pages/MagicHubPage"));
const MarketingHubPage = lazy(() => import("./pages/MarketingHubPage"));
const SpecialOccasionsPage = lazy(() => import("./pages/SpecialOccasionsPage"));
const SuggestionBoxPage = lazy(() => import("./pages/SuggestionBoxPage"));
const CommunityIdeasPage = lazy(() => import("./pages/CommunityIdeasPage"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const SubscribePage = lazy(() => import("./pages/SubscribePage"));
const AppBuilderPage = lazy(() => import("./pages/AppBuilderPage"));
const POSLearnPage = lazy(() => import("./pages/POSLearnPage"));
const POSTradingPage = lazy(() => import("./pages/POSTradingPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const RadarDemoPage = lazy(() => import("./pages/RadarDemoPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ConsentPage = lazy(() => import("./pages/ConsentPage"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/mind-hub" element={<MindHubPage />} />
              <Route path="/crisis-hub" element={<CrisisHubPage />} />
              <Route path="/vault" element={<VaultPage />} />
              <Route path="/oracle" element={<OraclePage />} />
              <Route path="/chat-oracle" element={<ChatOraclePage />} />
              <Route path="/specialists" element={<SpecialistsPage />} />
              <Route path="/video-editor" element={<VideoEditorPage />} />
              <Route path="/video-studio" element={<VideoStudioPage />} />
              <Route path="/movie-maker" element={<MovieMakerPage />} />
              <Route path="/media-library" element={<MediaLibraryPage />} />
              <Route path="/live-vision" element={<LiveVisionPage />} />
              <Route path="/voice-studio" element={<VoiceStudioPage />} />
              <Route path="/photography-hub" element={<PhotographyHubPage />} />
              <Route path="/personal-assistant" element={<PersonalAssistantPage />} />
              <Route path="/ai-tutor" element={<AITutorPage />} />
              <Route path="/my-ai-friends" element={<MyAIFriendsPage />} />
              <Route path="/interpreter" element={<InterpreterPage />} />
              <Route path="/inventor" element={<InventorPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/alarm-clock" element={<AlarmClockPage />} />
              <Route path="/safety-center" element={<SafetyCenterPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
              <Route path="/elderly-care" element={<ElderlyCarePage />} />
              <Route path="/haptic-escape" element={<HapticEscapePage />} />
              <Route path="/avatar-generator" element={<AvatarGeneratorPage />} />
              <Route path="/professional-hub" element={<ProfessionalHubPage />} />
              <Route path="/family-hub" element={<FamilyHubPage />} />
              <Route path="/magic-hub" element={<MagicHubPage />} />
              <Route path="/marketing-hub" element={<MarketingHubPage />} />
              <Route path="/special-occasions" element={<SpecialOccasionsPage />} />
              <Route path="/suggestion-box" element={<SuggestionBoxPage />} />
              <Route path="/community-ideas" element={<CommunityIdeasPage />} />
              <Route path="/referral" element={<ReferralPage />} />
              <Route path="/subscribe" element={<SubscribePage />} />
              <Route path="/app-builder" element={<AppBuilderPage />} />
              <Route path="/pos-learn" element={<POSLearnPage />} />
              <Route path="/pos-trading" element={<POSTradingPage />} />
              <Route path="/install" element={<InstallPage />} />
              <Route path="/radar-demo" element={<RadarDemoPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/consent" element={<ConsentPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
