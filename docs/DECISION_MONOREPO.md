# Architecture Recommendation: Single App vs Monorepo (Workspace)
**Date**: 2026-03-12
**Status**: Decision

## 결론 (Recommendation)
이 프로젝트의 조건(1인 개발자, Lean MVP, 미래 확장성, 큰 재작성 회피)을 고려할 때, **"Route Groups를 활용한 Single App" (`src/app/(public)`, `(auth)`, `(admin)`) 구조**를 강력히 추천합니다.

TurboRepo나 Nx 같은 Monorepo 패키지 분리(web / admin / jobs)는 현 단계에서 "성급한 과설계(Premature Optimization)"가 될 위험이 큽니다.

---

## 1. Single App (Route Groups) 구조 

하나의 Next.js 프로젝트 내에서 폴더명 `(폴더)`를 활용해 논리적으로만 앱 경계를 나누는 방식입니다.
* `src/app/(public)`
* `src/app/(auth)`
* `src/app/(admin)`
* `src/app/api/cron/...` (Background Jobs)

### 장점 (Pros)
- **가장 빠른 개발 속도 (Lean MVP)**: 1인 개발자가 패키지 간 의존성 문제, TS 설정 꼬임, 빌드 파이프라인(CI/CD) 설정에 시간을 낭비하지 않고 오직 "제품(수익 창출)"에만 집중할 수 있습니다.
- **코드 재사용 압도적 편리**: 동일한 `EvidenceCard` 컴포넌트나 `supabase.ts` 클라이언트를 Public 앱과 Admin 뷰에서 별도 export/import 패키징 과정 없이 바로 가져다(`@/components/...`) 쓸 수 있습니다.
- **배포 인프라 비용 제로**: Vercel에 단일 프로젝트로 배포되므로 별도의 Admin 도메인 서브 도메인을 관리할 필요가 없습니다. Background Jobs 역시 `/api/cron`을 통해 Vercel의 무료 스케줄러로 커버 가능합니다.

### 약점 및 극복 (Cons & Mitigation)
- *미래에 Admin 기능이 무거워지면 Public 성능에 영향을 주지 않을까?*
  - **극복**: Next.js App Router의 코드 스플리팅(Code Splitting) 덕분에 `/admin`에서 무거운 차트 라이브러리를 쓰더라도 일반 유저가 방문하는 `/` 페이지의 번들 사이즈에는 영향을 주지 않습니다.
- *Background Job이 15분을 초과하는 무거운 AI 작업이 되면?*
  - **극복**: Next.js API Route(서버리스)의 타임아웃 한계(Vercel Pro 기준 최대 5분)에 걸릴 수 있습니다. 이때는 스크래핑/파싱 로직(`src/services`)만 별도의 Python/Node.js 백엔드 레포지토리로 분리하면 됩니다. 프론트엔드 전체를 Rewrite 할 필요는 전혀 없습니다.

---

## 2. Monorepo (Packages) 구조

TurboRepo나 pnpm workspaces를 활용해 물리적으로 패키지를 쪼개는 방식입니다.
* `apps/web` (비회원/회원 앱)
* `apps/admin` (백오피스 앱)
* `packages/jobs` (데이터 스크래퍼)
* `packages/ui` (공용 컴포넌트)
* `packages/database` (Supabase 타입 셰어링)

### 장점 (Pros)
- 완벽한 물리적 격리. Admin 앱의 장애가 Web 앱에 영향을 미치지 않습니다.
- 서로 다른 배포 주기를 가져갈 수 있습니다.

### 치명적 단점 (Trade-offs for 1-Person MVP)
- **오버헤드 (Overhead)**: 1인 개발자가 공용 버튼 컴포넌트 하나를 수정하려면 `packages/ui`에서 빌드를 태우고 `apps/web`에서 버전을 맞추는 불필요한 공수가 발생합니다.
- **배포의 복잡성**: Vercel 프로젝트를 여러 개 파거나, Docker 컨테이너를 직접 오케스트레이션 해야 할 수 있습니다. MVP의 핵심인 "빠른 시장 검증"을 방해합니다.

---

## 🚦 최종 아키텍처 의사결정 (Conclusion)

이 프로젝트는 "초기에는 작게 시작하되, 미래에 결제/커뮤니티가 붙을 수 있어야 한다"는 명확한 철학이 있습니다. 

Next.js App Router의 **Route Groups 격리 + Middleware 권한 제어** 조합은 1인 개발자가 **Single App의 개발 속도(Lean)**를 누리면서도, **마치 Monorepo처럼 폴더 단위로 모듈(결제, 커뮤니티, 어드민)을 깔끔하게 분리**할 수 있게 해줍니다.

추후 스크래퍼(Jobs) 쪽이 감당 불가능할 정도로 데이터 파이프라인이 거대해지는 시점(예: 매초단위 수천개 틱 데이터 분석)에 도달했을 때만, 스크래퍼 코드만 도려내어 별도 Python 앱으로 분리하는 것이 가장 합리적인 "지연된 아키텍처 분리(Postponed Splitting)" 전략입니다.
