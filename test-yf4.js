const YahooFinance = require('yahoo-finance2').default;

async function test() {
    try {
        const yf = new YahooFinance();
        const quote = await yf.quote('AAPL');
        const tlys = await yf.quote('TLYS');
        console.log(`AAPL: $${quote.regularMarketPrice} (pre: $${quote.preMarketPrice}, pct: ${quote.preMarketChangePercent})`);
        console.log(`TLYS: $${tlys.regularMarketPrice} (pre: $${tlys.preMarketPrice}, pct: ${tlys.preMarketChangePercent})`);
    } catch (e) {
        console.error(e);
    }
}
test();
