import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FMPService } from '@/lib/api/fmp';
import { getTopGainersWithMeta } from '@/lib/gainersCache';
import { getKoreanNames } from '@/lib/api/koreanNames';
import { createClient } from '@/lib/supabase/server';
import ThemeAdminPanel from '@/components/ThemeAdminPanel';

export const dynamic = 'force-dynamic';

// 테마 정의
const THEMES: Record<string, {
  id: string;
  name: string;
  bgClass: string;
  description: string;
  matchFn: (item: { name: string; sector?: string | null; industry?: string | null }) => boolean;
}> = {
  oil: {
    id: 'oil',
    name: '석유',
    bgClass: 'bg-gradient-to-br from-stone-600 to-stone-900',
    description: '에너지·원유·석유 관련 기업',
    matchFn: (item) => {
      const s = (item.sector ?? '').toLowerCase();
      const ind = (item.industry ?? '').toLowerCase();
      return s.includes('energy') || ind.includes('oil') || ind.includes('petroleum') || ind.includes('natural gas');
    },
  },
  cannabis: {
    id: 'cannabis',
    name: '대마',
    bgClass: 'bg-gradient-to-br from-green-500 to-emerald-800',
    description: '대마·헴프·마리화나 관련 기업',
    matchFn: (item) => {
      const n = (item.name ?? '').toLowerCase();
      const ind = (item.industry ?? '').toLowerCase();
      return n.includes('cannabis') || n.includes('hemp') || n.includes('marijuana') ||
             ind.includes('cannabis') || ind.includes('marijuana');
    },
  },
  ai: {
    id: 'ai',
    name: 'AI',
    bgClass: 'bg-gradient-to-br from-blue-500 to-violet-800',
    description: '인공지능·반도체·소프트웨어 관련 기업',
    matchFn: (item) => {
      const n = (item.name ?? '').toLowerCase();
      const ind = (item.industry ?? '').toLowerCase();
      const s = (item.sector ?? '').toLowerCase();
      return n.includes(' ai') || n.startsWith('ai ') || n.includes('artificial') ||
             ind.includes('artificial intelligence') || ind.includes('semiconductor') ||
             (s.includes('technology') && ind.includes('software'));
    },
  },
};

// 테마별 SVG 아이콘
function ThemeHeroIcon({ id }: { id: string }) {
  if (id === 'oil') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
      <ellipse cx="32" cy="49" rx="14" ry="5" fill="rgba(255,255,255,0.1)" />
      <path d="M32 10 C32 10 18 27 18 38 C18 45.7 24.3 52 32 52 C39.7 52 46 45.7 46 38 C46 27 32 10 32 10Z" fill="rgba(255,255,255,0.88)" />
      <path d="M32 23 C32 23 24 32 24 39 C24 42.8 27.6 46 32 46 C36.4 46 40 42.8 40 39 C40 32 32 23 32 23Z" fill="rgba(180,110,20,0.85)" />
    </svg>
  );
  if (id === 'cannabis') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
      <path d="M32 8 C32 8 21 23 24 33 C19 29 12 25 12 25 C12 36 20 42 29 43 L27 57 L37 57 L35 43 C44 42 52 36 52 25 C52 25 45 29 40 33 C43 23 32 8 32 8Z" fill="rgba(255,255,255,0.88)" />
    </svg>
  );
  if (id === 'ai') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
      <circle cx="32" cy="32" r="6" fill="rgba(255,255,255,0.95)" />
      <circle cx="13" cy="20" r="4" fill="rgba(255,255,255,0.6)" />
      <circle cx="51" cy="20" r="4" fill="rgba(255,255,255,0.6)" />
      <circle cx="13" cy="44" r="4" fill="rgba(255,255,255,0.6)" />
      <circle cx="51" cy="44" r="4" fill="rgba(255,255,255,0.6)" />
      <circle cx="32" cy="9" r="3" fill="rgba(255,255,255,0.45)" />
      <circle cx="32" cy="55" r="3" fill="rgba(255,255,255,0.45)" />
      <line x1="32" y1="26" x2="13" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1="32" y1="26" x2="51" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1="32" y1="38" x2="13" y2="44" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1="32" y1="38" x2="51" y2="44" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1="32" y1="26" x2="32" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1="32" y1="38" x2="32" y2="52" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
    </svg>
  );
  return null;
}

export default async function ThemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = THEMES[id];
  if (!theme) notFound();

  // 어드민 여부 + 고정 티커 병렬 fetch
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: roleData }, { data: pinnedRows }, universe] = await Promise.all([
    user
      ? supabase.from('user_roles').select('role_type').eq('user_id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('theme_tickers')
      .select('symbol, added_at')
      .eq('theme_id', id)
      .order('added_at', { ascending: false }),
    getTopGainersWithMeta(),
  ]);

  const isAdmin = roleData?.role_type === 'admin';
  const pinnedTickers: { symbol: string; added_at: string }[] = pinnedRows ?? [];
  const pinnedSymbols = new Set(pinnedTickers.map(t => t.symbol));

  const allSymbols = universe.map(g => g.symbol);
  const [liveQuotes, marketQuotes] = await Promise.all([
    // 고정 티커(universe에 없을 수 있음)까지 포함해서 quote 조회
    FMPService.getRealTimeQuotes([...new Set([...allSymbols, ...pinnedSymbols])]),
    FMPService.getRealTimeQuotes(['^IXIC', 'USOIL']),
  ]);

  // 자동 매칭 종목
  const autoMatches = universe.filter(theme.matchFn);

  // 고정 티커 중 universe에 없는 것 — FMP quote로 보완
  const pinnedExtra = pinnedTickers
    .filter(t => !autoMatches.find(m => m.symbol === t.symbol))
    .map(t => ({
      symbol: t.symbol,
      name: t.symbol,
      sector: null as string | null,
      industry: null as string | null,
      price: liveQuotes[t.symbol]?.price ?? 0,
      changesPercentage: liveQuotes[t.symbol]?.changePercentage ?? 0,
    }));

  // 병합: 고정 + 자동 (중복 제거)
  const allMatches = [
    ...pinnedExtra,
    ...autoMatches,
  ];

  // 한국어 이름
  const koreanNames = await getKoreanNames(
    allMatches.map(i => ({ symbol: i.symbol, name: i.name }))
  );

  // 종목 상세 데이터 (수익률 높은 순)
  const stocks = allMatches
    .map(item => ({
      symbol: item.symbol,
      name: item.name,
      koreanName: koreanNames[item.symbol] ?? null,
      changePercent: liveQuotes[item.symbol]?.changePercentage ?? item.changesPercentage,
      price: liveQuotes[item.symbol]?.price ?? item.price,
      sector: item.sector,
      industry: item.industry,
      isPinned: pinnedSymbols.has(item.symbol),
    }))
    .sort((a, b) => b.changePercent - a.changePercent);

  const avgReturn = stocks.length > 0
    ? stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length
    : null;

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col">
      {/* 히어로 헤더 */}
      <div className={`${theme.bgClass} px-5 pt-5 pb-6 relative`}>
        {/* 뒤로가기 — 우상단 아이콘 */}
        <div className="flex justify-end mb-4">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition"
            aria-label="뒤로가기"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <ThemeHeroIcon id={id} />
          </div>
          <div>
            <p className="text-white/60 text-[11px] font-bold tracking-wider uppercase mb-0.5">테마주</p>
            <h1 className="text-white font-black text-[28px] leading-tight">{theme.name}</h1>
            <p className="text-white/70 text-[12px] mt-0.5">{theme.description}</p>
          </div>
        </div>

        {/* 요약 스탯: 오늘 평균 수익률 + 테마별 지표 */}
        <div className="mt-5 flex gap-3">
          {/* 공통: 오늘 평균 수익률 */}
          <div className="flex-1 bg-white/10 rounded-xl px-4 py-3">
            <p className="text-white/60 text-[10px] font-bold mb-0.5">오늘 평균 수익률</p>
            {avgReturn !== null ? (
              <p className={`font-black text-[20px] ${avgReturn >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(2)}%
              </p>
            ) : (
              <p className="font-black text-[18px] text-white/30">— %</p>
            )}
          </div>

          {/* 석유: WTI 유가 */}
          {id === 'oil' && (
            <div className="flex-1 bg-white/10 rounded-xl px-4 py-3">
              <p className="text-white/60 text-[10px] font-bold mb-0.5">WTI 원유</p>
              {marketQuotes['USOIL']?.price != null ? (
                <>
                  <p className="font-black text-[20px] text-white">
                    ${marketQuotes['USOIL'].price.toFixed(2)}
                  </p>
                  <p className={`text-[11px] font-bold mt-0.5 ${(marketQuotes['USOIL'].changePercentage ?? 0) >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                    {(marketQuotes['USOIL'].changePercentage ?? 0) >= 0 ? '+' : ''}{(marketQuotes['USOIL'].changePercentage ?? 0).toFixed(2)}%
                  </p>
                </>
              ) : (
                <p className="font-black text-[18px] text-white/30">— $</p>
              )}
            </div>
          )}

          {/* AI: 나스닥 종합지수 */}
          {id === 'ai' && (
            <div className="flex-1 bg-white/10 rounded-xl px-4 py-3">
              <p className="text-white/60 text-[10px] font-bold mb-0.5">나스닥 지수</p>
              {marketQuotes['^IXIC']?.changePercentage != null ? (
                <>
                  <p className={`font-black text-[20px] ${marketQuotes['^IXIC'].changePercentage >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                    {marketQuotes['^IXIC'].changePercentage >= 0 ? '+' : ''}{marketQuotes['^IXIC'].changePercentage.toFixed(2)}%
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {marketQuotes['^IXIC'].price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </>
              ) : (
                <p className="font-black text-[18px] text-white/30">— %</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 어드민 패널 */}
      {isAdmin && (
        <ThemeAdminPanel
          themeId={id}
          themeName={theme.name}
          pinnedTickers={pinnedTickers}
        />
      )}

      {/* 종목 리스트 */}
      <div className="flex-1 px-4 pt-5 pb-10">
        {stocks.length > 0 ? (
          <>
            <p className="text-[11px] text-gray-400 font-bold mb-3 tracking-wider uppercase">
              수익률 순위 · {stocks.length}개 종목
            </p>
            <div className="space-y-2">
              {stocks.map((stock, idx) => (
                <Link href={`/ticker/${stock.symbol}`} key={stock.symbol}>
                  <div className={`bg-white rounded-xl border shadow-sm px-4 py-3.5 flex items-center hover:bg-gray-50 transition mb-2 ${stock.isPinned ? 'border-orange-200' : 'border-gray-100'}`}>
                    {/* 순위 */}
                    <div className="w-6 shrink-0 mr-3">
                      <span className="text-[13px] font-black text-gray-300">{idx + 1}</span>
                    </div>
                    {/* 종목 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-bold text-[14px] text-gray-900 leading-tight truncate">
                          {stock.koreanName ?? stock.name}
                        </p>
                        {stock.isPinned && (
                          <span className="text-[9px] font-black text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full shrink-0">고정</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{stock.symbol}</span>
                        {stock.industry && (
                          <span className="text-[10px] text-gray-400 truncate">{stock.industry}</span>
                        )}
                      </div>
                    </div>
                    {/* 수익률 + 가격 */}
                    <div className="text-right shrink-0 ml-3">
                      <p className={`font-black text-[15px] leading-tight ${stock.changePercent >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">${stock.price.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📭</span>
            </div>
            <p className="text-gray-500 font-bold text-[14px]">현재 급등 중인 관련 종목이 없습니다.</p>
            <p className="text-gray-400 text-[12px] mt-1">장중에 다시 확인해주세요.</p>
            <Link href="/" className="mt-6 text-[12px] font-bold text-blue-500 hover:underline">
              ← 메인으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
