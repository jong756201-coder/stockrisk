import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export async function GET() {
    try {
        const news = await yahooFinance.search('AAPL', { newsCount: 3 }).catch((e: Error) => ({ error: e.message }));

        return NextResponse.json({
            news
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        return NextResponse.json({ error: message });
    }
}
