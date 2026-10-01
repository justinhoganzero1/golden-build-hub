CREATE TABLE public.memberships (
  user_id uuid PRIMARY KEY,
  kind text NOT NULL DEFAULT 'trial' CHECK (kind IN ('trial','founder','monthly','none')),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  founder_number integer UNIQUE CHECK (founder_number BETWEEN 1 AND 500),
  monthly_active_until timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_founder_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own membership" ON public.memberships FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all memberships" ON public.memberships FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.founder_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_number integer NOT NULL,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.founder_transfers TO authenticated;
GRANT ALL ON public.founder_transfers TO service_role;
ALTER TABLE public.founder_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read transfers" ON public.founder_transfers FOR SELECT TO authenticated USING (auth.uid() IN (from_user, to_user) OR public.has_role(auth.uid(),'admin'));

-- Backfill existing users with a fresh 3-day trial
INSERT INTO public.memberships (user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.memberships (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  BEGIN
    PERFORM public.grant_signup_welcome(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'grant_signup_welcome failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.public_founder_seats_left()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, 500 - (SELECT count(*) FROM public.memberships WHERE founder_number IS NOT NULL))::int
$$;
GRANT EXECUTE ON FUNCTION public.public_founder_seats_left() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_founder_seat(_user_id uuid, _session_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing int; _next int;
BEGIN
  PERFORM pg_advisory_xact_lock(424242);
  SELECT founder_number INTO _existing FROM public.memberships WHERE user_id = _user_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT n INTO _next FROM generate_series(1,500) n
    WHERE n NOT IN (SELECT founder_number FROM public.memberships WHERE founder_number IS NOT NULL)
    ORDER BY n LIMIT 1;
  IF _next IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.memberships (user_id, kind, founder_number, stripe_founder_session_id)
  VALUES (_user_id, 'founder', _next, _session_id)
  ON CONFLICT (user_id) DO UPDATE SET kind='founder', founder_number=_next, stripe_founder_session_id=_session_id, updated_at=now();
  RETURN _next;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_founder_seat(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_founder_seat(_from uuid, _to uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _num int;
BEGIN
  PERFORM pg_advisory_xact_lock(424242);
  SELECT founder_number INTO _num FROM public.memberships WHERE user_id = _from FOR UPDATE;
  IF _num IS NULL THEN RAISE EXCEPTION 'not a founder'; END IF;
  IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id=_to AND founder_number IS NOT NULL) THEN RAISE EXCEPTION 'buyer already a founder'; END IF;
  UPDATE public.memberships SET founder_number=NULL, kind='none', updated_at=now() WHERE user_id=_from;
  INSERT INTO public.memberships (user_id, kind, founder_number) VALUES (_to,'founder',_num)
  ON CONFLICT (user_id) DO UPDATE SET kind='founder', founder_number=_num, updated_at=now();
  RETURN _num;
END; $$;
REVOKE EXECUTE ON FUNCTION public.transfer_founder_seat(uuid,uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_founder_seat(uuid,uuid) TO service_role;