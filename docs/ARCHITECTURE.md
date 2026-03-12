# Architecture Decision Document (ADD)
**Date**: 2026-03-12
**Status**: Proposed
**Context**: High-risk momentum stock evidence dashboard MVP. Focus on fast repeated visits, structured evidence, and strict legal/safety boundaries. 

## 1. 아키텍처 개요 (Architecture Overview)
- **목표**: 초기 개발 속도(Lean)를 극대화하면서도, 향후 트래픽 증가 및 결제/커뮤니티 확장 시 대규모 재작성(Rewrite)을 피할 수 있는 모듈형 아키텍처.
- **핵심 스택 제안**: 
  - **프론트엔드/백엔드 (웹 앱)**: Next.js (App Router) + TypeScript. 서버 사이드 렌더링(SSR) 및 정적 생성(SSG)을 통해 30~60초 내 빠른 정보 습득 UX 달성.
  - **데이터베이스 및 인증**: PostgreSQL (Supabase 추천). Auth, DB, Row Level Security(RLS)가 통합되어 있어 별도의 복잡한 백엔드 없이 안전한 데이터 접근 제어 가능.
  - **데이터 파이프라인**: Vercel Cron Jobs 또는 별도의 경량 Python/Node.js 워커 기반 스케줄러.

## 2. 시스템 및 앱 경계 (App Boundaries)
앱은 논리적으로 크게 3가지 영역으로 분리되며, MVP 단계에서는 물리적으로 하나의 모노레포(Monorepo) 내에서 관리하되 디렉토리와 경로로 엄격히 분리합니다.

1. **공개 앱 (Public App)**: `src/app/(public)` 
   - 일반 사용자가 접근하는 Movers Feed, 주식 상세 페이지, 증거 패널. 
   - 최대한 정적 캐싱(CDN)을 활용하여 DB 부하를 줄이고 속도를 높임.
2. **회원 앱 (Member App)**: `src/app/(auth)`
   - 회원 가입, 로그인, 그리고 개인 관심종목(Watchlist) 기록을 담당하는 라우트.
3. **관리자 앱 (Admin App)**: `src/app/(admin)`
   - 데이터 노이즈 검수, 증거(Evidence) 카드 승인/거절(Hide) 등을 수행하는 백오피스.
4. **백그라운드 작업 (Background Jobs)**: `src/jobs` 또는 외부 워커
   - 주가 변동 및 뉴스/소셜 데이터를 수집하고 Schema에 맞춰 파싱한 뒤 DB에 적재. 웹 앱의 요청 주기와 무관하게 비동기적으로 동작.

## 3. 회원, 비회원, 관리자 경계 (User Boundaries)
- **비회원 (Guest)**: 마찰 없이 Movers Feed와 각 종목의 구조화된 증거 패널 조회 가능.
- **회원 (Member)**: 회원 가입 후 로그인 시, 개인화된 관심종목(Watchlist) 저장 기능 제공.
- **관리자 (Admin)**: 사전에 승인된 이메일 계정으로만 로그인 가능. 플랫폼 내 데이터 가시성을 제어하는 권한 구비.

## 4. 인증 경계 (Authentication Boundary)
- **인증 툴**: Supabase Auth (Magic Link, OAuth 등 최소한의 마찰을 주는 로그인 방식 적용).
- **경계 제어**:
  - Next.js Middleware를 통해 `/admin/*` 및 관련 API 라우트에 대한 접근을 차단하고, 토큰(JWT)과 Role(`role === 'admin'`)을 검증.
  - 일반 회원 전용 라우트(`/watchlist` 등) 역시 Middleware에서 세션 유무를 검증하여 비로그인 시 로그인 페이지로 리다이렉트.

## 5. 데이터베이스 경계 (Database Boundary)
- **데이터 파편화 방지**: 무결성을 위해 관계형 데이터베이스(PostgreSQL) 사용.
- **보안 경계 (RLS - Row Level Security)**:
  - `evidence` 테이블은 `status = 'published'`인 데이터만 비회원(Public)이 읽을 수(SELECT) 있음.
  - `watchlist` 테이블은 RLS를 통해 현재 로그인한 사용자(auth.uid()) 본인의 데이터에만 접근(CRUD) 가능하도록 설정.
  - 쓰기(INSERT/UPDATE/DELETE) 권한은 Admin Role 또는 서버 사이드 서비스 워커(Service Role)만 가짐 (단, 유저별 Watchlist 데이터는 예외).

## 6. 백그라운드 작업 경계 (Background Jobs Boundary)
- **로직 분리**: 스크래핑, 외부 API 호출, 증거 텍스트 요약(LLM 적용 등) 로직은 웹 서버 요청(Request/Response) 라이프사이클 밖에서 실행.
- **확장성**: 초기에는 웹 앱에 구현된 API Route를 스케줄러(Vercel Cron)가 찌르는(Call) 형태로 구축하지만, 나중에 스크래핑 규모가 커지면 웹 앱 코드 수정 없이 스케줄러만 독립된 마이크로서비스(Python 컨테이너 등)로 떼어내어 DB에 직접 꽂도록(Insert) 분리 가능.

## 7. 미래 확장 가능성 고려 (Future Extensibility)
MVP 범위를 넘어서는 기능들을 무리 없이 수용할 수 있는 기반:
- **결제 (Payments)**:
  - DB에 `users` 및 `subscriptions` 테이블을 선제적으로 설계 공간으로 남겨둠.
  - 향후 Stripe 등을 붙일 때, 웹훅(Webhook)이 결제 상태를 업데이트하면 웹 앱은 단순히 `is_premium` 필드를 확인하여 고급 증거(심층 분석, 추가 데이터 소스) 컴포넌트를 렌더링.
- **커뮤니티 (Community)**:
  - `comments` 또는 `discussions` 테이블을 `stock_symbol`을 외래키(Foreign Key)로 연결되도록 설계 가능.
  - Supabase의 Realtime 기능을 활용하면 소켓(Socket) 서버를 별도로 구축할 필요 없이 실시간 호가 구역의 미니 채팅방 등을 구현 가능.
- **Schema 기반 데이터 추출 (Schema-driven extraction)**:
  - 모든 증거 수집은 Zod 등의 스키마 라이브러리를 통해 검증. 향후 데이터 소스가 엑스(트위터), 텔레그램, SEC 공시 등으로 다양해져도, 최종 DB에 들어가는 포맷은 규격화되므로 프론트엔드 UI 재작성이 불필요함.

## 8. 안전 및 법적 제약 준수 방안
- UI 단에서 어떤 데이터도 "Fraud", "Safe", "Buy/Sell"이라는 하드코딩된 상태나 컬러(초록=안전, 빨강=위험)로 렌더링하지 않음.
- DB Schema 단에서 `evidence_type`을 `['disclosed_info', 'missing_filing', 'historical_analogue', 'listing_status']` 와 같이 철저히 중립적 팩트 기반의 열거형(Enum)으로 제한. 
- 출처(Source URL) 필드를 NOT NULL로 강제하여, 모든 리스크 정보는 원본 링크를 통해서만 제공되도록 아키텍처 레벨에서 강제.
