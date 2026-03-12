# App Routes & Boundaries
**Date**: 2026-03-12
**Status**: Proposed
**Context**: Next.js App Router structure reflecting the Lean MVP and strictly separating public web, authenticated app, and admin dashboard while leaving room for future payments and community layers.

## 1. Directory Structure (App Router)

```text
src/
└── app/
    ├── (public)/                 # [Public Web] 마찰이 없는 비회원 접근 영역 (캐싱 최적화 중심)
    │   ├── page.tsx              # '/' - 대시보드 (오늘의 테마, 모멘텀 급등주 요약 리스트)
    │   └── ticker/
    │       └── [symbol]/         # '/ticker/MSTR' - 종목 상세 (주가 차트 + 객관적 리스크/근거 카드)
    │
    ├── (auth)/                   # [Authenticated App] 회원 전용 영역 (Middleware로 세션 및 Role 보호)
    │   ├── login/
    │   │   └── page.tsx          # '/login' - Supabase Magic Link / 소셜 로그인
    │   ├── watchlist/
    │   │   └── page.tsx          # '/watchlist' - 내 관심종목 기반의 타임라인
    │   ├── premium/              # [Future Expansion] 향후 결제 모듈 자리표시자
    │   │   └── page.tsx          # '/premium' - 유료 구독(Stripe)으로 고급 통계 등 언락 안내 (현재 UI만)
    │   └── community/            # [Future Expansion] 향후 커뮤니티 모듈 자리표시자
    │       └── [symbol]/         # '/community/MSTR' - 특정 종목의 토론장 (현재 비활성화/MVP 제외)
    │
    ├── (admin)/                  # [Admin Dashboard] 사내 관리자 전용 백오피스
    │   ├── page.tsx              # '/admin' - 파이프라인 수집 현황 및 시스템 전체 모니터링
    │   └── contents/
    │       └── page.tsx          # '/admin/contents' - 수집된 Raw Evidence 검수 및 숨김(Hide) 처리
    │
    └── api/                      # Client-side 연동 및 외부 트리거 엔드포인트
        ├── auth/                 # 세션 및 콜백 관리
        ├── cron/                 # (MVP) Vercel 호환 백그라운드 워커 트리거 엔드포인트
        │   ├── fetch-events/     # 주가/거래량 스파이크 감지 트리거
        │   └── extract-evidence/ # 공시/찌라시 스크래핑 및 파싱 트리거
        └── webhooks/             # (Future Expansion) 외부 의존성 웹훅
            └── stripe/           # 결제 성공 시 계정 Role 업데이트 웹훅 플레이스홀더
```

## 2. Route Target Audience & UX Concept

### 2.1 Public Web (Core Acquisition)
- **대상**: 리서치 시간을 줄이고 "도박(투기)"의 승률을 높이고 싶은 방문자 전원.
- **경계 목표**: 어떤 인증 장벽도 없으며(Frictionless), 가장 속도가 빠르고 SEO에 노출되도록 ISR/정적 캐싱을 전면에 배치. 
- **설계 의도**: 사용자는 30~60초 만에 해당 종목의 객관적 `missing_or_risk_factors` (결함 데이터, 서류상 문제 등)와 T+1, T+30일 `similar_case_stats`를 확인하고 창을 닫음. 이 "빠른 확인" 유틸리티가 재방문 습관(Hook)을 형성함.

### 2.2 Authenticated App (Member Utility & Scalability)
- **대상**: 즐겨찾기를 원하는 가입 유저.
- **경계 목표**: 미들웨어에서 Session Token 유효성을 검사하며, 없으면 `/login`으로 리다이렉트. 사용자의 테이블 접근은 DB의 Row Level Security(RLS) 규칙에 의해 본인 데이터(Watchlist)만 볼 수 있게 제한됨.
- **미래 확장 (Payment & Community)**:
  - **`/premium` Route**: MVP 단계에서는 "향후 이런 프리미엄 분석(예: 기관 매집 시그널, 상세 SEC 공시 AI 요약)이 추가됩니다"라는 플래시보 화면만 구성하거나 비워 둡니다. 결제가 도입되면 `/api/webhooks/stripe`에서 DB의 User Role을 `PREMIUM`으로 바꿔주면 됩니다.
  - **`/community/[symbol]` Route**: 현재는 만들지 않습니다. 하지만 향후 커뮤니티 투입이 결정되면 이 폴더에서 Supabase Realtime 채널을 구독하게 하여 종목 전용 실시간 채팅/게시판을 렌더링하면 됩니다. 구조적인 충돌(Rewrite)은 일어나지 않습니다.

### 2.3 Admin Dashboard (Data Curation)
- **대상**: 플랫폼 내부 관리자 혹은 운영진.
- **경계 목표**: 미들웨어 레벨에서 `role === 'admin'` 권한이 없으면 무조건 403 차단. 
- **설계 의도**: 백그라운드 파이프라인(스크래퍼)이 100% 완벽할 수 없고, 뉴스 분류 기준이 잘못되기도 하므로 사람이 중간에 개입("이 기사는 찌라시라 Hide 처리")할 수 있는 시각적 UI를 가장 Lean하게 구성.
