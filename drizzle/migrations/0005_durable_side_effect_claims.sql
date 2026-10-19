CREATE TABLE public.operation_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, service text NOT NULL, request_key text NOT NULL, state text NOT NULL DEFAULT 'claimed', result jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,service,request_key));
GRANT SELECT ON public.operation_claims TO authenticated;
GRANT ALL ON public.operation_claims TO service_role;
ALTER TABLE public.operation_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_operation_read ON public.operation_claims FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.claim_paid_operation(_user_id uuid,_service text,_request_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claim_id uuid; existing public.operation_claims%ROWTYPE;
BEGIN
 IF _user_id IS NULL OR length(_request_key) NOT BETWEEN 1 AND 200 OR _service NOT IN ('kindle-send','outbound-call') THEN RAISE EXCEPTION 'invalid operation'; END IF;
 INSERT INTO public.operation_claims(user_id,service,request_key) VALUES(_user_id,_service,_request_key) ON CONFLICT DO NOTHING RETURNING id INTO claim_id;
 IF claim_id IS NOT NULL THEN RETURN jsonb_build_object('id',claim_id,'duplicate',false); END IF;
 SELECT * INTO existing FROM public.operation_claims WHERE user_id=_user_id AND service=_service AND request_key=_request_key;
 RETURN jsonb_build_object('id',existing.id,'duplicate',true,'state',existing.state,'result',existing.result);
END; $$;
REVOKE ALL ON FUNCTION public.claim_paid_operation(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paid_operation(uuid,text,text) TO service_role;