import { Suspense } from "react";
import { useParams } from "react-router-dom";
import StandaloneAppShell from "@/components/standalone/StandaloneAppShell";
import { getStandaloneApp } from "@/components/standalone/standaloneApps";
import NotFound from "./NotFound";

/**
 * Single dynamic route handler for /apps/:slug.
 * Looks up the app config and renders its simplified Component
 * inside the shared StandaloneAppShell.
 */
const StandaloneAppRoute = () => {
  const { slug = "" } = useParams();
  const app = getStandaloneApp(slug);
  if (!app) return <NotFound />;
  const Component = app.Component;
  return (
    <StandaloneAppShell
      slug={app.slug}
      title={app.title}
      tagline={app.tagline}
      fullAppPath={app.fullAppPath}
    >
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading {app.title}…</div>}>
        <Component />
      </Suspense>
    </StandaloneAppShell>
  );
};

export default StandaloneAppRoute;
