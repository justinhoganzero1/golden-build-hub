import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mcpPlugin()].filter(Boolean),
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
