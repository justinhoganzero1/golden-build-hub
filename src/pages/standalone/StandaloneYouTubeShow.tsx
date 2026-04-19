import YouTubeShowStudioPage from "@/pages/YouTubeShowStudioPage";

/**
 * Standalone wrapper for the YouTube Show Studio.
 * The full page already enforces PaywallGate + saves all generated
 * media to the user library, so it works as-is inside the standalone shell.
 */
const StandaloneYouTubeShow = () => <YouTubeShowStudioPage />;

export default StandaloneYouTubeShow;
