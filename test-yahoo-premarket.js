const https = require('https');

const postData = JSON.stringify({
  offset: 0,
  size: 20,
  sortField: 'preMarketChangePercent',
  sortType: 'DESC',
  quoteType: 'EQUITY',
  query: {
    operator: 'AND',
    operands: [
      { operator: 'eq', operands: ['region', 'us'] },
      { operator: 'gt', operands: ['preMarketPrice', 1.0] }
    ]
  }
});

const options = {
  hostname: 'query2.finance.yahoo.com',
  port: 443,
  path: '/v1/finance/screener',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
        const parsed = JSON.parse(data);
        const quotes = parsed.finance?.result?.[0]?.quotes || [];
        console.log("Found:", quotes.length);
        quotes.slice(0, 5).forEach(q => console.log(`${q.symbol}: ${q.preMarketChangePercent}% ($${q.preMarketPrice})`));
    } else {
        console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(postData);
req.end();
