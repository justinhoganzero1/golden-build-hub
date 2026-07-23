DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
END $$;

-- Anon read access for tables that expose public content via RLS
GRANT SELECT ON public.user_media TO anon;
GRANT SELECT ON public.featured_photos TO anon;
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT ON public.site_announcements TO anon;
GRANT SELECT ON public.photography_templates TO anon;
GRANT SELECT ON public.global_sound_signatures TO anon;
GRANT SELECT ON public.creator_comments TO anon;
GRANT SELECT ON public.living_gifs TO anon;
GRANT SELECT ON public.investment_offers TO anon;
GRANT INSERT ON public.page_views TO anon;
GRANT INSERT ON public.install_events TO anon;
GRANT INSERT ON public.affiliate_clicks TO anon;
GRANT INSERT ON public.signup_failures TO anon;
GRANT INSERT ON public.inquiry_leads TO anon;
GRANT INSERT ON public.advertiser_inquiries TO anon;

-- Sequences (for inserts that use serial/bigserial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;