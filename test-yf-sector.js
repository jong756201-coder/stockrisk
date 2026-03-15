const YahooFinance = require('yahoo-finance2').default;
async function test() {
    try {
        const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
        const summary = await yf.quoteSummary('AAPL', { modules: ['assetProfile'] });
        console.log("Sector:", summary.assetProfile?.sector);
        console.log("Industry:", summary.assetProfile?.industry);
    } catch (e) {
        console.error(e);
    }
}
test();
