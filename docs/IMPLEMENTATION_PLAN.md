# Step-by-Step Implementation Plan
**Date**: 2026-03-12
**Status**: Proposed

## Phase 1: Foundation (DB & Auth)
- **Goal**: Next.js 프로젝트 설정 및 Supabase 기반 마련.
- **Tasks**:
  1. `npx create-next-app@latest` (App Router, Tailwind, TypeScript).
  2. Supabase 프로젝트 생성 및 `auth.users` 연동.
  3. `DOMAIN_MODEL.md`에 정의된 테이블(tickers, events, extracted_evidence, similar_case_stats, watchlists 등) SQL 스키마 작성 및 실행.
  4. 비회원 읽기 권한(Public SELECT) 및 회원 전용 쓰기 권한(RLS) 정책 타겟팅.

## Phase 2: Pipeline Mock & Background Boundary
- **Goal**: 실제 외부 API 연동 전, 프론트엔드가 렌더링할 수 있는 형태의 가짜(Mock) 데이터 파이프라인 구축.
- **Tasks**:
  1. `/api/cron/fetch-events` 라우트 생성 (주가 스파이크 Mock 데이터 삽입).
  2. `/api/cron/extract-evidence` 라우트 생성. (임상 모수 부족, 상폐 취소 엔딩 등 극단적 리스크 요인이 파싱된 형태의 `extracted_evidence` 및 `similar_case_stats` Mock 데이터 삽입).
  3. 데이터 통신을 위한 로직을 별도로 분리해, 향후 파이썬 워커 등으로 떼어내기 쉽도록 `src/services/` 디렉토리에 캡슐화.

## Phase 3: Core Public UX (Movers & Evidence)
- **Goal**: 비회원 대상 30~60초 컷 스캐닝 UX 구현.
- **Tasks**:
  1. **`/` (Home)**: 오늘 가장 핫한 종목/테마 랭킹 대시보드 UI 구현 (ISR 캐싱 적용).
  2. **`/ticker/[symbol]`**: 핵심 화면. 
     - 긍정적인 뉴스 헤드라인 아래에 붉은색 뱃지로 **"리스크 팩터: [임상 모수 3명에 불과]"** 와 같이 객관적 사실을 부각하는 UI/UX.
     - **"과거 유사 사례 (상폐 취소 공시)"** 섹션에서 T+1일 상승 후 T+30일 유상증자(Offering 엔딩) 비율이 시각화된 통계 컴포넌트 구현.
     - 모든 리스크 팩터에 `source_url` 원문 링크 버튼 부착.

## Phase 4: Member Watchlist & Admin
- **Goal**: 반복 방문을 위한 편의 기능 및 파이프라인 제어 백오피스.
- **Tasks**:
  1. **`/login` & `/watchlist`**: Supabase Magic Link 로그인 UI 및 추가된 관심종목 리스트 렌더링. Middleware로 라우트 보호.
  2. **`/admin/evidences`**: 수집된 데이터 중 잘못 파싱되거나 신뢰할 수 없는 소스 발 증거를 관리자가 `hidden_by_admin` 처리하는 토글 UI 구현.

---

### 진행 전 확인 사항
위 4단계 마일스톤 중 **어느 단계를 먼저 코드 레벨로 구현하기 시작할까요?** 
보통 Phase 1(Next.js 세팅 및 DB 스키마 작성)부터 시작하여 뼈대를 잡는 것을 추천합니다.
