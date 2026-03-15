'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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

const SECTION_META = {
    offerings: {
        icon: '🚨',
        title: '자본 조달 및 유상증자',
        subtitle: 'S-3 · S-1 · F-3 · 424B — 주식 발행 공시',
        headerColor: 'bg-red-50 border-red-100',
        emptyText: '최근 1년 내 자본 조달 공시 없음',
    },
    disclosures: {
        icon: '⚠️',
        title: '주요 공시',
        subtitle: '8-K · 6-K — 돌발 이벤트 공시',
        headerColor: 'bg-amber-50 border-amber-100',
        emptyText: '최근 1년 내 8-K/6-K 공시 없음',
    },
    shareholders: {
        icon: '🦈',
        title: '대주주 지분 변동',
        subtitle: 'SC 13D · 13G — 5% 이상 지분 변동',
        headerColor: 'bg-blue-50 border-blue-100',
        emptyText: '최근 1년 내 대주주 지분 변동 없음',
    },
} as const;

type SectionType = keyof typeof SECTION_META;

const FORM_BADGE: Record<string, string> = {
    'S-3':   'bg-red-100 text-red-700 border-red-200',
    'S-3/A': 'bg-red-100 text-red-700 border-red-200',
    'S-1':   'bg-red-100 text-red-700 border-red-200',
    'S-1/A': 'bg-red-100 text-red-700 border-red-200',
    'F-3':   'bg-red-100 text-red-700 border-red-200',
    'F-3/A': 'bg-red-100 text-red-700 border-red-200',
    '424B1': 'bg-orange-100 text-orange-700 border-orange-200',
    '424B2': 'bg-orange-100 text-orange-700 border-orange-200',
    '424B3': 'bg-orange-100 text-orange-700 border-orange-200',
    '424B4': 'bg-orange-100 text-orange-700 border-orange-200',
    '424B5': 'bg-orange-100 text-orange-700 border-orange-200',
    '8-K':   'bg-amber-100 text-amber-700 border-amber-200',
    '8-K/A': 'bg-amber-100 text-amber-700 border-amber-200',
    '6-K':   'bg-amber-100 text-amber-700 border-amber-200',
    '6-K/A': 'bg-amber-100 text-amber-700 border-amber-200',
};

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
            className={`block rounded-xl px-4 py-3.5 border shadow-sm transition-all group
                ${isHigh
                    ? 'bg-red-50 border-red-200 hover:border-red-300 shadow-red-50'
                    : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
                }`}
        >
            <div className="flex items-center gap-2.5">
                <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                    {filing.formType}
                </span>
                <span className="text-[13px] font-bold text-gray-800">
                    {formatDate(filing.filingDate)}
                </span>
                <span className="text-[12px] text-gray-400">{daysSince(filing.filingDate)}</span>
                {isHigh && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white tracking-tight flex-shrink-0">
                        ⚡ 중요
                    </span>
                )}
                <span className="ml-auto text-gray-300 group-hover:text-blue-400 transition-colors">→</span>
            </div>

            {loading ? (
                <div className="h-2.5 bg-gray-100 rounded animate-pulse mt-1.5 w-3/4" />
            ) : (
                <>
                    {summary && (
                        <p className="text-[12px] text-gray-700 mt-1.5 leading-snug line-clamp-2">
                            {summary}
                        </p>
                    )}
                    {events.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
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

export default function SecFilingsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const symbol = (params?.symbol as string ?? '').toUpperCase();
    const typeParam = (searchParams.get('type') ?? 'disclosures') as SectionType;
    const sectionType: SectionType = typeParam in SECTION_META ? typeParam : 'disclosures';
    const meta = SECTION_META[sectionType];

    const [data, setData] = useState<SecFilingsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!symbol) return;
        fetch(`/api/sec-filings/${symbol}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => setData(d))
            .catch(() => setData({ offerings: [], keyDisclosures: [], shareholders: [] }))
            .finally(() => setLoading(false));
    }, [symbol]);

    const filings: SecFiling[] = data
        ? sectionType === 'offerings' ? data.offerings
        : sectionType === 'disclosures' ? data.keyDisclosures
        : data.shareholders
        : [];

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 p-4">
            {/* 헤더 */}
            <header className="mb-5">
                <div className="flex justify-end mb-3">
                  <Link
                    href={`/ticker/${symbol}`}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    aria-label="뒤로가기"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </Link>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${meta.headerColor}`}>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{meta.icon}</span>
                        <div>
                            <h1 className="text-[16px] font-black">{meta.title}</h1>
                            <p className="text-[11px] text-gray-500 mt-0.5">{meta.subtitle}</p>
                        </div>
                        {!loading && (
                            <span className="ml-auto text-[11px] font-black bg-white/80 px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                                {filings.length}건
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="space-y-2.5">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                            <div className="flex items-center gap-2 mb-2.5">
                                <div className="h-5 w-12 bg-gray-100 rounded" />
                                <div className="h-3 bg-gray-100 rounded w-24" />
                            </div>
                            <div className="h-3 bg-gray-100 rounded w-3/4" />
                        </div>
                    ))}
                </div>
            ) : filings.length === 0 ? (
                <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                    <p className="text-[14px] text-gray-400">{meta.emptyText}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filings.map((f, i) => {
                        const href = f.finalLink || f.link;
                        const detailUrl = `/ticker/${symbol}/sec-filings/detail?url=${encodeURIComponent(href)}&formType=${encodeURIComponent(f.formType)}&date=${encodeURIComponent(f.filingDate)}&from=${sectionType}`;
                        return <FilingCard key={i} filing={f} detailUrl={detailUrl} />;
                    })}
                </div>
            )}
        </main>
    );
}
