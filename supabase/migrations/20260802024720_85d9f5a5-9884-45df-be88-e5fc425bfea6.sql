-- 1. Prevent ownership reassignment on update
DROP POLICY IF EXISTS "Users can update own events" ON public.calendar_events;
CREATE POLICY "Users can update own events" ON public.calendar_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own call sessions" ON public.call_sessions;
CREATE POLICY "Users update own call sessions" ON public.call_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update diary entries" ON public.diary_entries;
CREATE POLICY "Users can update diary entries" ON public.diary_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Investors cannot fabricate AI trust signals
DROP POLICY IF EXISTS "Authenticated users can submit investment offers" ON public.investment_offers;
CREATE POLICY "Authenticated users can submit investment offers" ON public.investment_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND length(trim(investor_name)) > 0
    AND length(trim(investor_email)) > 0
    AND length(trim(message)) > 0
    AND (offer_amount IS NULL OR length(trim(offer_amount)) > 0)
    AND (ai_score IS NULL OR ai_score = 0)
    AND ai_notes IS NULL
  );

-- 3. Owner-only / internal SECURITY DEFINER functions must not be callable by anon
REVOKE EXECUTE ON FUNCTION public.get_story_writer_document(uuid) FROM anon;