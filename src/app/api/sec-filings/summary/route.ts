import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { ALL_SUB_TYPE_CODES, ALL_MISSING_CODES } from '@/lib/constants/eventTaxonomy';

function htmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractForSummary(text: string): string {
    return text.slice(0, 6000);
}

function extractForDetail(text: string): string {
    if (text.length <= 12000) return text;
    return text.slice(0, 8000) + '\n\n...(중략)...\n\n' + text.slice(-3000);
}

// PriceMoveCard와 동일한 스키마
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
        .describe('원문에 기재된 사실만을 바탕으로 한 핵심 요약 (한국어 2~3문장). 회사명·증권사명 등 고유명사는 영어 그대로, 나머지는 한국어.'),
    critical_points: z.array(z.string())
        .describe('투자자가 비판적으로 봐야 할 사항들. 한국어. 없으면 빈 배열.'),
    missing_items: z.array(MissingItemSchema)
        .describe('이 이벤트 유형에서 통상 공개돼야 할 정보 중 원문에 명시적으로 누락된 항목.'),
});

const FilingAnalysisSchema = z.object({
    importance: z.enum(['HIGH', 'LOW'])
        .describe(`이 공시의 주가 영향 중요도. HIGH = 주가에 즉각적이고 유의미한 영향을 줄 가능성이 높은 공시 (예: 대규모 유상증자, 임상 결과 발표, 대주주 지분 급변, 파산, 대형 계약 체결). LOW = 일상적이거나 영향이 제한적인 공시 (예: 소규모 ATM 지속, 정기 실적 공시(큰 이슈 없음), 경미한 지분 변동). 둘 중 반드시 하나만 선택.`),
    events: z.array(EventAnalysisSchema)
        .describe('이 공시에 포함된 독립적인 이벤트 목록'),
});

// 공시 텍스트 가져오기
async function fetchFilingText(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'StockAnalysis research@stockanalysis.app' },
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
    });
    if (!res.ok) return '';
    return htmlToText(await res.text());
}

// USDKRW 환율
async function fetchUsdKrwRate(): Promise<number> {
    try {
        const FMP_API_KEY = process.env.FMP_API_KEY;
        const url = `https://financialmodelingprep.com/stable/fx/USDKRW?apikey=${FMP_API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return 1380;
        const data = await res.json();
        const rate = data?.[0]?.price ?? data?.price ?? null;
        if (rate && !isNaN(Number(rate))) return Math.round(Number(rate));
        return 1380;
    } catch {
        return 1380;
    }
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const formType = req.nextUrl.searchParams.get('formType') ?? '';
    const wantDetail = req.nextUrl.searchParams.get('detail') === 'true';
    const cacheOnly = req.nextUrl.searchParams.get('cache_only') === 'true';

    if (!url) {
        return NextResponse.json({ error: 'url required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1) 캐시 확인
    const { data: cached, error: cacheErr } = await supabase
        .from('sec_filing_summaries')
        .select('summary, detail')
        .eq('url', url)
        .single();

    if (cacheErr && cacheErr.code !== 'PGRST116') {
        console.error('[SecSummary] cache lookup error — table may not exist:', cacheErr.message);
        return NextResponse.json({ summary: null, error: 'cache_table_missing' });
    }

    // cache_only 모드 → Gemini 호출 없이 캐시만 반환
    if (cacheOnly) {
        if (!cached) return NextResponse.json({ summary: null, detail: null, cached: false });
        return NextResponse.json({
            summary: cached.summary ?? null,
            detail: cached.detail ? JSON.parse(cached.detail) : null,
            cached: true,
        });
    }

    // 요약만 요청 + 캐시 있음 → 바로 반환
    if (!wantDetail && cached?.summary) {
        console.log('[SecSummary] cache HIT (summary):', url.slice(0, 60));
        return NextResponse.json({ summary: cached.summary, cached: true });
    }

    // 상세 요청 + 상세 캐시 있음 → 바로 반환
    if (wantDetail && cached?.detail) {
        console.log('[SecSummary] cache HIT (detail):', url.slice(0, 60));
        return NextResponse.json({
            summary: cached.summary,
            detail: JSON.parse(cached.detail),
            cached: true,
        });
    }

    // 2) 공시 텍스트 fetch
    let rawText = '';
    try {
        rawText = await fetchFilingText(url);
    } catch {
        return NextResponse.json({ summary: cached?.summary ?? null, detail: null });
    }

    if (!rawText || rawText.length < 100) {
        return NextResponse.json({ summary: cached?.summary ?? null, detail: null });
    }

    // 3-A) 한 줄 요약 (없으면 생성)
    let summary = cached?.summary ?? '';
    if (!summary) {
        try {
            console.log('[SecSummary] generating summary:', url.slice(0, 60));
            const { text } = await generateText({
                model: google('gemini-2.5-flash'),
                prompt: `다음 미국 SEC ${formType} 공시를 한국어 한 문장(40자 이내)으로 요약하세요.
핵심 수치(주식 수, 금액, %, 날짜)가 있으면 반드시 포함하세요.
마침표로 끝내세요. 추가 설명 없이 요약문만 출력하세요.

공시 내용:
${extractForSummary(rawText)}`,
            });
            summary = text.trim().slice(0, 120);
        } catch {
            return NextResponse.json({ summary: null, detail: null });
        }
    }

    // 3-B) 상세 분석 — PriceMoveCard와 동일한 스키마
    let detail = null;
    if (wantDetail) {
        try {
            console.log('[SecSummary] generating detail:', url.slice(0, 60));
            const usdKrwRate = await fetchUsdKrwRate();

            const { object } = await generateObject({
                model: google('gemini-2.5-flash'),
                schema: FilingAnalysisSchema,
                system: `당신은 미국 SEC 공시를 분석하는 포렌식 애널리스트입니다.

핵심 원칙:
1. 반드시 제공된 원문 텍스트에 명시적으로 기재된 내용만을 근거로 판단하십시오.
2. 원문에 없는 내용을 추측·가정·보완하지 마십시오.
3. missing_items는 원문에 진짜 없는 것만 나열하십시오 — 있는 것을 없다고 하지 마십시오.

critical_points 작성 기준 (매우 중요):
- critical_points는 summary에서 이미 언급한 사실을 반복하는 것이 아닙니다.
- "~가 ~% 증가했다" 같은 단순 사실 나열은 비판적 분석이 아닙니다. 절대 넣지 마십시오.
- 비판적 분석이란: 겉으로는 좋아 보이지만 실제로는 위험하거나 의심스러운 포인트를 짚어주는 것입니다.
- 진짜 비판할 만한 포인트가 없으면 critical_points를 빈 배열 []로 두십시오.

언어 및 금액 표기 규칙:
- 한국어로 작성하되, 회사명·증권사명·약물명 등 고유명사는 영어 그대로 사용합니다.
- 달러 금액은 반드시 원화로 환산하여 '약 X억 원 ($Y)' 형식으로 표기하십시오.
  현재 환율: 1 USD = ${usdKrwRate.toLocaleString()} KRW

공시 유형: ${formType}

분석 기준:
- S-3/S-1/424B: 발행 주식 수, 주당 가격, 총 조달액, 희석률, 워런트 조건 등
- 8-K: 이벤트 유형, 핵심 사실, 시장 영향, 리스크
- 6-K: 외국기업 주요 공시, 재무·사업 현황
- 13D/13G: 보유자명, 지분율, 변동 방향, 의결권 변화

이벤트 분리 원칙:
- 하나의 공시에 성격이 다른 이벤트가 여러 개 포함되면 반드시 각각 별도 항목으로 분리하십시오.`,
                prompt: `SEC ${formType} 공시를 분석하세요:\n\n${extractForDetail(rawText)}`,
            });
            detail = object;
        } catch (e) {
            console.error('[SecSummary] detail generation error:', e);
        }
    }

    // 4) 캐시 저장
    const upsertData: Record<string, string> = { url, summary, form_type: formType };
    if (detail) {
        upsertData.detail = JSON.stringify(detail);
    }
    const { error: saveErr } = await supabase
        .from('sec_filing_summaries')
        .upsert(upsertData, { onConflict: 'url' });

    if (saveErr) {
        console.error('[SecSummary] cache SAVE failed:', saveErr.message);
    } else {
        console.log('[SecSummary] cache SAVED:', url.slice(0, 60));
    }

    return NextResponse.json({ summary, detail, cached: false });
}
