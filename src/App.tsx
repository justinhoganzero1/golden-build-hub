import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { MuteProvider } from "@/contexts/MuteContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import MasterMuteButton from "@/components/MasterMuteButton";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MindHubPage = lazy(() => import("./pages/MindHubPage"));
const CrisisHubPage = lazy(() => import("./pages/CrisisHubPage"));
const VaultPage = lazy(() => import("./pages/VaultPage"));
const OraclePage = lazy(() => import("./pages/OraclePage"));

const AIStudioPage = lazy(() => import("./pages/AIStudioPage"));
const VideoEditorPage = lazy(() => import("./pages/VideoEditorPage"));


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

const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const SubscribePage = lazy(() => import("./pages/SubscribePage"));
const AppBuilderPage = lazy(() => import("./pages/AppBuilderPage"));
const POSLearnPage = lazy(() => import("./pages/POSLearnPage"));

const InstallPage = lazy(() => import("./pages/InstallPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ConsentPage = lazy(() => import("./pages/ConsentPage"));
const OwnerDashboardPage = lazy(() => import("./pages/OwnerDashboardPage"));
const AICompanionPage = lazy(() => import("./pages/AICompanionPage"));
const AvatarGalleryPage = lazy(() => import("./pages/AvatarGalleryPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const InvestorPage = lazy(() => import("./pages/InvestorPage"));
const CreatorsPage = lazy(() => import("./pages/CreatorsPage"));
const SignInPage = lazy(() => import("./components/SignInPage"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary pageName="App Root">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MuteProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <OfflineBanner />
            <MasterMuteButton />
          <BrowserRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<ErrorBoundary pageName="Dashboard"><DashboardPage /></ErrorBoundary>} />
                <Route path="/mind-hub" element={<ErrorBoundary pageName="Mind Hub"><MindHubPage /></ErrorBoundary>} />
                <Route path="/crisis-hub" element={<ErrorBoundary pageName="Crisis Hub"><CrisisHubPage /></ErrorBoundary>} />
                <Route path="/vault" element={<ErrorBoundary pageName="Vault"><VaultPage /></ErrorBoundary>} />
                <Route path="/oracle" element={<ErrorBoundary pageName="Oracle AI"><OraclePage /></ErrorBoundary>} />
                <Route path="/chat-oracle" element={<ErrorBoundary pageName="Oracle AI"><OraclePage /></ErrorBoundary>} />
                <Route path="/ai-studio" element={<ErrorBoundary pageName="AI Studio"><AIStudioPage /></ErrorBoundary>} />
                <Route path="/video-editor" element={<ErrorBoundary pageName="Video Editor"><VideoEditorPage /></ErrorBoundary>} />
                
                
                <Route path="/media-library" element={<ErrorBoundary pageName="Media Library"><MediaLibraryPage /></ErrorBoundary>} />
                <Route path="/live-vision" element={<ErrorBoundary pageName="Live Vision"><LiveVisionPage /></ErrorBoundary>} />
                <Route path="/voice-studio" element={<ErrorBoundary pageName="Voice Studio"><VoiceStudioPage /></ErrorBoundary>} />
                <Route path="/photography-hub" element={<ErrorBoundary pageName="Photography Hub"><PhotographyHubPage /></ErrorBoundary>} />
                <Route path="/personal-assistant" element={<ErrorBoundary pageName="Personal Assistant"><PersonalAssistantPage /></ErrorBoundary>} />
                <Route path="/ai-tutor" element={<ErrorBoundary pageName="AI Tutor"><AITutorPage /></ErrorBoundary>} />
                <Route path="/my-ai-friends" element={<ErrorBoundary pageName="My AI Friends"><MyAIFriendsPage /></ErrorBoundary>} />
                <Route path="/interpreter" element={<ErrorBoundary pageName="Interpreter"><InterpreterPage /></ErrorBoundary>} />
                <Route path="/inventor" element={<ErrorBoundary pageName="Inventor"><InventorPage /></ErrorBoundary>} />
                <Route path="/calendar" element={<ErrorBoundary pageName="Calendar"><CalendarPage /></ErrorBoundary>} />
                <Route path="/alarm-clock" element={<ErrorBoundary pageName="Alarm Clock"><AlarmClockPage /></ErrorBoundary>} />
                <Route path="/safety-center" element={<ErrorBoundary pageName="Safety Center"><SafetyCenterPage /></ErrorBoundary>} />
                <Route path="/diagnostics" element={<ErrorBoundary pageName="Diagnostics"><DiagnosticsPage /></ErrorBoundary>} />
                <Route path="/elderly-care" element={<ErrorBoundary pageName="Elderly Care"><ElderlyCarePage /></ErrorBoundary>} />
                <Route path="/haptic-escape" element={<ErrorBoundary pageName="Haptic Escape"><HapticEscapePage /></ErrorBoundary>} />
                <Route path="/avatar-generator" element={<ErrorBoundary pageName="Avatar Generator"><AvatarGeneratorPage /></ErrorBoundary>} />
                <Route path="/professional-hub" element={<ErrorBoundary pageName="Professional Hub"><ProfessionalHubPage /></ErrorBoundary>} />
                <Route path="/family-hub" element={<ErrorBoundary pageName="Family Hub"><FamilyHubPage /></ErrorBoundary>} />
                <Route path="/magic-hub" element={<ErrorBoundary pageName="Magic Hub"><MagicHubPage /></ErrorBoundary>} />
                <Route path="/marketing-hub" element={<ErrorBoundary pageName="Marketing Hub"><MarketingHubPage /></ErrorBoundary>} />
                <Route path="/special-occasions" element={<ErrorBoundary pageName="Special Occasions"><SpecialOccasionsPage /></ErrorBoundary>} />
                <Route path="/suggestion-box" element={<ErrorBoundary pageName="Suggestion Box"><SuggestionBoxPage /></ErrorBoundary>} />
                
                <Route path="/referral" element={<ErrorBoundary pageName="Referral"><ReferralPage /></ErrorBoundary>} />
                <Route path="/subscribe" element={<ErrorBoundary pageName="Subscribe"><SubscribePage /></ErrorBoundary>} />
                <Route path="/app-builder" element={<ErrorBoundary pageName="App Builder"><AppBuilderPage /></ErrorBoundary>} />
                <Route path="/pos-learn" element={<ErrorBoundary pageName="POS Learn"><POSLearnPage /></ErrorBoundary>} />
                
                <Route path="/install" element={<ErrorBoundary pageName="Install"><InstallPage /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary pageName="Settings"><SettingsPage /></ErrorBoundary>} />
                <Route path="/profile" element={<ErrorBoundary pageName="Profile"><ProfilePage /></ErrorBoundary>} />
                <Route path="/wallet" element={<ErrorBoundary pageName="Wallet"><WalletPage /></ErrorBoundary>} />
                <Route path="/consent" element={<ErrorBoundary pageName="Consent"><ConsentPage /></ErrorBoundary>} />
                <Route path="/owner-dashboard" element={<ErrorBoundary pageName="Owner Dashboard"><OwnerDashboardPage /></ErrorBoundary>} />
                <Route path="/ai-companion" element={<ErrorBoundary pageName="AI Companion"><AICompanionPage /></ErrorBoundary>} />
                <Route path="/avatar-gallery" element={<ErrorBoundary pageName="Avatar Gallery"><AvatarGalleryPage /></ErrorBoundary>} />
                <Route path="/privacy-policy" element={<ErrorBoundary pageName="Privacy Policy"><PrivacyPolicyPage /></ErrorBoundary>} />
                <Route path="/terms-of-service" element={<ErrorBoundary pageName="Terms of Service"><TermsOfServicePage /></ErrorBoundary>} />
                <Route path="/about" element={<ErrorBoundary pageName="About"><AboutPage /></ErrorBoundary>} />
                <Route path="/investor" element={<ErrorBoundary pageName="Investor"><InvestorPage /></ErrorBoundary>} />
                <Route path="/creators" element={<ErrorBoundary pageName="Creators"><CreatorsPage /></ErrorBoundary>} />
                <Route path="/sign-in" element={<ErrorBoundary pageName="Sign In"><SignInPage /></ErrorBoundary>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </MuteProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
