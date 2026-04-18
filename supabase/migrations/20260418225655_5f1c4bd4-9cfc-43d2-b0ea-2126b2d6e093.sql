-- 1) Wallet balances: remove direct user UPDATE; only SECURITY DEFINER funcs may change balance
DROP POLICY IF EXISTS "Users update own wallet" ON public.wallet_balances;
DROP POLICY IF EXISTS "Users delete own wallet" ON public.wallet_balances;

-- Explicit deny for safety (RLS without policy already denies, but make intent clear)
CREATE POLICY "No direct user updates to wallet"
  ON public.wallet_balances FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct user deletes to wallet"
  ON public.wallet_balances FOR DELETE
  TO authenticated
  USING (false);

-- 2) user_claims: protect server-managed fields via trigger
CREATE OR REPLACE FUNCTION public.protect_user_claims_server_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Force server-managed fields to safe defaults on insert
    NEW.ai_draft := NULL;
    NEW.ai_research := '{}'::jsonb;
    NEW.status := COALESCE(NULLIF(NEW.status, ''), 'draft');
    -- Only allow 'draft' on user-initiated insert
    IF NEW.status <> 'draft' AND NOT public.is_owner() THEN
      NEW.status := 'draft';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_owner() THEN
      NEW.ai_draft := OLD.ai_draft;
      NEW.ai_research := OLD.ai_research;
      NEW.status := OLD.status;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_claims_server_fields_trg ON public.user_claims;
CREATE TRIGGER protect_user_claims_server_fields_trg
BEFORE INSERT OR UPDATE ON public.user_claims
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_claims_server_fields();

-- 3) call_sessions: explicit INSERT policy so legitimate client-side creation is documented & allowed
CREATE POLICY "Users insert own call sessions"
  ON public.call_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
