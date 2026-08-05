DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memories" ON public.oracle_memories;
CREATE POLICY "Users can update own memories" ON public.oracle_memories FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own avatars" ON public.user_avatars;
CREATE POLICY "Users can update own avatars" ON public.user_avatars FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voices" ON public.saved_voices;
CREATE POLICY "Users can update own voices" ON public.saved_voices FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON public.oracle_chat_usage;
CREATE POLICY "Users can update own usage" ON public.oracle_chat_usage FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ad prefs" ON public.user_ad_preferences;
CREATE POLICY "Users can update own ad prefs" ON public.user_ad_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);