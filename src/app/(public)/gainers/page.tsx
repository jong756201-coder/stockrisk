import Link from 'next/link';
import { FMPService } from '@/lib/api/fmp';
import { recordAndGetDelta } from '@/lib/priceCache';
import { getTopGainersWithMeta } from '@/lib/gainersCache';
import { getKoreanNames } from '@/lib/api/koreanNames';

export const dynamic = 'force-dynamic';

function getRankCell(rank: number, fiveMinDelta: number | null, isHalted: boolean, dayChange: number) {
    if (isHalted) {
        const colour = dayChange >= 0 ? 'text-red-500' : 'text-blue-400';
        return { label: 'HALT', className: `${colour} font-black text-[9px] leading-none` };
    }
    if (fiveMinDelta === null) {
        return { label: String(rank), className: 'text-gray-900 font-black text-sm leading-none' };
    }
    if (fiveMinDelta >= 10) {
        return { label: '▲', className: 'text-red-500 font-black text-base leading-none' };
    }
    if (fiveMinDelta <= -10) {
        return { label: '▼', className: 'text-blue-400 font-black text-base leading-none' };
    }
    return { label: String(rank), className: 'text-gray-900 font-black text-sm leading-none' };
}

export default async function GainersPage() {
    const universe = await getTopGainersWithMeta();

    const symbols = universe.map(g => g.symbol);
    const [liveQuotes, koreanNames] = await Promise.all([
        FMPService.getRealTimeQuotes(symbols),
        getKoreanNames(universe.map(i => ({ symbol: i.symbol, name: i.name }))),
    ]);

    const gainers = [...universe].sort((a, b) => {
        const pctA = liveQuotes[a.symbol]?.changePercentage ?? a.changesPercentage;
        const pctB = liveQuotes[b.symbol]?.changePercentage ?? b.changesPercentage;
        return pctB - pctA;
    }).slice(0, 20);

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4">
            <header className="mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black">실시간 급등주 전체목록</h1>
                    <p className="text-sm text-gray-500 mt-1">FMP API 기준 실시간 급상승 종목입니다.</p>
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
                <div className="space-y-3">
                    {gainers.length > 0 ? (
                        gainers.map((item, idx) => {
                            const quote = liveQuotes[item.symbol];
                            const livePrice = quote?.price ?? item.price;
                            const isHalted = quote?.isHalted ?? false;
                            const dayChange = quote?.changePercentage ?? item.changesPercentage;
                            const fiveMinDelta = recordAndGetDelta(item.symbol, livePrice);
                            const rank = getRankCell(idx + 1, fiveMinDelta, isHalted, dayChange);
                            return (
                                <Link href={`/ticker/${item.symbol}`} key={item.symbol}>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center hover:bg-red-50 transition cursor-pointer mb-3">
                                        <div className="flex items-center justify-center w-6 shrink-0 mr-2">
                                            <span className={rank.className}>{rank.label}</span>
                                        </div>
                                        <div className="flex flex-col items-center justify-center pr-3 mr-3 border-r border-gray-100 text-2xl w-10 shrink-0" title={item.sector || 'Unknown'}>
                                            {item.emoji || '🏢'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-[15px] leading-tight mb-0.5 truncate">
                                                {koreanNames[item.symbol] ?? item.name}
                                            </h3>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">{item.symbol}</span>
                                                <p className="text-[11px] text-gray-400 truncate">{item.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end flex-shrink-0">
                                            <p className={`font-bold text-[15px] leading-tight mb-0.5 ${dayChange > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                {dayChange > 0 ? '+' : ''}{dayChange.toFixed(2)}%
                                            </p>
                                            <p className="text-[11px] text-gray-400">${livePrice.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">감지된 실시간 급등주가 없습니다.</p>
                    )}
                </div>
            </section>
        </main>
    );
}
