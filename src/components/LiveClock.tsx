'use client';

import { useEffect, useState } from 'react';

type MarketPhase = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

interface SessionInfo {
    phase: MarketPhase;
    label: string;
    dotColor: string;
    labelColor: string;
    blink: boolean;
}

/** 현재 미국 동부 시간이 써머타임(EDT)인지 판단. KST 오프셋 반환 (EDT: 13h, EST: 14h) */
function getKSToffset(): number {
    // America/New_York 기준 UTC 오프셋을 계산
    const now = new Date();
    const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const nyDate = new Date(nyStr);
    const utcDate = new Date(utcStr);
    const diffH = (nyDate.getTime() - utcDate.getTime()) / 3600000;
    // EDT = UTC-4 → diffH = -4 → kstOffset = 9-(-4) = 13
    // EST = UTC-5 → diffH = -5 → kstOffset = 9-(-5) = 14
    return Math.round(9 - diffH);
}

function isDST(): boolean {
    return getKSToffset() === 13;
}

/** ET HH:MM → KST HH:MM (다음날 표기 포함) */
function etToKST(etHours: number, etMinutes: number, dst: boolean): string {
    const offset = dst ? 13 : 14;
    const totalMin = etHours * 60 + etMinutes + offset * 60;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const nextDay = (etHours * 60 + etMinutes + offset * 60) >= 24 * 60;
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    return `${hh}:${mm}${nextDay ? '(익일)' : ''}`;
}

function nySeconds(): number {
    const now = new Date();
    const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const ny = new Date(nyStr);
    return ny.getHours() * 3600 + ny.getMinutes() * 60 + ny.getSeconds();
}

function nyMinutes(): number {
    const now = new Date();
    const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const ny = new Date(nyStr);
    return ny.getHours() * 60 + ny.getMinutes();
}

function isWeekend(): boolean {
    const now = new Date();
    const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    return new Date(nyStr).getDay() === 0 || new Date(nyStr).getDay() === 6;
}

const PRE_MARKET = 4 * 60;
const REGULAR = 9 * 60 + 30;
const AFTER_HOURS = 16 * 60;
const AFTER_END = 20 * 60;
const WINDOW_SEC = 10 * 60;

function fmt(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function getSession(): SessionInfo {
    if (isWeekend()) {
        return { phase: 'CLOSED', label: '장 휴장', dotColor: 'bg-gray-400', labelColor: 'text-gray-400', blink: false };
    }

    const t = nyMinutes();
    const ts = nySeconds();
    const secsToPreMarket = PRE_MARKET * 60 - ts;
    const secsToRegular = REGULAR * 60 - ts;

    if (secsToPreMarket > 0 && secsToPreMarket <= WINDOW_SEC)
        return { phase: 'CLOSED', label: `프리마켓까지 ${fmt(secsToPreMarket)}`, dotColor: 'bg-yellow-400', labelColor: 'text-yellow-600', blink: true };
    if (secsToRegular > 0 && secsToRegular <= WINDOW_SEC)
        return { phase: 'PRE_MARKET', label: `정규장까지 ${fmt(secsToRegular)}`, dotColor: 'bg-green-400', labelColor: 'text-green-600', blink: true };

    if (t >= PRE_MARKET && t < REGULAR)
        return { phase: 'PRE_MARKET', label: '프리마켓', dotColor: 'bg-yellow-400', labelColor: 'text-yellow-600', blink: true };
    if (t >= REGULAR && t < AFTER_HOURS)
        return { phase: 'REGULAR', label: '정규장', dotColor: 'bg-green-500', labelColor: 'text-green-600', blink: true };
    if (t >= AFTER_HOURS && t < AFTER_END)
        return { phase: 'AFTER_HOURS', label: '애프터마켓', dotColor: 'bg-purple-500', labelColor: 'text-purple-600', blink: true };
    return { phase: 'CLOSED', label: '장 마감', dotColor: 'bg-gray-400', labelColor: 'text-gray-400', blink: false };
}

function getKRTime(): string {
    return new Date().toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
}

interface LiveClockProps {
    /** true = 헤더 인라인 컴팩트 모드 (카드 없음, 작은 텍스트) */
    compact?: boolean;
}

export default function LiveClock({ compact = false }: LiveClockProps) {
    const [mounted, setMounted] = useState(false);
    const [time, setTime] = useState('');
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [dst, setDst] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        setMounted(true);
        setDst(isDST());
        const tick = () => {
            setTime(getKRTime());
            setSession(getSession());
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const kstSchedule = [
        { label: '프리마켓', start: etToKST(4, 0, dst), end: etToKST(9, 30, dst), dot: 'bg-yellow-400' },
        { label: '정규장', start: etToKST(9, 30, dst), end: etToKST(16, 0, dst), dot: 'bg-green-500' },
        { label: '애프터마켓', start: etToKST(16, 0, dst), end: etToKST(20, 0, dst), dot: 'bg-purple-500' },
    ];

    /* ── 컴팩트 모드 (헤더 인라인) ───────────────────────── */
    if (compact) {
        if (!mounted || !session) {
            return <div className="h-5 w-36 rounded bg-gray-100 animate-pulse" />;
        }
        return (
            <div className="relative flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400 font-bold tracking-wider">KST</span>
                <span className="text-[14px] font-black text-gray-900 tabular-nums tracking-tight">{time}</span>
                <span className="text-gray-300 mx-0.5 text-[11px]">·</span>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${session.dotColor} ${session.blink ? 'animate-pulse' : ''}`} />
                <span className={`text-[11px] font-bold ${session.labelColor}`}>{session.label}</span>
                <button
                    onClick={() => setShowInfo(v => !v)}
                    className="w-3.5 h-3.5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-[8px] font-black hover:bg-gray-300 transition flex-shrink-0"
                    aria-label="장 시간 안내"
                >?</button>

                {showInfo && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-gray-800 text-gray-100 rounded-xl shadow-xl p-3.5 z-50 text-[11px]">
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="font-black text-white text-[12px]">미국 증시 시간표 (한국 기준)</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: dst ? '#ca8a04' : '#4b5563', color: '#fff' }}>
                                {dst ? '써머타임' : '표준시'}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {kstSchedule.map(s => (
                                <div key={s.label} className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                                    <span className="text-gray-400 w-[60px]">{s.label}</span>
                                    <span className="font-bold text-white tabular-nums">{s.start} ~ {s.end}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-gray-700 text-gray-400 text-[10px]">
                            써머타임: 매년 3월 둘째 일요일 ~ 11월 첫째 일요일
                        </div>
                    </div>
                )}
            </div>
        );
    }

    /* ── 기본 모드 (풀 카드) ─────────────────────────────── */
    if (!mounted || !session) {
        return <div className="h-[44px] w-full rounded-xl bg-white border border-gray-100 animate-pulse mb-3" />;
    }

    return (
        <div className="mb-3 relative">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                {/* 왼쪽: KST 시계 */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-bold tracking-wider">KST</span>
                    <span className="text-[19px] font-black text-gray-900 tabular-nums tracking-tight">{time}</span>
                </div>

                {/* 오른쪽: 세션 + ? 버튼 */}
                <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${session.dotColor} ${session.blink ? 'animate-pulse' : ''}`} />
                    <span className={`text-[12px] font-bold tabular-nums ${session.labelColor}`}>{session.label}</span>

                    <button
                        onClick={() => setShowInfo(v => !v)}
                        className="w-4 h-4 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-[9px] font-black hover:bg-gray-300 transition flex-shrink-0"
                        aria-label="장 시간 안내"
                    >?</button>
                </div>
            </div>

            {/* 드롭다운 정보 패널 */}
            {showInfo && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-gray-800 text-gray-100 rounded-xl shadow-xl p-3.5 z-50 text-[11px]">
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="font-black text-white text-[12px]">미국 증시 시간표 (한국 기준)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: dst ? '#ca8a04' : '#4b5563', color: '#fff' }}>
                            {dst ? '써머타임' : '표준시'}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {kstSchedule.map(s => (
                            <div key={s.label} className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                                <span className="text-gray-400 w-[60px]">{s.label}</span>
                                <span className="font-bold text-white tabular-nums">{s.start} ~ {s.end}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-gray-700 text-gray-400 text-[10px]">
                        써머타임: 매년 3월 둘째 일요일 ~ 11월 첫째 일요일
                    </div>
                </div>
            )}
        </div>
    );
}
