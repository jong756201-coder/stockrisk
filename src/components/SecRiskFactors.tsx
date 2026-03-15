'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface RiskAnalysis {
    delisting_risk:      { exists: boolean; summary: string };
    going_concern:       { exists: boolean; summary: string };
    shell_recycling:     { exists: boolean; summary: string };
    offering_history?:   string;
    dilution_warning:    { exists: boolean; summary: string };
    audit_opinion:       { exists: boolean; summary: string };
    material_litigation: { exists: boolean; summary: string };
}

// critical 리스크 배지 정의
const CRITICAL_BADGES = [
    { key: 'delisting_risk',   label: '상폐위험' },
    { key: 'going_concern',    label: '계속기업' },
    { key: 'audit_opinion',    label: '감사의견' },
    { key: 'dilution_warning', label: '희석경보' },
    { key: 'shell_recycling',  label: '껍데기'   },
] as const;

// 아래로 열리는 말풍선 팝오버
function RiskPopover({
    label,
    summary,
    onClose,
}: {
    label: string;
    summary: string;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 닫기
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="absolute left-0 top-full mt-2 z-50 w-72 bg-white border border-red-200 rounded-xl shadow-xl"
            style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.13))' }}
        >
            {/* 꼭지 (말풍선 위쪽 삼각형) */}
            <div
                className="absolute -top-2 left-4 w-4 h-2 overflow-hidden"
                aria-hidden
            >
                <div className="w-3 h-3 bg-white border-l border-t border-red-200 rotate-45 translate-y-1.5 translate-x-0.5" />
            </div>

            <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <p className="text-[12px] font-black text-red-600 uppercase tracking-wide">{label}</p>
                    <button
                        onClick={onClose}
                        className="ml-auto text-gray-300 hover:text-gray-500 transition text-[16px] leading-none"
                        aria-label="닫기"
                    >
                        ×
                    </button>
                </div>
                <p className="text-[12px] text-gray-700 font-medium leading-relaxed">{summary}</p>
            </div>
        </div>
    );
}

// 배지 하나 + 그 배지에 달린 팝오버
function RiskBadge({ label, summary }: { label: string; summary: string }) {
    const [open, setOpen] = useState(false);

    return (
        <span className="relative inline-block">
            <button
                onClick={() => setOpen(v => !v)}
                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-2 py-0.5 rounded transition-colors"
            >
                <span className="w-1 h-1 rounded-full bg-white/70" />
                {label}
            </button>
            {open && (
                <RiskPopover
                    label={label}
                    summary={summary}
                    onClose={() => setOpen(false)}
                />
            )}
        </span>
    );
}

export default function SecRiskFactors({ symbol }: { symbol: string }) {
    const [data, setData] = useState<RiskAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [portalNode, setPortalNode] = useState<Element | null>(null);

    useEffect(() => {
        setPortalNode(document.getElementById('sec-risk-sticker-portal'));
        fetch(`/api/analyze-risk?symbol=${symbol}`)
            .then(r => r.json())
            .then(json => setData(json.analysis ?? null))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [symbol]);

    if (loading || !data) return null;

    const hasAnyRisk = data.delisting_risk.exists || data.going_concern.exists || data.shell_recycling.exists
        || data.dilution_warning?.exists || data.audit_opinion?.exists || data.material_litigation?.exists;
    const hasOfferingHistory = data.offering_history && data.offering_history.trim() !== '';

    if (!hasAnyRisk && !hasOfferingHistory) return null;

    // critical 배지: exists=true인 것만
    const activeBadges = CRITICAL_BADGES.filter(b => {
        const item = data[b.key as keyof RiskAnalysis];
        return typeof item === 'object' && item !== null && (item as { exists: boolean }).exists;
    });

    // 리스크 카드 목록 (기존 섹션용)
    const riskItems: { label: string; summary: string; critical?: boolean }[] = [];
    if (data.delisting_risk.exists)       riskItems.push({ label: '상장폐지 위험 (Item 3.01)',        summary: data.delisting_risk.summary,     critical: true });
    if (data.going_concern.exists)        riskItems.push({ label: '계속기업 불확실성 (Going Concern)', summary: data.going_concern.summary,      critical: true });
    if (data.audit_opinion?.exists)       riskItems.push({ label: '비적정 감사의견 / 내부통제 취약',   summary: data.audit_opinion.summary,      critical: true });
    if (data.dilution_warning?.exists)    riskItems.push({ label: '잠재 희석 경보 (워런트·전환사채)', summary: data.dilution_warning.summary,   critical: true });
    if (data.material_litigation?.exists) riskItems.push({ label: '중대 소송 계류 중',               summary: data.material_litigation.summary, critical: false });
    if (data.shell_recycling.exists)      riskItems.push({ label: '껍데기 돌려막기 (Shell Recycling)', summary: data.shell_recycling.summary,    critical: true });
    if (hasOfferingHistory)               riskItems.push({ label: '자본 조달 이력',                    summary: data.offering_history! });

    // 헤더 배지 (포털)
    const BadgeRow = activeBadges.length > 0 ? (
        <span className="inline-flex items-center gap-1 flex-wrap">
            {activeBadges.map(b => {
                const item = data[b.key as keyof RiskAnalysis] as { exists: boolean; summary: string };
                return <RiskBadge key={b.key} label={b.label} summary={item.summary} />;
            })}
        </span>
    ) : null;

    return (
        <>
            {/* 헤더 배지 포털 */}
            {portalNode && BadgeRow && createPortal(BadgeRow, portalNode)}

            {/* 기존 리스크 카드 섹션 */}
            {riskItems.map((item, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-red-600">
                    <h3 className="font-bold text-[15px] mb-3 leading-tight flex items-center">
                        {item.critical && <span className="w-2 h-2 rounded-full mr-2 bg-red-600 animate-pulse flex-shrink-0" />}
                        {item.label}
                    </h3>
                    <div className={`${item.critical ? 'bg-red-50' : 'bg-orange-50'} rounded-lg p-3`}>
                        <p className={`text-[12px] font-semibold leading-relaxed ${item.critical ? 'text-red-800' : 'text-orange-800'}`}>
                            {item.summary}
                        </p>
                    </div>
                </div>
            ))}
        </>
    );
}
