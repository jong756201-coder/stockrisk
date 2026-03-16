-- 과거 폭등/폭락 이력 캐시 테이블
-- 이벤트는 과거 데이터이므로 불변 → 영구 캐시 (30일마다 갱신으로 신규 이벤트 반영)
create table if not exists price_history_events (
  symbol      text        primary key,
  events_json jsonb       not null default '[]',
  cached_at   timestamptz not null default now()
);

-- RLS 활성화
alter table price_history_events enable row level security;

-- 공개 읽기 허용 (anon key로 읽기 가능)
create policy "public read price_history_events"
  on price_history_events for select
  using (true);

-- 서비스 롤(서버)만 쓰기 가능
create policy "service write price_history_events"
  on price_history_events for all
  using (auth.role() = 'service_role');
