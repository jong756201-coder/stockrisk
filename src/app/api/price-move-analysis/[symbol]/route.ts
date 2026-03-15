import { NextRequest, NextResponse } from 'next/server';
import { getPriceMoveAnalysis } from '@/lib/api/secAnalysis';

export const dynamic = 'force-dynamic';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    try {
        const analysis = await getPriceMoveAnalysis(upper);
        if (!analysis) {
            return NextResponse.json({ analysis: null }, { status: 200 });
        }
        return NextResponse.json({ analysis }, { status: 200 });
    } catch (e) {
        console.error('[price-move-analysis] error:', e);
        return NextResponse.json({ analysis: null }, { status: 200 });
    }
}
