const yahooFinance = require('yahoo-finance2').default;
async function test() {
  const result = await yahooFinance.quoteSummary('AAPL', { modules: ['balanceSheetHistory'] });
  console.log(JSON.stringify(result.balanceSheetHistory.balanceSheetStatements.map(x => ({ date: x.endDate, shares: x.ordinarySharesNumber })), null, 2));
}
test();
