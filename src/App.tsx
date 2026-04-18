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
import CallControlBanner from "@/components/CallControlBanner";
import PreviewModeBanner from "@/components/PreviewModeBanner";
import SpeedAIController from "@/components/SpeedAIController";
import { registerRoutes } from "@/lib/speedAI";
import NotFound from "./pages/NotFound";

// Centralized loader factory so Speed AI can prefetch the same chunks React.lazy uses.
const loaders = {
  "/": () => import("./pages/PortalLandingPage"),
  "/welcome": () => import("./pages/WelcomePage"),
  "/dashboard": () => import("./pages/DashboardPage"),
  "/mind-hub": () => import("./pages/MindHubPage"),
  "/crisis-hub": () => import("./pages/CrisisHubPage"),
  "/vault": () => import("./pages/VaultPage"),
  "/oracle": () => import("./pages/OraclePage"),
  "/ai-studio": () => import("./pages/AIStudioPage"),
  "/video-editor": () => import("./pages/VideoEditorPage"),
  "/media-library": () => import("./pages/MediaLibraryPage"),
  "/live-vision": () => import("./pages/LiveVisionPage"),
  "/voice-studio": () => import("./pages/VoiceStudioPage"),
  "/photography-hub": () => import("./pages/PhotographyHubPage"),
  "/personal-assistant": () => import("./pages/PersonalAssistantPage"),
  "/ai-tutor": () => import("./pages/AITutorPage"),
  "/interpreter": () => import("./pages/InterpreterPage"),
  "/inventor": () => import("./pages/InventorPage"),
  "/calendar": () => import("./pages/CalendarPage"),
  "/alarm-clock": () => import("./pages/AlarmClockPage"),
  "/safety-center": () => import("./pages/SafetyCenterPage"),
  "/diagnostics": () => import("./pages/DiagnosticsPage"),
  "/elderly-care": () => import("./pages/ElderlyCarePage"),
  "/avatar-generator": () => import("./pages/AvatarGeneratorPage"),
  "/professional-hub": () => import("./pages/ProfessionalHubPage"),
  "/family-hub": () => import("./pages/FamilyHubPage"),
  "/magic-hub": () => import("./pages/MagicHubPage"),
  "/marketing-hub": () => import("./pages/MarketingHubPage"),
  "/special-occasions": () => import("./pages/SpecialOccasionsPage"),
  "/suggestion-box": () => import("./pages/SuggestionBoxPage"),
  "/referral": () => import("./pages/ReferralPage"),
  "/subscribe": () => import("./pages/SubscribePage"),
  "/app-builder": () => import("./pages/AppBuilderPage"),
  "/pos-learn": () => import("./pages/POSLearnPage"),
  "/story-writer": () => import("./pages/StoryWriterPage"),
  "/settings": () => import("./pages/SettingsPage"),
  "/profile": () => import("./pages/ProfilePage"),
  "/wallet": () => import("./pages/WalletPage"),
  "/consent": () => import("./pages/ConsentPage"),
  "/owner-dashboard": () => import("./pages/OwnerDashboardPage"),
  "/ai-companion": () => import("./pages/AICompanionPage"),
  "/avatar-gallery": () => import("./pages/AvatarGalleryPage"),
  "/privacy-policy": () => import("./pages/PrivacyPolicyPage"),
  "/terms-of-service": () => import("./pages/TermsOfServicePage"),
  "/about": () => import("./pages/AboutPage"),
  "/investor": () => import("./pages/InvestorPage"),
  "/creators": () => import("./pages/CreatorsPage"),
  "/sign-in": () => import("./components/SignInPage"),
  "/web-wrapper": () => import("./pages/WebWrapperPage"),
  "/assistant-phone": () => import("./pages/AssistantPhonePage"),
  "/claims-assistant": () => import("./pages/ClaimsAssistantPage"),
} as const;

registerRoutes(loaders);

const PortalLandingPage = lazy(loaders["/"]);
const WelcomePage = lazy(loaders["/welcome"]);
const DashboardPage = lazy(loaders["/dashboard"]);
const MindHubPage = lazy(loaders["/mind-hub"]);
const CrisisHubPage = lazy(loaders["/crisis-hub"]);
const VaultPage = lazy(loaders["/vault"]);
const OraclePage = lazy(loaders["/oracle"]);
const AIStudioPage = lazy(loaders["/ai-studio"]);
const VideoEditorPage = lazy(loaders["/video-editor"]);
const MediaLibraryPage = lazy(loaders["/media-library"]);
const LiveVisionPage = lazy(loaders["/live-vision"]);
const VoiceStudioPage = lazy(loaders["/voice-studio"]);
const PhotographyHubPage = lazy(loaders["/photography-hub"]);
const PersonalAssistantPage = lazy(loaders["/personal-assistant"]);
const AITutorPage = lazy(loaders["/ai-tutor"]);
const InterpreterPage = lazy(loaders["/interpreter"]);
const InventorPage = lazy(loaders["/inventor"]);
const CalendarPage = lazy(loaders["/calendar"]);
const AlarmClockPage = lazy(loaders["/alarm-clock"]);
const SafetyCenterPage = lazy(loaders["/safety-center"]);
const DiagnosticsPage = lazy(loaders["/diagnostics"]);
const ElderlyCarePage = lazy(loaders["/elderly-care"]);
const AvatarGeneratorPage = lazy(loaders["/avatar-generator"]);
const ProfessionalHubPage = lazy(loaders["/professional-hub"]);
const FamilyHubPage = lazy(loaders["/family-hub"]);
const MagicHubPage = lazy(loaders["/magic-hub"]);
const MarketingHubPage = lazy(loaders["/marketing-hub"]);
const SpecialOccasionsPage = lazy(loaders["/special-occasions"]);
const SuggestionBoxPage = lazy(loaders["/suggestion-box"]);
const ReferralPage = lazy(loaders["/referral"]);
const SubscribePage = lazy(loaders["/subscribe"]);
const AppBuilderPage = lazy(loaders["/app-builder"]);
const POSLearnPage = lazy(loaders["/pos-learn"]);
const StoryWriterPage = lazy(loaders["/story-writer"]);
const SettingsPage = lazy(loaders["/settings"]);
const ProfilePage = lazy(loaders["/profile"]);
const WalletPage = lazy(loaders["/wallet"]);
const ConsentPage = lazy(loaders["/consent"]);
const OwnerDashboardPage = lazy(loaders["/owner-dashboard"]);
const AICompanionPage = lazy(loaders["/ai-companion"]);
const AvatarGalleryPage = lazy(loaders["/avatar-gallery"]);
const PrivacyPolicyPage = lazy(loaders["/privacy-policy"]);
const TermsOfServicePage = lazy(loaders["/terms-of-service"]);
const AboutPage = lazy(loaders["/about"]);
const InvestorPage = lazy(loaders["/investor"]);
const CreatorsPage = lazy(loaders["/creators"]);
const SignInPage = lazy(loaders["/sign-in"]);
const WebWrapperPage = lazy(loaders["/web-wrapper"]);
const AssistantPhonePage = lazy(loaders["/assistant-phone"]);
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
            <BrowserRouter>
              <SpeedAIController />
              <Toaster />
              <Sonner />
              <OfflineBanner />
              <PreviewModeBanner />
              <MasterMuteButton />
              <CallControlBanner />
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<ErrorBoundary pageName="Portal"><PortalLandingPage /></ErrorBoundary>} />
                  <Route path="/welcome" element={<ErrorBoundary pageName="Welcome"><WelcomePage /></ErrorBoundary>} />
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
                  
                  <Route path="/interpreter" element={<ErrorBoundary pageName="Interpreter"><InterpreterPage /></ErrorBoundary>} />
                  <Route path="/inventor" element={<ErrorBoundary pageName="Inventor"><InventorPage /></ErrorBoundary>} />
                  <Route path="/calendar" element={<ErrorBoundary pageName="Calendar"><CalendarPage /></ErrorBoundary>} />
                  <Route path="/alarm-clock" element={<ErrorBoundary pageName="Alarm Clock"><AlarmClockPage /></ErrorBoundary>} />
                  <Route path="/safety-center" element={<ErrorBoundary pageName="Safety Center"><SafetyCenterPage /></ErrorBoundary>} />
                  <Route path="/diagnostics" element={<ErrorBoundary pageName="Diagnostics"><DiagnosticsPage /></ErrorBoundary>} />
                  <Route path="/elderly-care" element={<ErrorBoundary pageName="Elderly Care"><ElderlyCarePage /></ErrorBoundary>} />
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
                  <Route path="/story-writer" element={<ErrorBoundary pageName="Story Writer"><StoryWriterPage /></ErrorBoundary>} />
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
                  <Route path="/web-wrapper" element={<ErrorBoundary pageName="Web Wrapper"><WebWrapperPage /></ErrorBoundary>} />
                  <Route path="/assistant-phone" element={<ErrorBoundary pageName="Assistant Phone"><AssistantPhonePage /></ErrorBoundary>} />
                  <Route path="/claims-assistant" element={<ErrorBoundary pageName="Claims Assistant"><ClaimsAssistantPage /></ErrorBoundary>} />
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
