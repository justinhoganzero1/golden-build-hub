import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Built-in media pointers (*.asset.json) hold site-relative "/__l5e/..." URLs.
// The installed Android / Google TV / iPhone app has no such paths, so each
// pointer's url is passed through resolveAssetUrl at runtime (website unchanged).
const ASSET_PREFIX = "\0native-asset:";
const assetPointerPlugin = () => ({
  name: "native-asset-pointers",
  enforce: "pre" as const,
  async resolveId(this: any, source: string, importer?: string) {
    if (!source.split("?")[0].endsWith(".asset.json") || source.includes("?")) return null;
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    return resolved ? `${ASSET_PREFIX}${resolved.id}.mjs` : null;
  },
  load(this: any, id: string) {
    if (!id.startsWith(ASSET_PREFIX)) return null;
    const file = id.slice(ASSET_PREFIX.length, -".mjs".length);
    this.addWatchFile(file);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const helper = JSON.stringify(path.resolve(__dirname, "src/lib/assetOrigin.ts"));
    return `import { resolveAssetUrl } from ${helper};\nconst asset = ${JSON.stringify(data)};\nif (typeof asset.url === "string") asset.url = resolveAssetUrl(asset.url);\nexport default asset;\n`;
  },
});

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [assetPointerPlugin(), react(), mode === "development" && componentTagger(), mcpPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core", "react-helmet-async"],
  },
  optimizeDeps: {
    // Scan lazy tool pages before serving React. Late dependency discovery
    // can otherwise leave a mounted renderer on an older React chunk hash.
    entries: ["index.html", "src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/test/**"],
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "react-helmet-async", "@radix-ui/react-dropdown-menu"],
  },
});
