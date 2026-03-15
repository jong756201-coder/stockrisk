import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    // TODO: Verify Stripe webhook signature
    return NextResponse.json({
        success: true,
        message: 'Webhook: stripe placeholder triggered.'
    });
}
