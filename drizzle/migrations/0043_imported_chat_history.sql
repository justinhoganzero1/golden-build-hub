CREATE TABLE public.imported_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('chatgpt','gemini')),
  conversation_id text NOT NULL,
  conversation_title text,
  msg_index integer NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (char_length(content) <= 12000),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(conversation_title,'') || ' ' || content)) STORED,
  UNIQUE (user_id, source, conversation_id, msg_index)
);
GRANT SELECT, INSERT, DELETE ON public.imported_chat_messages TO authenticated;
GRANT ALL ON public.imported_chat_messages TO service_role;
ALTER TABLE public.imported_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own imported chats select" ON public.imported_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own imported chats insert" ON public.imported_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own imported chats delete" ON public.imported_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX imported_chat_messages_fts_idx ON public.imported_chat_messages USING gin (fts);
CREATE INDEX imported_chat_messages_user_idx ON public.imported_chat_messages (user_id, source, sent_at);

-- Keyword search over one member's imported chats (any matching word, best matches first).
CREATE OR REPLACE FUNCTION public.search_imported_chats(_user_id uuid, _query text, _limit integer DEFAULT 6)
RETURNS TABLE (source text, conversation_title text, role text, content text, sent_at timestamptz, rank real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q tsquery; qtext text;
BEGIN
  qtext := plainto_tsquery('english', left(coalesce(_query,''), 500))::text;
  IF qtext IS NULL OR qtext = '' THEN RETURN; END IF;
  q := replace(qtext, ' & ', ' | ')::tsquery;
  RETURN QUERY
    SELECT m.source, m.conversation_title, m.role, left(m.content, 600), m.sent_at, ts_rank_cd(m.fts, q) AS rank
    FROM public.imported_chat_messages m
    WHERE m.user_id = _user_id AND m.fts @@ q
    ORDER BY rank DESC, m.sent_at DESC NULLS LAST
    LIMIT least(greatest(coalesce(_limit, 6), 1), 12);
END $$;
REVOKE ALL ON FUNCTION public.search_imported_chats(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_imported_chats(uuid, text, integer) TO service_role;