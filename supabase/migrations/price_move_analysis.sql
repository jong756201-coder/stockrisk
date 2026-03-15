-- 주가 변동 원인 분석 캐시 테이블
-- 8-K 공시를 Gemini로 분석한 결과를 저장 (symbol + filing_date 조합으로 중복 방지)

CREATE TABLE IF NOT EXISTS price_move_analysis (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      text        NOT NULL,
  filing_date text        NOT NULL,        -- "2024-03-15" 형식
  summary_ko  text        NOT NULL,        -- Gemini 한국어 요약
  filing_url  text,                        -- SEC EDGAR 원문 링크
  created_at  timestamptz DEFAULT now(),
  UNIQUE (symbol, filing_date)
);

-- RLS: 읽기는 공개, 쓰기는 service_role만
ALTER TABLE price_move_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON price_move_analysis FOR SELECT USING (true);
