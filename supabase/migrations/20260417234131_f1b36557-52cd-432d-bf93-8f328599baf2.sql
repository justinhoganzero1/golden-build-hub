
-- Daily Oracle chat usage counter (server-side enforcement of free tier limit)
CREATE TABLE public.oracle_chat_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.oracle_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.oracle_chat_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.oracle_chat_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.oracle_chat_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_oracle_chat_usage_updated_at
  BEFORE UPDATE ON public.oracle_chat_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_oracle_chat_usage_user_date ON public.oracle_chat_usage(user_id, usage_date);

-- Atomic increment + limit check helper (callable from edge function via service role).
-- Returns the new count and whether the user is now over the limit.
CREATE OR REPLACE FUNCTION public.increment_oracle_usage(_user_id uuid, _limit integer)
RETURNS TABLE (new_count integer, over_limit boolean, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'utc')::date;
  current_count integer;
BEGIN
  INSERT INTO public.oracle_chat_usage (user_id, usage_date, message_count)
  VALUES (_user_id, today, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = public.oracle_chat_usage.message_count + 1,
                updated_at = now()
  RETURNING message_count INTO current_count;

  RETURN QUERY SELECT current_count, current_count > _limit, _limit;
END;
$$;
