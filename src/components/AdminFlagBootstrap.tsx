// Mounted once at app root. Calls useIsAdmin so the global window flag
// (consumed by moderatePrompt and other non-React modules) reflects the
// signed-in user's admin status on every route — not only routes that
// already use the hook themselves.
import { useIsAdmin } from "@/hooks/useIsAdmin";
export default function AdminFlagBootstrap() {
  useIsAdmin();
  return null;
}
