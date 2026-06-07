const http = require('http');
const https = require('https');

const stations = [
  { name: 'קול חי מיוזיק', url: 'http://media2.93fm.co.il/livemusic' },
  { name: 'רדיו קול חי', url: 'http://media2.93fm.co.il/live-new' },
  { name: 'גאולה FM', url: 'http://broadcast.adpronet.com/radio/8010/radio.mp3' },
  { name: 'קול פליי', url: 'http://cdn.cybercdn.live/Kol_Barama/Music/icecast.audio' },
  { name: 'קול ברמה', url: 'http://cdn.cybercdn.live/Kol_Barama/Live_Audio/icecast.audio' },
  { name: 'JewishMusic', url: 'http://stream.jewishmusicstream.com:8000/stream' }
];

function checkUrl(name, urlString) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(urlString);
      const lib = urlString.startsWith('https') ? https : http;
      
      const options = {
        method: 'GET', // Use GET instead of HEAD because some servers reject HEAD
        headers: {
          'Range': 'bytes=0-100', // only request first 100 bytes to avoid downloading forever
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
        res.resume(); // consume response
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
  console.log('Testing radio station URLs with GET Range request...');
  for (const s of stations) {
    const result = await checkUrl(s.name, s.url);
    console.log(JSON.stringify(result, null, 2));
    
    if (result.location) {
      console.log(`Checking redirect for ${s.name}: ${result.location}`);
      const redirectResult = await checkUrl(s.name + ' (Redirect)', result.location);
      console.log(JSON.stringify(redirectResult, null, 2));
    }
    console.log('-----------------------------------');
  }
}

main();
