import { getCategoryData } from './category';
import { FMPService } from './fmp';

export interface RealityCheckData {
    country: string;
    fullTimeEmployees: number;
    ipoDate: string | null;
    floatShares: number;
    outstandingShares: number;
    floatPercentage: number;
    cashAndCashEquivalents: number;
    netIncome: number;
    cashRunwayMonths: number;
    sector: string | null;
    industry: string | null;
    dilutionRatio: number | null;
    marketCap: number | null;       // USD
    debtRatio: number | null;       // totalLiabilities / equity (null if no data)
    isCapitalImpaired: boolean;     // 자본잠식 (equity <= 0)
    companyName: string | null;     // FMP profile 회사명
    price: number | null;           // 현재 주가 (USD)
    changesPercentage: number | null; // 오늘 등락률 (%)
}

export class FundamentalsService {
    static async getRealityCheck(symbol: string): Promise<RealityCheckData | null> {
        try {
            const apiKey = process.env.FMP_API_KEY;
            if (!apiKey) throw new Error("FMP_API_KEY is missing");

            const baseUrl = 'https://financialmodelingprep.com/stable';

            // Fetch natively from FMP Stable APIs concurrently
            const [profileRes, floatRes, bsRes, isRes, annualIsRes, category, splitFactor] = await Promise.all([
                fetch(`${baseUrl}/profile?symbol=${symbol}&apikey=${apiKey}`, { cache: 'no-store' }),
                fetch(`${baseUrl}/shares-float?symbol=${symbol}&apikey=${apiKey}`, { cache: 'no-store' }),
                fetch(`${baseUrl}/balance-sheet-statement?symbol=${symbol}&period=quarter&limit=1&apikey=${apiKey}`, { cache: 'no-store' }),
                fetch(`${baseUrl}/income-statement?symbol=${symbol}&period=quarter&limit=1&apikey=${apiKey}`, { cache: 'no-store' }),
                fetch(`${baseUrl}/income-statement?symbol=${symbol}&period=annual&limit=4&apikey=${apiKey}`, { cache: 'no-store' }),
                getCategoryData(symbol),
                FMPService.getCumulativeSplitFactor(symbol, 4),
            ]);

            const [profileData, floatData, bsData, isData, annualIsData] = await Promise.all([
                profileRes.ok ? profileRes.json() : [],
                floatRes.ok ? floatRes.json() : [],
                bsRes.ok ? bsRes.json() : [],
                isRes.ok ? isRes.json() : [],
                annualIsRes.ok ? annualIsRes.json() : []
            ]);

            const profile = profileData[0] || {};
            const floatItem = floatData[0] || {};
            const bsItem = bsData[0] || {};
            const isItem = isData[0] || {};

            const country = profile.country || 'Unknown';
            const fullTimeEmployees = parseInt(profile.fullTimeEmployees) || 0;
            const ipoDate = profile.ipoDate || null;

            const floatShares = floatItem.floatShares || 0;
            const outstandingShares = floatItem.outstandingShares || (profile.mktCap ? profile.mktCap / profile.price : 0);
            const floatPercentage = outstandingShares > 0 ? (floatShares / outstandingShares) * 100 : 0;

            const cashAndCashEquivalents = bsItem.cashAndCashEquivalents || 0;
            const netIncome = isItem.netIncome || 0;

            let cashRunwayMonths = 999;
            if (netIncome < 0) {
                // netIncome is for the quarter (3 months)
                const monthlyBurn = Math.abs(netIncome / 3);
                cashRunwayMonths = monthlyBurn > 0 ? cashAndCashEquivalents / monthlyBurn : 0;
            }

            // ─── 순수 지분 희석률 (역분할 독립 계산) ───────────────────────────
            // adjClose/close 비율에서 도출한 splitFactor로 역분할을 직접 보정.
            //
            // splitFactor < 1 → 역분할 발생  (예: 10:1 역분할 → 0.1)
            // splitFactor = 1 → 분할 없음
            //
            // 핵심 공식:
            //   normalizedOldest = oldestShares × splitFactor
            //   (역분할이 없었다면 오늘 기준으로 oldestShares가 이 값이었을 것)
            //   dilution = (newestShares − normalizedOldest) / normalizedOldest × 100
            //
            // FMP IS 데이터가 소급 조정됐든 안 됐든 splitFactor가 보정해줌:
            //   ① 소급 조정된 경우: splitFactor ≈ 1 → 그대로 비교 (기존 방식과 동일)
            //   ② 소급 미조정된 경우: splitFactor가 역분할을 흡수해 정확한 희석률 계산
            let dilutionRatio: number | null = null;
            if (Array.isArray(annualIsData) && annualIsData.length >= 2) {
                const newestShares: number = annualIsData[0]?.weightedAverageShsOutDil || 0;
                const oldestShares: number = annualIsData[annualIsData.length - 1]?.weightedAverageShsOutDil || 0;

                if (newestShares > 0 && oldestShares > 0) {
                    // splitFactor로 과거 주식수를 오늘 분할 기준으로 환산
                    const normalizedOldest = oldestShares * splitFactor;
                    const ratio = ((newestShares - normalizedOldest) / normalizedOldest) * 100;
                    // 극단적 이상값만 걸러냄 (데이터 자체가 없는 수준)
                    if (ratio > -99 && ratio < 100000) dilutionRatio = ratio;
                }
            }

            // 시가총액 (USD) — stable profile은 marketCap 필드
            const marketCap: number | null = profile.marketCap ?? null;

            // 회사명, 현재가, 등락률
            // FMP profile의 changesPercentage는 "+0.83%" 같은 문자열로 올 수 있어 parseFloat 처리
            const companyName: string | null = profile.companyName || null;
            const price: number | null = profile.price ?? null;
            const rawChangePct = profile.changesPercentage;
            const changesPercentage: number | null =
                rawChangePct != null
                    ? parseFloat(String(rawChangePct).replace('%', ''))
                    : null;

            // 부채비율 = totalLiabilities / totalStockholdersEquity
            const totalLiabilities: number = bsItem.totalLiabilities || 0;
            const totalEquity: number = bsItem.totalStockholdersEquity ?? bsItem.totalEquity ?? 0;
            const isCapitalImpaired: boolean = totalEquity <= 0 && totalLiabilities > 0;
            const debtRatio: number | null = totalEquity !== 0
                ? (totalLiabilities / Math.abs(totalEquity)) * 100
                : null;

            return {
                country,
                fullTimeEmployees,
                ipoDate,
                floatShares,
                outstandingShares,
                floatPercentage,
                cashAndCashEquivalents,
                netIncome,
                cashRunwayMonths,
                sector: category.sector,
                industry: category.industry,
                dilutionRatio,
                marketCap,
                debtRatio,
                isCapitalImpaired,
                companyName,
                price,
                changesPercentage,
            };

        } catch (e) {
            console.error(`Failed to fetch reality check for ${symbol}:`, e);
            return null;
        }
    }
}
