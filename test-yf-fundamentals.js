const YahooFinance = require('yahoo-finance2').default;
async function test() {
    try {
        const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
        const summary = await yf.quoteSummary('AAPL', { modules: ['assetProfile', 'defaultKeyStatistics', 'financialData', 'balanceSheetHistoryQuarterly', 'incomeStatementHistoryQuarterly'] });
        
        console.log("Country:", summary.assetProfile?.country);
        console.log("Employees:", summary.assetProfile?.fullTimeEmployees);
        console.log("Float Shares:", summary.defaultKeyStatistics?.floatShares);
        console.log("Outstanding Shares:", summary.defaultKeyStatistics?.sharesOutstanding);
        
        const latestBS = summary.balanceSheetHistoryQuarterly?.balanceSheetStatements[0];
        console.log("Cash (BS):", latestBS?.cash || "Missing");
        console.log("Cash (FinData):", summary.financialData?.totalCash);
        
        const latestIS = summary.incomeStatementHistoryQuarterly?.incomeStatementHistory[0];
        console.log("Net Income:", latestIS?.netIncome);

    } catch (e) {
        console.error(e);
    }
}
test();
