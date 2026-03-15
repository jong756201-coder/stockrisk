import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import WatchlistButton from '@/components/WatchlistButton';
import NativeChart from '@/components/NativeChart';
import { FundamentalsService } from '@/lib/api/fundamentals';
import { FMPService } from '@/lib/api/fmp';
import RealityCheckPanel from '@/components/RealityCheckPanel';
import SecRiskFactors from '@/components/SecRiskFactors';
import InsiderTradingSection from '@/components/InsiderTradingSection';
import FutureEventsSection from '@/components/FutureEventsSection';
import SecFilingsSection from '@/components/SecFilingsSection';
import LatestFilingCard from '@/components/LatestFilingCard';
import { getKoreanNames } from '@/lib/api/koreanNames';

export const dynamic = 'force-dynamic'; // 테스트 중: 캐싱 비활성화

export default async function TickerPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const uppercaseSymbol = symbol.toUpperCase();
  const supabase = await createClient();

  // Fetch ticker details
  const { data: ticker } = await supabase.from('tickers').select('*').eq('symbol', uppercaseSymbol).single();

  // Fetch evidence containing missing factors
  const { data: evidence } = await supabase
    .from('extracted_evidence')
    .select('*')
    .eq('symbol', uppercaseSymbol)
    .in('status', ['published', 'pending_review']) // Show both for MVP demo purposes
    .order('extracted_at', { ascending: false });

  // Fetch similar stats
  const { data: stats } = await supabase
    .from('similar_case_stats')
    .select('*')
    .eq('symbol', uppercaseSymbol)
    .limit(3);

  const englishName = ticker?.company_name ?? uppercaseSymbol;
  const [realityData, chartData, krwRate, quotesMap, newsItems, koreanNamesMap] = await Promise.all([
    FundamentalsService.getRealityCheck(uppercaseSymbol),
    FMPService.getHistoricalChartDaily(uppercaseSymbol),
    FMPService.getForexRate('USDKRW'),
    FMPService.getRealTimeQuotes([uppercaseSymbol]),
    FMPService.getRecentNews(uppercaseSymbol, 3),
    getKoreanNames([{ symbol: uppercaseSymbol, name: englishName }]),
  ]);

  const koreanName = koreanNamesMap[uppercaseSymbol] ?? null;

  // /quote 엔드포인트 데이터 우선, 없으면 profile fallback
  const liveQuote = quotesMap[uppercaseSymbol] ?? null;
  const displayPrice: number | null = liveQuote?.price ?? realityData?.price ?? null;
  const displayChangePct: number | null = liveQuote?.changePercentage ?? realityData?.changesPercentage ?? null;

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4 relative">
      <header className="mb-4 flex flex-col justify-end">
        <div className="flex items-center justify-end gap-2 mb-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
            aria-label="뒤로가기"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <AuthButton />
        </div>
        <div className="flex justify-between items-start w-full">
          <div className="flex-1 min-w-0">
            {/* 섹터 / 인더스트리 뱃지 */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {realityData?.sector && <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-black tracking-tight">{realityData.sector.toUpperCase()}</span>}
              {realityData?.industry && <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-black tracking-tight">{realityData.industry.toUpperCase()}</span>}
              <span id="sec-risk-sticker-portal"></span>
            </div>
            {/* 회사 한국어명 */}
            <h1 className="text-3xl font-black leading-tight">
              {koreanName ?? realityData?.companyName ?? ticker?.company_name ?? uppercaseSymbol}
            </h1>
            {/* 티커 배지 + 영문 풀네임 */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex-shrink-0">
                {uppercaseSymbol}
              </span>
              <p className="text-[12px] font-medium text-gray-400 truncate">
                {realityData?.companyName || ticker?.company_name || '—'}
              </p>
            </div>
            {/* 현재 주가 + 등락률 */}
            {displayPrice != null && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[22px] font-black tabular-nums leading-none">
                  ${displayPrice < 0.01
                    ? displayPrice.toFixed(6)
                    : displayPrice < 1
                    ? displayPrice.toFixed(4)
                    : displayPrice.toFixed(2)}
                </span>
                {displayChangePct != null && !isNaN(displayChangePct) && (
                  <span className={`text-[12px] font-black px-2 py-0.5 rounded-full tabular-nums ${
                    displayChangePct > 0
                      ? 'bg-red-50 text-red-500'
                      : displayChangePct < 0
                      ? 'bg-blue-50 text-blue-500'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {displayChangePct > 0 ? '+' : ''}{displayChangePct.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {/* 하트 버튼 — 티커 오른쪽 끝 */}
          <WatchlistButton symbol={uppercaseSymbol} />
        </div>
      </header>

      {/* 0. Live Interactive Native Chart */}
      <section className="mb-3 bg-transparent">
        <NativeChart data={chartData} />
        <p className="text-[10px] text-gray-400 text-right mt-1 font-medium tracking-tight">Real-time data provided by FMP</p>
      </section>

      {/* 0.1 최신 공시 요약 카드 (차트 바로 아래) */}
      <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-2">
        Why is it moving?
      </h2>
      <LatestFilingCard symbol={uppercaseSymbol} />

      {/* 0.5 내부자 거래 */}
      <InsiderTradingSection symbol={uppercaseSymbol} />

      {/* 0.6 예정된 이벤트 (프레스 릴리즈 → Gemini 추출) */}
      <FutureEventsSection symbol={uppercaseSymbol} />

      {/* 0.65 주요 SEC 공시 (자본조달 / 8-K / 대주주 지분변동) */}
      <SecFilingsSection symbol={uppercaseSymbol} />

      {/* 0.7 Reality Check */}
      <RealityCheckPanel data={realityData} symbol={uppercaseSymbol} krwRate={krwRate} />


      {/* 1. Evidence & Risks Section */}
      <section className="mb-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center">
          <span className="w-1.5 h-4 bg-red-600 mr-2 rounded-sm"></span>
          객관적 리스크 팩터
        </h2>

        {/* SEC AI 리스크 분석 (Gemini) — 자본조달이력, 계속기업 불확실성 등 */}
        <SecRiskFactors symbol={uppercaseSymbol} />

        {!evidence || evidence.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 bg-white rounded-xl border border-gray-100">발견된 리스크/근거 데이터가 없습니다.</p>
        ) : (
          evidence.map((ev) => (
            <div key={ev.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-red-600">
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded mb-2">
                {ev.category.toUpperCase()}
              </span>
              <h3 className="font-bold text-[15px] mb-3 leading-tight">{ev.headline}</h3>

              <div className="bg-red-50 rounded-lg p-3 mb-3">
                <p className="text-[11px] font-bold text-red-800 mb-1">🚨 Missing / Risk Factors</p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-red-900">
                  {ev.missing_or_risk_factors?.map((factor: string, i: number) => (
                    <li key={i}>{factor}</li>
                  ))}
                </ul>
              </div>

              <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="block w-full text-center text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 py-2 rounded-lg hover:bg-gray-100 transition">
                원문 교차 검증하기 ↗
              </a>
            </div>
          ))
        )}
      </section>

      {/* 2. Similar Case Stats Section */}
      <section className="mb-6 space-y-3">
        <h2 className="text-lg font-bold flex items-center">
          <span className="w-1.5 h-4 bg-blue-600 mr-2 rounded-sm"></span>
          과거 유사 사례 결말
        </h2>

        {!stats || stats.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 bg-white rounded-xl border border-gray-100">유사 과거 사례 데이터가 없습니다.</p>
        ) : (
          stats.map((stat) => (
            <div key={stat.id} className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 mb-1">유사 종목: <span className="text-black">{stat.reference_symbol}</span></p>
              <h3 className="font-bold text-sm mb-4 leading-snug">"{stat.similarity_reason}"</h3>

              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-gray-50 py-2 rounded border border-gray-100">
                  <p className="text-[10px] text-gray-500">T+1일</p>
                  <p className={`font-black text-sm ${stat.outcome_t_plus_1 > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {stat.outcome_t_plus_1 > 0 ? '+' : ''}{stat.outcome_t_plus_1}%
                  </p>
                </div>
                <div className="bg-gray-50 py-2 rounded border border-gray-100">
                  <p className="text-[10px] text-gray-500">T+7일</p>
                  <p className={`font-black text-sm ${stat.outcome_t_plus_7 > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {stat.outcome_t_plus_7 > 0 ? '+' : ''}{stat.outcome_t_plus_7}%
                  </p>
                </div>
                <div className="bg-gray-50 py-2 rounded border border-gray-100">
                  <p className="text-[10px] text-gray-500">T+30일</p>
                  <p className={`font-black text-sm ${stat.outcome_t_plus_30 > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {stat.outcome_t_plus_30 > 0 ? '+' : ''}{stat.outcome_t_plus_30}%
                  </p>
                </div>
              </div>

              <div className="flex gap-1 flex-wrap">
                {stat.ultimate_outcome_tags?.map((tag: string, i: number) => (
                  <span key={i} className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-bold">#{tag}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 3. Latest News */}
      <section className="mb-6">
        <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-3">Latest News</h2>
        {newsItems.length === 0 ? (
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-2.5">
            <span className="text-xl">📭</span>
            <p className="text-[13px] text-gray-400 font-bold">최신 뉴스가 없어요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {newsItems.map((news, i) => {
              const href = news.url ?? '#';
              const ago = (() => {
                if (!news.publishedDate) return '';
                const diff = Date.now() - new Date(news.publishedDate).getTime();
                const h = Math.floor(diff / 36e5);
                if (h < 1) return `${Math.floor(diff / 6e4)}m ago`;
                if (h < 24) return `${h}h ago`;
                return `${Math.floor(h / 24)}d ago`;
              })();
              return (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
                >
                  {news.image ? (
                    <img src={news.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-xl">📰</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {news.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {news.site && <span className="text-[10px] font-bold text-gray-400 truncate max-w-[120px]">{news.site}</span>}
                      {news.site && ago && <span className="text-gray-200">·</span>}
                      {ago && <span className="text-[10px] text-gray-400 flex-shrink-0">{ago}</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5">↗</span>
                </a>
              );
            })}
          </div>
        )}
      </section>

    </main>
  );
}
