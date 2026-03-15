import { NextRequest, NextResponse } from 'next/server';
import { FMPService, FmpPressRelease } from '@/lib/api/fmp';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

// FMP 날짜 문자열을 YYYY-MM-DD로 정규화 (시간 포함 형식 대응)
function toDateOnly(dateStr: string): string {
    if (!dateStr) return '1970-01-01';
    return dateStr.split('T')[0].split(' ')[0];
}

// HTML → 순수 텍스트 변환
function htmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

// 보도자료 핵심 부분 추출
// Gemini 2.5 Flash는 1M 토큰 지원 — 넉넉하게 잡아도 됨
// 15,000자 이하면 전체, 초과하면 앞 10,000 + 뒤 4,000 (Upcoming Events 섹션은 문서 끝에 위치)
function extractKeyText(text: string): string {
    if (text.length <= 15000) return text;
    const head = text.slice(0, 10000);
    const tail = text.slice(-4000);
    return `${head}\n\n...(중략)...\n\n${tail}`;
}

// SEC EDGAR / FMP finalLink에서 8-K 전문 텍스트 추출
async function fetchFilingText(url: string): Promise<string> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'StockAnalysis research@stockanalysis.app' },
            cache: 'no-store',
        });
        if (!res.ok) return '';
        const text = htmlToText(await res.text());
        return extractKeyText(text);
    } catch {
        return '';
    }
}

// 회사 IR 페이지에서 이벤트 텍스트 수집
async function fetchIRPageText(symbol: string): Promise<FmpPressRelease[]> {
    const API_KEY = process.env.FMP_API_KEY;
    if (!API_KEY) return [];
    try {
        // 1) FMP 프로필에서 웹사이트 URL 가져오기
        const profileUrl = `${FMP_BASE_URL}/profile?symbol=${symbol}&apikey=${API_KEY}`;
        const profileRes = await fetch(profileUrl, { next: { revalidate: 86400 } });
        if (!profileRes.ok) return [];
        const profileData = await profileRes.json();
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;
        const website: string = profile?.website ?? '';
        if (!website) {
            console.log(`[FutureEvents] no website found for ${symbol}`);
            return [];
        }

        // 2) 공식 웹사이트에서 도메인 추출
        const baseUrl = website.replace(/\/$/, '');
        console.log(`[FutureEvents] ${symbol} website: ${baseUrl}`);

        // 3) IR 페이지 후보 URL 순서대로 시도
        const irPaths = [
            '/investors',
            '/investor-relations',
            '/ir',
            '/investors/events',
            '/investors/presentations',
            '/news',
        ];

        for (const path of irPaths) {
            const irUrl = `${baseUrl}${path}`;
            try {
                const res = await fetch(irUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockAnalysisBot/1.0)' },
                    signal: AbortSignal.timeout(5000), // 5초 타임아웃
                    cache: 'no-store',
                });
                if (!res.ok) continue;
                const html = await res.text();
                const text = html
                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (text.length > 200) {
                    console.log(`[FutureEvents] ${symbol} IR page hit: ${irUrl} (${text.length} chars)`);
                    return [{
                        symbol,
                        date: new Date().toISOString().split('T')[0],
                        title: `IR Page: ${irUrl}`,
                        text: extractKeyText(text),
                    }];
                }
            } catch {
                // 타임아웃 or 접근 불가 → 다음 후보로
                continue;
            }
        }

        console.log(`[FutureEvents] ${symbol} — no accessible IR page found`);
        return [];
    } catch (e) {
        console.error('[FutureEvents] IR page fetch error:', e);
        return [];
    }
}

// 최근 8-K 파일링 텍스트 수집 (최대 3개)
async function fetchRecent8KTexts(symbol: string): Promise<FmpPressRelease[]> {
    const API_KEY = process.env.FMP_API_KEY;
    if (!API_KEY) return [];
    try {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 6개월
        const url = `${FMP_BASE_URL}/sec-filings-search/symbol?symbol=${symbol}&from=${from}&to=${to}&page=0&limit=20&apikey=${API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];

        const filings8k = data
            .filter((f: any) => (f.formType ?? '').toUpperCase() === '8-K')
            .slice(0, 3); // 최근 3개만

        console.log(`[FutureEvents] 8-K filings found: ${filings8k.length}`);

        const results: FmpPressRelease[] = [];
        for (const f of filings8k) {
            const textUrl = f.finalLink ?? f.link;
            if (!textUrl) continue;
            const text = await fetchFilingText(textUrl);
            if (text.length > 100) {
                results.push({
                    symbol,
                    date: f.filingDate ?? f.acceptedDate ?? '',
                    title: `8-K: ${toDateOnly(f.filingDate ?? '')}`,
                    text,
                });
            }
        }
        return results;
    } catch (e) {
        console.error('[FutureEvents] 8-K fetch error:', e);
        return [];
    }
}

// 반환 직전 중복 제거: 같은 날짜+카테고리는 제목이 가장 긴 것 하나만
function dedupEvents(events: any[]): any[] {
    const map = new Map<string, any>();
    for (const ev of events) {
        const key = `${ev.event_date}|${ev.category}`;
        const existing = map.get(key);
        if (!existing || (ev.title?.length ?? 0) > (existing.title?.length ?? 0)) {
            map.set(key, ev);
        }
    }
    return Array.from(map.values()).sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;
    const sym = symbol.toUpperCase();
    const forceRefresh = req.nextUrl.searchParams.get('force') === 'true';
    const todayStr = new Date().toISOString().split('T')[0];

    console.log(`[FutureEvents] ${sym} — force=${forceRefresh}, today=${todayStr}`);

    try {
        const supabase = createAdminClient();

        // 1) 동기화 상태 확인 — 24시간 이내면 캐시 반환 (force=true 시 우회)
        if (!forceRefresh) {
            const { data: syncState, error: syncErr } = await supabase
                .from('events_sync_state')
                .select('*')
                .eq('symbol', sym)
                .single();

            if (syncErr && syncErr.code !== 'PGRST116') {
                // PGRST116 = row not found (정상). 다른 에러면 테이블 없음 가능성
                console.error('[FutureEvents] events_sync_state query error:', syncErr.message);
                // 테이블이 없으면 빈 배열 반환 (마이그레이션 미실행)
                return NextResponse.json({ events: [], error: 'Supabase table missing — run future_events migration' });
            }

            const lastSynced = syncState?.last_synced_at
                ? new Date(syncState.last_synced_at).getTime()
                : 0;
            const isFresh = Date.now() - lastSynced < CACHE_TTL_MS;

            if (isFresh) {
                const { data: events } = await supabase
                    .from('future_events')
                    .select('*')
                    .eq('symbol', sym)
                    .gte('event_date', todayStr)
                    .order('event_date', { ascending: true });

                const deduped = dedupEvents(events ?? []);
                console.log(`[FutureEvents] ${sym} — cache hit, ${events?.length ?? 0} → deduped ${deduped.length} events`);
                return NextResponse.json({ events: deduped, cached: true });
            }
        }

        // 2) 소스 수집: 8-K 전문 + PR + 뉴스 모두 병렬로 가져와서 합산
        // (컨퍼런스 발표는 뉴스에, FDA/임상은 8-K에 있는 경우가 많으므로 OR가 아닌 AND)
        console.log(`[FutureEvents] ${sym} — fetching all sources in parallel`);
        const [filingTexts, prItems, newsItems, irTexts] = await Promise.all([
            fetchRecent8KTexts(sym),
            FMPService.getPressReleases(sym, 20),
            FMPService.getRecentNews(sym, 10),
            fetchIRPageText(sym),
        ]);

        // 뉴스 URL에서 풀텍스트 fetch (BusinessWire/GlobeNewswire 보도자료 원문)
        const newsAsPR: FmpPressRelease[] = await Promise.all(
            newsItems.map(async (n) => {
                const summaryText = n.text ?? '';
                const articleUrl = n.url ?? n.link ?? '';

                // URL이 있으면 항상 원문 fetch 시도 (요약은 미래 이벤트 날짜 정보를 잘라냄)
                if (articleUrl) {
                    try {
                        const res = await fetch(articleUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockAnalysisBot/1.0)' },
                            signal: AbortSignal.timeout(6000),
                            cache: 'no-store',
                        });
                        if (res.ok) {
                            const fullText = htmlToText(await res.text());
                            if (fullText.length > summaryText.length) {
                                const keyText = extractKeyText(fullText);
                                console.log(`[FutureEvents] fetched full article: ${articleUrl.slice(0, 60)} (${fullText.length} chars → ${keyText.length} key chars)`);
                                return {
                                    symbol: sym,
                                    date: n.publishedDate,
                                    title: n.title,
                                    text: keyText,
                                };
                            }
                        }
                    } catch {
                        // 타임아웃 or 차단 → 요약본으로 fallback
                    }
                }

                return {
                    symbol: sym,
                    date: n.publishedDate,
                    title: n.title,
                    text: summaryText,
                };
            })
        );

        // 중복 제거: 같은 날짜+제목은 하나만. 소스 메타데이터도 함께 추적
        type SourceWithMeta = FmpPressRelease & { sourceType: string };
        const filingWithMeta: SourceWithMeta[] = filingTexts.map(s => ({ ...s, sourceType: 'SEC 8-K' }));
        const prWithMeta: SourceWithMeta[] = prItems.map(s => ({ ...s, sourceType: 'PR' }));
        const newsWithMeta: SourceWithMeta[] = newsAsPR.map(s => ({ ...s, sourceType: s.title.startsWith('IR Page:') ? 'IR 페이지' : '뉴스' }));
        const irWithMeta: SourceWithMeta[] = irTexts.map(s => ({ ...s, sourceType: 'IR 페이지' }));

        const allSources = [...filingWithMeta, ...prWithMeta, ...newsWithMeta, ...irWithMeta];
        const seen = new Set<string>();
        const rawSources = allSources.filter(s => {
            const key = `${toDateOnly(s.date)}|${s.title.slice(0, 40)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`[FutureEvents] ${sym} — sources: 8K=${filingTexts.length}, PR=${prItems.length}, news=${newsAsPR.length}, IR=${irTexts.length} → total=${rawSources.length}`);

        // 3-A) 어닝콜 — FMP earnings-calendar에서 직접 (Gemini 불필요, 구조화된 데이터)
        const earningsEvents: Array<{ date: string; type: string; description: string; importance: string; source_label: string }> = [];
        try {
            const API_KEY = process.env.FMP_API_KEY;
            const fromDate = todayStr;
            const toDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const ecUrl = `${FMP_BASE_URL}/earnings-calendar?symbol=${sym}&from=${fromDate}&to=${toDate}&apikey=${API_KEY}`;
            const ecRes = await fetch(ecUrl, { next: { revalidate: 3600 } });
            if (ecRes.ok) {
                const ecData = await ecRes.json();
                if (Array.isArray(ecData)) {
                    console.log(`[FutureEvents] ${sym} — earnings calendar raw count: ${ecData.length}`);
                    for (const ec of ecData) {
                        // FMP earnings-calendar은 서버 필터링이 안 되므로 클라이언트에서 심볼 확인
                        if (ec.symbol && ec.symbol.toUpperCase() !== sym) continue;
                        const ecDate = toDateOnly(ec.date ?? '');
                        if (ecDate >= todayStr) {
                            earningsEvents.push({
                                date: ecDate,
                                type: 'EARNINGS',
                                description: `어닝콜 예정 (EPS 예상: ${ec.epsEstimated != null ? `$${ec.epsEstimated}` : '미정'}, 매출 예상: ${ec.revenueEstimated != null ? `$${(ec.revenueEstimated / 1e6).toFixed(1)}M` : '미정'})`,
                                importance: 'MEDIUM',
                                source_label: 'FMP 어닝캘린더',
                            });
                        }
                    }
                    console.log(`[FutureEvents] ${sym} — earnings calendar: ${earningsEvents.length} events`);
                }
            }
        } catch (e) {
            console.error('[FutureEvents] earnings calendar error:', e);
        }

        if (!rawSources.length && !earningsEvents.length) {
            await supabase
                .from('events_sync_state')
                .upsert({ symbol: sym, last_synced_at: new Date().toISOString() }, { onConflict: 'symbol' });
            return NextResponse.json({ events: [], cached: false, note: 'No sources found' });
        }

        // 3-B) 증분 처리 — 날짜 정규화 후 비교
        const { data: currentSyncState } = await supabase
            .from('events_sync_state')
            .select('last_press_release_date')
            .eq('symbol', sym)
            .single();

        const lastPressDate = toDateOnly(currentSyncState?.last_press_release_date ?? '1970-01-01');
        const newReleases = forceRefresh
            ? rawSources
            : rawSources.filter(pr => toDateOnly(pr.date) >= lastPressDate);

        console.log(`[FutureEvents] ${sym} — lastPressDate=${lastPressDate}, newReleases=${newReleases.length} (force=${forceRefresh})`);

        let extractedEvents: Array<{ date: string; type: string; description: string; importance: string; sourceIndex: number }> = [];

        if (newReleases.length > 0) {
            // 4) Gemini로 미래 이벤트 추출 (소스 인덱스, 중요도 포함)
            const prTexts = newReleases.map((pr, i) => {
                const body = pr.text.trim().length > 30 ? pr.text : '(제목 참고)';
                return `[PR ${i + 1}] [소스: ${pr.sourceType}] 날짜: ${toDateOnly(pr.date)}\n제목: ${pr.title}\n내용: ${body}`;
            }).join('\n\n---\n\n');

            console.log(`[FutureEvents] ${sym} — sending ${newReleases.length} sources to Gemini`);

            try {
                const { object } = await generateObject({
                    model: google('gemini-2.5-flash'),
                    schema: z.object({
                        events: z.array(z.object({
                            date: z.string().describe('YYYY-MM-DD 형식. 반드시 오늘 이후 날짜. 정확한 날짜가 없으면 Q1=03-31, Q2=06-30, Q3=09-30, Q4=12-31, 연도만=해당연도-06-30'),
                            date_label: z.string().optional().describe('세 가지 경우: 1) 날짜 부정확 → "2026년 예정"/"2026 Q4 예정" 등 한국어 라벨, 2) 정확한 마감/기한 날짜(~까지, by date) → 반드시 "까지"만 입력, 3) 정확한 이벤트 날짜 → 빈 문자열'),
                            type: z.enum(['FDA 승인', '임상시험', '규제 승인', '컨퍼런스/프리젠테이션', '제품 출시', '주식·기업', '기타']),
                            description: z.string().describe('한국어로 번역된 이벤트 설명 (1-2문장)'),
                            importance: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('HIGH: FDA 결정/PDUFA/Phase 3 결과, MEDIUM: 학회발표/컨퍼런스/Phase 1-2, LOW: 일반 업데이트'),
                            sourceIndex: z.number().int().describe('이벤트가 추출된 PR 번호 (1부터 시작)'),
                        })),
                    }),
                    system: `당신은 미국 주식 보도자료에서 미래 이벤트를 추출하는 전문가입니다.

분석 대상 종목: ${sym}

오늘 날짜: ${todayStr}

추출 기준:
- 반드시 ${sym} 회사 자체의 이벤트만 추출 (다른 회사 이벤트는 절대 포함 금지)
- 뉴스/보도자료에 타사 이벤트가 언급되더라도 ${sym}과 직접 관련 없으면 제외
- 오늘(${todayStr}) 이후 날짜의 이벤트만 추출
- 중복 통합: 여러 소스에서 동일한 이벤트가 언급되면 반드시 하나로 통합 (가장 상세한 설명 사용)
- 같은 행사(예: 특정 컨퍼런스, 학회)에서 여러 세부 발표가 있어도 행사 자체를 하나의 이벤트로 통합
- 최종 결과에서 같은 날짜+같은 카테고리의 이벤트는 1개를 초과할 수 없음
- 명시적 날짜 없이 "Q2 2026", "Spring 2026" 등만 있는 경우:
  * Q1=3/31, Q2=6/30, Q3=9/30, Q4=12/31로 추정
  * "Spring"=5/15, "Summer"=8/15, "Fall/Autumn"=11/15
  * 연도+월만 있으면 해당 월 15일로 추정
- 날짜 추정이 전혀 불가능하면 제외

카테고리:
- FDA 승인: FDA의 최종 승인 결정 (NDA/BLA 승인, PDUFA 날짜, FDA 승인 완료)
- 임상시험: 임상 시험 자체 (Phase 1/2/3 진행, 결과 발표, IND 신청, 데이터 공개)
- 규제 승인: FDA 외 규제 기관 승인 (EU EMA, 네덜란드, 영국 MHRA 등 해외 규제 승인, 자율주행·소프트웨어 등 비의약품 규제 포함)
- 컨퍼런스/프리젠테이션: 학회 발표, 투자자 컨퍼런스, investor day
- 제품 출시: 신제품/서비스 론칭, 상업화
- 주식·기업: 액면분할, 주식병합, 배당 지급, 자사주 매입, 합병/인수 완료, 주주총회
- 기타: 계약 마감, 분류 불가 이벤트

중요도:
- HIGH: FDA PDUFA 날짜, Phase 3 결과 발표, NDA/BLA 제출 결과
- MEDIUM: Phase 1/2 결과, 학회 구두 발표, 투자자 컨퍼런스
- LOW: 포스터 발표, 일반 업데이트

sourceIndex: 이벤트 정보가 있던 PR 번호 (예: [PR 2]면 2)
description: 한국어로 간결하게`,
                    prompt: `다음 보도자료에서 미래 이벤트를 추출하세요:\n\n${prTexts}`,
                });

                const rawEvents = object.events ?? [];

                // 코드 단 중복 제거: 같은 날짜+카테고리 조합은 설명이 가장 긴 것 하나만 유지
                const eventMap = new Map<string, typeof rawEvents[0]>();
                for (const ev of rawEvents) {
                    const key = `${ev.date}|${ev.type}`;
                    const existing = eventMap.get(key);
                    if (!existing || ev.description.length > existing.description.length) {
                        eventMap.set(key, ev);
                    }
                }
                extractedEvents = Array.from(eventMap.values());

                console.log(`[FutureEvents] ${sym} — Gemini extracted ${rawEvents.length} → deduped ${extractedEvents.length} events:`, JSON.stringify(extractedEvents));
            } catch (e) {
                console.error('[FutureEvents] Gemini error:', e);
            }
        } else {
            console.log(`[FutureEvents] ${sym} — no new sources, skipping Gemini`);
        }

        // 5) force=true면 기존 이벤트 삭제 후 재삽입 (중복 방지)
        if (forceRefresh) {
            await supabase.from('future_events').delete().eq('symbol', sym);
        }

        const categoryMap: Record<string, string> = {
            'FDA 승인': 'FDA',
            '임상시험': 'CLINICAL',
            '규제 승인': 'REGULATORY',
            '컨퍼런스/프리젠테이션': 'CONFERENCE',
            '제품 출시': 'PRODUCT_LAUNCH',
            '주식·기업': 'CORPORATE',
            '기타': 'OTHER',
            'EARNINGS': 'EARNINGS',
        };

        // Gemini 추출 이벤트 저장
        if (extractedEvents.length > 0) {
            const rows = extractedEvents.map(ev => {
                const src = newReleases[ev.sourceIndex - 1];
                return {
                    symbol: sym,
                    event_date: ev.date,
                    date_label: ev.date_label ?? null,
                    category: categoryMap[ev.type] ?? 'OTHER',
                    title: ev.description,
                    importance: ev.importance ?? 'MEDIUM',
                    source_label: src ? `${src.sourceType} · ${toDateOnly(src.date)}` : '',
                    extracted_at: new Date().toISOString(),
                };
            });

            let { error: insertErr } = await supabase.from('future_events').insert(rows);
            if (insertErr) {
                console.error('[FutureEvents] insert error:', insertErr.message);
                // date_label 컬럼이 아직 없는 경우 fallback: 해당 필드 제외 후 재시도
                if (insertErr.message.includes('date_label')) {
                    console.log('[FutureEvents] retrying insert without date_label (column may not exist yet)');
                    const rowsWithoutLabel = rows.map(({ date_label: _dl, ...rest }) => rest);
                    const { error: retryErr } = await supabase.from('future_events').insert(rowsWithoutLabel);
                    if (retryErr) {
                        console.error('[FutureEvents] retry insert error:', retryErr.message);
                    } else {
                        console.log(`[FutureEvents] ${sym} — inserted ${rows.length} events (without date_label)`);
                    }
                }
            } else {
                console.log(`[FutureEvents] ${sym} — inserted ${rows.length} events`);
            }
        }

        // 어닝콜 이벤트 저장 (구조화 데이터, 항상 최신으로 덮어씀)
        if (earningsEvents.length > 0) {
            // 기존 어닝콜 이벤트만 먼저 삭제
            await supabase.from('future_events').delete().eq('symbol', sym).eq('category', 'EARNINGS');
            const earningsRows = earningsEvents.map(ev => ({
                symbol: sym,
                event_date: ev.date,
                category: 'EARNINGS',
                title: ev.description,
                importance: ev.importance,
                source_label: ev.source_label,
                extracted_at: new Date().toISOString(),
            }));
            const { error: eErr } = await supabase.from('future_events').insert(earningsRows);
            if (eErr) console.error('[FutureEvents] earnings insert error:', eErr.message);
        }

        // 6) 동기화 상태 업데이트
        const newestPrDate = toDateOnly(rawSources[0]?.date ?? todayStr);
        const { error: upsertErr } = await supabase
            .from('events_sync_state')
            .upsert({
                symbol: sym,
                last_synced_at: new Date().toISOString(),
                last_press_release_date: newestPrDate,
            }, { onConflict: 'symbol' });

        if (upsertErr) {
            console.error('[FutureEvents] sync_state upsert error:', upsertErr.message);
        }

        // 7) 전체 미래 이벤트 반환
        const { data: allEvents, error: fetchErr } = await supabase
            .from('future_events')
            .select('*')
            .eq('symbol', sym)
            .gte('event_date', todayStr)
            .order('event_date', { ascending: true });

        if (fetchErr) {
            console.error('[FutureEvents] final fetch error:', fetchErr.message);
        }

        return NextResponse.json({ events: dedupEvents(allEvents ?? []), cached: false });

    } catch (e) {
        console.error('[FutureEvents] unhandled error:', e);
        return NextResponse.json({ events: [], error: String(e) }, { status: 500 });
    }
}
