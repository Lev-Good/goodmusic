const http = require('http');
const https = require('https');

const stations = [
  { name: 'גאולה FM (HTTPS)', url: 'https://broadcast.adpronet.com/radio/8010/radio.mp3' },
  { name: 'גאולה FM (HTTP)', url: 'http://broadcast.adpronet.com/radio/8010/radio.mp3' }
];

function checkUrl(name, urlString) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(urlString);
      const lib = urlString.startsWith('https') ? https : http;
      
      const options = {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-100',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 4000
      };
      
      const req = lib.request(urlString, options, (res) => {
        resolve({
          name,
          url: urlString,
          statusCode: res.statusCode,
          location: res.headers.location,
          contentType: res.headers['content-type']
        });
        res.resume();
      });
      
      req.on('error', (e) => {
        resolve({
          name,
          url: urlString,
          error: e.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          name,
          url: urlString,
          error: 'Timeout'
        });
      });
      
      req.end();
    } catch (err) {
      resolve({
        name,
        url: urlString,
        error: err.message
      });
    }
  });
}

async function main() {
  for (const s of stations) {
    const result = await checkUrl(s.name, s.url);
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
