const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;

export interface FmpGainer {
    symbol: string;
    name: string;
    change: number;
    price: number;
    changesPercentage: number;
}

export interface FmpChartPoint {
    date: string;
    open: number;
    low: number;
    high: number;
    close: number;
    volume: number;
}

export interface FmpNews {
    symbol: string;
    publishedDate: string;
    title: string;
    image?: string;
    site?: string;
    publisher?: string;
    text: string;
    url?: string;
    link?: string;
}

export interface FmpQuote {
    symbol: string;
    price: number;
    changePercentage: number;
    change: number;
    timestamp: number;
    previousClose: number;
    isHalted: boolean;
}

export interface FmpPressRelease {
    symbol: string;
    date: string;
    title: string;
    text: string;
}

export interface FmpInsiderTrade {
    symbol: string;
    filingDate: string;
    transactionDate: string;
    reportingName: string;
    typeOfOwner: string;       // "director", "officer: ceo", etc.
    transactionType: string;   // "P-Purchase", "S-Sale", "A-Award", etc.
    securitiesTransacted: number;
    price: number;
    securitiesOwned: number;
    formType: string;
    link: string;
    securityName: string;
}

export interface FmpInsiderStats {
    symbol: string;
    totalBought: number;
    totalSold: number;
    totalBoughtValue: number;
    totalSoldValue: number;
    buyTransactions: number;
    sellTransactions: number;
}

export class FMPService {
    /**
     * Fetch today's biggest stock gainers to look for momentum plays.
     */
    static async getTopGainers(): Promise<FmpGainer[]> {
        if (!API_KEY) throw new Error('FMP_API_KEY is not set');

        // Using the biggest-gainers endpoint
        const url = `${FMP_BASE_URL}/biggest-gainers?apikey=${API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
            throw new Error(`FMP API Error: ${res.statusText}`);
        }

        return res.json();
    }

    /**
     * Fetch today's most active stocks (volume spikes) to look for hot themes.
     */
    static async getTopActives(): Promise<FmpGainer[]> {
        if (!API_KEY) throw new Error('FMP_API_KEY is not set');

        // Using the most-actives endpoint
        const url = `${FMP_BASE_URL}/most-actives?apikey=${API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
            throw new Error(`FMP API Error: ${res.statusText}`);
        }

        return res.json();
    }

    /**
     * Fetch recent news for a specific stock symbol.
     * @param symbol Stock ticker
     * @param limit Number of items to return
     */
    static async getRecentNews(symbol: string, limit: number = 5): Promise<FmpNews[]> {
        if (!API_KEY) return [];
        try {
            // /stable/news/stock?symbols=SYMBOL — 특정 티커 뉴스 (심볼 필터 적용)
            // /stable/news/stock-latest 는 전체 최신 뉴스로 symbol 파라미터 무시됨
            const url = `${FMP_BASE_URL}/news/stock?symbols=${symbol}&limit=${limit}&apikey=${API_KEY}`;
            const res = await fetch(url, { next: { revalidate: 3600 } });
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data.slice(0, limit) : [];
        } catch {
            return [];
        }
    }

    /**
     * Fetch SEC Filings (e.g., 8-K)
     */
    static async getSecFilings(symbol: string, type: string = '8-K', limit: number = 3) {
        if (!API_KEY) throw new Error('FMP_API_KEY is not set');
        const url = `${FMP_BASE_URL}/sec_filings?symbol=${symbol}&type=${type}&page=0&apikey=${API_KEY}`;
        const res = await fetch(url, { next: { revalidate: 3600 } });

        if (!res.ok) {
            throw new Error(`FMP API Error: ${res.statusText}`);
        }

        const data = await res.json();
        return data.slice(0, limit);
    }

    /**
     * 실시간 quote 조회 (/quote 엔드포인트만 사용).
     */
    static async getRealTimeQuotes(symbols: string[]): Promise<Record<string, FmpQuote>> {
        if (!API_KEY) throw new Error('FMP_API_KEY is not set');
        if (!symbols || symbols.length === 0) return {};

        const uniqueSymbols = Array.from(new Set(symbols)).filter(Boolean);
        const quotesMap: Record<string, FmpQuote> = {};

        try {
            await Promise.all(uniqueSymbols.map(async (sym) => {
                const res = await fetch(`${FMP_BASE_URL}/quote?symbol=${sym}&apikey=${API_KEY}`, { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (!Array.isArray(data) || !data[0]?.symbol) return;
                const q = data[0];

                quotesMap[q.symbol] = {
                    symbol: q.symbol,
                    price: q.price ?? 0,
                    changePercentage: q.changesPercentage ?? q.changePercentage ?? 0,
                    change: q.change ?? 0,
                    timestamp: q.timestamp || 0,
                    previousClose: q.previousClose || q.price || 0,
                    isHalted: q.isHalted === true,
                };
            }));
        } catch (e) {
            console.error('Failed to fetch real-time quotes:', e);
        }

        return quotesMap;
    }

    /**
     * Fetch daily historical chart data from FMP Stable (Starter plan compatible).
     * Returns last 90 trading days of OHLCV data.
     */
    static async getHistoricalChartDaily(symbol: string): Promise<FmpChartPoint[]> {
        if (!API_KEY) throw new Error('FMP_API_KEY is not set');
        if (!symbol) return [];

        try {
            const url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${symbol}&apikey=${API_KEY}`;
            const res = await fetch(url, { next: { revalidate: 300 } });

            if (!res.ok) {
                console.error(`FMP Daily Chart API Error: ${res.statusText}`);
                return [];
            }

            const data = await res.json();
            if (Array.isArray(data)) {
                // 최근 90일만 사용, FmpChartPoint 형태로 매핑
                return data.slice(0, 90).map((d: any) => ({
                    date: d.date,
                    open: d.open,
                    low: d.low,
                    high: d.high,
                    close: d.close,
                    volume: d.volume
                }));
            }
        } catch (e) {
            console.error("Failed to fetch daily chart data:", e);
        }

        return [];
    }
    /**
     * 특정 종목의 최신 뉴스를 가져옴 (FMP /stable/stock-news 엔드포인트).
     * v3는 deprecated — stable 전용으로 통일.
     * @param symbol  종목 티커
     * @param limit   가져올 뉴스 수 (기본 3)
     */
    static async getStockNews(symbol: string, limit: number = 3): Promise<FmpNews[]> {
        if (!API_KEY) return [];

        const mapItems = (data: any[], sym: string): FmpNews[] =>
            data.slice(0, limit).map((item: any) => ({
                symbol: item.symbol ?? sym,
                publishedDate: item.publishedDate ?? item.date ?? '',
                title: item.title ?? '',
                image: item.image ?? item.banner_image ?? undefined,
                site: item.site ?? item.source ?? undefined,
                publisher: item.publisher ?? item.site ?? item.source ?? undefined,
                text: item.text ?? item.summary ?? '',
                url: item.url ?? item.link ?? undefined,
            }));

        // stable 엔드포인트 파라미터 후보 순서대로 시도
        // (FMP stable은 문서마다 symbol/symbols/tickers 혼용)
        const candidates = [
            `${FMP_BASE_URL}/stock-news?tickers=${symbol}&limit=${limit}&apikey=${API_KEY}`,
            `${FMP_BASE_URL}/stock-news?symbol=${symbol}&limit=${limit}&apikey=${API_KEY}`,
            `${FMP_BASE_URL}/stock-news?symbols=${symbol}&limit=${limit}&apikey=${API_KEY}`,
        ];

        for (const url of candidates) {
            try {
                const res = await fetch(url, { next: { revalidate: 300 } });
                if (!res.ok) continue;
                const data = await res.json();
                // 에러 객체 or 빈 배열이 아닌지 확인
                if (Array.isArray(data) && data.length > 0 && data[0]?.title) {
                    console.log(`[news] ${symbol}: success via ${new URL(url).searchParams.toString().split('&')[0]}`);
                    return mapItems(data, symbol);
                }
                // 응답 내용 디버그 (title 없는 경우)
                console.log(`[news] ${symbol} try: ${new URL(url).searchParams.toString().split('&')[0]} →`, JSON.stringify(data).slice(0, 120));
            } catch (e) {
                console.error(`[news] fetch error for ${url}:`, e);
            }
        }

        console.log(`[news] ${symbol}: all candidates exhausted, no news found`);
        return [];
    }

    /**
     * 주가 데이터의 adjClose/close 비율로 누적 역분할(reverse split) 계수를 계산.
     *
     * FMP historical-price-eod/full 엔드포인트에는 close(원본)와 adjClose(소급조정)가 모두 있어
     * 두 값의 비율로 해당 날짜까지의 누적 분할 계수를 직접 도출할 수 있음.
     *
     *   oldAdjRatio = adjClose(oldest) / close(oldest)  → 과거 시점의 누적 조정계수
     *   newAdjRatio = adjClose(newest) / close(newest)  → 현재 시점의 누적 조정계수 (≈ 1.0)
     *   splitFactor = newAdjRatio / oldAdjRatio
     *
     * 예) 10:1 역분할이 있었다면:
     *   oldest: close=$1, adjClose=$10 → oldAdjRatio=10
     *   newest: close=$5, adjClose=$5  → newAdjRatio=1
     *   splitFactor = 1/10 = 0.1
     *   → 과거 주식수에 0.1을 곱해야 오늘 기준 주식수가 됨
     *
     * @returns splitFactor (분할 없으면 1.0, 역분할이면 < 1.0)
     */
    static async getCumulativeSplitFactor(symbol: string, yearsBack: number = 4): Promise<number> {
        if (!API_KEY) return 1;
        try {
            const url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${symbol}&apikey=${API_KEY}`;
            const res = await fetch(url, { cache: 'no-store' }); // 테스트 중: 캐싱 비활성화
            if (!res.ok) return 1;

            const data = await res.json();
            if (!Array.isArray(data) || data.length < 2) return 1;

            // FMP는 최신 날짜가 배열 앞에 옴
            const newest = data[0];
            const newestAdjRatio: number =
                newest.close > 0 ? (newest.adjClose ?? newest.close) / newest.close : 1;

            // yearsBack 년 전에 가장 가까운 데이터 포인트 찾기
            const cutoff = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
            const oldest = data.find((d: any) => new Date(d.date) <= cutoff);
            if (!oldest) return 1;

            const oldestAdjRatio: number =
                oldest.close > 0 ? (oldest.adjClose ?? oldest.close) / oldest.close : 1;
            if (oldestAdjRatio === 0) return 1;

            const factor = newestAdjRatio / oldestAdjRatio;

            // [DEBUG] 서버 콘솔에서 확인
            console.log(`[splitFactor] ${symbol}`, {
                newestDate: newest.date,
                newestClose: newest.close,
                newestAdjClose: newest.adjClose,   // null이면 FMP 응답에 adjClose 없음
                oldestDate: oldest.date,
                oldestClose: oldest.close,
                oldestAdjClose: oldest.adjClose,
                newestAdjRatio,
                oldestAdjRatio,
                factor,
            });

            return factor;
        } catch {
            return 1;
        }
    }

    /**
     * Fetch insider trading activity for a symbol (1 year window).
     * Endpoint: /stable/insider-trading/search?symbol=X&page=0&limit=N
     */
    static async getInsiderTrades(symbol: string, limit: number = 100): Promise<FmpInsiderTrade[]> {
        if (!API_KEY) return [];
        try {
            const url = `${FMP_BASE_URL}/insider-trading/search?symbol=${symbol}&page=0&limit=${limit}&apikey=${API_KEY}`;
            const res = await fetch(url, { next: { revalidate: 3600 } });
            if (!res.ok) return [];
            const data = await res.json();
            if (!Array.isArray(data)) return [];

            // Filter to last 1 year
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            return data
                .filter((t: any) => t.transactionDate && new Date(t.transactionDate) >= oneYearAgo)
                .map((t: any): FmpInsiderTrade => ({
                    symbol: t.symbol ?? symbol,
                    filingDate: t.filingDate ?? '',
                    transactionDate: t.transactionDate ?? '',
                    reportingName: t.reportingName ?? '',
                    typeOfOwner: t.typeOfOwner ?? '',
                    transactionType: t.transactionType ?? '',
                    securitiesTransacted: t.securitiesTransacted ?? 0,
                    price: t.price ?? 0,
                    securitiesOwned: t.securitiesOwned ?? 0,
                    formType: t.formType ?? '',
                    link: t.link ?? '',
                    securityName: t.securityName ?? '',
                }));
        } catch (e) {
            console.error('[InsiderTrades] fetch error:', e);
            return [];
        }
    }

    /**
     * Fetch insider trading statistics for a symbol.
     * Endpoint: /stable/insider-trading/statistics?symbol=X
     */
    static async getInsiderStats(symbol: string): Promise<FmpInsiderStats | null> {
        if (!API_KEY) return null;
        try {
            const url = `${FMP_BASE_URL}/insider-trading/statistics?symbol=${symbol}&apikey=${API_KEY}`;
            const res = await fetch(url, { next: { revalidate: 3600 } });
            if (!res.ok) return null;
            const data = await res.json();
            if (!data || typeof data !== 'object') return null;
            // May be array or single object
            const raw = Array.isArray(data) ? data[0] : data;
            if (!raw) return null;
            return {
                symbol: raw.symbol ?? symbol,
                totalBought: raw.totalBought ?? 0,
                totalSold: raw.totalSold ?? 0,
                totalBoughtValue: raw.totalBoughtValue ?? 0,
                totalSoldValue: raw.totalSoldValue ?? 0,
                buyTransactions: raw.buyTransactions ?? 0,
                sellTransactions: raw.sellTransactions ?? 0,
            };
        } catch (e) {
            console.error('[InsiderStats] fetch error:', e);
            return null;
        }
    }

    /**
     * Fetch press releases for a symbol.
     * Endpoint: /stable/news/press-releases?symbols=SYMBOL
     */
    static async getPressReleases(symbol: string, limit: number = 20): Promise<FmpPressRelease[]> {
        if (!API_KEY) return [];
        try {
            const url = `${FMP_BASE_URL}/news/press-releases?symbols=${symbol}&limit=${limit}&apikey=${API_KEY}`;
            const res = await fetch(url, { next: { revalidate: 3600 } });
            if (!res.ok) return [];
            const data = await res.json();
            if (!Array.isArray(data)) return [];
            return data.map((item: any): FmpPressRelease => ({
                symbol: item.symbol ?? symbol,
                date: item.date ?? item.publishedDate ?? '',
                title: item.title ?? '',
                text: item.text ?? '',
            }));
        } catch (e) {
            console.error('[PressReleases] fetch error:', e);
            return [];
        }
    }

    /**
     * Fetch forex exchange rate using /quote endpoint (supports currency pairs like USDKRW).
     * Returns the current price (exchange rate).
     */
    static async getForexRate(pair: string): Promise<number | null> {
        if (!API_KEY) throw new Error('FMP_API_KEY is not set');
        try {
            const url = `${FMP_BASE_URL}/quote?symbol=${pair}&apikey=${API_KEY}`;
            const res = await fetch(url, { next: { revalidate: 300 } }); // 5분 캐싱
            if (!res.ok) return null;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].price) {
                return data[0].price as number;
            }
        } catch (e) {
            console.error('Failed to fetch forex rate:', e);
        }
        return null;
    }
}
