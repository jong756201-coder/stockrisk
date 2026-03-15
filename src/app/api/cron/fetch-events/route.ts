import { NextResponse } from 'next/server';
import { FMPService } from '@/lib/api/fmp';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 1. FMP Stable API Gainers & Actives
        const [gainersRaw, themesRaw] = await Promise.all([
            FMPService.getTopGainers(),
            FMPService.getTopActives()
        ]);

        const gainers = gainersRaw;
        const themes = themesRaw;

        let insertedEvents = 0;
        const supabase = createAdminClient();

        // 중복 로직 함수화: 기존 내역이 있으면 시간과 지표를 업데이트하여 상위로 끌어올림(bump)
        const processItems = async (items: any[], eventType: string) => {
            for (const item of items) {
                // Tickers 테이블 Upsert
                await supabase.from('tickers').upsert({
                    symbol: item.symbol,
                    company_name: item.name,
                    last_price: item.price,
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'symbol' });

                // 오늘 등록된 동일 타입 이벤트 조회
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const { data: existingEvent } = await supabase
                    .from('events')
                    .select('id')
                    .eq('symbol', item.symbol)
                    .eq('event_type', eventType)
                    .gte('happened_at', todayStart.toISOString())
                    .limit(1)
                    .single();

                if (existingEvent) {
                    // Update to bump it to the top with fresh data
                    await supabase.from('events').update({
                        happened_at: new Date().toISOString(),
                        metrics_json: {
                            change_percentage: item.changesPercentage,
                            change_amount: item.change,
                            theme: null
                        }
                    }).eq('id', existingEvent.id);
                } else {
                    // Insert new event
                    await supabase.from('events').insert({
                        symbol: item.symbol,
                        event_type: eventType,
                        metrics_json: {
                            change_percentage: item.changesPercentage,
                            change_amount: item.change,
                            theme: null
                        }
                    });
                    insertedEvents++;
                }
            }
        };

        // 급등주 (price_gap_up) 처리
        await processItems(gainers, 'price_gap_up');
        // 테마주 (volume_spike) 처리 - 임의로 volume_spike를 테마주 트리거로 사용
        await processItems(themes, 'volume_spike');

        // FMP 리스트에서 빠진 종목들의 이벤트를 만료시킴
        // → happened_at을 2시간 전으로 설정하여 30분 윈도우에서 자연 탈락
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

        const currentGainerSymbols = gainers.map((g: any) => g.symbol);
        const currentThemeSymbols = themes.map((t: any) => t.symbol);

        // 오늘 등록된 price_gap_up 이벤트 중 현재 FMP 급등주 리스트에 없는 것
        const { data: staleGainers } = await supabase
            .from('events')
            .select('id, symbol')
            .eq('event_type', 'price_gap_up')
            .gte('happened_at', todayStart.toISOString())
            .not('symbol', 'in', `(${currentGainerSymbols.join(',')})`);

        if (staleGainers && staleGainers.length > 0) {
            const staleIds = staleGainers.map((e: any) => e.id);
            await supabase.from('events').update({ happened_at: twoHoursAgo }).in('id', staleIds);
        }

        // 오늘 등록된 volume_spike 이벤트 중 현재 FMP 활발주 리스트에 없는 것
        const { data: staleThemes } = await supabase
            .from('events')
            .select('id, symbol')
            .eq('event_type', 'volume_spike')
            .gte('happened_at', todayStart.toISOString())
            .not('symbol', 'in', `(${currentThemeSymbols.join(',')})`);

        if (staleThemes && staleThemes.length > 0) {
            const staleIds = staleThemes.map((e: any) => e.id);
            await supabase.from('events').update({ happened_at: twoHoursAgo }).in('id', staleIds);
        }

        const expiredCount = (staleGainers?.length || 0) + (staleThemes?.length || 0);

        return NextResponse.json({
            success: true,
            fetched_count: gainers.length + themes.length,
            inserted_events: insertedEvents,
            expired_events: expiredCount,
            message: 'Successfully fetched live momentum & theme stocks.'
        });

    } catch (e: any) {
        console.error("Cron fetch-events failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
