-- 미래 이벤트 캐시 테이블 (Gemini 추출 결과)
CREATE TABLE IF NOT EXISTS future_events (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  event_date DATE,
  category TEXT NOT NULL,        -- 'FDA', 'CONFERENCE', 'PRODUCT_LAUNCH', 'OTHER'
  title TEXT NOT NULL,
  source_url TEXT,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_future_events_symbol ON future_events(symbol);
CREATE INDEX IF NOT EXISTS idx_future_events_date ON future_events(event_date);

-- 심볼별 동기화 상태 추적
CREATE TABLE IF NOT EXISTS events_sync_state (
  symbol TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_press_release_date TEXT   -- 마지막으로 처리한 프레스 릴리즈 날짜
);
