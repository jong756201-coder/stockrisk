import { NextRequest, NextResponse } from 'next/server';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

// 디버그용: FMP 프레스 릴리즈 raw 응답 확인
// GET /api/debug/press-releases/EDSA
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;
    const sym = symbol.toUpperCase();
    const API_KEY = process.env.FMP_API_KEY;

    const url = `${FMP_BASE_URL}/news/press-releases?symbols=${sym}&limit=5&apikey=${API_KEY}`;
    const res = await fetch(url, { cache: 'no-store' });
    const raw = await res.json();

    // 응답 구조 분석
    const analysis = Array.isArray(raw) ? raw.map((item: any) => ({
        date: item.date,
        publishedDate: item.publishedDate,
        title: item.title,
        textLength: (item.text ?? '').length,
        textPreview: (item.text ?? '').slice(0, 200),
        keys: Object.keys(item),
    })) : raw;

    return NextResponse.json({ symbol: sym, count: Array.isArray(raw) ? raw.length : 0, data: analysis });
}
