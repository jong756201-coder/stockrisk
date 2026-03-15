import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
    const supabase = createAdminClient();

    // 1. Insert Tickers
    const { error: tickersError } = await supabase.from('tickers').upsert([
        { symbol: 'MSTR', company_name: 'MicroStrategy', exchange: 'NASDAQ', is_active: true, last_price: 1500.50 },
        { symbol: 'SMCI', company_name: 'Super Micro Computer', exchange: 'NASDAQ', is_active: true, last_price: 850.20 },
        { symbol: 'NKLA', company_name: 'Nikola Corp', exchange: 'NASDAQ', is_active: true, last_price: 1.25 }
    ], { onConflict: 'symbol' });

    if (tickersError) return NextResponse.json({ error: tickersError.message, step: 'tickers' }, { status: 500 });

    // 2. Insert Events
    const { error: eventsError } = await supabase.from('events').insert([
        { symbol: 'MSTR', event_type: 'volume_spike', metrics_json: { prev_vol: 1000000, curr_vol: 12500000 } },
        { symbol: 'SMCI', event_type: 'price_gap_up', metrics_json: { gap_percent: 15.4 } },
        { symbol: 'NKLA', event_type: 'volume_spike', metrics_json: { prev_vol: 5000000, curr_vol: 55000000 } }
    ]);
    if (eventsError) return NextResponse.json({ error: eventsError.message, step: 'events' }, { status: 500 });

    // 3. Insert Extracted Evidence
    const { error: evidenceError } = await supabase.from('extracted_evidence').insert([
        {
            symbol: 'NKLA',
            category: 'rumor',
            headline: 'X(Twitter) 발 대규모 공급계약 루머 확산 및 거래량 폭발',
            missing_or_risk_factors: [
                "출처가 불분명한 익명 텔레그램/X 계정발 텍스트",
                "SEC 공식 8-K 공시 전혀 없음",
                "회사의 현금 런웨이(Cash Runway)가 3개월 미만으로 유상증자(Offering) 위험 극상"
            ],
            source_url: 'https://twitter.com/placeholder_rumor',
            status: 'pending_review'
        },
        {
            symbol: 'SMCI',
            category: 'earnings',
            headline: '어닝서프라이즈 및 AI 서버 수주 잔고 가이던스 상향',
            missing_or_risk_factors: [
                "회계 조작 의혹(Hindenburg Research) 관련 10-K 연장 제출 건 아직 미결",
                "과거 3년간 이익 마진율 타 경쟁사 대비 하락 추세"
            ],
            source_url: 'https://sec.gov/placeholder_8k',
            status: 'published'
        }
    ]);
    if (evidenceError) return NextResponse.json({ error: evidenceError.message, step: 'evidence' }, { status: 500 });

    // 4. Insert Similar Case Stats
    const { error: statsError } = await supabase.from('similar_case_stats').insert([
        {
            symbol: 'NKLA',
            reference_symbol: 'MULN',
            similarity_reason: '현금 고갈 상태에서의 출처 불분명한 수주 루머 펌핑',
            outcome_t_plus_1: -15.5,
            outcome_t_plus_7: -45.2,
            outcome_t_plus_30: -80.5,
            ultimate_outcome_tags: ["offering_ending", "rs_reverse_split"]
        }
    ]);
    if (statsError) return NextResponse.json({ error: statsError.message, step: 'stats' }, { status: 500 });

    return NextResponse.json({
        success: true,
        message: 'Mock data seeded successfully.'
    });
}
