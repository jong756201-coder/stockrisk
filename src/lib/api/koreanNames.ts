import { createAdminClient } from '@/lib/supabase/admin';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

/**
 * 심볼 목록에 대한 한국어 회사명을 반환.
 * - Supabase 캐시 우선 조회
 * - 캐시 미스된 것만 Gemini Flash로 배치 번역 후 저장
 */
export async function getKoreanNames(
    items: { symbol: string; name: string }[]
): Promise<Record<string, string>> {
    if (!items.length) return {};

    const supabase = createAdminClient();
    const symbols = items.map(i => i.symbol);
    const result: Record<string, string> = {};

    // 1) Supabase에서 캐시된 것 조회
    const { data: cached } = await supabase
        .from('company_korean_names')
        .select('symbol, korean_name')
        .in('symbol', symbols);

    const cachedMap: Record<string, string> = {};
    for (const row of cached ?? []) {
        cachedMap[row.symbol] = row.korean_name;
        result[row.symbol] = row.korean_name;
    }

    // 2) 캐시 미스된 항목만 추출
    const missing = items.filter(i => !cachedMap[i.symbol]);
    if (!missing.length) return result;

    // 3) Gemini Flash로 배치 번역
    try {
        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: z.object({
                translations: z.array(z.object({
                    symbol: z.string(),
                    koreanName: z.string(),
                })),
            }),
            system: `당신은 미국 주식 회사명을 한국어로 번역하는 전문가입니다.
규칙:
- 한국 투자자/증권사에서 실제로 사용하는 명칭으로 번역
- 고유명사(인명, 브랜드)는 한국어 발음으로 표기 (예: Pfizer → 화이자)
- 회사 형태 접미사(Inc., Corp., Ltd. 등)는 생략
- 너무 길면 핵심 단어만 (예: bioAffinity Technologies → 바이오어피니티)
- 이미 잘 알려진 한국어 이름이 있으면 그것 사용 (예: Apple → 애플)
- 모르는 회사면 영어 발음을 한국어로 음차 표기`,
            prompt: `다음 미국 주식 회사들의 한국어 이름을 번역해주세요:\n${missing.map(i => `- ${i.symbol}: ${i.name}`).join('\n')}`,
        });

        // 4) 결과 저장 + result 맵에 추가
        const rows = object.translations
            .filter(t => t.koreanName?.trim())
            .map(t => ({
                symbol: t.symbol.toUpperCase(),
                korean_name: t.koreanName.trim(),
            }));

        if (rows.length) {
            await supabase
                .from('company_korean_names')
                .upsert(rows, { onConflict: 'symbol' });

            for (const row of rows) {
                result[row.symbol] = row.korean_name;
            }
        }
    } catch (e) {
        console.error('[getKoreanNames] Gemini error:', e);
        // 번역 실패 시 영문 이름 그대로 사용 (fallback)
        for (const i of missing) {
            result[i.symbol] = i.name;
        }
    }

    return result;
}
