-- ==========================================
-- 0. Clean Up (Idempotent run)
-- ==========================================
DROP TABLE IF EXISTS public.admin_review_logs CASCADE;
DROP TABLE IF EXISTS public.similar_case_stats CASCADE;
DROP TABLE IF EXISTS public.extracted_evidence CASCADE;
DROP TABLE IF EXISTS public.news_items CASCADE;
DROP TABLE IF EXISTS public.filings CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.watchlists CASCADE;
DROP TABLE IF EXISTS public.tickers CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

DROP TYPE IF EXISTS role_type CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS evidence_category CASCADE;
DROP TYPE IF EXISTS evidence_status CASCADE;
DROP TYPE IF EXISTS review_action CASCADE;

-- ==========================================
-- 1. Custom Types (Enums)
-- ==========================================
CREATE TYPE role_type AS ENUM ('admin', 'member');
CREATE TYPE event_type AS ENUM ('volume_spike', 'price_gap_up', 'halt_resumed');
CREATE TYPE evidence_category AS ENUM ('clinical_trial', 'partnership', 'delisting_notice', 'delisting_cancelled', 'earnings', 'rumor');
CREATE TYPE evidence_status AS ENUM ('pending_review', 'published', 'hidden_by_admin');
CREATE TYPE review_action AS ENUM ('approved', 'rejected', 'overridden_text');

-- ==========================================
-- 2. Tables
-- ==========================================

-- 2.1 user_profiles
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2.2 user_roles
CREATE TABLE public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_type role_type NOT NULL DEFAULT 'member',
    granted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2.3 tickers
CREATE TABLE public.tickers (
    symbol TEXT PRIMARY KEY,
    company_name TEXT,
    exchange TEXT,
    is_active BOOLEAN DEFAULT true,
    last_price DECIMAL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;

-- 2.4 watchlists
CREATE TABLE public.watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    symbol TEXT REFERENCES public.tickers(symbol) ON DELETE CASCADE NOT NULL,
    added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, symbol)
);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

-- 2.5 events
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT REFERENCES public.tickers(symbol) ON DELETE CASCADE NOT NULL,
    event_type event_type NOT NULL,
    happened_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    metrics_json JSONB
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 2.6 filings
CREATE TABLE public.filings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT REFERENCES public.tickers(symbol) ON DELETE CASCADE NOT NULL,
    form_type TEXT NOT NULL,
    filing_date TIMESTAMPTZ NOT NULL,
    source_url TEXT NOT NULL,
    raw_text_summary TEXT
);
ALTER TABLE public.filings ENABLE ROW LEVEL SECURITY;

-- 2.7 news_items
CREATE TABLE public.news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT REFERENCES public.tickers(symbol) ON DELETE CASCADE NOT NULL,
    publisher TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    source_url TEXT NOT NULL,
    sentiment_score FLOAT
);
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

-- 2.8 extracted_evidence
CREATE TABLE public.extracted_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT REFERENCES public.tickers(symbol) ON DELETE CASCADE NOT NULL,
    category evidence_category NOT NULL,
    headline TEXT NOT NULL,
    missing_or_risk_factors JSONB,
    source_url TEXT NOT NULL,
    status evidence_status DEFAULT 'pending_review' NOT NULL,
    extracted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.extracted_evidence ENABLE ROW LEVEL SECURITY;

-- 2.9 similar_case_stats
CREATE TABLE public.similar_case_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT REFERENCES public.tickers(symbol) ON DELETE CASCADE NOT NULL,
    reference_symbol TEXT NOT NULL,
    similarity_reason TEXT NOT NULL,
    outcome_t_plus_1 FLOAT,
    outcome_t_plus_7 FLOAT,
    outcome_t_plus_30 FLOAT,
    ultimate_outcome_tags JSONB
);
ALTER TABLE public.similar_case_stats ENABLE ROW LEVEL SECURITY;

-- 2.10 admin_review_logs
CREATE TABLE public.admin_review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID REFERENCES public.extracted_evidence(id) ON DELETE SET NULL,
    admin_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    action_taken review_action NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.admin_review_logs ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 3. Row Level Security Policies
-- ==========================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3.1 Public access (Read-only for everyone) for core tables
CREATE POLICY "Public read access to active tickers" ON public.tickers FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access to events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Public read access to published evidence" ON public.extracted_evidence FOR SELECT USING (status = 'published');
CREATE POLICY "Public read access to stats" ON public.similar_case_stats FOR SELECT USING (true);

-- 3.2 Watchlist RLS (Users can only see and edit their own)
CREATE POLICY "Users can view own watchlist" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlist" ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

-- 3.3 Admin access (Full access to all tables)
CREATE POLICY "Admin full access - tickers" ON public.tickers TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - events" ON public.events TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - filings" ON public.filings TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - news_items" ON public.news_items TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - extracted_evidence" ON public.extracted_evidence TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - similar_case_stats" ON public.similar_case_stats TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - admin_review_logs" ON public.admin_review_logs TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - user_roles" ON public.user_roles TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access - user_profiles" ON public.user_profiles TO authenticated USING (public.is_admin());

-- 3.4 Service Role access (Bypasses RLS by default when using service_role key in background workers)


-- ==========================================
-- 4. Auth Triggers 
-- ==========================================
-- Auto create user_profile when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (new.id, new.email);
  
  -- Defaut role assignment
  INSERT INTO public.user_roles (user_id, role_type)
  VALUES (new.id, 'member');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
