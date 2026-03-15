/**
 * 서버 사이드 가격 캐시 — 5분 전 가격과 비교해 단기 급등/급락 감지
 * Next.js는 재시작 시 초기화되지만, 1분 자동 새로고침 사이클 동안은 유지됨
 */

interface PriceSnapshot {
    price: number;
    ts: number; // epoch ms
}

// 모듈 레벨 Map → 서버 프로세스 수명 동안 유지
const cache = new Map<string, PriceSnapshot[]>();

const WINDOW_MS = 5 * 60 * 1000; // 5분
const MAX_SNAPSHOTS = 10; // 심볼당 최대 스냅샷 수

/**
 * 현재 가격을 기록하고, 5분 전 스냅샷과의 변화율(%)을 반환.
 * 5분 전 데이터가 없으면 null 반환 (아직 충분히 쌓이지 않음).
 */
export function recordAndGetDelta(symbol: string, currentPrice: number): number | null {
    const now = Date.now();
    const snapshots = cache.get(symbol) || [];

    // 현재 스냅샷 추가
    snapshots.push({ price: currentPrice, ts: now });

    // 오래된 스냅샷 정리 (10분 이상)
    const filtered = snapshots.filter(s => now - s.ts <= WINDOW_MS * 2);

    // 최대 개수 유지
    while (filtered.length > MAX_SNAPSHOTS) filtered.shift();

    cache.set(symbol, filtered);

    // 5분 전에 가장 가까운 스냅샷 찾기
    const targetTs = now - WINDOW_MS;
    const oldSnapshot = filtered.find(s => s.ts <= targetTs);

    if (!oldSnapshot || oldSnapshot.price <= 0) return null;

    return ((currentPrice - oldSnapshot.price) / oldSnapshot.price) * 100;
}
