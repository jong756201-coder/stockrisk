'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EVENT_SUB_TYPES, EVENT_TYPE_CONFIG } from '@/lib/constants/eventTaxonomy';

interface SecFiling {
    formType: string;
    filingDate: string;
    link: string;
    finalLink?: string;
}

interface EventAnalysis {
    type_code: string;
    sub_type: string;
    summary: string;
}

interface FilingDetail {
    importance: 'HIGH' | 'LOW';
    events: EventAnalysis[];
}

const FORM_BADGE: Record<string, string> = {
    'S-3':   'bg-red-100 text-red-700 border-red-200',
    'S-3/A': 'bg-red-100 text-red-700 border-red-200',
    'S-1':   'bg-red-100 text-red-700 border-red-200',
    'F-3':   'bg-red-100 text-red-700 border-red-200',
    '424B5': 'bg-orange-100 text-orange-700 border-orange-200',
    '424B4': 'bg-orange-100 text-orange-700 border-orange-200',
    '424B3': 'bg-orange-100 text-orange-700 border-orange-200',
    '8-K':   'bg-amber-100 text-amber-700 border-amber-200',
    '8-K/A': 'bg-amber-100 text-amber-700 border-amber-200',
    '6-K':   'bg-amber-100 text-amber-700 border-amber-200',
    'SC 13D':'bg-blue-100 text-blue-700 border-blue-200',
    'SC 13G':'bg-blue-100 text-blue-700 border-blue-200',
};

// 주요 공시(keyDisclosures) 중 8-K / 6-K 최신 하나만
const KEY_DISCLOSURE_FORMS = new Set(['8-K', '8-K/A', '6-K', '6-K/A']);

function pickLatest(
    _offerings: SecFiling[],
    keyDisclosures: SecFiling[],
    _shareholders: SecFiling[],
): { filing: SecFiling; section: 'disclosures' } | null {
    const candidates = keyDisclosures
        .filter(f => KEY_DISCLOSURE_FORMS.has(f.formType))
        .map(f => ({ filing: f, section: 'disclosures' as const }));
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
        const da = a.filing.filingDate.split('T')[0].split(' ')[0];
        const db = b.filing.filingDate.split('T')[0].split(' ')[0];
        return db.localeCompare(da);
    })[0];
}

function daysSince(dateStr: string): string {
    const d = dateStr.split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    const diff = Date.now() - new Date(d + 'T12:00:00').getTime();
    const days = Math.floor(diff / 864e5);
    if (days <= 0) return '오늘';
    if (days === 1) return '1일 전';
    if (days < 30) return `${days}일 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
}

export default function LatestFilingCard({ symbol }: { symbol: string }) {
    const [filing, setFiling] = useState<SecFiling | null>(null);
    const [section, setSection] = useState<'disclosures'>('disclosures');
    const [summary, setSummary] = useState<string | null>(null);
    const [detail, setDetail] = useState<FilingDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setFiling(null);
        setSummary(null);
        setDetail(null);
        // 1) 최신 공시 목록 fetch
        fetch(`/api/sec-filings/${symbol}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) { setLoading(false); return; }
                const latest = pickLatest(data.offerings, data.keyDisclosures, data.shareholders);
                if (!latest) { setLoading(false); return; }

                setFiling(latest.filing);
                setSection(latest.section);

                // 2) 캐시 있으면 즉시 반환, 없으면 Gemini 분석 후 캐시 저장
                const href = latest.filing.finalLink || latest.filing.link;
                const p = new URLSearchParams({
                    url: href,
                    formType: latest.filing.formType,
                    detail: 'true',
                });
                return fetch(`/api/sec-filings/summary?${p}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(d => {
                        setSummary(d?.summary ?? null);
                        setDetail(d?.detail ?? null);
                    });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [symbol]);

    if (loading) {
        return (
            <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-10 bg-gray-100 rounded" />
                    <div className="h-4 w-16 bg-gray-100 rounded" />
                    <div className="h-4 w-20 bg-gray-100 rounded-full" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
        );
    }

    if (!filing) return null;

    const href = filing.finalLink || filing.link;
    const detailUrl = `/ticker/${symbol}/sec-filings/detail?url=${encodeURIComponent(href)}&formType=${encodeURIComponent(filing.formType)}&date=${encodeURIComponent(filing.filingDate)}&from=${section}`;
    const badgeColor = FORM_BADGE[filing.formType] ?? 'bg-gray-100 text-gray-600 border-gray-200';
    const ago = daysSince(filing.filingDate);
    const isHigh = detail?.importance === 'HIGH';
    const events = detail?.events ?? [];

    return (
        <Link
            href={detailUrl}
            className={`mb-4 block rounded-xl shadow-sm px-3.5 py-3 hover:shadow-md transition-all group
                ${isHigh
                    ? 'bg-red-50 border-2 border-red-300 hover:border-red-400'
                    : 'bg-white border border-gray-100 hover:border-gray-300'
                }`}
        >
            {/* 상단 메타: N일 전 + 폼타입 + 중요도 + 화살표 */}
            <div className="flex items-center gap-1.5 mb-2.5">
                <span className={`text-[11px] font-black ${isHigh ? 'text-red-500' : 'text-gray-400'}`}>
                    {ago} 공시
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                    {filing.formType}
                </span>
                {isHigh && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white tracking-tight">
                        ⚡ 중요
                    </span>
                )}
                <span className="ml-auto text-[11px] text-gray-300 group-hover:text-blue-400 flex-shrink-0">→</span>
            </div>

            {/* 요약 — 시선이 먼저 닿는 메인 텍스트 */}
            {summary ? (
                <p className={`text-[13px] font-bold leading-snug line-clamp-2 mb-2.5 ${isHigh ? 'text-red-900' : 'text-gray-800'}`}>
                    {summary}
                </p>
            ) : (
                <p className="text-[11px] text-gray-400 mb-2">분석 보기 →</p>
            )}

            {/* 이벤트 뱃지 — 요약 아래 보조 정보 */}
            {events.length > 0 && (
                <div className="flex flex-wrap gap-1">
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
        </Link>
    );
}
