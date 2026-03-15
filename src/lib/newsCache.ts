import { unstable_cache } from 'next/cache';
import { FMPService, FmpNews } from '@/lib/api/fmp';
import { isNoise } from '@/lib/gainersCache';

export interface NewsItem extends FmpNews {
    symbol: string;
    symbolSource: string; // 어디서 온 종목인지 ('gainer' | 'active')
}

function isNoiseSymbol(sym: string): boolean {
    return isNoise({ symbol: sym, name: '', price: 1, change: 0, changesPercentage: 0 });
}

/**
 * 급등주+거래량 상위 심볼 풀에서 뉴스를 최대 limit개 가져옴.
 * 15분 캐싱 → API 호출 최소화.
 */
export const getNewsForActiveSymbols = unstable_cache(
    async (limit = 60): Promise<NewsItem[]> => {
        // 1. 급등주 + 거래량 상위 동시 조회
        const [gainersRaw, activesRaw] = await Promise.all([
            FMPService.getTopGainers(),
            FMPService.getTopActives(),
        ]);

        const gainersSymbols = gainersRaw
            .filter(g => !isNoiseSymbol(g.symbol))
            .slice(0, 20)
            .map(g => g.symbol);

        const activesSymbols = activesRaw
            .filter(a => !isNoiseSymbol(a.symbol))
            .slice(0, 20)
            .map(a => a.symbol);

        // 중복 제거
        const allSymbols = Array.from(new Set([...gainersSymbols, ...activesSymbols]));

        // 2. 심볼별 뉴스 병렬 조회 (심볼당 3건)
        const newsResults = await Promise.all(
            allSymbols.map(async (sym) => {
                try {
                    const items = await FMPService.getRecentNews(sym, 3);
                    const source = gainersSymbols.includes(sym) ? 'gainer' : 'active';
                    return items.map(n => ({ ...n, symbol: sym, symbolSource: source }));
                } catch {
                    return [];
                }
            })
        );

        // 3. 평탄화 + URL 기준 중복 제거 + 날짜 내림차순
        const seen = new Set<string>();
        const allNews: NewsItem[] = newsResults
            .flat()
            .filter(n => {
                const key = n.url || n.link || `${n.symbol}-${n.title}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => {
                const ta = new Date(a.publishedDate).getTime();
                const tb = new Date(b.publishedDate).getTime();
                return tb - ta;
            });

        return allNews.slice(0, limit);
    },
    ['news-active-symbols'],
    { revalidate: 900, tags: ['news'] } // 15분 캐싱
);
