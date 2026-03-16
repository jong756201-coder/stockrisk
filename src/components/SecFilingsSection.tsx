'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FilingCard from '@/components/FilingCard';

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

interface SectionProps {
    icon: string;
    title: string;
    subtitle: string;
    filings: SecFiling[];
    headerColor: string;
    symbol: string;
    sectionType: 'offerings' | 'disclosures' | 'shareholders';
}

function FilingSection({ icon, title, subtitle, filings, headerColor, symbol, sectionType }: SectionProps) {
    const SHOW = 3;
    const visible = filings.slice(0, SHOW);
    const remaining = filings.length - SHOW;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className={`px-4 py-3 border-b ${headerColor}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <div>
                            <p className="text-[13px] font-black leading-tight">{title}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    {filings.length > 0 && (
                        <span className="text-[11px] font-black bg-white/80 px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                            {filings.length}건
                        </span>
                    )}
                </div>
            </div>

            {/* 목록 */}
            <div className="px-3 py-2.5 space-y-2">
                {filings.length === 0 ? (
                    <p className="text-[12px] text-gray-400 py-1.5 px-1">최근 1년 내 해당 공시 없음</p>
                ) : (
                    <>
                        {visible.map((f, i) => {
                            const href = f.finalLink || f.link;
                            const detailUrl = `/ticker/${symbol}/sec-filings/detail?url=${encodeURIComponent(href)}&formType=${encodeURIComponent(f.formType)}&date=${encodeURIComponent(f.filingDate)}&from=${sectionType}`;
                            return (
                                <FilingCard key={i} filing={f} detailUrl={detailUrl} />
                            );
                        })}

                        {/* 더 보기 → 해당 섹션 전용 페이지 */}
                        {remaining > 0 && (
                            <Link
                                href={`/ticker/${symbol}/sec-filings?type=${sectionType}`}
                                className="flex items-center justify-center gap-1 text-[11px] text-blue-500 font-bold py-1.5 hover:text-blue-700 transition-colors"
                            >
                                +{remaining}건 더 보기 →
                            </Link>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function SecFilingsSection({ symbol }: { symbol: string }) {
    const [data, setData] = useState<SecFilingsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setData(null);
        fetch(`/api/sec-filings/${symbol}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => setData(d))
            .catch(() => setData({ offerings: [], keyDisclosures: [], shareholders: [] }))
            .finally(() => setLoading(false));
    }, [symbol]);

    const isEmpty = !loading && data &&
        data.offerings.length === 0 &&
        data.keyDisclosures.length === 0 &&
        data.shareholders.length === 0;

    if (isEmpty) return null;

    return (
        <section className="mb-6">
            <h2 className="text-lg font-bold flex items-center mb-3">
                <span className="w-1.5 h-4 bg-gray-700 mr-2 rounded-sm"></span>
                주요 공시
            </h2>

            {loading ? (
                <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                            <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-gray-100 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    <FilingSection
                        icon="📡"
                        title="주요 공시"
                        subtitle="8-K · 6-K — 돌발 이벤트 공시"
                        filings={data!.keyDisclosures}
                        headerColor={data!.keyDisclosures.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}
                        symbol={symbol}
                        sectionType="disclosures"
                    />
                    <FilingSection
                        icon="🚨"
                        title="자본 조달 및 유상증자"
                        subtitle="S-3 · S-1 · F-3 · 424B — 주식 발행 공시"
                        filings={data!.offerings}
                        headerColor={data!.offerings.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}
                        symbol={symbol}
                        sectionType="offerings"
                    />
                    <FilingSection
                        icon="🦈"
                        title="대주주 지분 변동"
                        subtitle="SC 13D · 13G — 5% 이상 지분 변동"
                        filings={data!.shareholders}
                        headerColor={data!.shareholders.length > 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}
                        symbol={symbol}
                        sectionType="shareholders"
                    />
                </div>
            )}
        </section>
    );
}
