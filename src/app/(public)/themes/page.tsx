import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ThemesPage() {
    const supabase = await createClient();

    // eslint-disable-next-line react-hooks/purity
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();

    const { data: themes } = await supabase
        .from('events')
        .select(`
      id,
      event_type,
      symbol,
      happened_at,
      metrics_json,
      tickers!inner (
        company_name,
        last_price
      )
    `)
        .eq('event_type', 'volume_spike')
        .gte('happened_at', thirtyMinsAgo)
        .order('happened_at', { ascending: false })
        .limit(50); // Show up to 50 instead of 5

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4">
            <header className="mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black">시장 주도 테마주 전체목록</h1>
                    <p className="text-sm text-gray-500 mt-1">최근 거래량이 폭등한 인기 테마 주식들입니다.</p>
                </div>
                <Link
                    href="/"
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition mt-1 shrink-0"
                    aria-label="뒤로가기"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </Link>
            </header>

            <section>
                <div className="grid grid-cols-2 gap-3">
                    {themes && themes.length > 0 ? (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        themes.map((evt: any) => (
                            <Link href={`/ticker/${evt.symbol}`} key={`theme-${evt.id}`}>
                                <div className="h-full bg-white text-black border border-gray-200 p-4 rounded-lg font-bold hover:border-orange-500 transition shadow-sm">
                                    <div className="text-xs text-orange-500 mb-2">{evt.metrics_json?.theme || '인기 테마'}</div>
                                    <div className="text-xl mb-1">{evt.symbol}</div>
                                    <div className="text-xs font-normal text-gray-500 truncate max-w-full mb-3">
                                        {Array.isArray(evt.tickers) ? evt.tickers[0]?.company_name : evt.tickers?.company_name}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-auto">{new Date(evt.happened_at).toLocaleTimeString()}</div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 col-span-2 text-center py-4">감지된 테마주가 없습니다.</p>
                    )}
                </div>
            </section>
        </main>
    );
}
