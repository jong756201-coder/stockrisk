import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FMP_BASE = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY ?? '';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// 캐시 유효 기간: 30일 (과거 이벤트는 불변이지만 새 이벤트가 생길 수 있으니 주기적 갱신)
const CACHE_TTL_DAYS = 30;

async function getCachedEvents(symbol: string): Promise<SpikeEvent[] | null> {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/price_history_events?symbol=eq.${symbol}&select=events_json,cached_at&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.[0]) return null;

    const cachedAt = new Date(rows[0].cached_at);
    const ageMs = Date.now() - cachedAt.getTime();
    if (ageMs > CACHE_TTL_DAYS * 86400 * 1000) return null; // 만료

    return rows[0].events_json as SpikeEvent[];
  } catch {
    return null;
  }
}

async function setCachedEvents(symbol: string, events: SpikeEvent[]): Promise<void> {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(
      `${SB_URL}/rest/v1/price_history_events`,
      {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates', // upsert
        },
        body: JSON.stringify({ symbol, events_json: events, cached_at: new Date().toISOString() }),
      },
    );
  } catch {
    // 저장 실패해도 무시 — 다음 요청에서 재시도됨
  }
}

interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
}

export interface SpikeEvent {
  date: string;          // 폭등/폭락 날짜
  changePercent: number; // 그 날의 변동률
  close: number;         // 종가
  volume: number;
  type: 'spike' | 'crash';
  // 30일 후 주가 변동
  afterDays: {
    t1?: number;   // T+1일 변동률
    t7?: number;   // T+7일 변동률
    t30?: number;  // T+30일 변동률
  };
  // 그 시점의 뉴스
  news: Array<{
    title: string;
    publishedDate: string;
    url?: string;
    site?: string;
  }>;
  // 그 시점의 SEC 공시
  filings: Array<{
    formType: string;
    filingDate: string;
    link: string;
    summary?: string | null;
  }>;
}

// ─── 전체 일봉 데이터 가져오기 ───────────────────────────────
async function fetchFullHistory(symbol: string): Promise<DailyBar[]> {
  const url = `${FMP_BASE}/historical-price-eod/full?symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // FMP: 최근 → 과거 순. 역순 정렬해서 과거 → 최근 순으로
  return data.map((d: Record<string, unknown>) => {
    const open = Number(d.open) || 0;
    const close = Number(d.close) || 0;
    // FMP의 changePercent = 전일 종가 대비 변동률 (close-to-close)
    // 이 값을 사용해야 갭업/갭다운 포함한 실제 일간 변동을 정확히 감지 가능
    const pct = d.changePercent !== undefined && d.changePercent !== null
      ? Number(d.changePercent)
      : (open > 0 ? ((close - open) / open) * 100 : 0);
    return {
      date: String(d.date),
      open,
      high: Number(d.high) || 0,
      low: Number(d.low) || 0,
      close,
      volume: Number(d.volume) || 0,
      changePercent: pct,
    };
  }).reverse(); // 과거 → 최근
}

// ─── 폭등/폭락 이벤트 찾기 ──────────────────────────────────
function findExtremeEvents(bars: DailyBar[]): SpikeEvent[] {
  const events: SpikeEvent[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const isSpike = bar.changePercent >= 100;
    const isCrash = bar.changePercent <= -50;

    if (!isSpike && !isCrash) continue;

    // T+1, T+7, T+30 변동률 계산 (해당 날의 종가 대비)
    const baseClose = bar.close;
    const afterDays: SpikeEvent['afterDays'] = {};

    if (i + 1 < bars.length) {
      afterDays.t1 = ((bars[i + 1].close - baseClose) / baseClose) * 100;
    }
    if (i + 5 < bars.length) {
      // 거래일 기준 ~7일 → 약 5 거래일
      afterDays.t7 = ((bars[i + 5].close - baseClose) / baseClose) * 100;
    }
    if (i + 22 < bars.length) {
      // 거래일 기준 ~30일 → 약 22 거래일
      afterDays.t30 = ((bars[i + 22].close - baseClose) / baseClose) * 100;
    }

    events.push({
      date: bar.date,
      changePercent: bar.changePercent,
      close: bar.close,
      volume: bar.volume,
      type: isSpike ? 'spike' : 'crash',
      afterDays,
      news: [],
      filings: [],
    });
  }

  // 최근 순으로 정렬, 최대 10개
  return events.reverse().slice(0, 10);
}

// ─── 해당 날짜 전후 뉴스 가져오기 ────────────────────────────
async function fetchNewsAroundDate(
  symbol: string,
  date: string,
): Promise<SpikeEvent['news']> {
  try {
    // 해당 날짜 기준 ±3일 뉴스 검색
    const d = new Date(date);
    const from = new Date(d.getTime() - 3 * 86400000).toISOString().split('T')[0];
    const to = new Date(d.getTime() + 1 * 86400000).toISOString().split('T')[0];

    const url = `${FMP_BASE}/news/stock?symbols=${symbol}&from=${from}&to=${to}&limit=3&apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 3).map((n: Record<string, unknown>) => ({
      title: String(n.title ?? ''),
      publishedDate: String(n.publishedDate ?? n.date ?? ''),
      url: n.url ? String(n.url) : undefined,
      site: n.site ? String(n.site) : undefined,
    }));
  } catch {
    return [];
  }
}

// ─── 해당 날짜 전후 SEC 공시 가져오기 ─────────────────────────
async function fetchFilingsAroundDate(
  symbol: string,
  date: string,
): Promise<SpikeEvent['filings']> {
  try {
    // 이벤트 날짜 기준 ±5일 범위로 SEC 공시 검색
    const eventDate = new Date(date);
    const from = new Date(eventDate.getTime() - 5 * 86400000).toISOString().split('T')[0];
    const to = new Date(eventDate.getTime() + 2 * 86400000).toISOString().split('T')[0];

    // FMP stable API: sec-filings-search/symbol (날짜 범위 지정 가능)
    const url = `${FMP_BASE}/sec-filings-search/symbol?symbol=${symbol}&from=${from}&to=${to}&page=0&limit=10&apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .slice(0, 3)
      .map((f: Record<string, unknown>) => ({
        formType: String(f.type ?? f.formType ?? '8-K'),
        filingDate: String(f.fillingDate ?? f.filingDate ?? f.date ?? ''),
        link: String(f.finalLink ?? f.link ?? ''),
      }));
  } catch {
    return [];
  }
}

// ─── 공시 한줄 요약 (Supabase 캐시에서만 조회 — 토큰 0) ──────
async function fetchFilingSummary(
  filingUrl: string,
): Promise<string | null> {
  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) return null;

    const res = await fetch(
      `${sbUrl}/rest/v1/sec_filing_summaries?url=eq.${encodeURIComponent(filingUrl)}&select=summary&limit=1`,
      {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.summary ?? null;
  } catch {
    return null;
  }
}

// ─── 메인 핸들러 ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  if (!API_KEY) {
    return NextResponse.json({ events: [], error: 'API key missing' });
  }

  // 1) Supabase 캐시 확인 — 히트 시 즉시 반환 (FMP 호출 없음)
  const cached = await getCachedEvents(upper);
  if (cached) {
    return NextResponse.json({ events: cached, source: 'cache' });
  }

  // 2) 캐시 미스 → FMP에서 전체 일봉 받아 폭등/폭락 이벤트 필터링
  const bars = await fetchFullHistory(upper);
  const events = findExtremeEvents(bars);

  if (events.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // 3) 각 이벤트에 대해 뉴스 + 공시 병렬 fetch (최대 8개)
  const topEvents = events.slice(0, 8);

  await Promise.all(
    topEvents.map(async (ev) => {
      const [news, filings] = await Promise.all([
        fetchNewsAroundDate(upper, ev.date),
        fetchFilingsAroundDate(upper, ev.date),
      ]);
      ev.news = news;

      // 공시 한줄 요약 (캐시에서만 — 과거 데이터이므로 Gemini 호출 불필요)
      const filingsWithSummary = await Promise.all(
        filings.map(async (f) => {
          if (!f.link) return f;
          const summary = await fetchFilingSummary(f.link);
          return { ...f, summary };
        }),
      );
      ev.filings = filingsWithSummary;
    }),
  );

  // 4) 결과를 Supabase에 저장 (비동기 — 응답 지연 없음)
  setCachedEvents(upper, topEvents).catch(() => {});

  return NextResponse.json({ events: topEvents, source: 'fresh' });
}
