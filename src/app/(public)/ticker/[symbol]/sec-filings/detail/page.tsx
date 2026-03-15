'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { EVENT_SUB_TYPES, MISSING_CATEGORIES, EVENT_TYPE_CONFIG } from '@/lib/constants/eventTaxonomy';

// PriceMoveCard와 동일한 타입
interface MissingItem {
    category: string;
    detail: string;
}

interface EventAnalysis {
    type_code: string;
    sub_type: string;
    summary: string;
    critical_points: string[];
    missing_items: MissingItem[];
}

interface FilingDetail {
    importance: 'HIGH' | 'LOW';
    events: EventAnalysis[];
}

// ─── ? 말풍선 팝오버 ──────────────────────────────────────────────────────────
function InfoBadge({ code, source }: { code: string; source: 'subtype' | 'missing' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    const info = source === 'subtype'
        ? EVENT_SUB_TYPES[code]
        : MISSING_CATEGORIES[code];

    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    if (!info) return null;

    return (
        <span ref={ref} className="relative inline-flex items-center shrink-0">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[9px] font-black hover:bg-gray-300 transition"
                aria-label="설명 보기"
            >
                ?
            </button>
            {open && (
                <span className="absolute left-0 top-full mt-2 z-50 w-60 bg-white border border-gray-200 rounded-xl shadow-xl block"
                    style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.10))' }}
                >
                    {/* 꼭지 */}
                    <span className="absolute -top-1.5 left-3 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45 block" aria-hidden />
                    <span className="block p-3 pt-3.5">
                        <span className="block text-[11px] font-black text-gray-700 mb-1">{info.label ?? code}</span>
                        <span className="block text-[11px] text-gray-500 leading-relaxed">{info.description}</span>
                    </span>
                </span>
            )}
        </span>
    );
}

// ─── 이벤트 카드 (PriceMoveCard와 동일 구조) ────────────────────────────────
function EventCard({ event, isLast }: { event: EventAnalysis; isLast: boolean }) {
    const typeConfig = EVENT_TYPE_CONFIG[event.type_code] ?? EVENT_TYPE_CONFIG.OTHER;
    const subInfo = EVENT_SUB_TYPES[event.sub_type];

    const hasCritical = event.critical_points.length > 0;
    const hasMissing = event.missing_items && event.missing_items.length > 0;

    return (
        <div className={`${!isLast ? 'border-b border-gray-100 pb-5 mb-5' : ''}`}>
            {/* 상위 타입 + 하위 타입 스티커 */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 ${typeConfig.bg} text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm tracking-tight`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70"></span>
                    {typeConfig.label}
                </span>

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

// ─── 이벤트 중요도 자동 분류 ─────────────────────────────────────────────────
function eventImportance(ev: EventAnalysis): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (ev.critical_points && ev.critical_points.length > 0) return 'HIGH';
    if (ev.missing_items && ev.missing_items.length > 0) return 'MEDIUM';
    return 'LOW';
}

// ─── 이벤트 목록 (접기/펼치기) ───────────────────────────────────────────────
function EventList({ events }: { events: EventAnalysis[] }) {
    const [showAll, setShowAll] = useState(false);

    const visible = events.filter(ev => eventImportance(ev) !== 'LOW');
    const hiddenCount = events.length - visible.length;

    const displayed = showAll ? events : visible.length > 0 ? visible : events;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-5">
                {displayed.map((event, i) => (
                    <EventCard
                        key={i}
                        event={event}
                        isLast={i === displayed.length - 1 && (showAll || hiddenCount === 0)}
                    />
                ))}
            </div>

            {/* 전체 보기 토글 — LOW 이벤트가 있을 때만 */}
            {hiddenCount > 0 && (
                <button
                    onClick={() => setShowAll(v => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100 text-[12px] font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors rounded-b-xl"
                >
                    {showAll ? (
                        <>
                            <span>접기</span>
                            <span className="text-[10px]">▲</span>
                        </>
                    ) : (
                        <>
                            <span>전체 보기 ({hiddenCount}개 더)</span>
                            <span className="text-[10px]">▼</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

// ─── 날짜 포맷 ──────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = dateStr.split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || '—';
    const [y, m, day] = d.split('-');
    return `${y}년 ${parseInt(m)}월 ${parseInt(day)}일`;
}

function formatRelative(dateStr: string): string {
    if (!dateStr) return '';
    const d = dateStr.split('T')[0].split(' ')[0];
    const date = new Date(d + 'T00:00:00');
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 864e5);
    if (days === 0) return '오늘 공시';
    if (days === 1) return '1일 전 공시';
    if (days < 8) return `${days}일 전 공시`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}주 전 공시`;
    const months = Math.floor(days / 30);
    return `${months}개월 전 공시`;
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────
const FORM_BADGE: Record<string, { color: string; headerBg: string }> = {
    'S-3':   { color: 'bg-red-100 text-red-700 border-red-200',       headerBg: 'bg-red-50' },
    'S-3/A': { color: 'bg-red-100 text-red-700 border-red-200',       headerBg: 'bg-red-50' },
    'S-1':   { color: 'bg-red-100 text-red-700 border-red-200',       headerBg: 'bg-red-50' },
    'S-1/A': { color: 'bg-red-100 text-red-700 border-red-200',       headerBg: 'bg-red-50' },
    'F-3':   { color: 'bg-red-100 text-red-700 border-red-200',       headerBg: 'bg-red-50' },
    '424B5': { color: 'bg-orange-100 text-orange-700 border-orange-200', headerBg: 'bg-orange-50' },
    '424B4': { color: 'bg-orange-100 text-orange-700 border-orange-200', headerBg: 'bg-orange-50' },
    '8-K':   { color: 'bg-amber-100 text-amber-700 border-amber-200', headerBg: 'bg-amber-50' },
    '8-K/A': { color: 'bg-amber-100 text-amber-700 border-amber-200', headerBg: 'bg-amber-50' },
    '6-K':   { color: 'bg-amber-100 text-amber-700 border-amber-200', headerBg: 'bg-amber-50' },
    'SC 13D': { color: 'bg-blue-100 text-blue-700 border-blue-200',   headerBg: 'bg-blue-50' },
    'SC 13G': { color: 'bg-blue-100 text-blue-700 border-blue-200',   headerBg: 'bg-blue-50' },
};

export default function FilingDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const symbol = (params?.symbol as string ?? '').toUpperCase();
    const filingUrl = searchParams.get('url') ?? '';
    const formType = searchParams.get('formType') ?? '';
    const filingDate = searchParams.get('date') ?? '';
    const backType = searchParams.get('from') ?? '';

    const [summary, setSummary] = useState<string | null>(null);
    const [detail, setDetail] = useState<FilingDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!filingUrl) { setLoading(false); return; }
        const p = new URLSearchParams({ url: filingUrl, formType, detail: 'true' });
        fetch(`/api/sec-filings/summary?${p}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                setSummary(d?.summary ?? null);
                setDetail(d?.detail ?? null);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [filingUrl, formType]);

    const badge = FORM_BADGE[formType] ?? { color: 'bg-gray-100 text-gray-600 border-gray-200', headerBg: 'bg-gray-50' };
    const backUrl = backType
        ? `/ticker/${symbol}/sec-filings?type=${backType}`
        : `/ticker/${symbol}`;
    const isHigh = detail?.importance === 'HIGH';

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 p-4">
            {/* 헤더 */}
            <header className="mb-4">
                <div className="flex justify-end mb-3">
                  <Link
                    href={backUrl}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    aria-label="뒤로가기"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </Link>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${isHigh ? 'bg-red-50 border-red-200' : `${badge.headerBg} border-gray-100`}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[11px] font-black px-2 py-0.5 rounded border ${badge.color}`}>
                                    {formType}
                                </span>
                                {isHigh && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white tracking-tight">
                                        ⚡ 중요 공시
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-400 font-medium mb-0.5">
                                공시 · {formatDate(filingDate)} KST
                            </p>
                            <p className="text-[15px] font-black text-gray-900 tracking-tight">
                                {formatRelative(filingDate)}
                            </p>
                        </div>
                        <a
                            href={filingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
                        >
                            SEC 원문 ↗
                        </a>
                    </div>
                    {summary && (
                        <p className="text-[13px] font-bold text-gray-700 mt-2">{summary}</p>
                    )}
                </div>
            </header>

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
            ) : !detail || !detail.events || detail.events.length === 0 ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                    <p className="text-[14px] text-gray-400 mb-3">상세 분석을 불러올 수 없습니다.</p>
                    <a
                        href={filingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-blue-500 font-bold hover:underline"
                    >
                        SEC 원문 보기 ↗
                    </a>
                </div>
            ) : (
                <EventList events={detail.events} />
            )}

            <p className="text-[10px] text-gray-300 text-right mt-3 font-medium">
                AI 분석 · 투자 판단의 근거로 사용하지 마세요
            </p>
        </main>
    );
}
