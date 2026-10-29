// Capture real DaLesson UI (web build + mocked backend) and compose App Store screenshots.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENS = [
  { id: '01-dashboard', route: '/', title: 'Your tutoring business<br>at a glance', sub: "Today's lessons, students and stats in one place" },
  { id: '02-calendar', route: '/calendar', title: 'Schedule lessons<br>in seconds', sub: 'Recurring lessons, color coded by subject' },
  { id: '03-students', route: '/students', title: 'Every student,<br>organized', sub: 'Subjects, grades, rates and parent contacts' },
  { id: '04-payments', route: '/payments', title: 'Know who has paid,<br>and who has not', sub: 'Monthly invoices and prepaid packages' },
  { id: '05-messages', route: '/messages', title: 'Keep parents<br>in the loop', sub: 'Message families without sharing your number' },
  { id: '06-parent', route: '/', parent: true, title: 'A portal for<br>every family', sub: 'Parents see schedules, payments and assignments' },
];

const DEVICES = {
  iphone: { W: 1320, H: 2868, vw: 440, vh: 956, sb: 54, inner: 960, top: 640, radius: 120, bezel: 26, title: 112, subSize: 46, statusFont: 17 },
  ipad: { W: 2064, H: 2752, vw: 1032, vh: 1376, sb: 32, inner: 1600, top: 600, radius: 64, bezel: 30, title: 128, subSize: 52, statusFont: 14 },
};

async function capture(browser, dev, s, file) {
  const { install } = (delete require.cache[require.resolve('./mock')], process.env.PARENT = s.parent ? '1' : '0', require('./mock'));
  const scale = dev.inner / dev.vw;
  const ctx = await browser.newContext({ viewport: { width: dev.vw, height: dev.vh - dev.sb }, deviceScaleFactor: scale, timezoneId: 'America/Los_Angeles', locale: 'en-US' });
  await ctx.clock.install({ time: new Date('2026-10-29T23:40:00Z') });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(s.id, 'pageerror', e.message.slice(0, 120)));
  await install(p);
  await p.goto('http://localhost:8090' + s.route, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(5000);
  await p.screenshot({ path: file });
  const top = await p.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, 2);
    let e = el; while (e) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') return c; e = e.parentElement; } return 'rgb(255,255,255)';
  });
  await ctx.close();
  return top;
}

function statusBar(color, dev) {
  const k = dev.inner / dev.vw;
  const light = /255, 107, 107|61, 156, 168|27, 58, 75/.test(color) || color.includes('255, 107');
  const fg = light ? '#fff' : '#1B3A4B';
  return `<div class="sb" style="background:${color};color:${fg}">
    <span>9:41</span>
    <span class="r"><svg width="${dev.statusFont * 1.1 * k}" height="${dev.statusFont * 0.72 * k}" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="${fg}"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="${fg}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${fg}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${fg}"/></svg>
    <svg width="${dev.statusFont * 1.65 * k}" height="${dev.statusFont * 0.72 * k}" viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="${fg}" opacity=".5"/><rect x="2.5" y="2.5" width="16" height="7" rx="1.5" fill="${fg}"/><rect x="24" y="4" width="2" height="4" rx="1" fill="${fg}" opacity=".5"/></svg></span></div>`;
}

function html(dev, s, img, color) {
  const scale = dev.inner / dev.vw;
  const sbH = dev.sb * scale;
  return `<!doctype html><html><head><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${dev.W}px;height:${dev.H}px;overflow:hidden;font-family:'Inter Display','Inter',sans-serif;
    background:linear-gradient(165deg,#FF6B6B 0%,#FF8A7A 38%,#FFE3DE 100%);position:relative}
  .blob{position:absolute;border-radius:50%;opacity:.18;background:#fff}
  h1{position:absolute;top:${dev.top * 0.2}px;width:100%;text-align:center;color:#fff;font-size:${dev.title}px;line-height:1.08;font-weight:800;letter-spacing:-2px}
  p{position:absolute;top:${dev.top * 0.2 + dev.title * 2.35}px;width:100%;text-align:center;color:#fff;opacity:.93;font-size:${dev.subSize}px;font-weight:500}
  .frame{position:absolute;left:${(dev.W - dev.inner) / 2 - dev.bezel}px;top:${dev.top}px;padding:${dev.bezel}px;background:#1B3A4B;border-radius:${dev.radius + dev.bezel}px;
    box-shadow:0 40px 120px rgba(27,58,75,.35)}
  .screen{width:${dev.inner}px;border-radius:${dev.radius}px;overflow:hidden;background:#fff}
  .sb{height:${sbH}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${sbH * 0.75}px;padding-top:${sbH * 0.12}px;font-weight:600;font-size:${dev.statusFont * scale}px;font-family:Inter,sans-serif}
  .sb .r{display:flex;gap:${8 * scale}px;align-items:center}
  .shot{display:block;width:${dev.inner}px}
  </style></head><body>
  <div class="blob" style="width:${dev.W * 0.7}px;height:${dev.W * 0.7}px;right:-${dev.W * 0.25}px;top:-${dev.W * 0.3}px"></div>
  <div class="blob" style="width:${dev.W * 0.5}px;height:${dev.W * 0.5}px;left:-${dev.W * 0.2}px;top:${dev.H * 0.45}px;opacity:.12"></div>
  <h1>${s.title}</h1><p>${s.sub}</p>
  <div class="frame"><div class="screen">${statusBar(color, dev)}<img class="shot" src="file://${img}"></div></div>
  </body></html>`;
}

(async () => {
  const which = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const [name, dev] of Object.entries(DEVICES)) {
    if (which.length && !which.includes(name)) continue;
    const out = path.join(__dirname, 'out', name); fs.mkdirSync(out + '/raw', { recursive: true });
    for (const s of SCREENS) {
      const raw = `${out}/raw/${s.id}.png`;
      const color = await capture(browser, dev, s, raw);
      const page = await browser.newPage({ viewport: { width: dev.W, height: dev.H }, deviceScaleFactor: 1 });
      const f = `${out}/${s.id}.html`; fs.writeFileSync(f, html(dev, s, raw, color));
      await page.goto('file://' + f); await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${name}-${s.id}.png`, clip: { x: 0, y: 0, width: dev.W, height: dev.H } });
      await page.close(); console.log('done', name, s.id, color);
    }
  }
  await browser.close();
})();
