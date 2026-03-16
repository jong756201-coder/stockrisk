'use client';

import { useEffect, useState } from 'react';
import FilingCard from '@/components/FilingCard';

interface SpikeEvent {
  date: string;
  changePercent: number;
  close: number;
  volume: number;
  type: 'spike' | 'crash';
  afterDays: {
    t1?: number;
    t7?: number;
    t30?: number;
  };
  news: Array<{
    title: string;
    publishedDate: string;
    url?: string;
    site?: string;
  }>;
  filings: Array<{
    formType: string;
    filingDate: string;
    link: string;
    summary?: string | null;
  }>;
}

function formatDate(dateStr: string): string {
  const d = dateStr.split('T')[0];
  if (!d) return dateStr;
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

function AfterBadge({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  const color = value >= 0 ? 'text-red-500' : 'text-blue-500';
  return (
    <div className="text-center">
      <p className="text-[9px] text-gray-400 font-bold">{label}</p>
      <p className={`text-[12px] font-black ${color}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </p>
    </div>
  );
}

function EventCard({ event, symbol }: { event: SpikeEvent; symbol: string }) {
  const [expanded, setExpanded] = useState(false);
  const isSpike = event.type === 'spike';

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${
      isSpike ? 'border-red-200 bg-white' : 'border-blue-200 bg-white'
    }`}>
      {/* 헤더 — 날짜 + 변동률 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
      >
        {/* 아이콘 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isSpike ? 'bg-red-100' : 'bg-blue-100'
        }`}>
          <span className="text-[14px]">{isSpike ? '🚀' : '💥'}</span>
        </div>

        {/* 날짜 */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800">{formatDate(event.date)}</p>
          <p className="text-[10px] text-gray-400">
            종가 ${event.close < 1 ? event.close.toFixed(4) : event.close.toFixed(2)}
            {event.volume > 0 && ` · 거래량 ${(event.volume / 1000000).toFixed(1)}M`}
          </p>
        </div>

        {/* 변동률 */}
        <div className={`text-right shrink-0`}>
          <p className={`text-[16px] font-black ${isSpike ? 'text-red-500' : 'text-blue-500'}`}>
            {event.changePercent >= 0 ? '+' : ''}{event.changePercent.toFixed(1)}%
          </p>
        </div>

        {/* 펼침 표시 */}
        <svg
          viewBox="0 0 24 24" width="16" height="16" fill="none"
          stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* 확장 영역 */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* 30일 후 주가 변동 */}
          {(event.afterDays.t1 != null || event.afterDays.t7 != null || event.afterDays.t30 != null) && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                이후 주가 변동
              </p>
              <div className="flex gap-4 justify-around bg-gray-50 rounded-lg py-2.5 px-3">
                <AfterBadge label="다음날" value={event.afterDays.t1} />
                <AfterBadge label="1주 후" value={event.afterDays.t7} />
                <AfterBadge label="1개월 후" value={event.afterDays.t30} />
              </div>
            </div>
          )}

          {/* SEC 공시 — SecFilingsSection과 동일한 FilingCard 사용 */}
          {event.filings.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                당시 공시
              </p>
              <div className="space-y-1.5">
                {event.filings.map((f, i) => {
                  const href = f.link;
                  const detailUrl = `/ticker/${symbol}/sec-filings/detail?url=${encodeURIComponent(href)}&formType=${encodeURIComponent(f.formType)}&date=${encodeURIComponent(f.filingDate)}&from=history`;
                  return (
                    <FilingCard
                      key={i}
                      filing={f}
                      detailUrl={detailUrl}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 뉴스 */}
          {event.news.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                당시 뉴스
              </p>
              <div className="space-y-1.5">
                {event.news.map((n, i) => (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 hover:bg-gray-100 transition"
                  >
                    <p className="text-[11px] font-bold text-gray-700 leading-snug line-clamp-2">
                      {n.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {n.site && <span className="text-[9px] text-gray-400">{n.site}</span>}
                      <span className="text-[9px] text-gray-300">{formatDate(n.publishedDate)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 공시/뉴스 둘 다 없음 */}
          {event.filings.length === 0 && event.news.length === 0 && (
            <p className="text-[11px] text-gray-400 text-center py-2">
              해당 시점의 공시/뉴스를 찾지 못했어요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PriceHistorySection({ symbol }: { symbol: string }) {
  const [events, setEvents] = useState<SpikeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const upperSymbol = symbol.toUpperCase();

  useEffect(() => {
    fetch(`/api/price-history/${symbol}`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <section className="mb-6">
        <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-3">
          과거 폭등/폭락 이력
        </h2>
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-24" />
                  <div className="h-2.5 bg-gray-100 rounded w-40" />
                </div>
                <div className="h-5 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (events.length === 0) return null; // 이력 없으면 섹션 자체를 숨김

  return (
    <section className="mb-6">
      <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-3">
        과거 폭등/폭락 이력
      </h2>
      <div className="space-y-2">
        {events.map((ev, i) => (
          <EventCard key={`${ev.date}-${i}`} event={ev} symbol={upperSymbol} />
        ))}
      </div>
    </section>
  );
}
