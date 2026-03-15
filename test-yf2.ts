import yahooFinance from 'yahoo-finance2';

async function test() {
    try {
        const quote = await yahooFinance.quote('AAPL');
        console.log(`AAPL: $${quote.regularMarketPrice} (pre: $${quote.preMarketPrice})`);
    } catch (e) {
        console.error(e);
    }
}

test();
