import { createAdminClient } from '@/lib/supabase/admin';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { ALL_SUB_TYPE_CODES, ALL_MISSING_CODES } from '@/lib/constants/eventTaxonomy';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_API_KEY = process.env.FMP_API_KEY;

// ─── 스키마 정의 ───────────────────────────────────────────────────────────────

const MissingItemSchema = z.object({
    category: z.string()
        .describe(`누락 항목 카테고리 코드. 반드시 다음 중 하나: ${ALL_MISSING_CODES.join(', ')}`),
    detail: z.string()
        .describe('해당 누락 항목에 대한 구체적 한국어 설명 (1문장)'),
});

const EventAnalysisSchema = z.object({
    type_code: z.enum(['OFFERING', 'CONTRACT', 'CLINICAL', 'EARNINGS', 'REGULATORY', 'MA', 'OTHER'])
        .describe('상위 이벤트 유형 코드'),
    sub_type: z.string()
        .describe(`하위 이벤트 유형 코드. 반드시 다음 중 하나: ${ALL_SUB_TYPE_CODES.join(', ')}`),
    summary: z.string()
        .describe('원문에 기재된 사실만을 바탕으로 한 핵심 요약 (한국어 2~3문장). 회사명·증권사명 등 고유명사는 영어 그대로, 나머지는 한국어. 영어 원문 구절을 괄호에 재인용하지 말 것.'),
    critical_points: z.array(z.string())
        .describe('원문에 기재된 수치·조건 중 투자자가 비판적으로 봐야 할 사항들. 한국어로 작성하되 고유명사·숫자는 영어/숫자 그대로. 영어 원문 재인용 금지. 원문에 없으면 빈 배열.'),
    missing_items: z.array(MissingItemSchema)
        .describe('이 이벤트 유형에서 통상 공개돼야 할 정보 중 원문에 명시적으로 누락된 항목. 원문에 있는 내용은 절대 포함 금지.'),
});

const FilingAnalysisSchema = z.object({
    events: z.array(EventAnalysisSchema)
        .describe('이 8-K에 포함된 독립적인 이벤트 목록'),
});

export type EventAnalysis = z.infer<typeof EventAnalysisSchema>;
export type MissingItem = z.infer<typeof MissingItemSchema>;
export type FilingAnalysis = z.infer<typeof FilingAnalysisSchema>;

export interface PriceMoveAnalysis {
    symbol: string;
    filingDate: string;
    filingUrl: string | null;
    events: EventAnalysis[];
}

// ─── 1. FMP에서 최신 8-K 공시 메타데이터 가져오기 ───────────────────────────
interface FmpFiling {
    symbol: string;
    formType?: string;
    filingDate?: string;
    acceptedDate?: string;
    link?: string;
    finalLink?: string;
}

async function fetchLatest8K(symbol: string): Promise<FmpFiling | null> {
    if (!FMP_API_KEY) return null;
    try {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const url = `${FMP_BASE_URL}/sec-filings-search/symbol?symbol=${symbol}&from=${from}&to=${to}&page=0&limit=20&apikey=${FMP_API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });
        console.log(`[secAnalysis] 8-K fetch status: ${res.status} for ${symbol}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        const filing8k = data.find((f: FmpFiling) =>
            (f.formType ?? '').toUpperCase() === '8-K'
        );
        return filing8k ?? null;
    } catch (e) {
        console.error(`[secAnalysis] fetchLatest8K error:`, e);
        return null;
    }
}

// ─── 2. SEC EDGAR 원문에서 텍스트 추출 ────────────────────────────────────────
async function fetchFilingText(url: string): Promise<string> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'StockRisk research@stockrisk.app' },
            cache: 'no-store',
        });
        console.log(`[secAnalysis] SEC doc fetch status: ${res.status} url: ${url.slice(0, 80)}`);
        if (!res.ok) return '';
        const html = await res.text();
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
        console.log(`[secAnalysis] SEC text length: ${text.length}`);
        return text.slice(0, 8000);
    } catch {
        return '';
    }
}

// ─── 3. 현재 USDKRW 환율 조회 ─────────────────────────────────────────────────
async function fetchUsdKrwRate(): Promise<number> {
    try {
        const url = `${FMP_BASE_URL}/fx/USDKRW?apikey=${FMP_API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return 1380; // fallback
        const data = await res.json();
        const rate = data?.[0]?.price ?? data?.price ?? null;
        if (rate && !isNaN(Number(rate))) return Math.round(Number(rate));
        return 1380;
    } catch {
        return 1380; // fallback
    }
}

// ─── 4. Gemini 구조화 분석 ─────────────────────────────────────────────────────
async function analyzeWithGemini(
    symbol: string,
    filingDate: string,
    filingText: string,
    usdKrwRate: number
): Promise<EventAnalysis[] | null> {
    try {
        const systemPrompt = `당신은 미국 SEC 8-K 공시를 분석하는 포렌식 애널리스트입니다.

핵심 원칙:
1. 반드시 제공된 원문 텍스트에 명시적으로 기재된 내용만을 근거로 판단하십시오.
2. 원문에 없는 내용을 추측·가정·보완하지 마십시오.
3. missing_items는 원문에 진짜 없는 것만 나열하십시오 — 있는 것을 없다고 하지 마십시오.

critical_points 작성 기준 (매우 중요):
- critical_points는 summary에서 이미 언급한 사실을 반복하는 것이 아닙니다.
- "~가 ~% 증가했다" 같은 단순 사실 나열은 비판적 분석이 아닙니다. 절대 넣지 마십시오.
- 비판적 분석이란: 겉으로는 좋아 보이지만 실제로는 위험하거나 의심스러운 포인트를 짚어주는 것입니다.
- 예: "매출이 87% 증가했지만 절대 금액이 공개되지 않아 규모를 판단할 수 없음", "계약 상대방이 설립 2개월 된 기업", "희석 규모가 시가총액의 30%에 달함"
- 진짜 비판할 만한 포인트가 없으면 critical_points를 빈 배열 []로 두십시오. 억지로 채우지 마십시오.

언어 및 금액 표기 규칙:
- 한국어로 작성하되, 회사명·증권사명·약물명 등 고유명사는 영어 그대로 사용합니다.
- 영어 원문 구절을 괄호 안에 재인용하거나 병기하지 마십시오. 한국어로 의미만 전달하세요.
- 달러 금액은 반드시 원화로 환산하여 '약 X억 원 ($Y)' 형식으로 표기하십시오.
  현재 환율: 1 USD = ${usdKrwRate.toLocaleString()} KRW
  환산 기준: 1억 원 = 100,000,000원. 1조 원 = 1,000,000,000,000원.
  예시: $15,000,000 → 약 207억 원 ($1,500만), $1B → 약 1조 3,800억 원 ($10억)
  금액이 작으면 '약 X만 원 ($Y)' 형식도 가능합니다.

이벤트 분리 원칙:
- 하나의 8-K에 성격이 다른 이벤트가 여러 개 포함되면 반드시 각각 별도 항목으로 분리하십시오.
- 예: ATM 프로그램이면 "판매 대행 계약 체결(CONTRACT/SALES_AGENT)"과 "ATM 주식 발행 프로그램(OFFERING/ATM)"을 분리.

상위 이벤트 유형(type_code) — 반드시 다음 중 하나:
- OFFERING: 유상증자, ATM, 전환사채, 워런트 등 주식 발행/자금 조달
- CONTRACT: 파트너십, 라이선스, 판매계약, 공급계약 등
- CLINICAL: 임상시험 결과, FDA 승인/거부, IND 신청
- EARNINGS: 분기/연간 실적 발표, 매출 업데이트, 가이던스, 비용 구조조정
- REGULATORY: 특허 취득/출원, 정부 승인(FDA 외), 인증, 특허 소송
- MA: 인수, 합병, 매각, 합작법인
- OTHER: 경영진 변경, 파산, 재무제표 정정, 상장폐지 통보 등

이벤트 하위 유형(sub_type) — 반드시 다음 코드 중 하나를 사용:

OFFERING 하위:
  ATM — 시장가 수시 매각 (at-the-market)
  DIRECT_OFFERING — 직접 공모
  PIPE — 사모 투자
  SHELF — 선반등록 (S-3 등록만, 아직 발행 아님)
  WARRANT_EXERCISE — 워런트 행사
  CONVERTIBLE — 전환사채
  RDO — 등록직접공모
  OTHER_OFFERING — 기타

CONTRACT 하위:
  LICENSE — 라이선스/특허 계약
  PARTNERSHIP — 파트너십/공동개발
  SUPPLY — 공급/유통 계약
  SALES_AGENT — 판매 대행 계약
  GOVERNMENT — 정부/공공기관 계약
  OTHER_CONTRACT — 기타 계약

CLINICAL 하위:
  TOPLINE — 탑라인 결과만 공개
  PHASE1 — 임상 1상
  PHASE2 — 임상 2상
  PHASE3 — 임상 3상
  FDA_DECISION — FDA 승인/거부
  IND — IND 신청
  OTHER_CLINICAL — 기타

EARNINGS 하위:
  QUARTERLY_RESULTS — 분기 실적
  ANNUAL_RESULTS — 연간 실적
  REVENUE_UPDATE — 매출/사업 현황 업데이트
  GUIDANCE — 실적 가이던스
  COST_RESTRUCTURING — 비용 구조조정
  OTHER_EARNINGS — 기타 실적/재무

REGULATORY 하위:
  PATENT_GRANT — 특허 취득
  PATENT_APPLICATION — 특허 출원
  GOVT_APPROVAL — 정부/기관 승인 (FDA 외)
  CERTIFICATION — 인증 취득 (ISO, CE, GMP 등)
  PATENT_LITIGATION — 특허 소송
  OTHER_REGULATORY — 기타 규제/인허가

MA 하위:
  ACQUISITION — 인수
  MERGER — 합병
  DIVESTITURE — 사업부 매각
  JV — 합작법인

OTHER 하위:
  LEADERSHIP_CHANGE — 경영진 변경
  BANKRUPTCY — 파산/구조조정
  RESTATEMENT — 재무제표 정정
  DELISTING_NOTICE — 상장폐지 통보
  OTHER_EVENT — 기타

missing_items 카테고리 코드 — 반드시 다음 중 하나를 사용:
  FUND_PURPOSE — 자금 사용 목적 불분명
  DILUTION_SCALE — 희석 규모 미공개
  OFFERING_PRICE — 발행 가격 미공개
  CONTRACT_VALUE — 계약 금액 미공개
  CONTRACT_DURATION — 계약 기간 미공개
  COUNTERPARTY_INFO — 상대방 정보 부족
  EXCLUSIVITY — 독점 여부 미공개
  SAMPLE_SIZE — 임상 모수 미공개
  PRIMARY_ENDPOINT — 1차 평가변수 미공개
  P_VALUE — 통계적 유의성 미공개
  CONTROL_GROUP — 대조군 설정 미공개
  FULL_DATA — 전체 데이터 미공개
  EXPENSE_DETAILS — 비용 세부사항 미공개
  TIMELINE — 일정/기한 미공개
  ABSOLUTE_FIGURES — 절대 금액 미공개 (증감률만 공개)
  COMPARISON_BASIS — 비교 기준 미공개 (전년 동기 수치 등)
  PATENT_SCOPE — 특허 범위/보호 기간 미공개
  APPROVAL_CONDITIONS — 승인 조건/제한 사항 미공개
  OTHER_MISSING — 기타`;

        const { object } = await generateObject({
            model: google('gemini-3.1-pro-preview'),
            schema: FilingAnalysisSchema,
            system: systemPrompt,
            prompt: `${symbol} 8-K 공시 (${filingDate})\n\n원문:\n${filingText}`,
        });
        console.log(`[secAnalysis] Gemini events count: ${object.events.length}`);
        return object.events;
    } catch (e) {
        console.error('[Gemini] analyzeWithGemini failed:', e);
        return null;
    }
}

// ─── 메인 함수: 캐시 확인 → fetch → 분석 → 저장 ──────────────────────────────
export async function getPriceMoveAnalysis(
    symbol: string
): Promise<PriceMoveAnalysis | null> {
    const supabase = createAdminClient();

    // 1. 최신 8-K 메타 조회
    const filing = await fetchLatest8K(symbol);
    if (!filing) return null;

    const filingDate =
        filing.filingDate ??
        filing.acceptedDate?.split(' ')[0] ??
        null;
    if (!filingDate) return null;

    const filingUrl = filing.finalLink ?? filing.link ?? null;

    // 2. Supabase 캐시 확인 — events_json이 있어야 캐시 히트
    try {
        const { data: cached } = await supabase
            .from('price_move_analysis')
            .select('symbol, filing_date, events_json, filing_url')
            .eq('symbol', symbol)
            .eq('filing_date', filingDate)
            .maybeSingle();

        if (cached?.events_json) {
            // 캐시된 데이터가 새 스키마인지 확인 (sub_type 필드 유무)
            const events = cached.events_json as EventAnalysis[];
            const hasNewSchema = events.length > 0 && 'sub_type' in events[0];
            if (hasNewSchema) {
                console.log(`[secAnalysis] cache hit (v2) for ${symbol} ${filingDate}`);
                return {
                    symbol: cached.symbol,
                    filingDate: cached.filing_date,
                    filingUrl: cached.filing_url ?? filingUrl,
                    events,
                };
            }
            // 구 스키마 → 재분석 필요
            console.log(`[secAnalysis] cache stale (v1) for ${symbol}, re-analyzing`);
        }
    } catch {
        // 캐시 없이 진행
    }

    // 3. 원문 텍스트 fetch + 환율 조회 (병렬)
    if (!filingUrl) return null;
    const [filingText, usdKrwRate] = await Promise.all([
        fetchFilingText(filingUrl),
        fetchUsdKrwRate(),
    ]);
    if (filingText.length < 100) return null;
    console.log(`[secAnalysis] USDKRW rate: ${usdKrwRate}`);

    // 4. Gemini 구조화 분석
    const events = await analyzeWithGemini(symbol, filingDate, filingText, usdKrwRate);
    if (!events || events.length === 0) return null;

    // 5. Supabase 저장
    try {
        await supabase.from('price_move_analysis').upsert(
            {
                symbol,
                filing_date: filingDate,
                events_json: events,
                summary_ko: events[0]?.summary ?? '',
                filing_url: filingUrl,
            },
            { onConflict: 'symbol,filing_date', ignoreDuplicates: false }
        );
    } catch (e) {
        console.error('[secAnalysis] Supabase upsert failed:', e);
    }

    return { symbol, filingDate, filingUrl, events };
}
