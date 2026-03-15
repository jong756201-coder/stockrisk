import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export async function GET() {
    try {
        const news = await yahooFinance.search('AAPL', { newsCount: 3 }).catch(e => ({ error: e.message }));

        return NextResponse.json({
            news
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
