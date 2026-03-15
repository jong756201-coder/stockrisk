'use client';

import { useEffect, useState } from 'react';
import type { PriceMoveAnalysis, EventAnalysis } from '@/lib/api/secAnalysis';
import { EVENT_SUB_TYPES, MISSING_CATEGORIES, EVENT_TYPE_CONFIG } from '@/lib/constants/eventTaxonomy';

interface Props { symbol: string }

// ─── ? 버튼 + 펼치기 설명 ──────────────────────────────────────────────────────
function InfoBadge({ code, source }: { code: string; source: 'subtype' | 'missing' }) {
    const [open, setOpen] = useState(false);

    const info = source === 'subtype'
        ? EVENT_SUB_TYPES[code]
        : MISSING_CATEGORIES[code];

    if (!info) return null;

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[9px] font-black hover:bg-gray-300 transition shrink-0"
                aria-label="설명 보기"
            >
                ?
            </button>
            {open && (
                <div className="w-full mt-1.5 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2.5 leading-relaxed">
                    {info.description}
                </div>
            )}
        </>
    );
}

// ─── 날짜 표시 ──────────────────────────────────────────────────────────────────
function formatFilingDate(dateStr: string): { absolute: string; relative: string } {
    if (!dateStr) return { absolute: '', relative: '' };

    const date = new Date(dateStr);

    // 한국 기준 날짜·시간 (KST = UTC+9)
    const absolute = date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    // 상대 시간
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 6e4);
    const hours = Math.floor(diff / 36e5);
    const days = Math.floor(diff / 864e5);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    let relative = '';
    if (mins < 60) relative = `${mins}분 전 공시`;
    else if (hours < 24) relative = `${hours}시간 전 공시`;
    else if (days === 1) relative = '1일 전 공시';
    else if (days < 8) relative = `${days}일 전 공시`;
    else if (weeks < 5) relative = `${weeks}주 전 공시`;
    else relative = `${months}개월 전 공시`;

    return { absolute, relative };
}

// ─── 개별 이벤트 카드 ───────────────────────────────────────────────────────────
function EventCard({ event, isLast }: { event: EventAnalysis; isLast: boolean }) {
    const typeConfig = EVENT_TYPE_CONFIG[event.type_code] ?? EVENT_TYPE_CONFIG.OTHER;
    const subInfo = EVENT_SUB_TYPES[event.sub_type];

    const hasCritical = event.critical_points.length > 0;
    const hasMissing = event.missing_items && event.missing_items.length > 0;

    return (
        <div className={`${!isLast ? 'border-b border-gray-100 pb-5 mb-5' : ''}`}>
            {/* 상위 타입 + 하위 타입 스티커 */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* 상위 타입 */}
                <span className={`inline-flex items-center gap-1.5 ${typeConfig.bg} text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm tracking-tight`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70"></span>
                    {typeConfig.label}
                </span>

                {/* 하위 타입 + ? */}
                {subInfo && (
                    <div className="inline-flex flex-wrap items-center gap-1 bg-gray-100 text-gray-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        <span>{subInfo.label}</span>
                        <InfoBadge code={event.sub_type} source="subtype" />
                    </div>
                )}
            </div>

            {/* 요약 */}
            <p className="text-[14px] font-bold leading-relaxed text-gray-800 mb-4">
                {event.summary}
            </p>

            {/* 비판적 분석 */}
            {hasCritical && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-100 p-3">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">
                        🔍 비판적 분석
                    </p>
                    <ul className="space-y-1.5">
                        {event.critical_points.map((pt, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[12px] text-red-800 font-semibold leading-snug">
                                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                {pt}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 누락 항목 (카테고리별) */}
            {hasMissing && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">
                        ⚠️ 공시에서 누락된 항목
                    </p>
                    <ul className="space-y-2">
                        {event.missing_items.map((item, i) => {
                            const catInfo = MISSING_CATEGORIES[item.category];
                            return (
                                <li key={i} className="text-[12px]">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                        <span className="font-black text-amber-800">
                                            {catInfo?.label ?? item.category}
                                        </span>
                                        <InfoBadge code={item.category} source="missing" />
                                    </div>
                                    <p className="pl-3 text-amber-700 font-medium leading-snug">
                                        {item.detail}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function PriceMoveCard({ symbol }: Props) {
    const [analysis, setAnalysis] = useState<PriceMoveAnalysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/price-move-analysis/${symbol}`)
            .then(r => r.json())
            .then(d => setAnalysis(d.analysis ?? null))
            .catch(() => setAnalysis(null))
            .finally(() => setLoading(false));
    }, [symbol]);

    return (
        <section className="mb-6">
            <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Why is it moving?
            </h2>

            {loading ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-16 bg-gray-100 rounded-full" />
                        <div className="h-5 w-28 bg-gray-100 rounded-full" />
                    </div>
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-4/5" />
                    <div className="h-16 bg-red-50 rounded-lg" />
                    <div className="h-12 bg-amber-50 rounded-lg" />
                </div>
            ) : !analysis || analysis.events.length === 0 ? (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-2.5">
                    <span className="text-xl">📋</span>
                    <p className="text-[13px] text-gray-400 font-bold">최근 8-K 공시가 없어요.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    {/* 날짜 + SEC 링크 */}
                    {(() => {
                        const { absolute, relative } = formatFilingDate(analysis.filingDate);
                        return (
                            <div className="mb-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-medium mb-0.5">
                                            공시 · {absolute} KST
                                        </p>
                                        <p className="text-[15px] font-black text-gray-900 tracking-tight">
                                            📌 {relative}
                                        </p>
                                    </div>
                                    {analysis.filingUrl && (
                                        <a
                                            href={analysis.filingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
                                        >
                                            SEC 원문 ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 이벤트 목록 */}
                    {analysis.events.map((event, i) => (
                        <EventCard
                            key={i}
                            event={event}
                            isLast={i === analysis.events.length - 1}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
