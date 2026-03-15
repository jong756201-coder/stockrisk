const { YahooFinance } = require('yahoo-finance2');

async function test() {
    try {
        const yahooFinance = new YahooFinance();
        const quote = await yahooFinance.quote('AAPL');
        const tlys = await yahooFinance.quote('TLYS');
        console.log(`AAPL: $${quote.regularMarketPrice} (pre: $${quote.preMarketPrice}, pct: ${quote.preMarketChangePercent})`);
        console.log(`TLYS: $${tlys.regularMarketPrice} (pre: $tlys.preMarketPrice}, pct: ${tlys.preMarketChangePercent})`);
    } catch (e) {
        console.error(e);
    }
}
test();
