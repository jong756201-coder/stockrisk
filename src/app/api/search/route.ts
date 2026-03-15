import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { containsKorean } from '@/lib/constants/koreanTickerMap';
import { getKoreanNames } from '@/lib/api/koreanNames';

export interface SearchResult {
    symbol: string;
    name: string;
    exchangeShortName: string;
    koreanName?: string;
}

// 티커처럼 생긴 쿼리 판별 (1~6자 영문자, 숫자 허용)
const TICKER_RE = /^[A-Za-z][A-Za-z0-9]{0,5}$/;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 1) {
        return NextResponse.json([]);
    }

    // ── 한글 입력 분기 ────────────────────────────────────────
    if (containsKorean(query)) {
        const results = await searchKorean(query);
        return NextResponse.json(results);
    }

    // ── 영문 / 티커 입력 (기존 로직) ─────────────────────────
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) return NextResponse.json([]);

    const looksLikeTicker = TICKER_RE.test(query);

    const [supabaseRes, fmpSearchRes, fmpDirectRes] = await Promise.allSettled([
        searchSupabase(query),
        searchFMP(query, apiKey),
        looksLikeTicker ? lookupDirectSymbol(query.toUpperCase(), apiKey) : Promise.resolve(null),
    ]);

    const local: SearchResult[] =
        supabaseRes.status === 'fulfilled' ? supabaseRes.value : [];
    const fmpSearch: SearchResult[] =
        fmpSearchRes.status === 'fulfilled' ? fmpSearchRes.value : [];
    const fmpDirect: SearchResult | null =
        fmpDirectRes.status === 'fulfilled' ? fmpDirectRes.value : null;

    const seen = new Set<string>();
    const merged: SearchResult[] = [];
    const addIfNew = (item: SearchResult | null) => {
        if (!item || seen.has(item.symbol)) return;
        seen.add(item.symbol);
        merged.push(item);
    };

    local.slice(0, 5).forEach(addIfNew);
    addIfNew(fmpDirect);
    fmpSearch.forEach(addIfNew);

    const final = merged.slice(0, 12);

    // 한국어 이름 조회 (Supabase 캐시 → 캐시 미스 시 Gemini 번역)
    const koreanNames = await getKoreanNames(
        final.map(r => ({ symbol: r.symbol, name: r.name }))
    );
    const withKorean = final.map(r => ({
        ...r,
        koreanName: koreanNames[r.symbol] ?? undefined,
    }));

    return NextResponse.json(withKorean);
}

// ── 한글 검색: Supabase 캐시 → Gemini 변환 → 저장 ──────────────
async function searchKorean(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const supabase = createAdminClient();

    // 1) company_korean_names 테이블에서 한국어 이름으로 검색
    //    (메인 화면에서 번역된 이름들이 여기 저장됨)
    const { data: koreanMatches } = await supabase
        .from('company_korean_names')
        .select('symbol, korean_name')
        .ilike('korean_name', `%${normalizedQuery}%`)
        .limit(8);

    // 2) korean_aliases 테이블에서도 검색 (사용자가 이전에 검색한 것들)
    const { data: aliasMatches } = await supabase
        .from('korean_aliases')
        .select('symbol, company_name, exchange, korean_query')
        .ilike('korean_query', `%${normalizedQuery}%`)
        .limit(5);

    const seen = new Set<string>();
    const results: SearchResult[] = [];

    // company_korean_names 결과 → FMP에서 회사 정보 보완 없이 일단 추가
    for (const row of koreanMatches ?? []) {
        if (seen.has(row.symbol)) continue;
        seen.add(row.symbol);
        results.push({
            symbol: row.symbol,
            name: row.symbol, // 아래서 tickers 테이블로 보완
            exchangeShortName: '',
            koreanName: row.korean_name,
        });
    }

    for (const row of aliasMatches ?? []) {
        if (seen.has(row.symbol)) continue;
        seen.add(row.symbol);
        results.push({
            symbol: row.symbol,
            name: row.company_name ?? row.symbol,
            exchangeShortName: row.exchange ?? '',
            koreanName: row.korean_query,
        });
    }

    // tickers 테이블에서 영문 회사명 보완
    if (results.length > 0) {
        const symbols = results.map(r => r.symbol);
        const { data: tickerRows } = await supabase
            .from('tickers')
            .select('symbol, company_name, exchange')
            .in('symbol', symbols);

        const tickerMap: Record<string, { name: string; exchange: string }> = {};
        for (const t of tickerRows ?? []) {
            tickerMap[t.symbol] = { name: t.company_name ?? t.symbol, exchange: t.exchange ?? '' };
        }
        for (const r of results) {
            if (tickerMap[r.symbol]) {
                r.name = tickerMap[r.symbol].name;
                r.exchangeShortName = tickerMap[r.symbol].exchange;
            }
        }
    }

    // Supabase에 없으면 빈 결과 반환
    // (영어로 티커 검색 시 getKoreanNames가 자동으로 번역 후 저장하므로
    //  다음 번 한글 검색 때는 자연스럽게 company_korean_names에서 히트됨)
    return results;
}

// ── Supabase tickers 검색 ─────────────────────────────────────
async function searchSupabase(query: string): Promise<SearchResult[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('tickers')
        .select('symbol, company_name, exchange')
        .or(`symbol.ilike.%${query}%,company_name.ilike.%${query}%`)
        .order('symbol')
        .limit(5);

    if (error || !data) return [];

    return data.map(row => ({
        symbol: row.symbol,
        name: row.company_name ?? row.symbol,
        exchangeShortName: row.exchange ?? '',
    }));
}

// ── FMP /search ────────────────────────────────────────────────
async function searchFMP(query: string, apiKey: string): Promise<SearchResult[]> {
    try {
        const res = await fetch(
            `https://financialmodelingprep.com/stable/search?query=${encodeURIComponent(query)}&limit=15&apikey=${apiKey}`,
            { cache: 'no-store' }
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];

        return data
            .filter((d: { symbol?: string; exchangeShortName?: string }) =>
                d.symbol &&
                !d.symbol.includes('.') &&
                d.exchangeShortName !== 'CRYPTO'
            )
            .map((d: { symbol: string; name: string; exchangeShortName: string }) => ({
                symbol: d.symbol,
                name: d.name,
                exchangeShortName: d.exchangeShortName ?? '',
            }));
    } catch {
        return [];
    }
}

// ── FMP /profile 직접 심볼 조회 ───────────────────────────────
async function lookupDirectSymbol(symbol: string, apiKey: string): Promise<SearchResult | null> {
    try {
        const res = await fetch(
            `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
            { cache: 'no-store' }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || !data[0]?.symbol) return null;
        const p = data[0];
        return {
            symbol: p.symbol,
            name: p.companyName ?? p.symbol,
            exchangeShortName: p.exchangeShortName ?? p.exchange ?? '',
        };
    } catch {
        return null;
    }
}
