import { NextResponse } from 'next/server';
import { FMPService } from '@/lib/api/fmp';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    try {
        const [trades, stats, krwRate] = await Promise.all([
            FMPService.getInsiderTrades(upper, 100),
            FMPService.getInsiderStats(upper),
            FMPService.getForexRate('USDKRW').then(r => r ?? 1380),
        ]);

        return NextResponse.json({ trades, stats, krwRate });
    } catch (e) {
        console.error('[/api/insider-trading]', e);
        return NextResponse.json({ trades: [], stats: null, krwRate: 1380 }, { status: 500 });
    }
}
