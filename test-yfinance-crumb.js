const https = require('https');

async function getCrumbAndCookie() {
    return new Promise((resolve, reject) => {
        const req = https.get('https://finance.yahoo.com', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            const setCookie = res.headers['set-cookie'];
            let cookie = '';
            if (setCookie) {
                cookie = setCookie.map(c => c.split(';')[0]).join('; ');
            }
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/"crumb":"([^"]+)"/);
                const crumb = match ? match[1].replace(/\\u002F/g, '/') : null;
                resolve({ crumb, cookie });
            });
        });
        req.on('error', reject);
    });
}

async function fetchScreener(crumb, cookie) {
    const postData = JSON.stringify({
        offset: 0,
        size: 15,
        sortField: 'preMarketChangePercent',
        sortType: 'DESC',
        quoteType: 'EQUITY',
        query: {
            operator: 'AND',
            operands: [
                { operator: 'eq', operands: ['region', 'us'] }
            ]
        }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'query2.finance.yahoo.com',
            port: 443,
            path: `/v1/finance/screener?crumb=${crumb}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0',
                'Cookie': cookie
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data });
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function test() {
    try {
        const { crumb, cookie } = await getCrumbAndCookie();
        console.log("Crumb:", crumb);
        console.log("Cookie:", cookie);
        if (crumb) {
            const result = await fetchScreener(crumb, cookie);
            console.log("Status:", result.status);
            const parsed = JSON.parse(result.data);
            const quotes = parsed.finance?.result?.[0]?.quotes || [];
            console.log("Found:", quotes.length);
            quotes.slice(0, 5).forEach(q => console.log(`${q.symbol}: ${q.preMarketChangePercent}% ($${q.preMarketPrice})`));
        } else {
            console.log("Failed to extract crumb.");
        }
    } catch (e) {
        console.error(e);
    }
}

test();
