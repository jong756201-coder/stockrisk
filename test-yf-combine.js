const { YahooFinance } = require('yahoo-finance2');
async function test() {
    try {
        const yf = new YahooFinance();
        const quotes = await yf.quoteCombine(['AAPL', 'TLYS']);
        console.log("Quotes length:", quotes.length);
        console.log(quotes[1].symbol, quotes[1].preMarketPrice);
    } catch (e) {
        console.error(e);
    }
}
test();
