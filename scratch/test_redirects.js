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
    const lib = urlString.startsWith('https') ? https : http;
    const req = lib.request(urlString, { method: 'HEAD', timeout: 3000 }, (res) => {
      resolve({
        name,
        url: urlString,
        statusCode: res.statusCode,
        location: res.headers.location,
        contentType: res.headers['content-type']
      });
    });
    
    req.on('error', (e) => {
      resolve({
        name,
        url: urlString,
        error: e.message
      });
    });
    
    req.end();
  });
}

async function main() {
  console.log('Testing radio station URLs...');
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
