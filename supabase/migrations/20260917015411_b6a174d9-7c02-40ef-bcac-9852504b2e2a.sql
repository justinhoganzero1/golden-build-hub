REVOKE EXECUTE ON FUNCTION public.billing_authorize(uuid,text,text,text,text,bigint,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.billing_settle(uuid,bigint,text,jsonb,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_charge_ai(uuid,text,integer,integer,jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_authorize(uuid,text,text,text,text,bigint,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_settle(uuid,bigint,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_charge_ai(uuid,text,integer,integer,jsonb) TO service_role;