-- Phase 1: 구조화 분석 결과 컬럼 추가
-- price_move_analysis 테이블에 events_json 컬럼 추가
ALTER TABLE price_move_analysis
    ADD COLUMN IF NOT EXISTS events_json jsonb;

-- 기존 캐시는 events_json이 null이므로 재분석 트리거됨 (자동)
