'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface RiskAnalysis {
    delisting_risk: { exists: boolean; summary: string };
    going_concern: { exists: boolean; summary: string };
    shell_recycling: { exists: boolean; summary: string };
    offering_history?: string;
}

export default function SecRiskAnalysisPanel({ symbol }: { symbol: string }) {
    const [data, setData] = useState<RiskAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [portalNode, setPortalNode] = useState<Element | null>(null);

    useEffect(() => {
        setPortalNode(document.getElementById('sec-risk-sticker-portal'));

        const fetchAnalysis = async () => {
            try {
                const response = await fetch(`/api/analyze-risk?symbol=${symbol}`);
                const json = await response.json();

                if (json.analysis) {
                    setData(json.analysis);
                } else if (json.message) {
                    setError(json.message);
                } else {
                    setError('분석 데이터를 불러오지 못했습니다.');
                }
            } catch {
                setError('분석 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [symbol]);

    if (loading) {
        return (
            <section className="mb-6 bg-red-50/50 border border-red-100 rounded-xl overflow-hidden shadow-sm p-5 animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-6 h-6 bg-red-200 rounded-full"></div>
                    <div className="h-4 bg-red-200 rounded w-1/2"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-3 bg-red-100 rounded w-full"></div>
                    <div className="h-3 bg-red-100 rounded w-5/6"></div>
                    <div className="h-3 bg-red-100 rounded w-4/6"></div>
                </div>
                <p className="text-xs text-red-400 mt-4 text-center font-medium">Gemini가 수십만 자의 SEC 공시 원문을 포렌식 감사 중입니다...</p>
            </section>
        );
    }

    // 오류 or 분석 데이터 없음: 아무것도 렌더링하지 않음
    if (error || !data) return null;

    const hasAnyRisk = data.delisting_risk.exists || data.going_concern.exists || data.shell_recycling.exists;
    const hasOfferingHistory = data.offering_history && data.offering_history.trim() !== '';

    // 리스크도 없고 자본조달이력도 없으면 전체 패널 숨김
    if (!hasAnyRisk && !hasOfferingHistory) return null;

    const DangerSticker = hasAnyRisk ? (
        <span className="inline-flex items-center ml-2 align-middle bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm border border-red-700 animate-bounce">
            ⚠️ 상폐·환기 리스크
        </span>
    ) : null;

    return (
        <>
            {portalNode && createPortal(DangerSticker, portalNode)}

            <section className="mb-6 bg-white border-2 border-red-600 rounded-xl overflow-hidden shadow-md">
                <div className="bg-red-600 px-4 py-3 flex justify-between items-center text-white">
                    <h2 className="text-[15px] font-black flex items-center">
                        <span className="text-xl mr-2">🚨</span> AI 공시 심층 분석 (Gemini)
                    </h2>
                    <span className="text-[10px] bg-red-800 text-red-100 px-2 py-0.5 rounded font-bold tracking-wider">SEC EDGAR</span>
                </div>

                <div className="p-4 space-y-4">
                    {/* 자본 조달 이력 — 실제 데이터 있을 때만 */}
                    {hasOfferingHistory && (
                        <div>
                            <div className="flex items-center mb-1">
                                <span className="w-2 h-2 rounded-full mr-2 bg-red-400"></span>
                                <span className="text-[13px] font-bold text-gray-800">자본 조달 이력</span>
                            </div>
                            <p className="text-[12px] pl-4 leading-relaxed text-gray-700 font-medium bg-red-50/50 p-2 rounded">
                                {data.offering_history}
                            </p>
                        </div>
                    )}

                    {hasOfferingHistory && hasAnyRisk && <div className="w-full h-px bg-red-50"></div>}

                    {/* Delisting Risk */}
                    {data.delisting_risk.exists && (
                        <div>
                            <div className="flex items-center mb-1">
                                <span className="w-2 h-2 rounded-full mr-2 bg-red-600 animate-pulse"></span>
                                <span className="text-[13px] font-bold text-gray-800">상장폐지 위험 (Item 3.01)</span>
                            </div>
                            <p className="text-[12px] pl-4 text-red-700 font-semibold">{data.delisting_risk.summary}</p>
                        </div>
                    )}

                    {data.delisting_risk.exists && (data.going_concern.exists || data.shell_recycling.exists) && <div className="w-full h-px bg-red-50"></div>}

                    {/* Going Concern */}
                    {data.going_concern.exists && (
                        <div>
                            <div className="flex items-center mb-1">
                                <span className="w-2 h-2 rounded-full mr-2 bg-red-600 animate-pulse"></span>
                                <span className="text-[13px] font-bold text-gray-800">계속기업 불확실성 (Going Concern)</span>
                            </div>
                            <p className="text-[12px] pl-4 text-red-700 font-semibold">{data.going_concern.summary}</p>
                        </div>
                    )}

                    {data.going_concern.exists && data.shell_recycling.exists && <div className="w-full h-px bg-red-50"></div>}

                    {/* Shell Recycling */}
                    {data.shell_recycling.exists && (
                        <div>
                            <div className="flex items-center mb-1">
                                <span className="w-2 h-2 rounded-full mr-2 bg-red-600 animate-pulse"></span>
                                <span className="text-[13px] font-bold text-gray-800">껍데기 돌려막기 (Shell Recycling)</span>
                            </div>
                            <p className="text-[12px] pl-4 text-red-700 font-semibold">{data.shell_recycling.summary}</p>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
