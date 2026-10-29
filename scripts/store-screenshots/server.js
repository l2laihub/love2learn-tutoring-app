const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..', 'dist');
http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let f = path.join(root, u);
  const hm = u.match(/\.([0-9a-f]{32})(@\dx)?\.\w+$/);
  if (!fs.existsSync(f) && hm && fs.existsSync(path.join(root, 'assets', hm[1]))) f = path.join(root, 'assets', hm[1]);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (path.extname(u) && !u.endsWith('.html')) { console.log('404', q.url.slice(0, 200)); s.writeHead(404); return s.end(); }
    f = path.join(root, 'index.html');
  }
  const t = { '.js': 'application/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream';
  s.writeHead(200, { 'content-type': t });
  fs.createReadStream(f).pipe(s);
}).listen(8090);
