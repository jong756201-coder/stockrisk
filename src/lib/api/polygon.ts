const POLYGON_BASE_URL = 'https://api.polygon.io';
const API_KEY = process.env.POLYGON_API_KEY;

export interface PolygonAgg {
    T: string; // symbol
    v: number; // volume
    vw: number; // volume weighted avg price
    o: number; // open
    c: number; // close
    h: number; // high
    l: number; // low
    t: number; // timestamp
    n: number; // number of transactions
}

export class PolygonService {
    /**
     * Get the historical daily bar (closing price) for a stock on a specific date.
     * @param symbol Stock ticker
     * @param date Date String in YYYY-MM-DD format
     */
    static async getDailyBar(symbol: string, date: string): Promise<PolygonAgg | null> {
        if (!API_KEY) throw new Error('POLYGON_API_KEY is not set');

        // Polygon daily open/close endpoint: /v1/open-close/{stocksTicker}/{date}
        // Alternatively, using the aggregate endpoint for a single day
        const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/1/day/${date}/${date}?adjusted=true&sort=asc&apiKey=${API_KEY}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Polygon Daily Bar Error for ${symbol} on ${date}: ${res.status}`);
                return null; // Don't throw to prevent pipeline crash, just return null if no data
            }

            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return data.results[0];
            }

            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    /**
     * Helper function to get past prices for similarities logic
     */
    static async getOutcomePrices(symbol: string, baseDate: string) {
        // Utility to calculate future dates (T+1, T+7, T+30)
        // Complex date math will be handled by the pipeline logic.
        // This just exposes the raw fetcher.
    }
}
