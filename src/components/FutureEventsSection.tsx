'use client';

import { useEffect, useState } from 'react';

interface FutureEvent {
    id: number;
    symbol: string;
    event_date: string;
    date_label?: string;
    category: string;
    title: string;
    importance?: string;
    source_label?: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    FDA:           { label: 'FDA 승인',      color: 'bg-red-50 text-red-700 border-red-200',          icon: '💊' },
    CLINICAL:      { label: '임상시험',      color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '🧪' },
    REGULATORY:    { label: '규제 승인',     color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '🏛️' },
    CONFERENCE:    { label: '컨퍼런스',      color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: '🎤' },
    PRODUCT_LAUNCH:{ label: '제품 출시',     color: 'bg-green-50 text-green-700 border-green-200',    icon: '🚀' },
    CORPORATE:     { label: '주식·기업',     color: 'bg-teal-50 text-teal-700 border-teal-200',       icon: '🏢' },
    EARNINGS:      { label: '어닝콜',        color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '📊' },
    OTHER:         { label: '기타',          color: 'bg-gray-50 text-gray-700 border-gray-200',       icon: '📌' },
};

const IMPORTANCE_CONFIG: Record<string, { dot: string; ring: string }> = {
    HIGH:   { dot: 'bg-red-500',    ring: 'border-red-200 ring-1 ring-red-100' },
    MEDIUM: { dot: 'bg-amber-400',  ring: 'border-amber-200' },
    LOW:    { dot: 'bg-gray-300',   ring: 'border-gray-100' },
};

function getDaysUntil(dateStr: string): number {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${month}/${day} (${weekdays[d.getDay()]})`;
}

export default function FutureEventsSection({ symbol }: { symbol: string }) {
    const [events, setEvents] = useState<FutureEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        fetch(`/api/future-events/${symbol}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => setEvents(d.events ?? []))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [symbol]);

    if (loading) {
        return (
            <section className="mb-6">
                <h2 className="text-lg font-bold flex items-center mb-3">
                    <span className="w-1.5 h-4 bg-amber-500 mr-2 rounded-sm"></span>
                    예정된 이벤트
                </h2>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
            </section>
        );
    }

    if (error) return null;

    return (
        <section className="mb-6">
            <h2 className="text-lg font-bold flex items-center mb-3">
                <span className="w-1.5 h-4 bg-amber-500 mr-2 rounded-sm"></span>
                예정된 이벤트
                {events.length > 0 && (
                    <span className="ml-2 text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {events.length}건
                    </span>
                )}
            </h2>

            {events.length === 0 ? (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-2.5">
                    <span className="text-xl">📅</span>
                    <p className="text-[13px] text-gray-400 font-bold">확인된 예정 이벤트가 없습니다.</p>
                </div>
            ) : (() => {
                const visibleEvents = showAll
                    ? events
                    : events.filter(ev => (ev.importance ?? 'MEDIUM') !== 'LOW');
                const hiddenCount = events.length - events.filter(ev => (ev.importance ?? 'MEDIUM') !== 'LOW').length;

                return (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="divide-y divide-gray-50">
                            {(visibleEvents.length > 0 ? visibleEvents : events).map((ev) => {
                                const cat = CATEGORY_CONFIG[ev.category] ?? CATEGORY_CONFIG.OTHER;
                                const imp = IMPORTANCE_CONFIG[ev.importance ?? 'MEDIUM'] ?? IMPORTANCE_CONFIG.MEDIUM;
                                const daysLeft = getDaysUntil(ev.event_date);
                                const isToday = daysLeft === 0;
                                const isImminent = daysLeft <= 7;
                                const isDeadline = ev.date_label === '까지';
                                const isApprox = !!ev.date_label && !isDeadline;

                                return (
                                    <div key={ev.id} className={`p-4 border-l-4 ${imp.dot === 'bg-red-500' ? 'border-l-red-400' : imp.dot === 'bg-amber-400' ? 'border-l-amber-300' : 'border-l-gray-100'}`}>
                                        <div className="flex items-start gap-3">
                                            {/* 날짜 블록 */}
                                            {isDeadline ? (
                                                <div className={`flex-shrink-0 w-14 text-center rounded-lg py-1.5 ${isImminent ? 'bg-amber-50' : 'bg-gray-50'}`}>
                                                    <p className={`text-[11px] font-bold ${isImminent ? 'text-amber-600' : 'text-gray-500'}`}>
                                                        ~{formatDate(ev.event_date)}
                                                    </p>
                                                </div>
                                            ) : isApprox ? (
                                                <div className="flex-shrink-0 w-14 text-center rounded-lg py-1.5 bg-gray-50">
                                                    <p className="text-[10px] font-bold text-gray-400 leading-tight">
                                                        {ev.date_label}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className={`flex-shrink-0 w-14 text-center rounded-lg py-1.5 ${isImminent ? 'bg-amber-50' : 'bg-gray-50'}`}>
                                                    <p className={`text-[11px] font-bold ${isImminent ? 'text-amber-600' : 'text-gray-500'}`}>
                                                        {formatDate(ev.event_date)}
                                                    </p>
                                                    <p className={`text-[10px] font-black mt-0.5 ${isToday ? 'text-red-500' : isImminent ? 'text-amber-500' : 'text-gray-400'}`}>
                                                        {isToday ? '오늘' : `D-${daysLeft}`}
                                                    </p>
                                                </div>
                                            )}

                                            {/* 이벤트 내용 */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${cat.color}`}>
                                                        {cat.icon} {cat.label}
                                                    </span>
                                                    {ev.importance === 'HIGH' && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white tracking-tight">
                                                            ⚡ 중요
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[13px] font-bold text-gray-800 leading-snug">
                                                    {ev.title}
                                                </p>
                                                {ev.source_label && (
                                                    <p className="text-[10px] text-gray-400 mt-1 font-medium">
                                                        출처: {ev.source_label}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 전체 보기 / 접기 토글 */}
                        {hiddenCount > 0 && (
                            <button
                                onClick={() => setShowAll(v => !v)}
                                className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100 text-[12px] font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                {showAll ? (
                                    <>접기 <span className="text-[10px]">▲</span></>
                                ) : (
                                    <>전체 보기 ({hiddenCount}개 더) <span className="text-[10px]">▼</span></>
                                )}
                            </button>
                        )}
                    </div>
                );
            })()}

            <p className="text-[10px] text-gray-300 text-right mt-1.5 font-medium">
                AI가 공시·보도자료에서 추출 · 실제 일정과 다를 수 있음
            </p>
        </section>
    );
}
