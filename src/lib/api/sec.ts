import axios from 'axios';
import * as cheerio from 'cheerio';

export interface SecFilingMeta {
    type: string;
    filing_date: string;
    source_url: string;
}

export interface AllFilingsResult {
    riskFilings: SecFilingMeta[];      // 8-K, 10-K, 10-Q
    offeringFilings: SecFilingMeta[];  // S-3, 424B5, S-1, S-3ASR, S-1/A
}

export class SecFilingService {
    /**
     * FMP API 1번 호출로 최근 3년 SEC 공시를 모두 가져온 뒤,
     * 리스크 분석용(8-K, 10-K, 10-Q)과 오퍼링 분석용(S-3, 424B5, S-1)으로 분리 반환.
     */
    static async getAllFilings(symbol: string): Promise<AllFilingsResult> {
        try {
            const apiKey = process.env.FMP_API_KEY;
            if (!apiKey) throw new Error("Missing FMP_API_KEY");

            const today = new Date();
            const toDate = today.toISOString().split('T')[0];
            const fromDateObj = new Date();
            fromDateObj.setFullYear(today.getFullYear() - 3);
            const fromDate = fromDateObj.toISOString().split('T')[0];

            const url = `https://financialmodelingprep.com/stable/sec-filings-search/symbol?symbol=${symbol.toUpperCase()}&from=${fromDate}&to=${toDate}&limit=100&apikey=${apiKey}`;
            const response = await axios.get(url);

            if (!Array.isArray(response.data)) {
                if (response.data?.['Error Message']) {
                    console.error("FMP API error:", response.data['Error Message']);
                }
                return { riskFilings: [], offeringFilings: [] };
            }

            const riskTypes = ['8-K', '10-K', '10-Q'];
            const offeringTypes = ['S-3', '424B5', 'S-1', 'S-3ASR', 'S-1/A'];

            const mapFiling = (f: any): SecFilingMeta => ({
                type: f.formType,
                filing_date: f.filingDate ? f.filingDate.split(' ')[0] : '',
                source_url: f.finalLink || f.link
            });

            const riskFilings = response.data
                .filter((f: any) => riskTypes.includes(f.formType))
                .slice(0, 5)
                .map(mapFiling);

            const offeringFilings = response.data
                .filter((f: any) => offeringTypes.includes(f.formType))
                .slice(0, 5)
                .map(mapFiling);

            return { riskFilings, offeringFilings };
        } catch (e: any) {
            console.error(`SEC Filing fetch error for ${symbol}:`, e.message);
            return { riskFilings: [], offeringFilings: [] };
        }
    }

    /**
     * SEC EDGAR HTML에서 텍스트만 추출.
     * SEC User-Agent 규정 준수.
     */
    static async extractTextFromEdgarUrl(url: string): Promise<string> {
        try {
            const headers = {
                'User-Agent': 'StockRisk App stockrisk@example.com',
                'Accept': 'text/html,application/xhtml+xml'
            };

            const response = await axios.get(url, { headers, timeout: 15000 });
            const $ = cheerio.load(response.data);
            const rawText = $('body').text();
            const cleanText = rawText.replace(/\s+/g, ' ').trim();

            // 문서당 80,000자 제한 (총 토큰 절약)
            return cleanText.substring(0, 80000);
        } catch (e: any) {
            console.error(`SEC EDGAR fetch error from ${url}:`, e.message);
            return "";
        }
    }
}
