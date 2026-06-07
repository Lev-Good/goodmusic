const https = require('https');

const urls = [
  'https://stream.jewishmusicstream.com:8000/stream',
  'https://stream.jewishmusicstream.com/stream'
];

function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, {
        method: 'GET',
        headers: { 'Range': 'bytes=0-100' },
        rejectUnauthorized: false, // Bypass node validation
        timeout: 4000
      }, (res) => {
        resolve({
          url,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          location: res.headers.location
        });
        res.resume();
      });
      
      req.on('error', (e) => {
        resolve({ url, error: e.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, error: 'Timeout' });
      });
      
      req.end();
    } catch (err) {
      resolve({ url, error: err.message });
    }
  });
}

async function main() {
  for (const url of urls) {
    const result = await checkUrl(url);
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
