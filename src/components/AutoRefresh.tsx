'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AutoRefresh({ intervalMs = 60000 }: { intervalMs?: number }) {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            // Next.js router.refresh()로 서버 컴포넌트 재실행 → FMP API 직접 호출로 신선한 데이터
            router.refresh();
        }, intervalMs);

        return () => clearInterval(interval);
    }, [router, intervalMs]);

    return null;
}

