'use client';

import { useEffect, useState } from 'react';

type MarketPhase = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

function getMarketStatus(): { phase: MarketPhase; label: string; color: string; blink: boolean } {
    const now = new Date();
    const nyTimeStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyDate = new Date(nyTimeStr);

    const day = nyDate.getDay();
    const hours = nyDate.getHours();
    const minutes = nyDate.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    if (day === 0 || day === 6) {
        return { phase: 'CLOSED', label: '장 휴장 (주말)', color: 'bg-gray-500', blink: false };
    }

    const PRE_MARKET_START = 4 * 60; // 04:00
    const REGULAR_START = 9 * 60 + 30; // 09:30
    const AFTER_HOURS_START = 16 * 60; // 16:00
    const AFTER_HOURS_END = 20 * 60; // 20:00

    if (timeInMinutes >= PRE_MARKET_START && timeInMinutes < REGULAR_START) {
        return { phase: 'PRE_MARKET', label: '프리마켓 진행중', color: 'bg-yellow-500', blink: true };
    } else if (timeInMinutes >= REGULAR_START && timeInMinutes < AFTER_HOURS_START) {
        return { phase: 'REGULAR', label: '정규장 진행중', color: 'bg-green-500', blink: true };
    } else if (timeInMinutes >= AFTER_HOURS_START && timeInMinutes < AFTER_HOURS_END) {
        return { phase: 'AFTER_HOURS', label: '애프터마켓 진행중', color: 'bg-purple-500', blink: true };
    } else {
        return { phase: 'CLOSED', label: '장 종료', color: 'bg-gray-500', blink: false };
    }
}

export default function MarketStatus() {
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<{ phase: MarketPhase; label: string; color: string; blink: boolean } | null>(null);

    useEffect(() => {
        setMounted(true);
        setStatus(getMarketStatus());
        const interval = setInterval(() => {
            setStatus(getMarketStatus());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!mounted || !status) {
        return (
            <div className="flex items-center bg-gray-50 px-2.5 py-1.5 rounded-full border border-gray-200 shadow-sm text-[11px] font-bold mr-2 w-[110px] h-[28px] animate-pulse">
            </div>
        );
    }

    return (
        <div className="flex items-center bg-white px-2.5 py-1.5 rounded-full border border-gray-200 shadow-sm text-[11px] font-bold mr-2">
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.color} ${status.blink ? 'animate-pulse' : ''}`}></span>
            <span className="text-gray-700 tracking-tight">{status.label}</span>
        </div>
    );
}
