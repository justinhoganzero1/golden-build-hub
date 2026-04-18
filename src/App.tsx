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
// Vaulted: CallControlBanner (Twilio) — disabled until telephony returns.
import PreviewModeBanner from "@/components/PreviewModeBanner";
import SpeedAIController from "@/components/SpeedAIController";
import { registerRoutes } from "@/lib/speedAI";
import NotFound from "./pages/NotFound";
import RequireAuth from "@/components/RequireAuth";

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
  
  "/claims-assistant": () => import("./pages/ClaimsAssistantPage"),
  "/personal-vault": () => import("./pages/PersonalVaultPage"),
  "/claims-app": () => import("./pages/ClaimsAppPage"),
  "/movie-studio-pro": () => import("./pages/MovieStudioProPage"),
  "/ai-chat-companion": () => import("./pages/SeoLandingPage"),
  "/ai-friend": () => import("./pages/SeoLandingPage"),
  "/free-ai-chat": () => import("./pages/SeoLandingPage"),
  "/ai-girlfriend": () => import("./pages/SeoLandingPage"),
  "/ai-boyfriend": () => import("./pages/SeoLandingPage"),
  "/character-ai-alternative": () => import("./pages/SeoLandingPage"),
  "/replika-alternative": () => import("./pages/SeoLandingPage"),
  "/ai-therapist-free": () => import("./pages/SeoLandingPage"),
  "/ai-tutor-free": () => import("./pages/SeoLandingPage"),
  "/free-ai-voice-chat": () => import("./pages/SeoLandingPage"),
  "/ai-app-builder": () => import("./pages/SeoLandingPage"),
  "/ai-image-generator-free": () => import("./pages/SeoLandingPage"),
  "/ai-video-generator": () => import("./pages/SeoLandingPage"),
  "/ai-music-generator": () => import("./pages/SeoLandingPage"),
  "/ai-coder": () => import("./pages/SeoLandingPage"),
  "/ai-3d-app-builder": () => import("./pages/SeoLandingPage"),
  "/ai-name-generator": () => import("./pages/SeoLandingPage"),
  "/ai-tagline-generator": () => import("./pages/SeoLandingPage"),
  "/ai-business-idea-generator": () => import("./pages/SeoLandingPage"),
  "/ai-horoscope-free": () => import("./pages/SeoLandingPage"),
  "/ai-logo-ideas": () => import("./pages/SeoLandingPage"),
  "/ai-companion-app": () => import("./pages/SeoLandingPage"),
  "/replika-vs-solace": () => import("./pages/SeoLandingPage"),
  "/ai-life-coach-free": () => import("./pages/SeoLandingPage"),
  "/ai-elderly-care": () => import("./pages/SeoLandingPage"),
  "/ai-crisis-support": () => import("./pages/SeoLandingPage"),
  "/ai-photo-editor": () => import("./pages/SeoLandingPage"),
  "/free-seo-tools": () => import("./pages/SeoLandingPage"),
  "/ai-email-writer": () => import("./pages/SeoLandingPage"),
  "/store/:accountId": () => import("./pages/StorefrontPage"),
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

const ClaimsAssistantPage = lazy(loaders["/claims-assistant"]);
const PersonalVaultPage = lazy(loaders["/personal-vault"]);
const ClaimsAppPage = lazy(loaders["/claims-app"]);
const MovieStudioProPage = lazy(loaders["/movie-studio-pro"]);
const SeoLandingPage = lazy(() => import("./pages/SeoLandingPage"));
const StorefrontPage = lazy(() => import("./pages/StorefrontPage"));
const AppsStorefrontPage = lazy(() => import("./pages/AppsStorefrontPage"));
const StandaloneAppRoute = lazy(() => import("./pages/StandaloneAppRoute"));
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
              
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<ErrorBoundary pageName="Portal"><PortalLandingPage /></ErrorBoundary>} />
                  <Route path="/welcome" element={<RequireAuth><ErrorBoundary pageName="Welcome"><WelcomePage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/dashboard" element={<RequireAuth><ErrorBoundary pageName="Dashboard"><DashboardPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/mind-hub" element={<RequireAuth><ErrorBoundary pageName="Mind Hub"><MindHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/crisis-hub" element={<RequireAuth><ErrorBoundary pageName="Crisis Hub"><CrisisHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/vault" element={<RequireAuth><ErrorBoundary pageName="Vault"><VaultPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/oracle" element={<RequireAuth><ErrorBoundary pageName="Oracle AI"><OraclePage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/chat-oracle" element={<RequireAuth><ErrorBoundary pageName="Oracle AI"><OraclePage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/ai-studio" element={<RequireAuth><ErrorBoundary pageName="AI Studio"><AIStudioPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/video-editor" element={<RequireAuth><ErrorBoundary pageName="Video Editor"><VideoEditorPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/media-library" element={<RequireAuth><ErrorBoundary pageName="Media Library"><MediaLibraryPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/live-vision" element={<RequireAuth><ErrorBoundary pageName="Live Vision"><LiveVisionPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/voice-studio" element={<RequireAuth><ErrorBoundary pageName="Voice Studio"><VoiceStudioPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/photography-hub" element={<RequireAuth><ErrorBoundary pageName="Photography Hub"><PhotographyHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/personal-assistant" element={<RequireAuth><ErrorBoundary pageName="Personal Assistant"><PersonalAssistantPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/ai-tutor" element={<RequireAuth><ErrorBoundary pageName="AI Tutor"><AITutorPage /></ErrorBoundary></RequireAuth>} />
                  
                  <Route path="/interpreter" element={<RequireAuth><ErrorBoundary pageName="Interpreter"><InterpreterPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/inventor" element={<RequireAuth><ErrorBoundary pageName="Inventor"><InventorPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/calendar" element={<RequireAuth><ErrorBoundary pageName="Calendar"><CalendarPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/alarm-clock" element={<RequireAuth><ErrorBoundary pageName="Alarm Clock"><AlarmClockPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/safety-center" element={<RequireAuth><ErrorBoundary pageName="Safety Center"><SafetyCenterPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/diagnostics" element={<RequireAuth><ErrorBoundary pageName="Diagnostics"><DiagnosticsPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/elderly-care" element={<RequireAuth><ErrorBoundary pageName="Elderly Care"><ElderlyCarePage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/avatar-generator" element={<RequireAuth><ErrorBoundary pageName="Avatar Generator"><AvatarGeneratorPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/professional-hub" element={<RequireAuth><ErrorBoundary pageName="Professional Hub"><ProfessionalHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/family-hub" element={<RequireAuth><ErrorBoundary pageName="Family Hub"><FamilyHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/magic-hub" element={<RequireAuth><ErrorBoundary pageName="Magic Hub"><MagicHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/marketing-hub" element={<RequireAuth><ErrorBoundary pageName="Marketing Hub"><MarketingHubPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/special-occasions" element={<RequireAuth><ErrorBoundary pageName="Special Occasions"><SpecialOccasionsPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/suggestion-box" element={<RequireAuth><ErrorBoundary pageName="Suggestion Box"><SuggestionBoxPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/referral" element={<RequireAuth><ErrorBoundary pageName="Referral"><ReferralPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/subscribe" element={<RequireAuth><ErrorBoundary pageName="Subscribe"><SubscribePage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/app-builder" element={<RequireAuth><ErrorBoundary pageName="App Builder"><AppBuilderPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/pos-learn" element={<RequireAuth><ErrorBoundary pageName="POS Learn"><POSLearnPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/story-writer" element={<RequireAuth><ErrorBoundary pageName="Story Writer"><StoryWriterPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/settings" element={<RequireAuth><ErrorBoundary pageName="Settings"><SettingsPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/profile" element={<RequireAuth><ErrorBoundary pageName="Profile"><ProfilePage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/wallet" element={<RequireAuth><ErrorBoundary pageName="Wallet"><WalletPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/consent" element={<ErrorBoundary pageName="Consent"><ConsentPage /></ErrorBoundary>} />
                  <Route path="/owner-dashboard" element={<RequireAuth><ErrorBoundary pageName="Owner Dashboard"><OwnerDashboardPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/ai-companion" element={<RequireAuth><ErrorBoundary pageName="AI Companion"><AICompanionPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/avatar-gallery" element={<RequireAuth><ErrorBoundary pageName="Avatar Gallery"><AvatarGalleryPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/privacy-policy" element={<ErrorBoundary pageName="Privacy Policy"><PrivacyPolicyPage /></ErrorBoundary>} />
                  <Route path="/terms-of-service" element={<ErrorBoundary pageName="Terms of Service"><TermsOfServicePage /></ErrorBoundary>} />
                  <Route path="/about" element={<ErrorBoundary pageName="About"><AboutPage /></ErrorBoundary>} />
                  <Route path="/investor" element={<RequireAuth><ErrorBoundary pageName="Investor"><InvestorPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/creators" element={<RequireAuth><ErrorBoundary pageName="Creators"><CreatorsPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/sign-in" element={<ErrorBoundary pageName="Sign In"><SignInPage /></ErrorBoundary>} />
                  <Route path="/auth" element={<ErrorBoundary pageName="Sign In"><SignInPage /></ErrorBoundary>} />
                  <Route path="/web-wrapper" element={<RequireAuth><ErrorBoundary pageName="Web Wrapper"><WebWrapperPage /></ErrorBoundary></RequireAuth>} />
                  
                  <Route path="/claims-assistant" element={<RequireAuth><ErrorBoundary pageName="Claims Assistant"><ClaimsAssistantPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/personal-vault" element={<RequireAuth><ErrorBoundary pageName="Personal Vault"><PersonalVaultPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/claims-app" element={<RequireAuth><ErrorBoundary pageName="SOLACE Claims App"><ClaimsAppPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/movie-studio-pro" element={<RequireAuth><ErrorBoundary pageName="Movie Studio Pro"><MovieStudioProPage /></ErrorBoundary></RequireAuth>} />
                  <Route path="/ai-chat-companion" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-friend" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/free-ai-chat" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-girlfriend" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-boyfriend" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/character-ai-alternative" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/replika-alternative" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-therapist-free" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-tutor-free" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/free-ai-voice-chat" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-app-builder" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-image-generator-free" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-video-generator" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-music-generator" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-coder" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-3d-app-builder" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-name-generator" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-tagline-generator" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-business-idea-generator" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-horoscope-free" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-logo-ideas" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-companion-app" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/replika-vs-solace" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-life-coach-free" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-elderly-care" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-crisis-support" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-photo-editor" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/free-seo-tools" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/ai-email-writer" element={<ErrorBoundary pageName="SEO Landing"><SeoLandingPage /></ErrorBoundary>} />
                  <Route path="/store/:accountId" element={<ErrorBoundary pageName="Creator Storefront"><StorefrontPage /></ErrorBoundary>} />
                  <Route path="/apps" element={<ErrorBoundary pageName="Apps Storefront"><AppsStorefrontPage /></ErrorBoundary>} />
                  <Route path="/apps/:slug" element={<RequireAuth><ErrorBoundary pageName="Standalone App"><StandaloneAppRoute /></ErrorBoundary></RequireAuth>} />
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
