'use client';

import Link from 'next/link';

export type ThemeStock = {
  symbol: string;
  name: string;
  koreanName: string | null;
  changePercent: number;
  price: number;
};

export type ThemeCardData = {
  id: string;
  name: string;
  bgClass: string;
  avgReturn: number | null;
  count: number;
  stocks: ThemeStock[];
  // 테마별 시장 지표
  marketReturn?: number | null;   // AI: 나스닥(QQQ) 등락률
  marketPrice?: number | null;    // 석유: WTI 가격
  marketPriceChange?: number | null; // 석유: WTI 등락률
};

// SVG 아이콘: 각 테마별로 클라이언트 컴포넌트 안에 정의
function ThemeIcon({ id }: { id: string }) {
  if (id === 'oil') {
    return (
      <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
        <ellipse cx="32" cy="49" rx="14" ry="5" fill="rgba(255,255,255,0.1)" />
        <path d="M32 10 C32 10 18 27 18 38 C18 45.7 24.3 52 32 52 C39.7 52 46 45.7 46 38 C46 27 32 10 32 10Z" fill="rgba(255,255,255,0.88)" />
        <path d="M32 23 C32 23 24 32 24 39 C24 42.8 27.6 46 32 46 C36.4 46 40 42.8 40 39 C40 32 32 23 32 23Z" fill="rgba(180,110,20,0.85)" />
      </svg>
    );
  }
  if (id === 'cannabis') {
    return (
      <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
        <path d="M32 8 C32 8 21 23 24 33 C19 29 12 25 12 25 C12 36 20 42 29 43 L27 57 L37 57 L35 43 C44 42 52 36 52 25 C52 25 45 29 40 33 C43 23 32 8 32 8Z" fill="rgba(255,255,255,0.88)" />
      </svg>
    );
  }
  if (id === 'ai') {
    return (
      <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
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
  }
  return null;
}

export default function ThemeSection({ cards }: { cards: ThemeCardData[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
      {cards.map((theme) => (
        <Link
          key={theme.id}
          href={`/themes/${theme.id}`}
          className="flex-shrink-0 w-[140px] bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform"
        >
          {/* 테마 그래픽 */}
          <div className={`w-full h-[100px] flex items-center justify-center ${theme.bgClass}`}>
            <ThemeIcon id={theme.id} />
          </div>
          {/* 테마 정보 */}
          <div className="px-3 pt-3 pb-3">
            <p className="font-black text-[15px] text-gray-900 leading-tight mb-0.5">{theme.name}</p>
            <p className="text-[10px] text-gray-400 mb-1.5">오늘 평균 수익률</p>
            {theme.avgReturn !== null ? (
              <p className={`font-black text-[18px] leading-tight ${theme.avgReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {theme.avgReturn >= 0 ? '+' : ''}{theme.avgReturn.toFixed(2)}%
              </p>
            ) : (
              <p className="font-bold text-[14px] text-gray-300 leading-tight">— %</p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              {theme.count > 0 ? `${theme.count}개 종목 ›` : '관련 종목 없음'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
