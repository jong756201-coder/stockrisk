import { unstable_cache } from 'next/cache';
import { FMPService, FmpGainer } from '@/lib/api/fmp';
import { getCategoryData } from '@/lib/api/category';

// 노이즈 필터: SPAC 유닛, 라이츠, 워런트 제거
export function isNoise(item: FmpGainer): boolean {
    const sym = item.symbol || '';
    if (sym.includes('-')) return true;
    if (sym.length > 5) return true;
    if (/[A-Z]{3,}[UWZR]$/.test(sym) || /WS$|RT$|RI$/.test(sym)) return true;
    return false;
}

export interface GainerWithMeta extends FmpGainer {
    emoji: string;
    sector: string | null;
    industry: string | null;
}

/**
 * 급등주 유니버스를 60초마다 갱신.
 * FMP biggest-gainers + most-actives 합산 후 중복 제거.
 */
export const getTopGainersWithMeta = unstable_cache(
    async (): Promise<GainerWithMeta[]> => {
        const [gainersRaw, activesRaw] = await Promise.all([
            FMPService.getTopGainers(),
            FMPService.getTopActives(),
        ]);

        const seen = new Set<string>();
        const merged: FmpGainer[] = [];

        for (const item of [...gainersRaw, ...activesRaw]) {
            if (!isNoise(item) && !seen.has(item.symbol)) {
                seen.add(item.symbol);
                merged.push(item);
            }
        }

        const universe = merged.slice(0, 35);

        // 카테고리 이모지 병렬 로딩
        const withMeta = await Promise.all(
            universe.map(async (g) => {
                const cat = await getCategoryData(g.symbol);
                return {
                    ...g,
                    emoji: cat.emoji,
                    sector: cat.sector,
                    industry: cat.industry,
                } as GainerWithMeta;
            })
        );

        return withMeta;
    },
    ['top-gainers-with-meta'],
    { revalidate: 60, tags: ['gainers'] }
);
