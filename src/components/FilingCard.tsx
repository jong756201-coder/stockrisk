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

export interface FilingCardFiling {
    formType: string;
    filingDate: string;
    link: string;
    finalLink?: string;
}

export const FORM_BADGE: Record<string, string> = {
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

export function formatFilingDate(dateStr: string): string {
    if (!dateStr) return '—';
    const datePart = dateStr.split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart || '—';
    const [y, m, d] = datePart.split('-');
    return `${y}.${m}.${d}`;
}

export function daysSince(dateStr: string): string {
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

export default function FilingCard({
    filing,
    detailUrl,
}: {
    filing: FilingCardFiling;
    detailUrl: string;
}) {
    const [summary, setSummary] = useState<string | null>(null);
    const [detail, setDetail] = useState<FilingDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const href = filing.finalLink || filing.link;
    const badgeColor = FORM_BADGE[filing.formType] ?? 'bg-gray-100 text-gray-600 border-gray-200';

    useEffect(() => {
        if (!href) { setLoading(false); return; }
        const params = new URLSearchParams({ url: href, formType: filing.formType, detail: 'false' });
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
                    {formatFilingDate(filing.filingDate)}
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
