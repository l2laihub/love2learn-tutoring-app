// App Store creative assets for DaLesson: product page header (21:9),
// search results (3:2) and universal (16:9). Uses real app captures.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'out/iphone/raw');
const OUT = path.join(__dirname, 'out/creative');
fs.mkdirSync(OUT, { recursive: true });

const mark = (size, tile = '#FFFFFF', note = '#FF6B6B') => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="${tile}"/>
<circle cx="45" cy="61" r="16" fill="${note}"/><rect x="59" y="21" width="8" height="44" rx="4" fill="${note}"/></svg>`;

// Phone: raw capture is 960 wide for a 440pt screen; status bar is 54pt.
function phone(file, w, { rotate = 0, x = 0, y = 0, z = 1, shadow = 1 } = {}) {
  const k = w / 440;
  const bezel = Math.round(12 * k);
  const sb = 54 * k;
  return `<div class="phone" style="width:${w + bezel * 2}px;padding:${bezel}px;border-radius:${62 * k}px;
    transform:translate(${x}px,${y}px) rotate(${rotate}deg);z-index:${z};
    box-shadow:0 ${40 * k * shadow}px ${110 * k * shadow}px rgba(27,58,75,${0.38 * shadow})">
    <div class="screen" style="border-radius:${50 * k}px">
      <div class="sb" style="height:${sb}px;font-size:${17 * k}px;padding:${sb * 0.12}px ${sb * 0.75}px 0">
        <span>9:41</span><span style="display:flex;gap:${7 * k}px;align-items:center">
        <svg width="${19 * k}" height="${12 * k}" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg>
        <svg width="${27 * k}" height="${12 * k}" viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="#fff" opacity=".6"/><rect x="2.5" y="2.5" width="16" height="7" rx="1.5" fill="#fff"/><rect x="24" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".6"/></svg></span>
      </div>
      <img src="file://${RAW}/${file}" style="display:block;width:${w}px">
    </div></div>`;
}

const base = (W, H, body) => `<!doctype html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;font-family:'Inter Display','Inter',sans-serif;
  background:radial-gradient(120% 140% at 15% 10%,#FF8A7A 0%,#FF6B6B 45%,#F25A5A 100%)}
.blob{position:absolute;border-radius:50%;background:#fff}
.phone{position:absolute;background:#1B3A4B}
.screen{overflow:hidden;background:#fff}
.sb{background:#FF6B6B;color:#fff;display:flex;justify-content:space-between;align-items:center;font-family:Inter,sans-serif;font-weight:600}
.brand{display:flex;align-items:center;color:#fff;font-weight:800;letter-spacing:-1px}
h1{color:#fff;font-weight:800;letter-spacing:-0.025em;line-height:1.02}
p{color:#fff;opacity:.92;font-weight:500}
</style></head><body>${body}</body></html>`;

// Phones are positioned relative to a centre anchor via a wrapper.
const group = (cx, cy, items) => `<div style="position:absolute;left:${cx}px;top:${cy}px">${items}</div>`;

const designs = {
  // 21:9 product page header — brand forward, focal content centred.
  'header-3840x1646': {
    W: 3840, H: 1646,
    html: (W, H) => base(W, H, `
      <div class="blob" style="width:1500px;height:1500px;left:-500px;top:-800px;opacity:.10"></div>
      <div class="blob" style="width:1200px;height:1200px;right:-300px;bottom:-700px;opacity:.10"></div>
      <div style="position:absolute;left:560px;top:0;height:${H}px;display:flex;flex-direction:column;justify-content:center;width:1700px">
        <div class="brand" style="font-size:96px;gap:36px;margin-bottom:64px">${mark(150)}DaLesson</div>
        <h1 style="font-size:150px">Your tutoring studio,<br>in one app</h1>
        <p style="font-size:64px;margin-top:48px">Lessons, students, payments and parents</p>
      </div>
      ${group(2700, 150, [
        phone('02-calendar.png', 560, { x: -520, y: 170, rotate: -6, z: 1 }),
        phone('04-payments.png', 560, { x: 340, y: 170, rotate: 6, z: 1 }),
        phone('01-dashboard.png', 600, { x: -100, y: 60, z: 2 }),
      ].join(''))}`),
  },
  // 3:2 search results — show the app, big and simple.
  'search-3840x2560': {
    W: 3840, H: 2560,
    html: (W, H) => base(W, H, `
      <div class="blob" style="width:1800px;height:1800px;left:-700px;top:-900px;opacity:.10"></div>
      <div class="blob" style="width:1500px;height:1500px;right:-500px;bottom:-900px;opacity:.10"></div>
      <div style="position:absolute;top:150px;width:100%;text-align:center">
        <h1 style="font-size:170px">Run your tutoring studio</h1>
        <p style="font-size:72px;margin-top:36px">Lessons, students and payments in one place</p>
      </div>
      ${group(1920, 640, [
        phone('02-calendar.png', 640, { x: -1150, y: 230, rotate: -7, z: 1 }),
        phone('04-payments.png', 640, { x: 470, y: 230, rotate: 7, z: 1 }),
        phone('01-dashboard.png', 720, { x: -386, y: 70, z: 2 }),
      ].join(''))}`),
  },
  // 16:9 universal — usable for both; key content inside the 21:9 ∩ 3:2 centre.
  'universal-5244x2950': {
    W: 5244, H: 2950,
    html: (W, H) => base(W, H, `
      <div class="blob" style="width:2200px;height:2200px;left:-800px;top:-1300px;opacity:.10"></div>
      <div class="blob" style="width:1900px;height:1900px;right:-600px;bottom:-1200px;opacity:.10"></div>
      <div style="position:absolute;left:1000px;top:0;height:${H}px;display:flex;flex-direction:column;justify-content:center;width:1800px">
        <div class="brand" style="font-size:110px;gap:42px;margin-bottom:72px">${mark(170)}DaLesson</div>
        <h1 style="font-size:190px">Your tutoring studio,<br>in one app</h1>
        <p style="font-size:74px;margin-top:56px">Lessons, students, payments and parents</p>
      </div>
      ${group(3480, 440, [
        phone('02-calendar.png', 680, { x: -640, y: 190, rotate: -6, z: 1 }),
        phone('04-payments.png', 680, { x: 420, y: 190, rotate: 6, z: 1 }),
        phone('01-dashboard.png', 740, { x: -125, y: 60, z: 2 }),
      ].join(''))}`),
  },
};

(async () => {
  const b = await chromium.launch();
  for (const [name, d] of Object.entries(designs)) {
    const p = await b.newPage({ viewport: { width: d.W, height: d.H }, deviceScaleFactor: 1 });
    const f = path.join(OUT, name + '.html');
    fs.writeFileSync(f, d.html(d.W, d.H));
    await p.goto('file://' + f);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, name + '.raw.png') });
    await p.close();
  }
  await b.close();
})();
