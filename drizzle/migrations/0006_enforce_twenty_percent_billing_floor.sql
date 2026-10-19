CREATE OR REPLACE FUNCTION public.billing_margin_valid(_cost bigint,_fee bigint,_total bigint,_kind text,_status text,_owner boolean) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN _owner OR _kind<>'usage' OR _status<>'settled' THEN true ELSE _cost>=0 AND _fee>=ceil(_cost::numeric*0.20) AND _total>=_cost+_fee END; $$;
REVOKE ALL ON FUNCTION public.billing_margin_valid(bigint,bigint,bigint,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.billing_margin_valid(bigint,bigint,bigint,text,text,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.enforce_billing_margin_floor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_exempt boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='admin') INTO owner_exempt;
 IF NOT public.billing_margin_valid(NEW.provider_cost_micros,NEW.platform_fee_micros,NEW.total_micros,NEW.transaction_type,NEW.status,owner_exempt) THEN RAISE EXCEPTION 'billing_margin_floor: provider cost plus at least 20 percent is required'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_billing_margin_floor() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_twenty_percent_margin BEFORE INSERT OR UPDATE ON public.billing_transactions FOR EACH ROW EXECUTE FUNCTION public.enforce_billing_margin_floor();
CREATE OR REPLACE FUNCTION public.enforce_ai_charge_margin_floor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='admin') AND (NEW.platform_fee_cents<ceil(NEW.provider_cost_cents::numeric*0.20) OR NEW.total_cents<NEW.provider_cost_cents+NEW.platform_fee_cents) THEN RAISE EXCEPTION 'billing_margin_floor: provider cost plus at least 20 percent is required'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_ai_charge_margin_floor() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_ai_twenty_percent_margin BEFORE INSERT OR UPDATE ON public.ai_charges FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_charge_margin_floor();
CREATE OR REPLACE FUNCTION public.run_daily_safety_check() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE checks jsonb := '[]'; n bigint; exemptions bigint; report_id uuid; c record;
BEGIN
 SELECT count(*) INTO n FROM pg_class t JOIN pg_namespace s ON s.oid=t.relnamespace WHERE s.nspname='public' AND t.relkind='r' AND NOT t.relrowsecurity;
 checks := checks || jsonb_build_array(jsonb_build_object('name','Public table row security','status',CASE WHEN n=0 THEN 'pass' ELSE 'fail' END,'count',n));
 SELECT count(*) INTO n FROM public.billing_transactions t WHERE transaction_type='usage' AND status='settled' AND NOT public.billing_margin_valid(provider_cost_micros,platform_fee_micros,total_micros,transaction_type,status,EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=t.user_id AND r.role='admin'));
 SELECT count(*) INTO exemptions FROM public.billing_transactions t WHERE transaction_type='usage' AND status='settled' AND provider_cost_micros>0 AND platform_fee_micros<ceil(provider_cost_micros::numeric*0.20) AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=t.user_id AND r.role='admin');
 checks := checks || jsonb_build_array(jsonb_build_object('name','20 percent billing margin','status',CASE WHEN n=0 THEN 'pass' ELSE 'fail' END,'count',n,'detail',exemptions||' historical owner-exempt records retained; no retrospective wallet changes'));
 SELECT count(*) INTO n FROM public.billing_holds WHERE status='held' AND expires_at<now();
 checks := checks || jsonb_build_array(jsonb_build_object('name','Expired billing reservations need review','status',CASE WHEN n=0 THEN 'pass' ELSE 'warn' END,'count',n));
 SELECT count(*) INTO n FROM public.kindle_deliveries WHERE status IN ('preparing','queued','delayed') AND created_at<now()-interval '1 day';
 checks := checks || jsonb_build_array(jsonb_build_object('name','Kindle delivery needs review','status',CASE WHEN n=0 THEN 'pass' ELSE 'warn' END,'count',n));
 SELECT count(*) INTO n FROM public.call_sessions WHERE direction='outbound' AND twilio_call_sid IS NULL AND created_at<now()-interval '1 hour' AND ended_at IS NULL;
 checks := checks || jsonb_build_array(jsonb_build_object('name','Unconfirmed outbound calls','status',CASE WHEN n=0 THEN 'pass' ELSE 'warn' END,'count',n));
 SELECT count(*) INTO n FROM public.movie_render_jobs WHERE status='running' AND updated_at<now()-interval '1 day';
 checks := checks || jsonb_build_array(jsonb_build_object('name','Stalled movie jobs','status',CASE WHEN n=0 THEN 'pass' ELSE 'warn' END,'count',n));
 SELECT count(*) INTO n FROM public.stripe_event_log WHERE status IN ('error','failed') AND created_at>now()-interval '1 day';
 checks := checks || jsonb_build_array(jsonb_build_object('name','Payment processing failures','status',CASE WHEN n=0 THEN 'pass' ELSE 'warn' END,'count',n));
 INSERT INTO public.system_health_reports(source,checks) VALUES('daily-database',checks) RETURNING id INTO report_id;
 FOR c IN SELECT value FROM jsonb_array_elements(checks) WHERE value->>'status'<>'pass' LOOP
 INSERT INTO public.system_incidents(incident_key,severity,summary) VALUES('daily:'||(c.value->>'name'),c.value->>'status',(c.value->>'name')||': '||(c.value->>'count')) ON CONFLICT (incident_key) WHERE acknowledged_at IS NULL DO NOTHING;
 END LOOP;
 RETURN report_id;
END; $$;
REVOKE ALL ON FUNCTION public.run_daily_safety_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_safety_check() TO service_role;