'use client';

import { useEffect, useState } from 'react';
import type { FmpInsiderTrade, FmpInsiderStats } from '@/lib/api/fmp';

// ─── 거래 유형 분류 ──────────────────────────────────────────────────────────────
interface TxTypeConfig {
    label: string;
    short: string;
    bg: string;
    text: string;
    isBuy: boolean;
    isOpenMarket: boolean; // 장내 매수/매도 여부
}

const TX_TYPE_CONFIG: Record<string, TxTypeConfig> = {
    'P-Purchase':                  { label: '장내 매수',        short: '매수',    bg: 'bg-red-100',    text: 'text-red-700',    isBuy: true,  isOpenMarket: true  },
    'S-Sale':                      { label: '장내 매도',        short: '매도',    bg: 'bg-blue-100',   text: 'text-blue-700',   isBuy: false, isOpenMarket: true  },
    'S-Sale+OE':                   { label: '옵션 행사 후 매도', short: '옵션매도', bg: 'bg-blue-100',   text: 'text-blue-700',   isBuy: false, isOpenMarket: false },
    'A-Award':                     { label: '주식 수여',        short: '수여',    bg: 'bg-gray-100',   text: 'text-gray-500',   isBuy: true,  isOpenMarket: false },
    'M-Exempt':                    { label: '옵션 행사',        short: '옵션행사', bg: 'bg-purple-100', text: 'text-purple-700', isBuy: true,  isOpenMarket: false },
    'F-InKind':                    { label: '세금 원천징수',    short: '원천징수', bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
    'G-Gift':                      { label: '증여',             short: '증여',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
    'D-ReturnToIssuer':            { label: '발행사 반환',      short: '반환',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
    'C-Conversion':                { label: '전환',             short: '전환',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: true,  isOpenMarket: false },
    'I-DiscretionaryDisposition':  { label: '임의처분',         short: '처분',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
    'J-Other':                     { label: '기타',             short: '기타',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
    'W-Will':                      { label: '상속',             short: '상속',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
    'X-InTheMoney':                { label: '옵션 행사 (ITM)',  short: '옵션행사', bg: 'bg-purple-100', text: 'text-purple-700', isBuy: true,  isOpenMarket: false },
    'Z-Trust':                     { label: '신탁',             short: '신탁',    bg: 'bg-gray-100',   text: 'text-gray-400',   isBuy: false, isOpenMarket: false },
};

function getTxConfig(txType: string): TxTypeConfig {
    return TX_TYPE_CONFIG[txType] ?? {
        label: txType,
        short: txType.split('-')[0] ?? txType,
        bg: 'bg-gray-100',
        text: 'text-gray-400',
        isBuy: false,
        isOpenMarket: false,
    };
}

// ─── 직책 정규화 ────────────────────────────────────────────────────────────────
function formatTitle(raw: string): string {
    if (!raw) return '';
    const s = raw.toLowerCase();
    if (s.includes('ceo') || s.includes('chief executive')) return 'CEO';
    if (s.includes('cfo') || s.includes('chief financial')) return 'CFO';
    if (s.includes('coo') || s.includes('chief operating')) return 'COO';
    if (s.includes('cto') || s.includes('chief technolog')) return 'CTO';
    if (s.includes('president')) return 'President';
    if (s.includes('director')) return 'Director';
    if (s.includes('10%') || s.includes('beneficial')) return '대주주(10%+)';
    if (s.includes('officer')) return 'Officer';
    return raw.split(':').pop()?.trim() ?? raw;
}

// ─── 날짜 포맷 ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// ─── 금액 포맷: "약 X억 원 ($YM)" ──────────────────────────────────────────────
function formatValueKrw(usd: number, krwRate: number): { krw: string; usd: string } {
    if (usd === 0) return { krw: '', usd: '' };

    const krwVal = usd * krwRate;
    let krwStr: string;
    if (krwVal >= 1_0000_0000) {
        krwStr = `약 ${(krwVal / 1_0000_0000).toFixed(1)}억 원`;
    } else if (krwVal >= 1_000_0000) {
        krwStr = `약 ${(krwVal / 1_000_0000).toFixed(0)}백만 원`;
    } else if (krwVal >= 10_000) {
        krwStr = `약 ${(krwVal / 10_000).toFixed(0)}만 원`;
    } else {
        krwStr = `${krwVal.toFixed(0)}원`;
    }

    let usdStr: string;
    if (usd >= 1_000_000) usdStr = `$${(usd / 1_000_000).toFixed(1)}M`;
    else if (usd >= 1_000) usdStr = `$${(usd / 1_000).toFixed(0)}K`;
    else usdStr = `$${usd.toFixed(0)}`;

    return { krw: krwStr, usd: usdStr };
}

function formatShares(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M주`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K주`;
    return `${n.toLocaleString()}주`;
}

// ─── 개별 거래 행 ────────────────────────────────────────────────────────────────
function TradeRow({ trade, krwRate, isLast }: { trade: FmpInsiderTrade; krwRate: number; isLast: boolean }) {
    const cfg = getTxConfig(trade.transactionType);
    const usdValue = trade.securitiesTransacted * trade.price;
    const { krw, usd } = formatValueKrw(usdValue, krwRate);
    const title = formatTitle(trade.typeOfOwner);

    return (
        <div className={`flex items-start gap-3 py-3 ${!isLast ? 'border-b border-gray-50' : ''}`}>
            {/* 매수/매도 색상 세로줄 */}
            <div className={`mt-1 w-1 min-h-[44px] rounded-full flex-shrink-0 ${cfg.isOpenMarket ? (cfg.isBuy ? 'bg-red-400' : 'bg-blue-400') : 'bg-gray-200'}`} />

            <div className="flex-1 min-w-0">
                {/* 이름 + 직책 */}
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[13px] font-black text-gray-900 truncate">
                        {trade.reportingName || '—'}
                    </span>
                    {title && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                            {title}
                        </span>
                    )}
                </div>

                {/* 거래 유형 배지 + 날짜 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.short}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                        {formatDate(trade.transactionDate)}
                    </span>
                </div>
            </div>

            {/* 수량 + 금액 */}
            <div className="text-right flex-shrink-0">
                <p className={`text-[13px] font-black tabular-nums ${cfg.isOpenMarket ? (cfg.isBuy ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'}`}>
                    {cfg.isBuy ? '+' : '-'}{formatShares(trade.securitiesTransacted)}
                </p>
                {krw && (
                    <p className="text-[11px] text-gray-800 font-bold tabular-nums">{krw}</p>
                )}
                {usd && (
                    <p className="text-[10px] text-gray-400 font-medium tabular-nums">{usd}</p>
                )}
            </div>
        </div>
    );
}

// ─── 금액 통계 카드 ────────────────────────────────────────────────────────────
function ValueStatCard({
    label,
    usdTotal,
    count,
    krwRate,
    color,
}: {
    label: string;
    usdTotal: number;
    count: number;
    krwRate: number;
    color: 'red' | 'blue';
}) {
    const { krw, usd } = formatValueKrw(usdTotal, krwRate);
    const colorMap = {
        red:  { bg: 'bg-red-50',  labelText: 'text-red-400',  valueText: 'text-red-600',  countText: 'text-red-300' },
        blue: { bg: 'bg-blue-50', labelText: 'text-blue-400', valueText: 'text-blue-600', countText: 'text-blue-300' },
    };
    const c = colorMap[color];

    return (
        <div className={`${c.bg} rounded-lg p-3`}>
            <p className={`text-[10px] font-black ${c.labelText} uppercase tracking-wide mb-1`}>{label}</p>
            {krw ? (
                <>
                    <p className={`text-[15px] font-black ${c.valueText} leading-tight`}>{krw}</p>
                    <p className={`text-[10px] ${c.labelText} font-medium`}>{usd}</p>
                </>
            ) : (
                <p className={`text-[15px] font-black ${c.valueText}`}>—</p>
            )}
            <p className={`text-[10px] ${c.countText} font-bold mt-1`}>{count}건</p>
        </div>
    );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function InsiderTradingSection({ symbol }: { symbol: string }) {
    const [trades, setTrades] = useState<FmpInsiderTrade[]>([]);
    const [stats, setStats] = useState<FmpInsiderStats | null>(null);
    const [krwRate, setKrwRate] = useState<number>(1380);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        fetch(`/api/insider-trading/${symbol}`)
            .then(r => r.json())
            .then(d => {
                setTrades(d.trades ?? []);
                setStats(d.stats ?? null);
                setKrwRate(d.krwRate ?? 1380);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [symbol]);

    // 장내 매수/매도만 분리
    const buyTrades  = trades.filter(t => t.transactionType === 'P-Purchase');
    const sellTrades = trades.filter(t => t.transactionType === 'S-Sale');
    const otherTrades = trades.filter(t => t.transactionType !== 'P-Purchase' && t.transactionType !== 'S-Sale');

    // 금액 기준 통계
    const totalBuyUsd  = buyTrades.reduce((acc, t) => acc + t.securitiesTransacted * t.price, 0);
    const totalSellUsd = sellTrades.reduce((acc, t) => acc + t.securitiesTransacted * t.price, 0);

    const netSentiment: 'buy' | 'sell' | 'neutral' =
        totalBuyUsd > totalSellUsd * 1.2 ? 'buy' :
        totalSellUsd > totalBuyUsd * 1.2 ? 'sell' : 'neutral';

    // 목록 표시 (기본: 장내 매수/매도 최근 10건)
    const openMarketTrades = [...buyTrades, ...sellTrades].sort(
        (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );
    const displayTrades = showAll ? trades.sort((a,b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()) : openMarketTrades.slice(0, 10);

    return (
        <section className="mb-6">
            <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Insider Trading
            </h2>

            {loading ? (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm animate-pulse space-y-3">
                    <div className="flex gap-2">
                        <div className="h-16 w-1/2 bg-gray-100 rounded-lg" />
                        <div className="h-16 w-1/2 bg-gray-100 rounded-lg" />
                    </div>
                    <div className="h-8 bg-gray-100 rounded-lg" />
                </div>
            ) : trades.length === 0 ? (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-2.5">
                    <span className="text-xl">📋</span>
                    <p className="text-[13px] text-gray-400 font-bold">최근 1년간 내부자 거래가 없어요.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* 통계 헤더 */}
                    <div className="p-4 border-b border-gray-50">
                        {/* 매수/매도 우세 배지 */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                                netSentiment === 'buy'  ? 'bg-red-100 text-red-700'   :
                                netSentiment === 'sell' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                            }`}>
                                {netSentiment === 'buy'  ? '🔺 매수 우세' :
                                 netSentiment === 'sell' ? '🔻 매도 우세' : '⚖️ 중립'}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium">
                                장내 매수/매도 · 최근 1년 금액 기준
                            </span>
                        </div>

                        {/* 금액 통계 카드 */}
                        <div className="grid grid-cols-2 gap-2">
                            <ValueStatCard
                                label="장내 매수 총액"
                                usdTotal={totalBuyUsd}
                                count={buyTrades.length}
                                krwRate={krwRate}
                                color="red"
                            />
                            <ValueStatCard
                                label="장내 매도 총액"
                                usdTotal={totalSellUsd}
                                count={sellTrades.length}
                                krwRate={krwRate}
                                color="blue"
                            />
                        </div>
                    </div>

                    {/* 거래 목록 — 전체보기 눌렀을 때만 표시 */}
                    {showAll && (
                        <div className="px-4">
                            {displayTrades.length === 0 ? (
                                <div className="py-4 text-center">
                                    <p className="text-[12px] text-gray-400 font-bold">장내 매수/매도 내역 없음</p>
                                </div>
                            ) : (
                                displayTrades.map((trade, i) => (
                                    <TradeRow
                                        key={`${trade.transactionDate}-${trade.reportingName}-${i}`}
                                        trade={trade}
                                        krwRate={krwRate}
                                        isLast={i === displayTrades.length - 1}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* 전체보기 / 접기 버튼 — 항상 표시 */}
                    <div className="px-4 pb-3 pt-2">
                        <button
                            onClick={() => setShowAll(prev => !prev)}
                            className="w-full text-[11px] font-bold text-gray-400 hover:text-gray-600 bg-gray-50 border border-gray-100 rounded-lg py-2 transition-colors"
                        >
                            {showAll
                                ? '접기'
                                : `전체 거래 보기 (총 ${trades.length}건)`}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
