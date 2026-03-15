-- theme_tickers: 관리자가 특정 테마에 수동으로 고정한 티커 목록
CREATE TABLE IF NOT EXISTS public.theme_tickers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id    TEXT NOT NULL,               -- 'oil' | 'cannabis' | 'ai'
    symbol      TEXT NOT NULL,
    added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (theme_id, symbol)
);

ALTER TABLE public.theme_tickers ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read theme_tickers"
    ON public.theme_tickers FOR SELECT USING (true);

-- 관리자만 insert/update/delete
CREATE POLICY "Admin can manage theme_tickers"
    ON public.theme_tickers FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role_type = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role_type = 'admin'
        )
    );
