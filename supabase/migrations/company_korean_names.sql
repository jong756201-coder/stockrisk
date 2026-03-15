-- 회사명 한국어 번역 캐시
-- Gemini가 번역한 결과를 영구 저장 (심볼당 1회만 번역)
CREATE TABLE IF NOT EXISTS company_korean_names (
    symbol      TEXT PRIMARY KEY,
    korean_name TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_korean_names ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read company_korean_names" ON company_korean_names;
CREATE POLICY "public read company_korean_names"
    ON company_korean_names FOR SELECT USING (true);
