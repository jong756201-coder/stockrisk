'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EVENT_SUB_TYPES, EVENT_TYPE_CONFIG } from '@/lib/constants/eventTaxonomy';

interface EventAnalysis {
    type_code: string;
    sub_type: string;
    summary: string;
}

interface FilingDetail {
    importance: 'HIGH' | 'LOW';
    events: EventAnalysis[];
}

interface SecFiling {
    formType: string;
    filingDate: string;
    link: string;
    finalLink?: string;
}

interface SecFilingsData {
    offerings: SecFiling[];
    keyDisclosures: SecFiling[];
    shareholders: SecFiling[];
}

const FORM_BADGE: Record<string, string> = {
    'S-3':    'bg-red-100 text-red-700 border-red-200',
    'S-3/A':  'bg-red-100 text-red-700 border-red-200',
    'S-1':    'bg-red-100 text-red-700 border-red-200',
    'S-1/A':  'bg-red-100 text-red-700 border-red-200',
    'F-3':    'bg-red-100 text-red-700 border-red-200',
    'F-3/A':  'bg-red-100 text-red-700 border-red-200',
    '424B1':  'bg-orange-100 text-orange-700 border-orange-200',
    '424B2':  'bg-orange-100 text-orange-700 border-orange-200',
    '424B3':  'bg-orange-100 text-orange-700 border-orange-200',
    '424B4':  'bg-orange-100 text-orange-700 border-orange-200',
    '424B5':  'bg-orange-100 text-orange-700 border-orange-200',
    '8-K':    'bg-amber-100 text-amber-700 border-amber-200',
    '8-K/A':  'bg-amber-100 text-amber-700 border-amber-200',
    '6-K':    'bg-amber-100 text-amber-700 border-amber-200',
    '6-K/A':  'bg-amber-100 text-amber-700 border-amber-200',
};

// NaN 없는 안전한 날짜 포맷 (Date 객체 안 씀)
function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const datePart = dateStr.split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart || '—';
    const [y, m, d] = datePart.split('-');
    return `${y}.${m}.${d}`;
}

function daysSince(dateStr: string): string {
    if (!dateStr) return '';
    const datePart = dateStr.split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return '';
    const diff = Date.now() - new Date(datePart + 'T12:00:00').getTime();
    if (isNaN(diff)) return '';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return '오늘';
    if (days < 30) return `${days}일 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
}

// 공시 카드 전체 — importance 기반 스타일링 포함
function FilingCard({
    filing,
    detailUrl,
}: {
    filing: SecFiling;
    detailUrl: string;
}) {
    const [summary, setSummary] = useState<string | null>(null);
    const [detail, setDetail] = useState<FilingDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const href = filing.finalLink || filing.link;
    const badgeColor = FORM_BADGE[filing.formType] ?? 'bg-gray-100 text-gray-600 border-gray-200';

    useEffect(() => {
        if (!href) { setLoading(false); return; }
        const params = new URLSearchParams({ url: href, formType: filing.formType, detail: 'true', cache_only: 'true' });
        fetch(`/api/sec-filings/summary?${params}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                setSummary(d?.summary ?? null);
                setDetail(d?.detail ?? null);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [href, filing.formType]);

    const isHigh = detail?.importance === 'HIGH';
    const events = detail?.events ?? [];

    return (
        <Link
            href={detailUrl}
            className={`block rounded-lg px-3 py-2.5 border transition-all group
                ${isHigh
                    ? 'bg-red-50 border-red-200 hover:border-red-300 hover:bg-red-50/80'
                    : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'
                }`}
        >
            {/* 상단: 폼타입 + 날짜 + N일전 + [⚡중요] + 화살표 */}
            <div className="flex items-center gap-2">
                <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                    {filing.formType}
                </span>
                <span className="text-[12px] font-bold text-gray-700">
                    {formatDate(filing.filingDate)}
                </span>
                <span className="text-[11px] text-gray-400">{daysSince(filing.filingDate)}</span>
                {isHigh && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white tracking-tight flex-shrink-0">
                        ⚡ 중요
                    </span>
                )}
                <span className="ml-auto text-[11px] text-gray-300 group-hover:text-blue-400 flex-shrink-0">→</span>
            </div>

            {/* 요약 + 뱃지 */}
            {loading ? (
                <div className="h-2.5 bg-gray-100 rounded animate-pulse mt-1.5 w-3/4" />
            ) : (
                <>
                    {summary && (
                        <p className="text-[11px] text-gray-700 mt-1 leading-snug line-clamp-2">
                            {summary}
                        </p>
                    )}
                    {events.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {events.map((ev, i) => {
                                const typeConfig = EVENT_TYPE_CONFIG[ev.type_code] ?? null;
                                const subInfo = EVENT_SUB_TYPES[ev.sub_type] ?? null;
                                return (
                                    <span key={i} className="inline-flex items-center gap-1">
                                        {typeConfig && (
                                            <span className={`inline-flex items-center gap-1 ${typeConfig.bg} text-white text-[9px] font-black px-1.5 py-0.5 rounded-full`}>
                                                <span className="w-1 h-1 rounded-full bg-white/70 flex-shrink-0" />
                                                {typeConfig.label}
                                            </span>
                                        )}
                                        {subInfo && (
                                            <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                                {subInfo.label}
                                            </span>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </Link>
    );
}

interface SectionProps {
    icon: string;
    title: string;
    subtitle: string;
    filings: SecFiling[];
    headerColor: string;
    symbol: string;
    sectionType: 'offerings' | 'disclosures' | 'shareholders';
}

function FilingSection({ icon, title, subtitle, filings, headerColor, symbol, sectionType }: SectionProps) {
    const SHOW = 3;
    const visible = filings.slice(0, SHOW);
    const remaining = filings.length - SHOW;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className={`px-4 py-3 border-b ${headerColor}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <div>
                            <p className="text-[13px] font-black leading-tight">{title}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    {filings.length > 0 && (
                        <span className="text-[11px] font-black bg-white/80 px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                            {filings.length}건
                        </span>
                    )}
                </div>
            </div>

            {/* 목록 */}
            <div className="px-3 py-2.5 space-y-2">
                {filings.length === 0 ? (
                    <p className="text-[12px] text-gray-400 py-1.5 px-1">최근 1년 내 해당 공시 없음</p>
                ) : (
                    <>
                        {visible.map((f, i) => {
                            const href = f.finalLink || f.link;
                            const detailUrl = `/ticker/${symbol}/sec-filings/detail?url=${encodeURIComponent(href)}&formType=${encodeURIComponent(f.formType)}&date=${encodeURIComponent(f.filingDate)}&from=${sectionType}`;
                            return (
                                <FilingCard key={i} filing={f} detailUrl={detailUrl} />
                            );
                        })}

                        {/* 더 보기 → 해당 섹션 전용 페이지 */}
                        {remaining > 0 && (
                            <Link
                                href={`/ticker/${symbol}/sec-filings?type=${sectionType}`}
                                className="flex items-center justify-center gap-1 text-[11px] text-blue-500 font-bold py-1.5 hover:text-blue-700 transition-colors"
                            >
                                +{remaining}건 더 보기 →
                            </Link>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function SecFilingsSection({ symbol }: { symbol: string }) {
    const [data, setData] = useState<SecFilingsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setData(null);
        fetch(`/api/sec-filings/${symbol}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => setData(d))
            .catch(() => setData({ offerings: [], keyDisclosures: [], shareholders: [] }))
            .finally(() => setLoading(false));
    }, [symbol]);

    const isEmpty = !loading && data &&
        data.offerings.length === 0 &&
        data.keyDisclosures.length === 0 &&
        data.shareholders.length === 0;

    if (isEmpty) return null;

    return (
        <section className="mb-6">
            <h2 className="text-lg font-bold flex items-center mb-3">
                <span className="w-1.5 h-4 bg-gray-700 mr-2 rounded-sm"></span>
                주요 공시
            </h2>

            {loading ? (
                <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                            <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-gray-100 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    <FilingSection
                        icon="📡"
                        title="주요 공시"
                        subtitle="8-K · 6-K — 돌발 이벤트 공시"
                        filings={data!.keyDisclosures}
                        headerColor={data!.keyDisclosures.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}
                        symbol={symbol}
                        sectionType="disclosures"
                    />
                    <FilingSection
                        icon="🚨"
                        title="자본 조달 및 유상증자"
                        subtitle="S-3 · S-1 · F-3 · 424B — 주식 발행 공시"
                        filings={data!.offerings}
                        headerColor={data!.offerings.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}
                        symbol={symbol}
                        sectionType="offerings"
                    />
                    <FilingSection
                        icon="🦈"
                        title="대주주 지분 변동"
                        subtitle="SC 13D · 13G — 5% 이상 지분 변동"
                        filings={data!.shareholders}
                        headerColor={data!.shareholders.length > 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}
                        symbol={symbol}
                        sectionType="shareholders"
                    />
                </div>
            )}
        </section>
    );
}
