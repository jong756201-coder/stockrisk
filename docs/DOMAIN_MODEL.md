# Domain Model (ERD)
**Date**: 2026-03-12
**Status**: Proposed
**Context**: Database schema design based on the approved lean architecture. Focuses on structured evidence, fast access, and future extensibility for members and admins.

## 1. ERD Summary (Entity Relationship Overview)

- `users` (Supabase Auth) -> `user_roles` (1:1) : 사용자 인가 권한 매핑
- `users` -> `watchlists` (1:N) : 회원별 관심 종목
- `tickers` -> `watchlists` (1:N)
- `tickers` -> `events` (1:N) : 시세 분출(Spike), 거래량 급등 등 핵심 모멘텀 트리거
- `tickers` -> `filings` (1:N) : SEC 공시 등 공식 문서
- `tickers` -> `news_items` (1:N) : 외부 뉴스 기사 원본 로그
- `tickers` -> `extracted_evidence` (1:N) : 위 raw 데이터(events, filings, news)에서 정제된 사용자 노출용 '핵심 근거 카드'
- `tickers` -> `similar_case_stats` (1:N) : 과거 유사 급등 패턴 통계 
- `extracted_evidence` -> `admin_review_logs` (1:N) : 관리자의 필터링, Hide 처리 이력

## 2. Table Specifications

### 2.1 Users & Roles Boundary
인증은 Supabase의 자체 `auth.users`를 활용하되, 비즈니스 로직용 프로필과 역할(Role)을 퍼블릭 테이블로 분리합니다.

* **`user_profiles`** (Extends `auth.users`)
  * `id` (UUID, PK, FK to `auth.users.id`)
  * `email` (String, Unique)
  * `created_at` (Timestamp)
  * `updated_at` (Timestamp)

* **`user_roles`** (RBAC)
  * `user_id` (UUID, PK, FK to `user_profiles.id`)
  * `role_type` (Enum: `admin`, `member`)
  * `granted_at` (Timestamp)

### 2.2 Watchlist (Member Extension)
향후 회원이 급등주를 개인 포트폴리오/관심종목에 담아두는 기능의 자리표시자(Placeholder). (MVP 대상)

* **`watchlists`** 
  * `id` (UUID, PK)
  * `user_id` (UUID, FK to `user_profiles.id`, Index)
  * `symbol` (String, FK to `tickers.symbol`, Index)
  * `added_at` (Timestamp)
  * *Constraint*: Unique (`user_id`, `symbol`)

### 2.3 Core Domain: Tickers & Events
모멘텀 주식의 메타데이터와 시스템이 감지한 "왜 지금 이 종목을 봐야하는가?"에 대한 트리거.

* **`tickers`**
  * `symbol` (String, PK) - e.g., "MSTR", "SMCI"
  * `company_name` (String)
  * `exchange` (String)
  * `is_active` (Boolean) - 상장 폐지/거래 정지 여부
  * `last_price` (Decimal, Nullable) - 배치 업데이트용 캐시
  * `updated_at` (Timestamp)

* **`events`** (시스템이 감지한 정량적 스파이크)
  * `id` (UUID, PK)
  * `symbol` (String, FK to `tickers.symbol`, Index)
  * `event_type` (Enum: `volume_spike`, `price_gap_up`, `halt_resumed`)
  * `happened_at` (Timestamp)
  * `metrics_json` (JSONB) - e.g., `{"prev_vol": 10000, "curr_vol": 500000}`

### 2.4 Evidence Sources (Raw Data)
백그라운드 워커가 긁어오는 원본 데이터. (Raw 형태이므로 사용자에게 직접 노출 전 가공 필요)

* **`filings`** (SEC 등 공시)
  * `id` (UUID, PK)
  * `symbol` (String, FK to `tickers.symbol`, Index)
  * `form_type` (String) - e.g., "8-K", "S-1", "10-Q"
  * `filing_date` (Timestamp)
  * `source_url` (String, Required)
  * `raw_text_summary` (Text)

* **`news_items`** (외부 뉴스 및 소셜 데이터)
  * `id` (UUID, PK)
  * `symbol` (String, FK to `tickers.symbol`, Index)
  * `publisher` (String) - e.g., "Bloomberg", "X(Twitter)"
  * `title` (String)
  * `published_at` (Timestamp)
  * `source_url` (String, Required)
  * `sentiment_score` (Float, Nullable) - 내부 필터링 참고용

### 2.5 Extracted Evidence (Core UX)
Raw 데이터를 바탕으로 가공된 최종 "근거 카드". AI가 가치 판단을 하는 것이 아니라, 긍정적인 뉴스 이면에 숨겨진 **객관적인 사실(모수 부족, 출처 불분명, 계약자 실체 없음 등)을 구조화**하여 보여줍니다.

* **`extracted_evidence`**
  * `id` (UUID, PK)
  * `symbol` (String, FK to `tickers.symbol`, Index)
  * `category` (Enum: `clinical_trial`, `partnership`, `delisting_notice`, `delisting_cancelled`, `earnings`, `rumor`)
  * `headline` (String) - 한 줄 뉴스 요약 (주가 상승의 원인이 된 표면적 이유)
  * `missing_or_risk_factors` (JSONB) - 파싱된 리스크 요인 
    * e.g., `["임상 모수 3명에 불과", "계약 상대방 기업 페이퍼컴퍼니 의혹", "재무제표상 현금 고갈로 인한 유상증자(Offering) 임박"]`
  * `source_url` (String, Required) - 리스크 파악의 근거가 되는 원본 링크 강제
  * `status` (Enum: `pending_review`, `published`, `hidden_by_admin`)
  * `extracted_at` (Timestamp)

### 2.6 Analytics & Curation 
현재 급등 사유(Evidence)와 유사한 과거 사례들이 T+1, T+7, T+30일에 어떤 결말(예: 유상증자 엔딩, 상장폐지 엔딩)을 맞이했는지 통계로 제공하여 투기적 합리성을 높입니다.

* **`similar_case_stats`** (과거 유사 패턴 아카이브)
  * `id` (UUID, PK)
  * `symbol` (String, FK to `tickers.symbol`)
  * `reference_symbol` (String) - 과거 유사한 호재 패턴으로 펌핑되었던 종목 기호
  * `similarity_reason` (String) - e.g., "상장폐지 취소 공시 후 급등", "모수 부족한 임상 발표 후 급등"
  * `outcome_t_plus_1` (Float) - 기준일(T) 대비 T+1일 종가 수익률(%)
  * `outcome_t_plus_7` (Float) - 기준일(T) 대비 T+7일 종가 수익률(%)
  * `outcome_t_plus_30` (Float) - 기준일(T) 대비 T+30일 종가 수익률(%)
  * `ultimate_outcome_tags` (JSONB) - e.g., `["offering", "delisted", "sustained_pump"]`

* **`admin_review_logs`** (관리자 검수 이력 로깅)
  * `id` (UUID, PK)
  * `evidence_id` (UUID, FK to `extracted_evidence.id`, Nullable)
  * `admin_user_id` (UUID, FK to `user_profiles.id`)
  * `action_taken` (Enum: `approved`, `rejected`, `overridden_text`)
  * `reason` (Text, Nullable) - e.g., "Fake news from unreliable X account"
  * `created_at` (Timestamp)
