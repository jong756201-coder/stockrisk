import { NextRequest, NextResponse } from 'next/server';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

// 자본 조달 관련 폼 타입
const OFFERING_TYPES = new Set([
    'S-3', 'S-3/A', 'S-1', 'S-1/A', 'F-3', 'F-3/A',
    '424B1', '424B2', '424B3', '424B4', '424B5',
    'S-11', 'S-11/A',
]);

// 주요 수시 공시 폼 타입
const KEY_DISCLOSURE_TYPES = new Set([
    '8-K', '8-K/A', '6-K', '6-K/A',
]);

// 대주주 지분 변동 폼 타입
const SHAREHOLDER_TYPES = new Set([
    'SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A',
    'SC13D', 'SC13D/A', 'SC13G', 'SC13G/A',
]);

export interface SecFiling {
    formType: string;
    filingDate: string;
    link: string;
    finalLink?: string;
    description?: string;
}

export interface SecFilingsResponse {
    offerings: SecFiling[];
    keyDisclosures: SecFiling[];
    shareholders: SecFiling[];
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;
    const sym = symbol.toUpperCase();
    const API_KEY = process.env.FMP_API_KEY;

    if (!API_KEY) {
        return NextResponse.json({ error: 'No API key' }, { status: 500 });
    }

    try {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1년

        const url = `${FMP_BASE_URL}/sec-filings-search/symbol?symbol=${sym}&from=${from}&to=${to}&page=0&limit=100&apikey=${API_KEY}`;
        const res = await fetch(url, { next: { revalidate: 3600 } }); // 1시간 캐시

        if (!res.ok) {
            return NextResponse.json({ offerings: [], keyDisclosures: [], shareholders: [] });
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            return NextResponse.json({ offerings: [], keyDisclosures: [], shareholders: [] });
        }

        const offerings: SecFiling[] = [];
        const keyDisclosures: SecFiling[] = [];
        const shareholders: SecFiling[] = [];

        for (const f of data) {
            const formType: string = (f.formType ?? f.type ?? '').trim();
            const normalizedType = formType.toUpperCase().replace(/\s+/g, ' ');

            // FMP stable API는 날짜 필드명이 일정하지 않음 — 여러 필드 시도
            const rawDate = (
                f.filingDate ?? f.acceptedDate ?? f.dateFiled ?? f.filed ?? f.date ?? ''
            ).toString().trim();
            // "2025-11-01 00:00:00" 형식 → "2025-11-01" 정규화
            const filingDate = rawDate.split('T')[0].split(' ')[0];

            const filing: SecFiling = {
                formType,
                filingDate,
                link: f.link ?? '',
                finalLink: f.finalLink ?? undefined,
            };

            if (OFFERING_TYPES.has(normalizedType)) {
                offerings.push(filing);
            } else if (KEY_DISCLOSURE_TYPES.has(normalizedType)) {
                keyDisclosures.push(filing);
            } else if (
                SHAREHOLDER_TYPES.has(normalizedType) ||
                normalizedType.startsWith('SC 13') ||
                normalizedType.startsWith('SC13')
            ) {
                shareholders.push(filing);
            }
        }

        // 각 섹션 최근 순 정렬 후 제한
        const sortByDate = (a: SecFiling, b: SecFiling) =>
            b.filingDate.localeCompare(a.filingDate);

        return NextResponse.json({
            offerings: offerings.sort(sortByDate).slice(0, 10),
            keyDisclosures: keyDisclosures.sort(sortByDate).slice(0, 10),
            shareholders: shareholders.sort(sortByDate).slice(0, 10),
        } satisfies SecFilingsResponse);

    } catch (e) {
        console.error('[SecFilings] error:', e);
        return NextResponse.json({ offerings: [], keyDisclosures: [], shareholders: [] });
    }
}
