-- 한글 검색어 → 티커 캐시 테이블
-- Gemini가 한번 변환한 결과를 영구 저장
CREATE TABLE IF NOT EXISTS korean_aliases (
    id          SERIAL PRIMARY KEY,
    korean_query TEXT NOT NULL,          -- 사용자 입력 원문 (트리밍 + 소문자)
    symbol      TEXT NOT NULL,           -- 매핑된 티커
    company_name TEXT,                   -- 영문 회사명
    exchange    TEXT,                    -- NASDAQ / NYSE / OTC 등
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 검색 성능용 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS korean_aliases_query_idx ON korean_aliases (korean_query);
CREATE INDEX IF NOT EXISTS korean_aliases_symbol_idx ON korean_aliases (symbol);

-- Public read (앱에서 읽기 전용)
ALTER TABLE korean_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read korean_aliases" ON korean_aliases;
CREATE POLICY "public read korean_aliases"
    ON korean_aliases FOR SELECT USING (true);
