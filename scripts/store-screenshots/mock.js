// Mock Supabase backend + demo data for rendering DaLesson store screenshots.
// All names are fictional.
const REF = 'hfbpnssoaityzwgscyui';
const TUTOR_UID = '00000000-0000-4000-8000-000000000001';
const TUTOR_ID = 'p-tutor';
const now = new Date('2026-10-29T23:40:00Z'); // Thu 4:40pm PT
const iso = d => d.toISOString();
const ts = '2026-06-01T00:00:00Z';

const tutor = {
  id: TUTOR_ID, user_id: TUTOR_UID, name: 'Sarah Nguyen', email: 'sarah@harmonylearning.com',
  phone: '(206) 555-0142', role: 'tutor', avatar_url: null, onboarding_completed_at: ts,
  preferences: {}, invitation_token: null, invitation_sent_at: null, invitation_expires_at: null,
  invitation_accepted_at: null, requires_agreement: false, agreement_signed_at: ts, billing_mode: 'invoice',
  prepaid_subjects: [], telegram_chat_id: null, telegram_username: null, telegram_linked_at: null,
  telegram_recap_enabled: false, auto_complete_lessons: true, created_at: ts, updated_at: ts,
  business_name: 'Harmony Studio', timezone: 'America/Los_Angeles', tutor_id: null,
  subscription_status: 'active', subscription_plan: 'pro',
};

const fams = [
  ['Jennifer Park', [['Emma Park', 9, '4th', ['piano', 'reading']], ['Lucas Park', 7, '2nd', ['math']]], 'invoice'],
  ['David Tran', [['Mia Tran', 11, '6th', ['math', 'english']]], 'prepaid'],
  ['Maria Lopez', [['Sofia Lopez', 8, '3rd', ['reading', 'speech']]], 'invoice'],
  ['Kevin Chen', [['Ethan Chen', 12, '7th', ['piano']], ['Chloe Chen', 10, '5th', ['piano', 'math']]], 'invoice'],
  ['Amanda Wright', [['Noah Wright', 6, '1st', ['reading']]], 'prepaid'],
  ['Linh Pham', [['Ava Pham', 13, '8th', ['math', 'english']]], 'invoice'],
  ['Robert Kim', [['Leo Kim', 9, '4th', ['speech']]], 'invoice'],
];
const parents = [], students = [];
fams.forEach(([pname, kids, mode], i) => {
  const pid = `p-${i + 1}`;
  parents.push({ ...tutor, id: pid, user_id: `u-${i + 1}`, name: pname, role: 'parent',
    email: pname.toLowerCase().replace(' ', '.') + '@example.com', phone: `(425) 555-01${10 + i}`,
    billing_mode: mode, prepaid_subjects: mode === 'prepaid' ? ['math', 'reading'] : [],
    business_name: null, tutor_id: TUTOR_ID });
  kids.forEach(([n, age, g, subj], j) => students.push({
    id: `s-${i + 1}-${j + 1}`, parent_id: pid, tutor_id: TUTOR_ID, name: n, age, grade_level: g, subjects: subj,
    subject_rates: Object.fromEntries(subj.map(s => [s, s === 'piano' ? 45 : 40])), avatar_url: null,
    birthday: null, created_at: ts, updated_at: ts }));
});
const P = id => parents.find(p => p.id === id);
const S = id => students.find(s => s.id === id);
const withParent = s => ({ ...s, parent: { ...P(s.parent_id), students: students.filter(x => x.parent_id === s.parent_id) } });

// Lessons: a weekly pattern for Oct 1 - Nov 30 (local Pacific = UTC-7)
const pattern = [ // [studentId, subject, weekday(0=Sun), hourLocal, min, dur]
  ['s-1-1', 'piano', 1, 15, 30, 45], ['s-2-1', 'math', 1, 16, 30, 60], ['s-5-1', 'reading', 1, 17, 30, 30],
  ['s-4-1', 'piano', 2, 15, 0, 45], ['s-3-1', 'reading', 2, 16, 0, 45], ['s-6-1', 'english', 2, 17, 0, 60],
  ['s-1-2', 'math', 3, 15, 30, 45], ['s-7-1', 'speech', 3, 16, 30, 30], ['s-4-2', 'piano', 3, 17, 15, 45],
  ['s-1-1', 'reading', 4, 15, 0, 45], ['s-2-1', 'english', 4, 16, 0, 60], ['s-4-2', 'math', 4, 17, 15, 45], ['s-3-1', 'speech', 4, 18, 15, 30],
  ['s-6-1', 'math', 5, 15, 30, 60], ['s-5-1', 'reading', 5, 16, 45, 30],
  ['s-4-1', 'piano', 6, 10, 0, 45], ['s-1-1', 'piano', 6, 11, 0, 45],
];
const lessons = [];
let lid = 0;
for (let d = new Date('2026-10-01T00:00:00Z'); d < new Date('2026-12-01T00:00:00Z'); d = new Date(d.getTime() + 864e5)) {
  for (const [sid, subj, wd, h, m, dur] of pattern) {
    if (d.getUTCDay() !== wd) continue;
    const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h + 7, m));
    const done = at < now;
    lessons.push({ id: `l-${++lid}`, student_id: sid, tutor_id: TUTOR_ID, subject: subj, scheduled_at: iso(at), duration_min: dur,
      status: done ? 'completed' : 'scheduled', notes: done && lid % 3 === 0 ? 'Great focus today. Practice scales 10 min daily.' : null,
      session_id: null, override_amount: null, created_at: ts, updated_at: ts });
  }
}
const lessonOut = l => ({ ...l, student: withParent(S(l.student_id)) });

const months = ['2026-09-01', '2026-10-01'];
const payments = [];
parents.forEach((p, i) => months.forEach((m, k) => {
  const kids = students.filter(s => s.parent_id === p.id).length;
  const due = [360, 480, 320, 640, 160, 400, 240][i];
  const status = k === 0 ? 'paid' : ['paid', 'paid', 'partial', 'paid', 'paid', 'unpaid', 'paid'][i];
  const paid = status === 'paid' ? due : status === 'partial' ? due / 2 : 0;
  payments.push({ id: `pay-${i}-${k}`, parent_id: p.id, tutor_id: TUTOR_ID, month: m, amount_due: due, amount_paid: paid, status,
    paid_at: paid ? `${m.slice(0, 8)}0${3 + i}T18:00:00Z` : null, notes: null, payment_type: p.billing_mode,
    subject: p.billing_mode === 'prepaid' ? 'math' : null, sessions_prepaid: p.billing_mode === 'prepaid' ? 8 : 0,
    sessions_used: p.billing_mode === 'prepaid' ? (k === 0 ? 8 : 6) : 0, sessions_rolled_over: 0, created_at: m + 'T00:00:00Z', updated_at: ts,
    _kids: kids });
}));
const payOut = p => ({ ...p, parent: { ...P(p.parent_id), students: students.filter(s => s.parent_id === p.parent_id) } });

const thread = (id, subj, pid, last, sender, mins, unread) => ({
  id, subject: subj, created_by: TUTOR_ID, creator_name: 'Sarah Nguyen', recipient_type: pid==='p-4'?'all':'group', group_id: null, group_name: pid==='p-4'?null:P(pid).name.split(' ')[1]+' Family',
  is_active: true, created_at: ts, updated_at: iso(new Date(now - mins * 6e4)), latest_message_id: id + '-m',
  latest_message_content: last, latest_message_sender_id: sender === 'me' ? TUTOR_ID : pid,
  latest_message_sender_name: sender === 'me' ? 'Sarah Nguyen' : P(pid).name, latest_message_created_at: iso(new Date(now - mins * 6e4)),
  unread_count: unread, participant_count: pid==='p-4'?7:2 });
const threads = [
  thread('t1', "Emma's recital piece", 'p-1', 'She has been practicing every night. Thank you so much!', 'them', 12, 2),
  thread('t2', 'Reschedule next Tuesday?', 'p-3', 'Tuesday at 5:00 PM works. See you then!', 'me', 55, 0),
  thread('t3', 'Math packet for Mia', 'p-2', 'Uploaded the fractions worksheet to Shared Resources.', 'me', 180, 0),
  thread('t4', 'Holiday schedule', 'p-4', 'Will lessons continue over Thanksgiving week?', 'them', 60 * 26, 1),
  thread('t5', 'Welcome to the studio!', 'p-5', 'Noah loved his first reading lesson 📚', 'them', 60 * 50, 0),
];

const notifications = [
  { id: 'n1', recipient_id: TUTOR_ID, sender_id: 'p-1', type: 'message', title: 'New message from Jennifer Park', message: 'She has been practicing every night…', data: {}, read_at: null, created_at: iso(new Date(now - 12 * 6e4)), priority: 'normal' },
  { id: 'n2', recipient_id: TUTOR_ID, sender_id: 'p-4', type: 'reschedule_request', title: 'Reschedule request', message: 'Kevin Chen requested a new time for Ethan', data: {}, read_at: null, created_at: iso(new Date(now - 3 * 36e5)), priority: 'normal' },
];

const PARENT = process.env.PARENT === '1';
const myKids = students.filter(s => s.parent_id === 'p-1').map(s => s.id);
const tables = {
  parents: parents.concat([tutor]),
  students: students.filter(s => !PARENT || myKids.includes(s.id)).map(withParent),
  scheduled_lessons: lessons.filter(l => !PARENT || myKids.includes(l.student_id)).map(lessonOut),
  payments: payments.filter(p => !PARENT || p.parent_id === 'p-1').map(payOut),
  notifications,
  tutor_settings: [{ id: 'ts1', tutor_id: TUTOR_UID, custom_subjects: [], default_rate: 45, default_base_duration: 60, subject_rates: {}, group_subject_rates: {}, combined_session_rate: 0, created_at: ts, updated_at: ts }],
  assignments: [
    { id: 'a1', tutor_id: TUTOR_ID, student_id: 's-1-1', title: 'C Major Scale – Hands Together', instructions: 'Practice 10 min daily', due_date: '2026-11-03', status: 'assigned', assigned_at: iso(new Date(now - 864e5)), completed_at: null, worksheet_type: 'piano', config: {}, pdf_url: null, created_at: ts, updated_at: ts, student: S('s-1-1') },
    { id: 'a2', tutor_id: TUTOR_ID, student_id: 's-2-1', title: 'Fractions Practice Set', instructions: 'Problems 1–20', due_date: '2026-11-02', status: 'assigned', assigned_at: iso(new Date(now - 2 * 864e5)), completed_at: null, worksheet_type: 'math', config: {}, pdf_url: null, created_at: ts, updated_at: ts, student: S('s-2-1') },
  ],
};

const rpc = {
  get_current_user_parent: PARENT ? [parents[0]] : [tutor],
  get_threads_with_preview: threads,
  get_unread_message_count: 3,
  get_unread_notification_count: 2,
  get_my_tutor_info: [tutor],
  get_busy_slots_for_date: [],
};

function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'or', 'and', 'on_conflict', 'columns'].includes(k)) continue;
    const col = k.includes('.') ? null : k; if (!col) continue;
    const m = v.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|in|is|like|ilike|cs|ov)\.(.*)$/); if (!m) continue;
    const [, neg, op, raw] = m;
    const test = r => {
      const x = r[col];
      if (x === undefined && !['is'].includes(op)) return true; // unknown column: don't filter
      switch (op) {
        case 'eq': return String(x) === raw;
        case 'neq': return String(x) !== raw;
        case 'gt': return x > raw; case 'gte': return x >= raw;
        case 'lt': return x < raw; case 'lte': return x <= raw;
        case 'in': return raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/"/g, '')).includes(String(x));
        case 'is': return raw === 'null' ? x == null : String(x) === raw;
        case 'cs': case 'ov': return true;
        default: return true;
      }
    };
    out = out.filter(r => (neg ? !test(r) : test(r)));
  }
  const order = params.get('order');
  if (order) {
    const [c, dir] = order.split(',')[0].split('.');
    out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  const limit = params.get('limit'); if (limit) out = out.slice(0, +limit);
  return out;
}

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
const user = { id: TUTOR_UID, aud: 'authenticated', role: 'authenticated', email: tutor.email, app_metadata: { provider: 'email' },
  user_metadata: { name: tutor.name, role: 'tutor', subscription_status: 'active' }, created_at: ts };
if (PARENT) { user.id = 'u-1'; user.email = parents[0].email; user.user_metadata = { name: parents[0].name, role: 'parent' }; }
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated', email: tutor.email })}.sig`;
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600 * 24 * 30, expires_at: exp, user };

async function install(page, opts = {}) {
  await page.addInitScript(([key, s]) => {
    localStorage.setItem(key, JSON.stringify(s));
  }, [`sb-${REF}-auth-token`, session]);
  await page.route(/supabase\.co/, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const json = (body, headers = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range', ...headers }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (path.startsWith('/auth/v1/user')) return json(user);
    if (path.startsWith('/auth/v1/token')) return json(session);
    if (path.startsWith('/auth/v1')) return json({});
    if (path.startsWith('/storage/v1')) return json([]);
    if (path.startsWith('/functions/v1')) return json({});
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop();
      return json(fn in rpc ? rpc[fn] : (opts.log && console.log('unmocked rpc', fn), []));
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop();
      const rows = tables[table];
      if (!rows && opts.log) console.log('unmocked table', table, url.search.slice(0, 120));
      if (req.method() !== 'GET' && req.method() !== 'HEAD') return json([]);
      const out = applyFilters(rows || [], url.searchParams);
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const range = { 'content-range': `0-${Math.max(out.length - 1, 0)}/${out.length}` };
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...range, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } });
      if (single) return out[0] ? json(out[0], range) : route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }) });
      return json(out, range);
    }
    return json({});
  });
  await page.route(/realtime|websocket/, r => r.abort());
}
module.exports = { install, now };
