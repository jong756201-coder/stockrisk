import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FMPService } from '@/lib/api/fmp';
import { LLMService } from '@/lib/api/llm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const supabase = createAdminClient();

        // 1. 최근 감지된 이벤트 중 근거가 추출되지 않은 종목들 가져오기 (MVP 한정 최근 5개 처리 제한)
        const { data: events } = await supabase
            .from('events')
            .select('symbol')
            .order('happened_at', { ascending: false })
            .limit(5);

        if (!events || events.length === 0) {
            return NextResponse.json({ success: true, message: 'No events found to process.' });
        }

        const processedSymbols: string[] = [];
        let skippedSymbolCount = 0;

        for (const event of events) {
            const symbol = event.symbol;

            // 이미 추출된 데이터가 있는지 확인
            const { data: existingEvidence } = await supabase
                .from('extracted_evidence')
                .select('id')
                .eq('symbol', symbol)
                .limit(1);

            if (existingEvidence && existingEvidence.length > 0) {
                skippedSymbolCount++;
                continue;
            }

            // 2. FMP Stable API 기반의 정확한 해당 기업 뉴스 클리핑
            const news = await FMPService.getRecentNews(symbol, 4);

            let rawText = '';
            let primarySourceUrl = '';

            if (news && news.length > 0) {
                news.forEach((n: any, idx: number) => {
                    rawText += `[${n.site}]: ${n.title}\n${n.text || ''}\n`;
                    if (!primarySourceUrl) primarySourceUrl = n.url;
                });
            }

            if (!rawText.trim()) {
                console.log(`No news found for ${symbol}. Skipping extraction.`);
                continue;
            }

            // 3. LLM 팩트 추출 (Gemini -> Fact Checking)
            const extracted = await LLMService.extractEvidence(rawText, `FMP News Headlines & Bodies for ${symbol}`);

            if (extracted) {
                // 4. DB 저장
                await supabase.from('extracted_evidence').insert({
                    symbol: symbol,
                    category: extracted.category,
                    headline: extracted.headline,
                    missing_or_risk_factors: extracted.missing_or_risk_factors,
                    source_url: primarySourceUrl || `https://financialmodelingprep.com/symbol/${symbol}`,
                    status: 'published'
                });

                // 5. [MVP용] AI가 분류한 카테고리를 활용해 수동으로 대표적인 과거 사례 하드코딩 매치
                let simStats = null;
                if (extracted.category === 'clinical_trial') {
                    simStats = { ref: 'SAVA', t1: -12.5, t7: -35.2, t30: -54.0, tags: ['dilution', 'failed_endpoint'] };
                } else if (extracted.category === 'delisting_cancelled') {
                    simStats = { ref: 'TUP', t1: 25.4, t7: -15.0, t30: -80.5, tags: ['delisted'] };
                } else if (extracted.category === 'partnership') {
                    simStats = { ref: 'LUNR', t1: 30.5, t7: 15.0, t30: -10.5, tags: ['hype_faded'] };
                } else {
                    simStats = { ref: 'AMC', t1: 5.2, t7: -10.4, t30: -20.6, tags: ['offering'] };
                }

                await supabase.from('similar_case_stats').insert({
                    symbol: symbol,
                    reference_symbol: simStats.ref,
                    similarity_reason: extracted.similarity_reason,
                    outcome_t_plus_1: simStats.t1,
                    outcome_t_plus_7: simStats.t7,
                    outcome_t_plus_30: simStats.t30,
                    ultimate_outcome_tags: simStats.tags
                });

                processedSymbols.push(symbol);
            }
        }

        return NextResponse.json({
            success: true,
            processed: processedSymbols,
            skipped: skippedSymbolCount,
            message: 'Successfully extracted evidence using FMP API & Gemini AI.'
        });

    } catch (e: any) {
        console.error("Cron extract-evidence failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
