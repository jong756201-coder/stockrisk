import React from 'react';
import { RealityCheckData } from '@/lib/api/fundamentals';

const COUNTRY_KR: Record<string, string> = {
    'US': '미국', 'CN': '중국', 'JP': '일본', 'KR': '한국', 'GB': '영국',
    'DE': '독일', 'FR': '프랑스', 'CA': '캐나다', 'AU': '호주', 'IN': '인도',
    'BR': '브라질', 'IL': '이스라엘', 'HK': '홍콩', 'SG': '싱가포르', 'TW': '대만',
    'IE': '아일랜드', 'NL': '네덜란드', 'CH': '스위스', 'SE': '스웨덴', 'NO': '노르웨이',
    'DK': '덴마크', 'FI': '핀란드', 'IT': '이탈리아', 'ES': '스페인', 'MX': '멕시코',
    'AR': '아르헨티나', 'ZA': '남아공', 'RU': '러시아', 'NZ': '뉴질랜드', 'BE': '벨기에',
    'AT': '오스트리아', 'PL': '폴란드', 'LU': '룩셈부르크', 'BM': '버뮤다',
    'KY': '케이맨제도', 'BS': '바하마', 'VG': '영국령 버진아일랜드', 'PA': '파나마', 'CY': '키프로스',
    // FMP sometimes returns full country names
    'United States': '미국', 'China': '중국', 'Japan': '일본', 'South Korea': '한국',
    'United Kingdom': '영국', 'Germany': '독일', 'France': '프랑스', 'Canada': '캐나다',
    'Australia': '호주', 'India': '인도', 'Brazil': '브라질', 'Israel': '이스라엘',
    'Hong Kong': '홍콩', 'Singapore': '싱가포르', 'Taiwan': '대만', 'Ireland': '아일랜드',
    'Netherlands': '네덜란드', 'Switzerland': '스위스', 'Sweden': '스웨덴', 'Norway': '노르웨이',
    'Denmark': '덴마크', 'Finland': '핀란드', 'Italy': '이탈리아', 'Spain': '스페인',
    'Mexico': '멕시코', 'Argentina': '아르헨티나', 'South Africa': '남아공',
    'New Zealand': '뉴질랜드', 'Belgium': '벨기에', 'Luxembourg': '룩셈부르크',
    'Bermuda': '버뮤다', 'Cayman Islands': '케이맨제도', 'Bahamas': '바하마',
    'British Virgin Islands': '영국령 버진아일랜드', 'Panama': '파나마', 'Cyprus': '키프로스'
};

export default function RealityCheckPanel({ data, symbol, krwRate }: { data: RealityCheckData | null, symbol: string, krwRate?: number | null }) {
    if (!data) return null;
    const usdKrw = krwRate ?? 1450;

    // Risk Evaluators
    const riskyCountries = ['Cayman Islands', 'Bahamas', 'Bermuda', 'British Virgin Islands', 'Panama', 'Cyprus'];
    const isRiskyCountry = riskyCountries.includes(data.country);

    // We treat 0 employees as extremely risky as well (often means missing or paper company)
    const isRiskyEmployees = data.fullTimeEmployees < 10;

    // Runway less than 6 months is dangerous
    const isRiskyRunway = data.cashRunwayMonths < 6;

    // Helper functions for formatting
    const formatNumber = (num: number) => {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toLocaleString();
    };

    const formatCurrency = (num: number) => {
        if (num === 0) return '$0';
        const isNegative = num < 0;
        const absNum = Math.abs(num);
        const formatted = formatNumber(absNum);
        return isNegative ? `-$${formatted}` : `$${formatted}`;
    };

    return (
        <section className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-[15px] font-black text-gray-800 flex items-center">
                    <span className="text-xl mr-2">🔎</span> 기초 펀더멘털 (실체 검증)
                </h2>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Reality Check</span>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
                {/* 1. Country */}
                <div className="flex flex-col">
                    <span className="text-[11px] text-gray-500 font-medium mb-1">법인 소재지</span>
                    <span className={`text-sm font-bold ${isRiskyCountry ? 'text-red-600' : 'text-gray-900'}`}>
                        {data.country === 'Unknown' ? <span className="text-gray-400">정보 없음</span> : (COUNTRY_KR[data.country] || data.country)}
                        {isRiskyCountry && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded">리스크</span>}
                    </span>
                </div>

                {/* 2. Employees */}
                <div className="flex flex-col">
                    <span className="text-[11px] text-gray-500 font-medium mb-1">정규직 직원수</span>
                    <span className={`text-sm font-bold ${data.fullTimeEmployees === 0 ? 'text-gray-400' : isRiskyEmployees ? 'text-red-600' : 'text-gray-900'}`}>
                        {data.fullTimeEmployees === 0 ? '정보 없음' : `${data.fullTimeEmployees.toLocaleString()} 명`}
                        {(data.fullTimeEmployees > 0 && isRiskyEmployees) && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded">페이퍼?</span>}
                    </span>
                </div>

                {/* 3. Float % */}
                <div className="flex flex-col">
                    <div className="relative flex items-center group cursor-help mb-1 w-max">
                        <span className="text-[11px] text-gray-500 font-medium mr-1">유통 주식</span>
                        <span className="text-[9px] w-3.5 h-3.5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-bold">?</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 p-2.5 bg-gray-800 text-gray-100 text-[11px] rounded shadow-lg z-10">
                            <strong>[계산식]</strong><br />
                            (유통 주식 / 총 발행 주식) * 100<br /><br />
                            <strong>[실제 수치]</strong><br />
                            • 유통: {formatNumber(data.floatShares)}주<br />
                            • 발행: {formatNumber(data.outstandingShares)}주
                        </div>
                    </div>
                    <span className={`text-sm font-bold ${data.outstandingShares === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                        {data.outstandingShares === 0 ? '정보 없음' : (
                            <>{data.floatPercentage.toFixed(1)}% <span className="text-[11px] text-gray-400 font-normal">({formatNumber(data.floatShares)}주)</span></>
                        )}
                    </span>
                </div>

                {/* 4. Cash Runway */}
                <div className="flex flex-col">
                    <div className="relative flex items-center group cursor-help mb-1 w-max">
                        <span className="text-[11px] text-gray-500 font-medium mr-1">현금 생존력</span>
                        <span className="text-[9px] w-3.5 h-3.5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-bold">?</span>
                        <div className="absolute right-0 sm:left-0 sm:right-auto bottom-full mb-1 hidden group-hover:block w-52 p-2.5 bg-gray-800 text-gray-100 text-[11px] rounded shadow-lg z-10">
                            <strong>[계산식]</strong><br />
                            보유 현금 / |최근 분기 순손실 / 3|<br /><br />
                            <strong>[실제 수치]</strong><br />
                            • 현금: {formatCurrency(data.cashAndCashEquivalents)}<br />
                            • 분기 순이익: {formatCurrency(data.netIncome)}<br />
                            • 월평균 소모: {data.netIncome < 0 ? formatCurrency(Math.abs(data.netIncome / 3)) : '$0'}
                        </div>
                    </div>
                    {data.cashAndCashEquivalents === 0 && data.netIncome === 0 ? (
                        <span className="text-sm font-bold text-gray-400">정보 없음</span>
                    ) : data.netIncome >= 0 ? (
                        <span className="text-sm font-bold text-green-600">흑자 기업 (자생 가능)</span>
                    ) : (
                        <span className={`text-sm font-bold ${isRiskyRunway ? 'text-red-600' : 'text-gray-900'}`}>
                            약 {data.cashRunwayMonths.toFixed(1)}개월 버팀
                            {isRiskyRunway && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded">유증 위험</span>}
                        </span>
                    )}
                </div>
                {/* 5. Market Cap */}
                {data.marketCap !== null && (
                    <div className="flex flex-col">
                        <span className="text-[11px] text-gray-500 font-medium mb-1">시가총액</span>
                        <span className="text-sm font-bold text-gray-900">
                            {/* 원화: 억/조 단위 */}
                            {(() => {
                                const krw = data.marketCap! * usdKrw;
                                if (krw >= 1_0000_0000_0000) return `${(krw / 1_0000_0000_0000).toFixed(1)}조 원`;
                                if (krw >= 1_0000_0000) return `${Math.round(krw / 1_0000_0000).toLocaleString()}억 원`;
                                return `${Math.round(krw / 10000).toLocaleString()}만 원`;
                            })()}
                        </span>
                        <span className="text-[11px] text-gray-400 font-normal mt-0.5">
                            ${(data.marketCap! / 1_000_000).toFixed(0)}M
                        </span>
                    </div>
                )}

                {/* 6. Debt Ratio */}
                {data.debtRatio !== null && (
                    <div className="flex flex-col">
                        <div className="relative flex items-center group cursor-help mb-1 w-max">
                            <span className="text-[11px] text-gray-500 font-medium mr-1">부채 비율</span>
                            <span className="text-[9px] w-3.5 h-3.5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-bold">?</span>
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 p-2.5 bg-gray-800 text-gray-100 text-[11px] rounded shadow-lg z-10">
                                <strong>[계산식]</strong><br />
                                총부채 / |자기자본| × 100<br /><br />
                                <strong>[실제 수치]</strong><br />
                                • 총부채: {formatCurrency(data.debtRatio !== null ? (data.debtRatio * (data.isCapitalImpaired ? 1 : 1)) : 0)}<br />
                                • 자기자본: {data.isCapitalImpaired ? '음수 (자본잠식)' : '양수'}<br /><br />
                                <strong>[기준]</strong><br />
                                • 300% 이하: 안전<br />
                                • 300% 초과: 과다부채<br />
                                • 자기자본 ≤ 0: 자본잠식
                            </div>
                        </div>
                        <span className={`text-sm font-bold flex items-center gap-1 ${data.isCapitalImpaired ? 'text-red-600' : data.debtRatio! > 300 ? 'text-orange-500' : 'text-gray-900'}`}>
                            {data.isCapitalImpaired ? '측정불가' : `${data.debtRatio!.toFixed(0)}%`}
                            {data.isCapitalImpaired && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">자본잠식</span>
                            )}
                            {!data.isCapitalImpaired && data.debtRatio! > 300 && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">과다부채</span>
                            )}
                        </span>
                    </div>
                )}

                {/* 7. Dilution Ratio */}
                {data.dilutionRatio !== null && (
                    <div className="flex flex-col col-span-2 pt-3 border-t border-gray-100">
                        <div className="relative flex items-center group cursor-help mb-1 w-max">
                            <span className="text-[11px] text-gray-500 font-medium mr-1">3년 지분 희석률</span>
                            <span className="text-[9px] w-3.5 h-3.5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-bold">?</span>
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 p-2.5 bg-gray-800 text-gray-100 text-[11px] rounded shadow-lg z-10">
                                <strong>[계산식]</strong><br />
                                (최근연도 희석주식수 - 3년전 희석주식수) / 3년전 희석주식수 × 100<br /><br />
                                <strong>[데이터 소스]</strong><br />
                                FMP annual income-statement<br />
                                weightedAverageShsOutDil<br /><br />
                                역주식병합(Reverse Split) 시 양쪽 모두 소급조정되어 자연 상쇄됨
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${data.dilutionRatio > 0 ? 'text-red-600' : data.dilutionRatio < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                {data.dilutionRatio > 0 ? '+' : ''}{data.dilutionRatio.toFixed(2)}%
                            </span>
                            <span className="text-[11px] text-gray-400 font-normal">
                                {data.dilutionRatio === 0 ? '주식수 변동 없음' : data.dilutionRatio > 0 ? '지분 희석' : '주식 수 감소'}
                            </span>
                            {data.dilutionRatio > 30 && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">과도한 희석</span>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </section>
    );
}
