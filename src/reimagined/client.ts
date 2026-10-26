import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Dedicated storage key: IT sign-in never replaces the Oracle account session.
export const reimaginedClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { storageKey: 'reimagined-it-session-v1', persistSession: true, autoRefreshToken: true } },
);