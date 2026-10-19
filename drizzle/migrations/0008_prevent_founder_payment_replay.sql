CREATE TABLE public.founder_payment_fulfillments (
 stripe_session_id text PRIMARY KEY,
 user_id uuid NOT NULL,
 founder_number integer,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.founder_payment_fulfillments TO service_role;
ALTER TABLE public.founder_payment_fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages founder fulfillment" ON public.founder_payment_fulfillments FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.founder_payment_fulfillments(stripe_session_id,user_id,founder_number) SELECT stripe_founder_session_id,user_id,founder_number FROM public.memberships WHERE stripe_founder_session_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.claim_founder_seat(_user_id uuid,_session_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _existing integer; _next integer; _fulfilled public.founder_payment_fulfillments%ROWTYPE;
BEGIN
 IF _user_id IS NULL OR NULLIF(_session_id,'') IS NULL THEN RAISE EXCEPTION 'invalid founder payment'; END IF;
 PERFORM pg_advisory_xact_lock(424242);
 SELECT * INTO _fulfilled FROM public.founder_payment_fulfillments WHERE stripe_session_id=_session_id;
 IF FOUND THEN
  IF _fulfilled.user_id<>_user_id THEN RAISE EXCEPTION 'founder payment owner mismatch'; END IF;
  SELECT founder_number INTO _existing FROM public.memberships WHERE user_id=_user_id;
  IF _existing IS DISTINCT FROM _fulfilled.founder_number OR _existing IS NULL THEN RAISE EXCEPTION 'founder payment already consumed'; END IF;
  RETURN _existing;
 END IF;
 SELECT founder_number INTO _existing FROM public.memberships WHERE user_id=_user_id;
 IF _existing IS NOT NULL THEN
  INSERT INTO public.founder_payment_fulfillments(stripe_session_id,user_id,founder_number) VALUES(_session_id,_user_id,_existing);
  RETURN _existing;
 END IF;
 SELECT n INTO _next FROM generate_series(1,500) n WHERE NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.founder_number=n) ORDER BY n LIMIT 1;
 IF _next IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.founder_payment_fulfillments(stripe_session_id,user_id,founder_number) VALUES(_session_id,_user_id,_next);
 INSERT INTO public.memberships(user_id,kind,founder_number,stripe_founder_session_id) VALUES(_user_id,'founder',_next,_session_id)
 ON CONFLICT(user_id) DO UPDATE SET kind='founder',founder_number=_next,stripe_founder_session_id=_session_id,updated_at=now();
 RETURN _next;
END; $$;
REVOKE ALL ON FUNCTION public.claim_founder_seat(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat(uuid,text) TO service_role;