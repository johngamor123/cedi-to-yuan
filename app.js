import {
  watchUser, registerUser, loginUser, googleLogin, logoutUser, resetPassword, updateName,
  resendVerify, reloadUser, setRemember, getProfile, saveProfile,
  ADMIN_EMAIL, watchConfig, saveConfig, createOrder, watchMyOrders, watchAllOrders,
  adminSet, claimPaid, cancelMine, watchAnnounce, saveAnnounce, saveQR, getQR
} from "./firebase-auth.js";

/* ---------- HELPERS ---------- */
const $ = id => document.getElementById(id);
const f = n => (+n || 0).toFixed(2);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR = {
  "auth/email-already-in-use": "This email already has an account. Please log in.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "Please choose a stronger password (at least 6 characters).",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "No account found. Please register first.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Check your internet connection and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "permission-denied": "You do not have permission to do that."
};
const err = e => alert(ERR[e && e.code] || (e && e.message) || "Something went wrong. Please try again.");
function toast(m) {
  const t = $('toast'); t.textContent = m; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', 2500);
}

/* ---------- DATE + TIME (same on every phone: 25 Oct 2026, 10:33:12 PM) ---------- */
const fmt = d => {
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return day + ', ' + time;
};
function tickClock() {
  const c = $('clock'); if (!c) return;
  const d = new Date();
  c.textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(d)
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

/* ---------- NIGHT / DAY MODE ---------- */
const THEME_LABEL = { auto: "Auto (follows your phone)", light: "Day mode ☀️", dark: "Night mode 🌙" };
const getTheme = () => localStorage.theme || "auto";
function applyTheme() {
  const t = getTheme();
  const dark = t == "dark" || (t == "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", dark ? "#0a2418" : "#0b6b35");
  const d = $('dtheme');
  if (d) d.textContent = dark ? "☀️ Switch to Day mode" : "🌙 Switch to Night mode";
}
function setTheme(t) {
  localStorage.theme = t;
  applyTheme();
  if (cur == 'account') acc();
}
function cycleTheme() {
  const order = ["auto", "light", "dark"];
  const next = order[(order.indexOf(getTheme()) + 1) % 3];
  setTheme(next);
  toast("Appearance: " + THEME_LABEL[next]);
}
function quickTheme() {
  const isDark = document.body.classList.contains("dark");
  setTheme(isDark ? "light" : "dark");
  toast(isDark ? "Day mode on ☀️" : "Night mode on 🌙");
  closeDrawer();
}

/* ---------- PASSWORD EYE (open = shown, slashed = hidden) ---------- */
const EYE_ON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function eye(id) {
  const input = $(id), s = input.parentNode.querySelector('span');
  const hidden = input.type == 'password';
  input.type = hidden ? 'text' : 'password';
  s.innerHTML = hidden ? EYE_ON : EYE_OFF;
}
function hidePw() {
  document.querySelectorAll('.pw').forEach(w => {
    w.querySelector('input').type = 'password';
    w.querySelector('span').innerHTML = EYE_OFF;
  });
}

/* ---------- SOUND + VIBRATION ---------- */
let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { }
}
document.addEventListener('pointerdown', unlockAudio);
function beep() {
  try {
    unlockAudio();
    if (actx) {
      const t = actx.currentTime;
      [[880, 0], [1175, 0.17]].forEach(([fr, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = fr;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
        o.connect(g); g.connect(actx.destination);
        o.start(t + d); o.stop(t + d + 0.17);
      });
    }
  } catch (e) { }
  try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]) } catch (e) { }
}
function notify(msg) { beep(); toast(msg) }

const METHODS = [
  ["Pay with Paystack", "Card, Mobile Money, Bank (coming soon)", false],
  ["MTN Mobile Money", "Pay with MTN MoMo", true],
  ["Telecel Cash", "Pay with Telecel Cash", true],
  ["AirtelTigo Money", "Pay with AirtelTigo Money", true],
  ["Bank Transfer", "Direct Bank Transfer", true]
];
const RT = {
  "Alipay": "Alipay account (phone or email)",
  "WeChat Pay": "WeChat ID or phone number",
  "Bank Transfer": "Bank account number"
};
const QR_TYPES = ["Alipay", "WeChat Pay"];
const TABS = ["All", "Pending", "Completed", "Cancelled"];
const ATABS = ["All", "Needs action", "Pending", "Completed", "Cancelled", "Customers"];
const SLIDES = [
  { art: "people", t: "Exchange Made Simple", x: "Buy Chinese Yuan (CNY) with your Ghana Cedis (GHS) in just a few taps." },
  { art: "splash", t: "See your Yuan instantly", x: "Enter how many Cedis you want to spend and see exactly how much Yuan you will get before you pay." },
  { art: "flow", t: "Pay and receive", x: "Tell us your Alipay, WeChat or bank account, pay with Mobile Money or bank transfer, and we send your Yuan." }
];
const ART = {
  people: '<img class="art-people" src="images/people.webp" width="1100" height="733" alt="A Ghanaian man and a Chinese woman exchanging currency on their phones">',
  splash: '<div class="art-card"><img src="images/splash.webp" width="1100" height="619" alt="Cedi to Yuan exchange"></div>',
  flow: '<div class="flow"><div><i>📲</i><small>Place order</small></div><b>›</b><div><i>💳</i><small>Pay</small></div><b>›</b><div><i>🇨🇳</i><small>Get Yuan</small></div></div>'
};
const MAILHINT = "\n\nIf you don't see it in your Inbox, check your Spam and Promotions folders (look for an email from firebaseapp.com).";
const waNum = p => { p = String(p || "").replace(/\D/g, ""); if (p.startsWith("0")) p = "233" + p.slice(1); return p };

/* ---------- STATE ---------- */
let me = null, profile = {}, cfg = null, ann = null, method = "MTN Mobile Money", rtype = "Alipay";
let hist = [], cur, pendingAfter = null, tab = "All", atab = "All", slide = 0;
let openId = null, placing = false, lastPlaced = null, custCache = [];
let myOrders = [], allOrders = [], unsubs = [];
let seenFirstMine = false, lastEvMax = 0, seenFirstAll = false, knownAll = {};
let seenFirstAnn = false, lastAnnAt = 0;
let qrData = null, qrTouched = false, qrFromSaved = false;

const isAdmin = () => !!(me && me.email && me.email.toLowerCase() === ADMIN_EMAIL);
const byTime = (a, b) => (b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 9e12) - (a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 9e12);
const dt = o => o.createdAt && o.createdAt.toDate ? fmt(o.createdAt.toDate()) : (o.clientTime ? fmt(new Date(o.clientTime)) : "Just now");
const evTime = o => o.updatedAt && o.updatedAt.seconds ? o.updatedAt.seconds * 1000 : 0;
const annAt = () => ann && ann.at && ann.at.seconds ? ann.at.seconds * 1000 : 0;
const makeId = () => {
  const d = new Date();
  return "CYT-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + "-" + String(Date.now()).slice(-6);
};
const cnyOf = g => Number(((+g || 0) * (cfg ? +cfg.rate : 0)).toFixed(2));
const rateOf = o => (+o.ghs > 0 && +o.cny > 0) ? String(+((+o.cny) / (+o.ghs)).toFixed(4)) : "-";
const rateTxt = () => cfg ? ("1 GHS = " + cfg.rate + " CNY") : "Rate not available yet";
const total = o => (+o.ghs) + (+o.fee);
const noFee = () => !!(cfg && +cfg.fee == 0);
const myPhone = () => profile.phone || (me ? localStorage["phone_" + me.uid] : "") || "";
const getOrder = id => myOrders.find(o => o.id == id);
const ps = o => o.payStatus || "Awaiting payment";

/* ---------- NAVIGATION (phone Back button works) ---------- */
function show(p) {
  cur = p;
  qrClose();
  document.querySelectorAll('.s').forEach(e => e.classList.toggle('on', e.id == p));
  $('nav').style.display = ['home', 'orders', 'account'].includes(p) ? 'flex' : 'none';
  document.querySelectorAll('#nav div').forEach(d => d.classList.toggle('a', d.dataset.p == p));
  closeDrawer();
  if (p == 'login' || p == 'reg') hidePw();
  const r = { home, onb: () => { slide = 0; slideShow() }, buy: calc, recv: recvShow, summary: sum, pay: payShow,
    orders: list, order: orderShow, done: doneShow, notif: notifShow, how: () => { localStorage.howdone = '1' },
    account: acc, personal: personalShow, password: pwShow, admin: adminShow };
  if (r[p]) r[p]();
  if ($(p)) $(p).scrollTop = 0;
}
function go(p) { if (cur) hist.push(cur); history.pushState({}, ""); show(p) }
function back() { if (hist.length) history.back(); else show('home') }
function reset(p, then) {
  const n = hist.length; hist = [];
  const run = () => { show(p); if (then) then() };
  if (n) {
    pendingAfter = run;
    history.go(-n);
    setTimeout(() => { if (pendingAfter === run) { pendingAfter = null; run() } }, 500);
  } else run();
}
const goHome = () => reset('home');
const navTo = p => reset(p);
window.addEventListener('popstate', () => {
  if (pendingAfter) { const fn = pendingAfter; pendingAfter = null; fn(); return }
  if (hist.length) show(hist.pop());
});

function openDrawer() {
  $('dn').textContent = me ? (me.displayName || 'CediToYuan') : 'CediToYuan';
  $('de').textContent = me ? me.email : '';
  $('dadmin').style.display = isAdmin() ? 'block' : 'none';
  $('drawer').classList.add('on');
}
function closeDrawer() { $('drawer').classList.remove('on') }
function drawerGo(p) {
  closeDrawer();
  if (['home', 'orders', 'account'].includes(p)) reset(p); else go(p);
}

/* ---------- ONBOARDING ---------- */
function slideShow() {
  const s = SLIDES[slide];
  $('oart').innerHTML = ART[s.art];
  $('ot').textContent = s.t;
  $('ox').textContent = s.x;
  $('odots').innerHTML = SLIDES.map((_, i) => `<i class="${i == slide ? 'a' : ''}"></i>`).join('');
  $('obtn').textContent = slide < SLIDES.length - 1 ? 'Next ›' : 'Continue ›';
}
function nextSlide() { if (slide < SLIDES.length - 1) { slide++; slideShow() } else go('login') }

/* ---------- SHARE ---------- */
function shareApp() {
  const url = location.origin + location.pathname.replace(/index\.html$/, '');
  const text = "Buy Chinese Yuan with Ghana Cedis fast and safely on CediToYuan 🇬🇭➜🇨🇳";
  if (navigator.share) navigator.share({ title: "CediToYuan", text, url }).catch(() => {});
  else window.open("https://wa.me/?text=" + encodeURIComponent(text + " " + url), "_blank");
}

/* ---------- AUTH ---------- */
async function loadProfile() {
  try { profile = (await getProfile(me.uid)) || {} } catch (e) { profile = {} }
  if (cur == 'home') home();
}
async function reg() {
  const n = $('rn').value.trim(), e = $('re').value.trim(), ph = $('rp').value.trim(), p = $('rpw').value;
  if (n.length < 2 || !e || ph.replace(/\D/g, '').length < 9 || p.length < 6) return alert('Fill all fields correctly (password min 6 characters, valid phone number).');
  if (p != $('rcp').value) return alert('Passwords do not match');
  try {
    me = await registerUser(n, e, p);
    profile = { name: n, phone: ph };
    saveProfile(me.uid, profile).catch(() => {});
    reset('home', () => alert('Account created! We sent a verification link to ' + e + '.' + MAILHINT));
  } catch (x) { err(x) }
}
async function login() {
  const e = $('li').value.trim(), p = $('lp').value;
  if (!e.includes('@')) return alert('Please login with your email address');
  if (!p) return alert('Enter your password');
  try { await setRemember($('rem').checked); me = await loginUser(e, p); reset('home') } catch (x) { err(x) }
}
async function google() {
  try { await setRemember($('rem').checked); me = await googleLogin(); reset('home') } catch (x) { err(x) }
}
async function forgot() {
  const e = $('li').value.trim();
  if (!e.includes('@')) return alert('Type your email in the email box first');
  try { await resetPassword(e); alert('If an account exists for ' + e + ', a password reset link has been sent.' + MAILHINT) } catch (x) { err(x) }
}
async function logout() {
  try { await logoutUser() } catch (x) { err(x); return }
  me = null; profile = {}; clearRecv(); reset('login');
}
async function resend() {
  try {
    const r = await resendVerify();
    if (r == "verified") { toast("Your email is already verified"); home() }
    else alert('Verification link sent to ' + me.email + '.' + MAILHINT);
  } catch (x) { err(x) }
}
async function refreshVerify() {
  try { await reloadUser(); home(); toast(me.emailVerified ? "Email verified. Thank you!" : "Not verified yet. Open the link in your email.") } catch (x) { err(x) }
}

/* ---------- LIVE DATA ---------- */
function stopData() {
  unsubs.forEach(u => u()); unsubs = []; myOrders = []; allOrders = [];
  seenFirstMine = false; lastEvMax = 0; seenFirstAll = false; knownAll = {};
}
function startData() {
  stopData();
  if (!me) return;
  unsubs.push(watchMyOrders(me.uid, l => {
    myOrders = l.sort(byTime);
    const mx = l.reduce((a, o) => Math.max(a, evTime(o)), 0);
    if (seenFirstMine && mx > lastEvMax) notify('🔔 You have an update on your order');
    lastEvMax = Math.max(lastEvMax, mx); seenFirstMine = true;
    refreshOrders();
  }));
  if (isAdmin()) unsubs.push(watchAllOrders(l => {
    allOrders = l.sort(byTime);
    let msg = '';
    l.forEach(o => {
      const prev = knownAll[o.id];
      if (seenFirstAll) {
        if (prev === undefined && o.status == 'Pending') msg = '🆕 New order received';
        else if (prev !== undefined && prev != ps(o) && ps(o) == 'Customer says paid' && o.status == 'Pending') msg = '💬 A customer says they have paid';
      }
      knownAll[o.id] = ps(o);
    });
    seenFirstAll = true;
    if (msg) notify(msg);
    refreshOrders();
  }));
}
function refreshOrders() {
  if (cur == 'orders') list();
  if (cur == 'home') home();
  if (cur == 'admin') adminList();
  if (cur == 'order') orderShow();
  if (cur == 'notif') notifShow();
  if (cur == 'done') doneShow();
  updateBell();
}
watchConfig(c => {
  cfg = c;
  if (cur == 'home') home();
  if (cur == 'buy') calc();
  if (cur == 'summary') sum();
  if (cur == 'pay') payShow();
  if (cur == 'order') orderShow();
});
watchAnnounce(a => {
  ann = a;
  const at = annAt();
  if (seenFirstAnn && at > lastAnnAt && a && a.text && !isAdmin()) notify('📢 ' + a.text);
  lastAnnAt = Math.max(lastAnnAt, at); seenFirstAnn = true;
  updateBell();
  if (cur == 'notif') notifShow();
});

/* ---------- NOTIFICATIONS ---------- */
const seenKey = () => "seen_" + (me ? me.uid : "x");
const notifs = () => myOrders.filter(o => o.lastEvent && o.updatedAt).sort((a, b) => evTime(b) - evTime(a));
const unread = () => {
  const seen = +localStorage[seenKey()] || 0;
  return notifs().filter(o => evTime(o) > seen).length + ((ann && ann.text && annAt() > seen) ? 1 : 0);
};
function updateBell() { const d = $('bdot'); if (d) d.style.display = unread() > 0 ? 'block' : 'none' }
function notifShow() {
  const l = notifs();
  const annHtml = ann && ann.text ? `<div class="card" style="background:#fff7df"><b>📢 Announcement</b><br>${esc(ann.text)}<br><small>${annAt() ? fmt(new Date(annAt())) : ''}</small></div>` : '';
  const items = l.map(o => `<div class="card" onclick="openOrder('${o.id}')">
    <b>${esc(o.lastEvent)}</b><br><small>Order ${esc(o.orderId)} · ${fmt(new Date(evTime(o)))}</small></div>`).join('');
  $('nl').innerHTML = (annHtml + items) || '<p style="text-align:center;color:#888;margin-top:40px">No notifications yet</p>';
  localStorage[seenKey()] = Date.now();
  updateBell();
}

/* ---------- HOME ---------- */
function qcalc() {
  const g = +$('qc').value || 0;
  $('qcout').textContent = cfg ? "¥ " + f(cnyOf(g)) : "—";
}
function buyFromQuick() {
  const g = +$('qc').value;
  if (g > 0) $('amt').value = g;
  go('buy');
}
function dismissHow() { localStorage.howdone = '1'; $('howcard').style.display = 'none' }
function home() {
  const first = me ? String(me.displayName || profile.name || "").trim().split(" ")[0] : "";
  $('hello').textContent = first ? "Hello, " + first + " 👋" : "Hello 👋";
  tickClock();
  $('hr').textContent = rateTxt();
  $('hu').textContent = cfg && cfg.updated && cfg.updated.toDate ? "Last updated: " + fmt(cfg.updated.toDate()) : "";
  const done = myOrders.filter(o => o.status == "Completed");
  $('cb').textContent = "¥ " + f(done.reduce((a, o) => a + +o.cny, 0));
  $('gb').textContent = "GH₵ " + f(done.reduce((a, o) => a + +o.ghs, 0));
  $('closedbanner').style.display = cfg && cfg.open === false ? 'block' : 'none';
  $('vbanner').style.display = me && !me.emailVerified ? 'block' : 'none';
  $('nofee').style.display = noFee() ? 'block' : 'none';
  $('howcard').style.display = (!localStorage.howdone && myOrders.length == 0) ? 'block' : 'none';
  qcalc();
  updateBell();
}

/* ---------- BUY ---------- */
function setAmt(v) { $('amt').value = v; calc() }
function calc() {
  const g = +$('amt').value || 0;
  $('cny').textContent = "¥ " + f(cnyOf(g));
  $('br').textContent = rateTxt();
  $('rcv').textContent = "You will receive ¥ " + f(cnyOf(g)) + " CNY";
  $('minmax').textContent = cfg ? "Min GH₵ " + cfg.min + " · Max GH₵ " + cfg.max : "";
  $('nofeeb').style.display = noFee() ? 'block' : 'none';
  document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('a', c.textContent == "GH₵ " + $('amt').value));
}
function toRecipient() {
  if (!cfg) return alert('Rates are not available yet. Please try again shortly.');
  if (cfg.open === false) return alert('We are currently closed and not taking new orders. Please try again later.');
  const g = +$('amt').value;
  if (!(g > 0)) return alert('Enter an amount');
  if (g < +cfg.min) return alert('Minimum order is GH₵ ' + cfg.min);
  if (g > +cfg.max) return alert('Maximum order is GH₵ ' + cfg.max);
  go('recv');
}

/* ---------- QR CODE (shrunk on the phone, stored free in the database) ---------- */
const qrKey = () => "qr_" + (me ? me.uid : "x") + "_" + rtype;
function qrLoadSaved() {
  qrData = null; qrFromSaved = false;
  if (QR_TYPES.includes(rtype)) {
    try { const s = localStorage[qrKey()]; if (s) { qrData = s; qrFromSaved = true } } catch (e) { }
  }
}
function qrView() {
  const on = QR_TYPES.includes(rtype);
  $('qrbox').style.display = on ? 'block' : 'none';
  if (!on) return;
  $('qrname').textContent = rtype;
  $('qrprev').style.display = qrData ? 'block' : 'none';
  if (qrData) {
    $('qrimg').src = qrData;
    $('qrnote').textContent = qrFromSaved ? 'Saved from your last order' : 'Ready to send with your order';
  }
  $('qrbtn').textContent = qrData ? '🔄 Change QR code' : '📷 Upload QR code';
}
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let max = 900, q = 0.85, out = '';
        for (let i = 0; i < 8; i++) {
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= 230000) break;
          max = Math.round(max * 0.85); q = Math.max(0.5, q - 0.08);
        }
        URL.revokeObjectURL(url);
        if (out.length > 330000) reject(new Error('too big')); else resolve(out);
      } catch (e) { reject(e) }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) };
    img.src = url;
  });
}
async function qrPicked(inp) {
  const file = inp.files && inp.files[0];
  inp.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) return alert('Please choose a picture (a screenshot or photo of your QR code).');
  toast('Preparing your QR code...');
  try {
    qrData = await shrinkImage(file);
    qrTouched = true; qrFromSaved = false;
    qrView(); toast('QR code added');
  } catch (e) {
    console.error(e);
    alert('We could not read that picture. Please try another screenshot or photo of your QR code.');
  }
}
function qrRemove() {
  qrData = null; qrTouched = true; qrFromSaved = false;
  try { localStorage.removeItem(qrKey()) } catch (e) { }
  qrView();
}
async function viewQR(id) {
  const o = findAll(id); if (!o) return;
  $('qrview').classList.add('on');
  $('qrstatus').textContent = 'Loading QR code...';
  $('qrfull').style.display = 'none'; $('qrdl').style.display = 'none';
  try {
    const q = await getQR(id);
    if (!q || !q.img) { $('qrstatus').textContent = 'QR code not received. Ask the customer to send it on WhatsApp.'; return }
    $('qrstatus').textContent = (q.type || 'QR code') + ' · ' + (o.recvName || '');
    $('qrfull').src = q.img; $('qrfull').style.display = 'block';
    $('qrdl').href = q.img; $('qrdl').download = 'qr-' + (o.orderId || id) + '.jpg'; $('qrdl').style.display = 'block';
  } catch (x) { console.error(x); $('qrstatus').textContent = 'Could not load the QR code.' }
}
function qrClose() { const v = $('qrview'); if (v) v.classList.remove('on') }

/* ---------- RECIPIENT ---------- */
const acctVal = () => { const a = $('racct').value.trim(); return rtype == "Bank Transfer" ? a.replace(/[\s-]/g, '') : a };
const cnVal = () => $('rcn').value.trim();
const branchVal = () => $('rbranch').value.trim();
function setRT(t) { rtype = t; qrTouched = false; qrLoadSaved(); rtView() }
function rtView() {
  $('rts').innerHTML = Object.keys(RT).map(k => `<div class="pm ${k == rtype ? 'a' : ''}" onclick="setRT('${k}')"><b>${k}</b><span>${k == rtype ? '◉' : '○'}</span></div>`).join('');
  $('racct').placeholder = RT[rtype];
  $('rbankbox').style.display = rtype == "Bank Transfer" ? 'block' : 'none';
  $('rnlabel').textContent = "Full name on your " + rtype + " account";
  qrView();
}
function recvShow() {
  const key = "lastRecv_" + (me ? me.uid : "x");
  let last = null;
  try { last = JSON.parse(localStorage[key] || "null") } catch (e) { }
  if (last && !$('rname').value && !$('racct').value) {
    rtype = last.type; $('rname').value = last.name; $('racct').value = last.acct; $('rbank').value = last.bank || "";
    $('rbranch').value = last.branch || ""; $('rcn').value = last.cn || "";
  }
  if (!qrTouched) qrLoadSaved();
  rtView();
  if (!$('rphone').value) $('rphone').value = myPhone();
}
function clearRecv() {
  ['rname', 'rcn', 'racct', 'rbank', 'rbranch', 'rphone'].forEach(i => $(i).value = '');
  $('rconf').checked = false;
  qrData = null; qrTouched = false; qrFromSaved = false;
}
function toSummary() {
  const n = $('rname').value.trim(), a = acctVal(), b = $('rbank').value.trim(), br = branchVal(), cn = cnVal(), ph = $('rphone').value.trim();
  if (n.length < 2) return alert('Enter the full name on your account');
  if (cn && !/[\u4e00-\u9fff]/.test(cn)) return alert('The Chinese name must be written in Chinese characters. Leave it empty if you do not have it.');
  if (rtype == "Bank Transfer") {
    if (!/^\d+$/.test(a)) return alert('The bank account number must contain digits only (no letters or symbols).');
    if (a.length < 12 || a.length > 25) return alert('The bank account number looks wrong. Chinese bank accounts usually have 12 to 25 digits. Please check it.');
    if (b.length < 2) return alert('Enter the bank name');
    if (br.length < 2) return alert('Enter the branch and city where the account was opened');
  } else if (a.length < 5) return alert('Enter your ' + RT[rtype]);
  if (ph.replace(/\D/g, '').length < 9) return alert('Enter your phone number');
  if (!$('rconf').checked) return alert('Please tick the box to confirm the name matches your account');
  go('summary');
}

/* ---------- SUMMARY ---------- */
function sum() {
  if (!cfg) return;
  const g = +$('amt').value || 0, fee = +cfg.fee;
  $('sumBox').innerHTML =
    `<h3 style="margin-bottom:8px">🇬🇭 Buy Yuan</h3>
    <div class="row"><span>GHS Amount</span><b>GH₵ ${f(g)}</b></div>
    <div class="row"><span>Exchange Rate</span><b>${esc(rateTxt())}</b></div>
    <div class="row"><span>You Get</span><b>¥ ${f(cnyOf(g))} CNY</b></div>
    ${fee > 0 ? `<div class="row"><span>Fee</span><b>GH₵ ${f(fee)}</b></div>` : ''}
    <div class="row"><span>Total to pay (GHS)</span><b>GH₵ ${f(g + fee)}</b></div>
    ${fee == 0 ? '<div class="vb ok">🎉 No fees on this order</div>' : ''}
    <div class="rbox">
     <small>Yuan will be sent to</small><br>
     <b>${esc(rtype)}</b><br>
     Name: <b>${esc($('rname').value.trim())}</b>
     ${cnVal() ? `<br>Chinese name: <b>${esc(cnVal())}</b>` : ''}
     <br>Account: <b>${esc(acctVal())}</b>
     ${rtype == "Bank Transfer" ? `<br>Bank: <b>${esc($('rbank').value.trim())}</b><br>Branch / city: <b>${esc(branchVal())}</b>` : ''}
     ${QR_TYPES.includes(rtype) && qrData ? '<br>QR code: <b>attached ✅</b>' : ''}
    </div>`;
}

/* ---------- PAYMENT METHOD + PLACE ORDER ---------- */
function pms() {
  $('pms').innerHTML = METHODS.map(m => `<div class="pm ${m[0] == method ? 'a' : ''} ${m[2] ? '' : 'off'}" onclick="setMethod('${m[0]}')"><div><b>${m[0]}</b><br><small>${m[1]}</small></div><span>${m[0] == method ? '◉' : '○'}</span></div>`).join('');
}
function setMethod(m) {
  const x = METHODS.find(k => k[0] == m);
  if (!x || !x[2]) return toast('Paystack is coming soon');
  method = m; pms();
}
function payShow() {
  pms();
  $('paybtn').textContent = "Place Order · GH₵ " + f((+$('amt').value || 0) + (cfg ? +cfg.fee : 0)) + " ›";
}
async function placeOrder() {
  if (placing) return;
  if (!me) return alert('Please log in again.');
  if (!cfg || cfg.open === false) return alert('We are currently not taking orders. Please try again later.');
  const g = +$('amt').value, fee = +cfg.fee;
  if (!(g > 0) || g < +cfg.min || g > +cfg.max) return alert('Please check the amount.');
  placing = true;
  show('proc');
  $('st2').className = ''; $('st3').className = '';
  setTimeout(() => $('st2').className = 'a', 700);
  setTimeout(() => $('st3').className = 'a', 1400);
  const isBank = rtype == "Bank Transfer";
  const withQR = QR_TYPES.includes(rtype) && !!qrData;
  const sendType = rtype, sendQR = qrData, sendKey = qrKey();
  const o = {
    uid: me.uid, name: me.displayName || profile.name || "", email: me.email || "",
    phone: $('rphone').value.trim(), orderId: makeId(), clientTime: Date.now(),
    ghs: g, fee, rate: +cfg.rate, cny: cnyOf(g), method,
    status: "Pending", payStatus: "Awaiting payment",
    recvType: rtype, recvName: $('rname').value.trim(), recvCN: cnVal(), recvAcct: acctVal(),
    recvBank: isBank ? $('rbank').value.trim() : "",
    recvBranch: isBank ? branchVal() : "",
    hasQR: withQR,
    customerRef: "", note: ""
  };
  let qrNote = '';
  try {
    const ref = await Promise.race([
      createOrder(o),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    ]);
    if (withQR) {
      try {
        await Promise.race([
          saveQR(ref.id, { uid: me.uid, orderId: o.orderId, type: sendType, img: sendQR }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
        ]);
        try { localStorage[sendKey] = sendQR } catch (e) { }
      } catch (x) {
        console.error(x);
        qrNote = 'Your order was placed, but we could not upload your QR code. Please send the QR code to us on WhatsApp (0598415716).';
      }
    }
    if (o.phone) { profile.phone = o.phone; saveProfile(me.uid, { phone: o.phone }).catch(() => {}) }
    try { localStorage["lastRecv_" + me.uid] = JSON.stringify({ type: rtype, name: o.recvName, cn: o.recvCN, acct: o.recvAcct, bank: o.recvBank, branch: o.recvBranch }) } catch (e) { }
    await new Promise(r => setTimeout(r, 1500));
    openId = ref.id; lastPlaced = o;
    clearRecv();
    if (navigator.vibrate) navigator.vibrate(60);
    reset('home', () => { go('done'); if (qrNote) setTimeout(() => alert(qrNote), 400) });
  } catch (x) {
    console.error(x);
    alert(x.code == 'permission-denied'
      ? 'Your order was blocked. The rate may have just changed. Please go back and try again.'
      : 'We could not confirm your order. Please check My Orders before trying again.');
    show('pay');
  } finally { placing = false }
}

/* ---------- ORDER PLACED / DETAILS ---------- */
function payBox(o) {
  const info = cfg && cfg.payInfo ? cfg.payInfo : "Our payment details will be sent to you on WhatsApp.";
  return `<div class="rbox"><b>Pay GH₵ ${f(total(o))}</b><br><small>Send payment to:</small><br>
    <span style="white-space:pre-line">${esc(info)}</span><br>
    <small>Use <b>${esc(o.orderId)}</b> as your payment reference.</small></div>`;
}
function doneShow() {
  const o = getOrder(openId) || lastPlaced;
  if (!o) return;
  $('dtxt').textContent = "Your request to buy ¥ " + f(o.cny) + " CNY has been received. Please pay to complete it.";
  $('did').textContent = o.orderId;
  $('ddt').textContent = dt(o);
  $('dpay').innerHTML = payBox(o);
}
function openOrder(id) { openId = id; go('order') }
function tracker(o) {
  if (o.status == 'Cancelled') return '';
  const paid = o.status == 'Completed' || ps(o) == 'Paid';
  const steps = [
    ["Order placed", "d"],
    ["Payment", paid ? "d" : (ps(o) == 'Customer says paid' ? "a" : "")],
    ["Yuan sent", o.status == 'Completed' ? "d" : (paid ? "a" : "")]
  ];
  return `<div class="trk">${steps.map(s => `<div class="ts ${s[1]}"><i>${s[1] == 'd' ? '✔' : ''}</i><small>${s[0]}</small></div>`).join('')}</div>`;
}
function orderShow() {
  const o = getOrder(openId);
  if (!o) { $('obody').innerHTML = '<p style="text-align:center;margin-top:40px;color:#888">Loading order...</p>'; return }
  const keep = $('cref') ? $('cref').value : '';
  const sup = "https://wa.me/233598415716?text=" + encodeURIComponent("Hello CediToYuan, I need help with order " + o.orderId);
  let action = '';
  if (o.status == 'Pending') {
    if (ps(o) == 'Awaiting payment') action = payBox(o) +
      `<input id="cref" placeholder="Your transaction ID / payment reference">
       <button class="btn" onclick="iPaid()">I Have Paid</button>
       <button class="btn o red-o" onclick="custCancel()">Cancel Order</button>`;
    else if (ps(o) == 'Customer says paid') action =
      `<div class="vb wait">⏳ We are confirming your payment${o.customerRef ? ' (ref: ' + esc(o.customerRef) + ')' : ''}. This usually takes a few minutes.</div>
       <a class="btn o" href="${sup}" target="_blank">💬 Contact support</a>`;
    else if (ps(o) == 'Paid') action = `<div class="vb ok">✅ Payment confirmed. We are sending your Yuan now.</div>`;
  } else if (o.status == 'Completed') {
    action = `<div class="vb ok">✅ Completed. ¥ ${f(o.cny)} was sent to your ${esc(o.recvType)}.</div>`;
  } else {
    action = `<div class="vb bad">❌ Order cancelled${o.cancelReason ? ': ' + esc(o.cancelReason) : ''}.
      ${ps(o) == 'Refund due' ? ' Your refund of GH₵ ' + f(total(o)) + ' will be processed.' : ''}
      ${ps(o) == 'Refunded' ? ' Your payment has been refunded.' : ''}</div>
      <a class="btn o" href="${sup}" target="_blank">💬 Contact support</a>`;
  }
  $('obody').innerHTML = `<div class="card">
    <div class="row"><b style="font-size:22px">¥ ${f(o.cny)}</b><span class="tag ${o.status}">${o.status}</span></div>
    ${tracker(o)}
    <div class="orow"><span>Order ID</span><b>${esc(o.orderId)}</b></div>
    <div class="orow"><span>Date &amp; time</span><b>${dt(o)}</b></div>
    <div class="orow"><span>GHS Amount</span><b>GH₵ ${f(o.ghs)}</b></div>
    <div class="orow"><span>Rate</span><b>1 GHS = ${rateOf(o)} CNY</b></div>
    ${+o.fee > 0 ? `<div class="orow"><span>Fee</span><b>GH₵ ${f(o.fee)}</b></div>` : ''}
    <div class="orow"><span>Total to pay</span><b>GH₵ ${f(total(o))}</b></div>
    <div class="orow"><span>Pay method</span><b>${esc(o.method)}</b></div>
    <div class="rbox"><small>Yuan sent to</small><br><b>${esc(o.recvType || '—')}</b><br>
      Name: <b>${esc(o.recvName || '—')}</b>
      ${o.recvCN ? '<br>Chinese name: <b>' + esc(o.recvCN) + '</b>' : ''}
      <br>Account: <b>${esc(o.recvAcct || '—')}</b>
      ${o.recvBank ? '<br>Bank: <b>' + esc(o.recvBank) + '</b>' : ''}
      ${o.recvBranch ? '<br>Branch / city: <b>' + esc(o.recvBranch) + '</b>' : ''}
      ${o.hasQR ? '<br>QR code: <b>sent</b>' : ''}</div>
  </div>${action}`;
  if ($('cref')) $('cref').value = keep;
}
async function iPaid() {
  const o = getOrder(openId); if (!o) return;
  const r = $('cref').value.trim();
  if (r.length < 3) return alert('Enter your transaction ID or payment reference so we can find your payment.');
  try { await claimPaid(o.id, r); toast('Thank you! We are confirming your payment.') } catch (x) { err(x) }
}
async function custCancel() {
  const o = getOrder(openId); if (!o) return;
  if (!confirm('Cancel this order? Only do this if you have NOT paid.')) return;
  try { await cancelMine(o.id); toast('Order cancelled') } catch (x) { err(x) }
}

/* ---------- MY ORDERS ---------- */
function setTab(t) { tab = t; list() }
function list() {
  $('tabs').innerHTML = TABS.map(t => `<b class="${t == tab ? 'a' : ''}" onclick="setTab('${t}')">${t}</b>`).join('');
  const l = myOrders.filter(o => tab == "All" || o.status == tab);
  $('ol').innerHTML = l.length ? l.map(o => `<div class="card" onclick="openOrder('${o.id}')">
    <div class="row"><b style="font-size:20px">¥ ${f(o.cny)}</b><span class="tag ${o.status}">${o.status}</span></div>
    <small>GH₵ ${f(o.ghs)} · 1 GHS = ${rateOf(o)} CNY<br>
    ${o.recvType ? 'To: ' + esc(o.recvType) + ' · ' + esc(o.recvName) + '<br>' : ''}
    ${o.status == 'Pending' ? esc(ps(o)) + '<br>' : ''}
    Order ID: ${esc(o.orderId)}<br>${dt(o)}</small></div>`).join('')
    : '<p style="text-align:center;color:#888;margin-top:40px">No orders yet</p>';
}

/* ---------- ACCOUNT ---------- */
const ACC = [["Personal Information", "personal"], ["Change Password", "password"], ["How It Works", "how"], ["Invite Friends", "share"], ["Payment Methods", "pmethods"], ["Notifications", "notif"], ["Help & Support", "help"], ["Terms & Privacy", "terms"], ["About Us", "about"]];
function acc() {
  $('an').textContent = me ? (me.displayName || 'User') : '';
  $('ae').textContent = me ? me.email : '';
  $('adminBtn').style.display = isAdmin() ? 'block' : 'none';
  const items = [ACC[0], ACC[1], ["Appearance: " + THEME_LABEL[getTheme()], "theme"]].concat(ACC.slice(2));
  $('alist').innerHTML = items.map(t => `<div class="row" style="border-bottom:1px solid #eee" onclick="accGo('${t[1]}')"><span>${t[0]}</span><span>›</span></div>`).join('');
}
function accGo(p) {
  if (p == 'theme') return cycleTheme();
  if (p == 'share') return shareApp();
  if (p == 'pmethods') return alert('You can pay with MTN Mobile Money, Telecel Cash, AirtelTigo Money or Bank Transfer. Paystack (card) is coming soon.');
  go(p);
}
function personalShow() {
  $('pn').value = me ? (me.displayName || '') : '';
  $('pe').value = me ? me.email : '';
  $('pp').value = myPhone();
}
function pwShow() { $('pwemail').textContent = me ? me.email : '' }
async function savePersonal() {
  const n = $('pn').value.trim(), p = $('pp').value.trim();
  if (n.length < 2) return alert('Enter your full name');
  try {
    await updateName(n);
    await saveProfile(me.uid, { name: n, phone: p });
    profile.name = n; profile.phone = p;
    toast('Saved'); back();
  } catch (x) { err(x) }
}
async function sendReset() {
  try { await resetPassword(me.email); alert('A password reset link has been sent to ' + me.email + '.' + MAILHINT) } catch (x) { err(x) }
}

/* ---------- ADMIN ---------- */
function adminShow() {
  if (!isAdmin()) { back(); return }
  if (cfg) {
    $('ar').value = cfg.rate; $('af').value = cfg.fee; $('amin').value = cfg.min; $('amax').value = cfg.max;
    $('apay').value = cfg.payInfo || ''; $('aopen').checked = cfg.open !== false;
  } else { $('aopen').checked = true }
  $('aann').value = ann && ann.text ? ann.text : '';
  adminList();
}
async function saveCfg() {
  const rate = +$('ar').value, fee = +$('af').value, min = +$('amin').value, max = +$('amax').value;
  if (!(rate > 0)) return alert('Enter the rate (Yuan for 1 GH₵), for example 0.542');
  if (!(fee >= 0) || $('af').value === '') return alert('Enter the fee (use 0 for no fee)');
  if (!(min > 0) || !(max >= min)) return alert('Enter a valid minimum and maximum order');
  if (rate >= 1 && !confirm('Rate ' + rate + ' means customers get ¥ ' + rate + ' for every GH₵ 1. Is that correct?')) return;
  try {
    await saveConfig({ rate, fee, min, max, open: $('aopen').checked, payInfo: $('apay').value.trim() });
    toast('Settings saved. Customers now see 1 GHS = ' + rate + ' CNY');
  } catch (x) { err(x) }
}
async function sendAnn() {
  const t = $('aann').value.trim();
  if (t.length < 3) return alert('Type your announcement (at least 3 letters).');
  if (t.length > 200) return alert('Keep it under 200 characters.');
  if (!confirm('Send this announcement to all customers?')) return;
  try { await saveAnnounce(t); toast('Announcement sent') } catch (x) { err(x) }
}
async function clearAnn() {
  if (!confirm('Remove the current announcement?')) return;
  try { await saveAnnounce(''); $('aann').value = ''; toast('Announcement cleared') } catch (x) { err(x) }
}
const need = o => o.status == "Pending" && ps(o) == "Customer says paid";
const TF = {
  "All": () => true, "Needs action": need,
  "Pending": o => o.status == "Pending", "Completed": o => o.status == "Completed", "Cancelled": o => o.status == "Cancelled",
  "Customers": () => true
};
function setATab(t) { atab = t; adminList() }
function payBadge(o) {
  if (o.status == "Completed") return '';
  if (o.status == "Cancelled") {
    if (ps(o) == "Refund due") return `<div class="vb bad">💸 Refund due: GH₵ ${f(total(o))}</div>`;
    if (ps(o) == "Refunded") return `<div class="vb ok">✅ Refunded</div>`;
    return '';
  }
  if (ps(o) == "Paid") return `<div class="vb ok">✅ Payment confirmed</div>`;
  if (ps(o) == "Customer says paid") return `<div class="vb wait">💬 Customer says paid${o.customerRef ? ' · ref: <b>' + esc(o.customerRef) + '</b>' : ''}<br>Check your MoMo/bank for GH₵ ${f(total(o))}, then tap Confirm payment.</div>`;
  return `<div class="vb wait">⏳ Waiting for customer to pay GH₵ ${f(total(o))}</div>`;
}
function custList(q) {
  const m = {};
  allOrders.forEach(o => {
    const k = o.uid || o.email; if (!k) return;
    const c = m[k] || (m[k] = { name: o.name, phone: o.phone, email: o.email, n: 0, spent: 0, last: o });
    c.n++;
    if (o.status == "Completed") c.spent += total(o);
  });
  custCache = Object.values(m)
    .filter(c => !q || [c.name, c.phone, c.email].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.n - a.n);
  if (!custCache.length) return '<p style="text-align:center;color:#888;margin-top:30px">No customers yet. Customers appear here after their first order.</p>';
  return `<small>${custCache.length} customer(s) who have placed orders</small>` + custCache.map((c, i) => `<div class="card">
    <b>👤 ${esc(c.name || '—')}</b><br>
    <small>${esc(c.phone)} · ${esc(c.email)}<br>${c.n} order(s) · GH₵ ${f(c.spent)} completed<br>Last order: ${dt(c.last)}</small>
    <div><button class="btn sm o" onclick="waPhone(${i})">💬 WhatsApp</button><button class="btn sm o" onclick="custOrders(${i})">📋 Orders</button></div>
  </div>`).join('');
}
function waPhone(i) { const c = custCache[i]; if (c) window.open("https://wa.me/" + waNum(c.phone), "_blank") }
function custOrders(i) { const c = custCache[i]; if (!c) return; $('asearch').value = c.email || c.phone || ''; atab = "All"; adminList() }
function adminList() {
  const today = new Date().toDateString();
  const isToday = o => o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toDateString() == today : true;
  const done = allOrders.filter(o => o.status == "Completed");
  const stat = (l, v) => `<div class="card"><small>${l}</small><div class="big" style="font-size:19px">${v}</div></div>`;
  $('astat').innerHTML = '<div class="two">' +
    stat("Today", allOrders.filter(isToday).length) +
    stat("Needs action", allOrders.filter(need).length) +
    stat("Pending", allOrders.filter(o => o.status == "Pending").length) +
    stat("Completed", done.length) +
    stat("GH₵ received", f(done.reduce((a, o) => a + total(o), 0))) +
    stat("Yuan sent", "¥ " + f(done.reduce((a, o) => a + +o.cny, 0))) + '</div>';
  $('atabs').innerHTML = ATABS.map(t => `<b class="${t == atab ? 'a' : ''}" onclick="setATab('${t}')">${t}</b>`).join('');
  const q = ($('asearch').value || '').toLowerCase().trim();
  if (atab == "Customers") { $('aol').innerHTML = custList(q); return }
  const l = allOrders.filter(o => TF[atab](o) &&
    (!q || [o.name, o.phone, o.email, o.orderId, o.recvName, o.recvCN, o.customerRef].join(' ').toLowerCase().includes(q)));
  $('aol').innerHTML = l.length ? l.map(o => {
    const bad = Math.abs((+o.cny) - (+o.ghs) * (+o.rate)) > 0.011;
    return `<div class="card">
    <div class="row"><b style="font-size:20px">¥ ${f(o.cny)}</b><span class="tag ${o.status}">${o.status}</span></div>
    ${payBadge(o)}
    ${bad ? '<div class="vb bad">⚠️ Yuan amount does not match the rate. Do not complete this order.</div>' : ''}
    <small>GH₵ ${f(o.ghs)}${+o.fee > 0 ? ' + fee ' + f(o.fee) : ''} = <b>GH₵ ${f(total(o))}</b> · 1 GHS = ${rateOf(o)} CNY<br>Pay method: ${esc(o.method)}</small>
    <div class="rbox">
      <small>Send Yuan to</small><br><b>${esc(o.recvType || '—')}</b><br>
      Name: <b>${esc(o.recvName || '—')}</b>
      ${o.recvCN ? `<br>Chinese name: <b>${esc(o.recvCN)}</b>` : ''}
      <br>Account: <b>${esc(o.recvAcct || '—')}</b>
      ${o.recvBank ? `<br>Bank: <b>${esc(o.recvBank)}</b>` : ''}
      ${o.recvBranch ? `<br>Branch / city: <b>${esc(o.recvBranch)}</b>` : ''}
      ${o.hasQR ? `<br>QR code: <b>attached</b>` : ''}
      <div><button class="btn sm o" onclick="copyField('${o.id}','recvName')">Copy name</button>${o.recvCN ? `<button class="btn sm o" onclick="copyField('${o.id}','recvCN')">Copy Chinese name</button>` : ''}<button class="btn sm o" onclick="copyField('${o.id}','recvAcct')">Copy account</button>${o.hasQR ? `<button class="btn sm" onclick="viewQR('${o.id}')">🔳 View QR</button>` : ''}</div>
    </div>
    <small>👤 ${esc(o.name)} · ${esc(o.phone)}<br>${esc(o.email)}<br>${esc(o.orderId)}<br>${dt(o)}</small>
    ${o.cancelReason ? `<div class="note">Reason: ${esc(o.cancelReason)}</div>` : ''}
    ${o.note ? `<div class="note">📝 ${esc(o.note)}</div>` : ''}
    <div>
      <button class="btn sm o" onclick="waCust('${o.id}')">💬 WhatsApp</button>
      <button class="btn sm o" onclick="addNote('${o.id}')">📝 Note</button>
      ${o.status == "Pending" && ps(o) != "Paid" ? `<button class="btn sm" onclick="confirmPay('${o.id}')">💰 Confirm payment</button>` : ''}
      ${o.status == "Pending" && ps(o) == "Paid" ? `<button class="btn sm" onclick="completeOrder('${o.id}')">✔ Complete</button>` : ''}
      ${o.status == "Pending" ? `<button class="btn sm red" onclick="adminCancel('${o.id}')">✖ Cancel</button>` : ''}
      ${o.status == "Cancelled" && ps(o) == "Refund due" ? `<button class="btn sm" onclick="markRefunded('${o.id}')">Mark refunded</button>` : ''}
    </div>
  </div>`}).join('') : '<p style="text-align:center;color:#888;margin-top:30px">No orders</p>';
}
const findAll = id => allOrders.find(x => x.id == id);
async function confirmPay(id) {
  const o = findAll(id); if (!o) return;
  if (!confirm('Confirm you received GH₵ ' + f(total(o)) + ' from ' + (o.name || 'this customer') + '?')) return;
  try { await adminSet(id, { payStatus: 'Paid', paid: true, lastEvent: 'Payment confirmed. We are sending your Yuan.' }); toast('Payment confirmed') } catch (x) { err(x) }
}
async function completeOrder(id) {
  const o = findAll(id); if (!o) return;
  if (ps(o) != 'Paid') return alert('Confirm the payment first.');
  if (!confirm('Have you already sent ¥ ' + f(o.cny) + ' to ' + o.recvName + ' (' + o.recvType + ' ' + o.recvAcct + ')?')) return;
  try { await adminSet(id, { status: 'Completed', lastEvent: 'Order completed. ¥ ' + f(o.cny) + ' sent to your ' + o.recvType + '.' }); toast('Order completed') } catch (x) { err(x) }
}
async function adminCancel(id) {
  const o = findAll(id); if (!o) return;
  const r = prompt('Reason for cancelling (optional):', '');
  if (r === null) return;
  const refund = ps(o) == 'Paid';
  const reason = r.trim();
  try {
    await adminSet(id, {
      status: 'Cancelled', cancelReason: reason, payStatus: refund ? 'Refund due' : ps(o),
      lastEvent: 'Order cancelled' + (reason ? ': ' + reason : '') + (refund ? '. Your refund will be processed.' : '')
    });
    toast('Order cancelled');
  } catch (x) { err(x) }
}
async function markRefunded(id) {
  if (!confirm('Mark this order as refunded?')) return;
  try { await adminSet(id, { payStatus: 'Refunded', lastEvent: 'Your refund has been sent.' }); toast('Marked refunded') } catch (x) { err(x) }
}
function copyField(id, k) {
  const o = findAll(id); if (!o) return;
  const t = o[k] || '';
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('Copied: ' + t)).catch(() => prompt('Copy this:', t));
  else prompt('Copy this:', t);
}
function waCust(id) {
  const o = findAll(id); if (!o) return;
  const msg = encodeURIComponent("Hello " + (o.name || "") + ", this is CediToYuan about your order " + o.orderId + ".");
  window.open("https://wa.me/" + waNum(o.phone) + "?text=" + msg, "_blank");
}
async function addNote(id) {
  const o = findAll(id); if (!o) return;
  const n = prompt('Private note for this order:', o.note || '');
  if (n === null) return;
  try { await adminSet(id, { note: n.trim() }, false); toast('Note saved') } catch (x) { err(x) }
}
function exportCsv() {
  const rows = [["Date and time","Order ID","Name","Phone","Email","GHS","Fee","Rate (CNY per GHS)","CNY","Pay method","Payment status","Status","Recipient type","Recipient name","Recipient Chinese name","Recipient account","Bank","Branch / city","QR attached","Customer ref"]];
  allOrders.forEach(o => rows.push([dt(o), o.orderId, o.name, o.phone, o.email, o.ghs, o.fee, rateOf(o), o.cny, o.method, o.payStatus || '', o.status, o.recvType || '', o.recvName || '', o.recvCN || '', o.recvAcct || '', o.recvBank || '', o.recvBranch || '', o.hasQR ? 'Yes' : 'No', o.customerRef || '']));
  const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(",")).join("\n");
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = "cediToyuan-orders.csv";
  document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- START ---------- */
$('chips').innerHTML = [200, 500, 1000, 2000, 5000].map(v => `<div class="chip" onclick="setAmt(${v})">GH₵ ${v}</div>`).join('') +
  `<div class="chip" onclick="$('amt').value='';$('amt').focus()">Other</div>`;
pms();
slideShow();
hidePw();
applyTheme();
try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme) } catch (e) { }
setInterval(() => { if (cur == 'home') tickClock() }, 1000);

Object.assign(window, {
  $, toast, go, back, goHome, navTo, openDrawer, closeDrawer, drawerGo, eye, nextSlide, shareApp,
  cycleTheme, quickTheme,
  reg, login, google, forgot, logout, resend, refreshVerify,
  home, qcalc, buyFromQuick, dismissHow, calc, setAmt, toRecipient, setRT, toSummary, setMethod, placeOrder,
  qrPicked, qrRemove, viewQR, qrClose,
  setTab, openOrder, iPaid, custCancel, accGo, savePersonal, sendReset,
  saveCfg, sendAnn, clearAnn, setATab, adminList, copyField, waCust, waPhone, custOrders, addNote,
  confirmPay, completeOrder, adminCancel, markRefunded, exportCsv
});

let first = true;
watchUser(u => {
  me = u; startData();
  if (u) loadProfile();
  if (first) { first = false; show(u ? 'home' : 'splash') }
  else if (!u && !['splash', 'onb', 'login', 'reg', 'terms'].includes(cur)) show('login');
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');