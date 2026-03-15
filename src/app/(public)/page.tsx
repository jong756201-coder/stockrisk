import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import AutoRefresh from '@/components/AutoRefresh';
import LiveClock from '@/components/LiveClock';
import ThemeSection from '@/components/ThemeSection';
import { getCategoryData } from '@/lib/api/category';
import { FMPService } from '@/lib/api/fmp';
import { recordAndGetDelta } from '@/lib/priceCache';
import { getTopGainersWithMeta, isNoise } from '@/lib/gainersCache';
import { getNewsForActiveSymbols } from '@/lib/newsCache';
import { getKoreanNames } from '@/lib/api/koreanNames';

export const dynamic = 'force-dynamic';

// 평소: 검은 순위 숫자
// 5분 델타 ±10% 이상: ▲ / ▼
// HALT: HALT 표기
function getRankCell(rank: number, fiveMinDelta: number | null, isHalted: boolean, dayChange: number) {
  if (isHalted) {
    const colour = dayChange >= 0 ? 'text-red-500' : 'text-blue-400';
    return { label: 'HALT', className: `${colour} font-black text-[9px] leading-none` };
  }
  // 5분 데이터 없으면 무조건 순위 숫자
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

export default async function DashboardPage() {
  // 캐시에서 FMP 기반 gainers 유니버스 가져옴 (최대 35개, 60초 갱신)
  const [universe, krwRate, latestNews] = await Promise.all([
    getTopGainersWithMeta(),
    FMPService.getForexRate('USDKRW'),
    getNewsForActiveSymbols(5),
  ]);

  // liveQuotes: isHalted, FMP 보완용
  const allSymbols = universe.map(g => g.symbol);
  const liveQuotes = await FMPService.getRealTimeQuotes(allSymbols);

  // FMP liveQuote 기준 정렬, 없으면 캐시값
  const liveSorted = [...universe].sort((a, b) => {
    const pctA = liveQuotes[a.symbol]?.changePercentage ?? a.changesPercentage;
    const pctB = liveQuotes[b.symbol]?.changePercentage ?? b.changesPercentage;
    return pctB - pctA;
  });

  const gainers = liveSorted.slice(0, 5);
  const themes = liveSorted.slice(0, 10);
  const topActives = liveSorted.slice(5, 10);

  // 한국어 회사명 (Supabase 캐시 → 캐시 미스 시 Gemini 배치 번역)
  const allVisible = liveSorted.slice(0, 10);
  const koreanNames = await getKoreanNames(
    allVisible.map(i => ({ symbol: i.symbol, name: i.name }))
  );

  const themeCategoryMap: Record<string, { sector: string | null, industry: string | null, emoji: string }> = {};
  for (const item of universe) {
    themeCategoryMap[item.symbol] = { sector: item.sector, industry: item.industry, emoji: item.emoji };
  }
  for (const t of themes) {
    if (!themeCategoryMap[t.symbol]) {
      themeCategoryMap[t.symbol] = await getCategoryData(t.symbol);
    }
  }


  // === 시장 주도 테마주: 석유 / 대마 / AI ===
  type ThemeMatchFn = (item: { name: string; sector?: string | null; industry?: string | null }) => boolean;
  const themeDefs: { id: string; name: string; bgClass: string; matchFn: ThemeMatchFn }[] = [
    {
      id: 'oil',
      name: '석유',
      bgClass: 'bg-gradient-to-br from-stone-600 to-stone-900',
      matchFn: (item) => {
        const s = (item.sector ?? '').toLowerCase();
        const ind = (item.industry ?? '').toLowerCase();
        return s.includes('energy') || ind.includes('oil') || ind.includes('petroleum') || ind.includes('natural gas');
      },
    },
    {
      id: 'cannabis',
      name: '대마',
      bgClass: 'bg-gradient-to-br from-green-500 to-emerald-800',
      matchFn: (item) => {
        const n = (item.name ?? '').toLowerCase();
        const ind = (item.industry ?? '').toLowerCase();
        return n.includes('cannabis') || n.includes('hemp') || n.includes('marijuana') ||
               ind.includes('cannabis') || ind.includes('marijuana');
      },
    },
    {
      id: 'ai',
      name: 'AI',
      bgClass: 'bg-gradient-to-br from-blue-500 to-violet-800',
      matchFn: (item) => {
        const n = (item.name ?? '').toLowerCase();
        const ind = (item.industry ?? '').toLowerCase();
        const s = (item.sector ?? '').toLowerCase();
        return n.includes(' ai') || n.startsWith('ai ') || n.includes('artificial') ||
               ind.includes('artificial intelligence') || ind.includes('semiconductor') ||
               (s.includes('technology') && ind.includes('software'));
      },
    },
  ];

  const computedThemes = themeDefs.map(def => {
    const matches = universe.filter(def.matchFn);
    const avgReturn = matches.length > 0
      ? matches.reduce((sum, item) => {
          const chg = liveQuotes[item.symbol]?.changePercentage ?? item.changesPercentage;
          return sum + chg;
        }, 0) / matches.length
      : null;
    // 종목 상세 (직렬화 가능, 수익률 높은 순 정렬)
    const stocks = matches
      .map(item => ({
        symbol: item.symbol,
        name: item.name,
        koreanName: koreanNames[item.symbol] ?? null,
        changePercent: liveQuotes[item.symbol]?.changePercentage ?? item.changesPercentage,
        price: liveQuotes[item.symbol]?.price ?? item.price,
      }))
      .sort((a, b) => b.changePercent - a.changePercent);
    return { id: def.id, name: def.name, bgClass: def.bgClass, avgReturn, count: matches.length, stocks };
  });

  const sortedThemeCards = [...computedThemes].sort(
    (a, b) => (b.avgReturn ?? -Infinity) - (a.avgReturn ?? -Infinity)
  );

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4 relative">
      <AutoRefresh intervalMs={60000} />

      {/* 상단 바: 검색 + 유저 아이콘 */}
      <div className="flex items-center justify-end gap-2 mt-1 mb-3">
        <Link
          href="/search"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition text-gray-500"
          aria-label="종목 검색"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="22" y2="22" />
          </svg>
        </Link>
        <AuthButton />
      </div>

      {/* 로고 + 인라인 시계 */}
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tighter">StockRisk 🦅</h1>
        <LiveClock compact />
      </header>

      {/* 환율 스트립 */}
      {krwRate && (
        <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-bold tracking-wider">USD / KRW</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[18px] font-black text-gray-900">{krwRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
            <span className="text-[11px] text-gray-400 font-medium">원</span>
          </div>
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
          실시간 급등주
        </h2>
        <div className="space-y-3">
          {gainers.length > 0 ? (
            gainers.map((item, idx) => {
              const quote = liveQuotes[item.symbol];
              const isHalted = quote?.isHalted ?? false;
              // 가격/% 는 FMP /quote 사용 (이미 프리마켓 반영됨)
              const displayPrice = quote?.price ?? item.price;
              const displayChangePct = quote?.changePercentage ?? item.changesPercentage;
              const fiveMinDelta = recordAndGetDelta(item.symbol, displayPrice);
              const rank = getRankCell(idx + 1, fiveMinDelta, isHalted, displayChangePct);

              return (
                <Link href={`/ticker/${item.symbol}`} key={item.symbol}>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center hover:bg-red-50 transition cursor-pointer mb-3">
                    <div className="flex items-center justify-center w-5 shrink-0 mr-2">
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
                      <p className={`font-bold text-[15px] leading-tight mb-0.5 ${displayChangePct > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {displayChangePct > 0 ? '+' : ''}{displayChangePct.toFixed(2)}%
                      </p>
                      <p className="text-[11px] font-medium text-gray-400">${displayPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">감지된 실시간 급등주가 없습니다.</p>
          )}

          {gainers.length > 0 && (
            <Link href="/gainers" className="block text-center text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition py-2.5 rounded-lg mt-2">
              급등주 전체보기 ↗
            </Link>
          )}
        </div>
      </section>

      {/* 실시간 거래대금 상위 */}
      <section className="mb-6">
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
          실시간 거래대금 상위
        </h2>
        <div className="space-y-3">
          {topActives.length > 0 ? (
            topActives.map((item, idx) => {
              const quote = liveQuotes[item.symbol];
              const livePrice = quote?.price ?? item.price;
              const isHalted = quote?.isHalted ?? false;
              const dayChange = quote?.changePercentage ?? item.changesPercentage;
              const fiveMinDelta = recordAndGetDelta(item.symbol, livePrice);
              const rank = getRankCell(idx + 1, fiveMinDelta, isHalted, dayChange);
              return (
                <Link href={`/ticker/${item.symbol}`} key={`active-${item.symbol}`}>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center hover:bg-orange-50 transition cursor-pointer mb-3">
                    <div className="flex items-center justify-center w-5 shrink-0 mr-2">
                      <span className={rank.className}>{rank.label}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center pr-3 mr-3 border-r border-gray-100 text-2xl w-10 shrink-0" title={item.symbol}>
                      {themeCategoryMap[item.symbol]?.emoji || '🏢'}
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
                      <p className="text-[11px] font-medium text-gray-400">${livePrice.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">거래대금 데이터가 없습니다.</p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
          시장 주도 테마주
        </h2>
        <ThemeSection cards={sortedThemeCards} />
      </section>

      {/* 뉴스 미리보기 */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
          마이크로캡 최신 뉴스
        </h2>
        <div className="space-y-2">
          {latestNews.map((item, i) => {
            const href = item.url || item.link || '#';
            const ago = (() => {
              const diff = Date.now() - new Date(item.publishedDate).getTime();
              const m = Math.floor(diff / 60000);
              if (m < 60) return `${m}분 전`;
              const h = Math.floor(m / 60);
              return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
            })();
            return (
              <a
                key={`news-${i}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${item.symbolSource === 'gainer' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {item.symbol}
                  </span>
                  <span className="text-[10px] text-gray-400">{ago}</span>
                </div>
                <p className="text-[12px] font-bold text-gray-900 leading-snug line-clamp-2">{item.title}</p>
              </a>
            );
          })}
        </div>
        <Link href="/news" className="block text-center text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition py-2.5 rounded-lg mt-3">
          뉴스 전체보기 ↗
        </Link>
      </section>
    </main >
  );
}
