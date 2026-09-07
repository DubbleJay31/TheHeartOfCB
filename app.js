/* ═══════════════════════════════════════
   THE HEART OF CB — app.js
═══════════════════════════════════════ */

/* ─── EMAIL CONFIG ─────────────────────
   All emails send via Resend through /.netlify/functions/send-email.
   See _sendEmail() below.
   5. Set EMAILJS_ENABLED = true
─────────────────────────────────────────── */
// All emails now sent via Resend through /.netlify/functions/send-email
async function _sendEmail(to, subject, html) {
  try {
    await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: Array.isArray(to) ? to : [to], subject, html })
    });
  } catch(e) { console.error('Email send failed:', e); }
}

// ── CLOUD SYNC ──
const _JBIN_KEY = '$2a$10$44pjBF4oAPLF1c9iSHD9SefHfQqHCxErviZcxGGUokZmecqZqX7sq';
const _JBIN_BIN = '6a421d5af5f4af5e29401948';

async function _pushInquiryToCloud(inquiry) {
  try {
    // Read current cloud data
    const r = await fetch(`https://api.jsonbin.io/v3/b/${_JBIN_BIN}/latest`, {
      headers: { 'X-Master-Key': _JBIN_KEY, 'X-Bin-Meta': 'false' }
    });
    const data = r.ok ? await r.json() : { quotes: [], inquiries: [] };
    const inquiries = data.inquiries || [];
    const isDup = inquiries.some(e => e.email === inquiry.email && e.ci === inquiry.ci);
    if (!isDup) {
      inquiries.unshift(inquiry);
      await fetch(`https://api.jsonbin.io/v3/b/${_JBIN_BIN}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': _JBIN_KEY },
        body: JSON.stringify({ quotes: data.quotes || [], inquiries: inquiries.slice(0, 50), pricing: data.pricing })
      });
    }
  } catch(e) { console.warn('Cloud inquiry push failed:', e); }
}

async function _sendGuestConfirmation(inquiry) {
  if (!inquiry.email) return;
  const fmtD = s => { try { return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}); } catch { return s; } };
  const firstName = inquiry.first || inquiry.name || 'there';
  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f8f6f0;margin:0;padding:20px;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#0a1f3a;padding:24px;text-align:center;">
    <img src="https://theheartofcb.com/THOCB%20Pin%20Square.png" width="56" height="56" alt="" style="display:block;margin:0 auto 10px;border-radius:50%;" />
    <h1 style="color:#c9a84c;font-size:1.2rem;margin:0;font-family:Georgia,serif;">Inquiry Received!</h1>
    <p style="color:#c9a84c;margin:.3rem 0 0;font-size:.85rem;">The Heart Of CB · Carolina Beach, NC</p>
  </div>
  <div style="padding:28px 32px;color:#374151;font-size:.97rem;line-height:1.6;">
    <p>Hi ${firstName},</p>
    <p>Thanks for reaching out! We received your inquiry and will get back to you shortly with pricing and availability.</p>
    <div style="background:#f8f6f0;border-radius:8px;padding:16px;margin:16px 0;font-size:.93rem;">
      ${inquiry.propLabel || inquiry.prop ? `<div style="margin-bottom:7px;"><strong>Property:</strong> ${inquiry.propLabel || inquiry.prop}</div>` : ''}
      ${inquiry.ci ? `<div style="margin-bottom:7px;"><strong>Check-in:</strong> ${fmtD(inquiry.ci)}</div>` : ''}
      ${inquiry.co ? `<div style="margin-bottom:7px;"><strong>Check-out:</strong> ${fmtD(inquiry.co)}</div>` : ''}
      ${inquiry.guests ? `<div><strong>Guests:</strong> ${inquiry.guests}</div>` : ''}
    </div>
    <p>Feel free to browse the property at <a href="https://theheartofcb.com" style="color:#b8882a;">theheartofcb.com</a>.</p>
    <p>📞 Jesse: <a href="tel:9105998118" style="color:#b8882a;">(910) 599-8118</a><br>
    📧 <a href="mailto:stay@theheartofcb.com" style="color:#b8882a;">stay@theheartofcb.com</a></p>
    <p>Talk soon!<br><strong>Jesse</strong><br><em>The Heart Of CB</em></p>
  </div>
</div></body></html>`;
  await _sendEmail(inquiry.email, `We got your inquiry — The Heart Of CB`, html);
}

async function _notifyHost(inquiry) {
  try {
    const fmtD = s => { try { return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}); } catch { return s; } };
    const inqCode = btoa(unescape(encodeURIComponent(JSON.stringify(inquiry))));
    const adminUrl = 'https://theheartofcb.com/admin.html#inq=' + inqCode;
    const guestName = [inquiry.first, inquiry.last].filter(Boolean).join(' ');
    const html = `<div style="font-family:Georgia,serif;background:#f5f0e8;padding:24px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#0a1f3a;padding:20px 32px;text-align:center;">
      <div style="color:#b8882a;font-size:18px;font-weight:700;letter-spacing:.06em;">NEW BOOKING INQUIRY</div>
      <div style="color:#c8b99a;font-size:12px;margin-top:2px;">The Heart of CB</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0a1f3a;">📨 ${guestName} wants to book the ${inquiry.propLabel || inquiry.prop}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
        <tr><td style="padding:5px 0;color:#666;width:110px;">Guest</td><td style="color:#0a1f3a;font-weight:600;">${guestName}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Email</td><td><a href="mailto:${inquiry.email}" style="color:#b8882a;">${inquiry.email}</a></td></tr>
        ${inquiry.phone ? `<tr><td style="padding:5px 0;color:#666;">Phone</td><td style="color:#0a1f3a;">${inquiry.phone}</td></tr>` : ''}
        <tr><td style="padding:5px 0;color:#666;">Property</td><td style="color:#0a1f3a;">${inquiry.propLabel || inquiry.prop}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Check-In</td><td style="color:#0a1f3a;">${fmtD(inquiry.ci)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Check-Out</td><td style="color:#0a1f3a;">${fmtD(inquiry.co)}</td></tr>
        ${inquiry.guests ? `<tr><td style="padding:5px 0;color:#666;">Guests</td><td style="color:#0a1f3a;">${inquiry.guests}</td></tr>` : ''}
        ${inquiry.pets ? `<tr><td style="padding:5px 0;color:#666;">Pets</td><td style="color:#0a1f3a;">${inquiry.pets}</td></tr>` : ''}
        ${inquiry.message ? `<tr><td style="padding:5px 0;color:#666;vertical-align:top;">Message</td><td style="color:#0a1f3a;font-style:italic;">"${inquiry.message}"</td></tr>` : ''}
      </table>
      <div style="text-align:center;">
        <a href="${adminUrl}" style="display:inline-block;background:#b8882a;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 28px;border-radius:7px;">Open in Admin &amp; Generate Quote</a>
      </div>
    </div>
  </div>
</div>`;
    await _sendEmail('jessejonesrealestate@gmail.com', `New Inquiry: ${guestName} · ${inquiry.propLabel || inquiry.prop}`, html);
  } catch(err) {
    console.error('Host notification email failed:', err);
  }
}

/* ─── ICAL CONFIG ───────────────────────
   Paste your Airbnb iCal export URLs below.
   In Airbnb: Hosting → Calendar → Export → Copy link
─────────────────────────────────────────── */
const ICAL_URLS = {
  prop1: '/ical/32953785.ics?t=c8f87f72bb3a4e309161f5e8f291b3be',
  prop2: '/ical/898555047779275870.ics?t=c5a9ef08bc2349a19f0116b4032e3685',
  prop3: '/ical/663216324333577458.ics?t=bac5f2a4139d45759dbefc259bd69378',
};

// ─── ICAL ENGINE ───
const _calCache  = {};
let _calProp     = 'prop1';
let _selStart      = null;
let _selEnd        = null;
let _calToday      = null;
let _attestedRules = false;
const _visitedTabs = new Set();
let _lastPropCalOffset = 0;
const _calInst   = {}; // wrapId → { prop, wrap, sentinel, observer, months, startOffset }

async function _fetchICS(url) {
  if (!url) return [];
  try {
    const r = await fetch(url);
    const txt = await r.text();
    return _parseICS(txt);
  } catch(e) { return []; }
}

function _parseICS(txt) {
  const ranges = [];
  txt.split('BEGIN:VEVENT').slice(1).forEach(blk => {
    const sm = blk.match(/DTSTART[^:]*:(\d{8})/);
    const em = blk.match(/DTEND[^:]*:(\d{8})/);
    if (sm && em) ranges.push({ s: _icsD(sm[1]), e: _icsD(em[1]) });
  });
  return ranges;
}

function _icsD(s) {
  return new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
}

// Always parse date strings in LOCAL time to avoid timezone off-by-one
function _keyToDate(key) {
  const p = key.split('-');
  return new Date(+p[0], +p[1]-1, +p[2]);
}

function _isBooked(d, ranges) {
  return ranges.some(r => d >= r.s && d < r.e);
}

function _dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ─── PRICE ESTIMATOR ───
const _RATES = {
  prop1: { wd: [100,120,140,180,210,300,350,280,190,160,140,120], we: [140,150,180,270,350,480,500,450,300,250,180,180] },
  prop2: { wd: [80,80,100,100,120,160,180,140,120,100,80,90],     we: [100,100,120,160,190,230,260,230,170,140,120,100] },
  prop3: { wd: [80,80,100,100,120,160,180,140,120,100,80,90],     we: [100,100,120,160,190,230,260,230,170,140,120,100] },
};
// Overrides loaded from cloud at page load (key = 'YYYY-MM-DD', value = nightly rate)
let _overrides     = { prop1:{}, prop2:{}, prop3:{} };
let _restrictions  = { prop1:{}, prop2:{}, prop3:{} }; // {minNights,noCheckIn,noCheckOut}

// Fetch pricing from cloud and apply — called once at page load
(async function _loadPricing() {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${_JBIN_BIN}/latest`, {
      headers: { 'X-Master-Key': _JBIN_KEY, 'X-Bin-Meta': 'false' }
    });
    if (!r.ok) return;
    const data = await r.json();
    if (!data || !data.pricing) return;
    const p = data.pricing;
    ['prop1','prop2','prop3'].forEach(prop => {
      if (p.baseRates && p.baseRates[prop]) {
        if (p.baseRates[prop].wd) _RATES[prop].wd = p.baseRates[prop].wd;
        if (p.baseRates[prop].we) _RATES[prop].we = p.baseRates[prop].we;
      }
      if (p.overrides     && p.overrides[prop])     _overrides[prop]    = p.overrides[prop];
      if (p.restrictions && p.restrictions[prop]) _restrictions[prop] = p.restrictions[prop];
    });
  } catch(e) { /* silently fall back to hardcoded rates */ }
})();

// Weekend = Friday night, Saturday night
// + Sunday of Memorial Day / Labor Day weekends, and Sunday July 3 when July 4 is Monday
function _isWeekendNight(d) {
  const dow = d.getDay();
  if (dow === 5 || dow === 6) return true;
  if (dow !== 0) return false;
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if (m === 4) {
    const lastDay = new Date(y, 5, 0).getDate();
    const lastMon = lastDay - ((new Date(y, 4, lastDay).getDay() + 6) % 7);
    if (day === lastMon - 1) return true;
  }
  if (m === 6 && day === 3 && new Date(y, 6, 4).getDay() === 1) return true;
  if (m === 8) {
    const firstDow = new Date(y, 8, 1).getDay();
    const firstMon = 1 + ((8 - firstDow) % 7);
    if (day === firstMon - 1) return true;
  }
  return false;
}

function _calcEstimate(start, end, prop) {
  const p   = _RATES[prop] || _RATES.prop1;
  const ov  = _overrides[prop] || {};
  let subtotal = 0, nights = 0;
  const cur = new Date(start);
  while (cur < end) {
    const dk = cur.toISOString().slice(0,10);
    subtotal += ov[dk] !== undefined
      ? ov[dk]
      : (_isWeekendNight(cur) ? p.we[cur.getMonth()] : p.wd[cur.getMonth()]);
    nights++;
    cur.setDate(cur.getDate() + 1);
  }
  const salesTax = Math.round(subtotal * 0.07);
  const occTax   = Math.round(subtotal * 0.06);
  const preTax   = subtotal + salesTax + occTax;
  const ccFee    = Math.round(preTax * 0.03);
  const total    = preTax + ccFee;
  return { nights, subtotal, salesTax, occTax, ccFee, preTax, total };
}

function _showBookingBar(start, end) {
  const bar = document.getElementById('booking-bar');
  if (!bar) return;
  const est = _calcEstimate(start, end, _calProp);
  const propNames = { prop1: 'Front Home', prop2: 'Left Suite', prop3: 'Right Suite' };
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  document.getElementById('bb-dates').innerHTML =
    `<strong>${fmt(start)}</strong> – <strong>${fmt(end)}</strong> · ${est.nights} night${est.nights>1?'s':''} · ${propNames[_calProp]}`;

  const avgNightly = Math.round(est.subtotal / est.nights);
  document.getElementById('bb-price').innerHTML =
    `<div class="bb-price-compact"><div class="bb-price-main">~$${avgNightly}<span class="bb-per-night">/night +tax</span></div><span class="bb-price-total-est">est. $${est.total} total</span></div>`;
  const hiddenEst = document.getElementById('form-est-total');
  if (hiddenEst) hiddenEst.value = `~$${est.total} total ($${avgNightly}/night avg, ${est.nights} nights)`;
  // Store for inquiry auto-fill in admin
  window._lastAvgNightly = avgNightly;

  _updateBbBtn();
  bar.style.display = 'block';
}

function _updateBbBtn() {
  const btn = document.querySelector('.bb-btn');
  if (!btn) return;
  if (_attestedRules) {
    btn.textContent = 'Request to Book →';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.cursor = '';
    btn.style.opacity = '';
  } else {
    btn.textContent = 'Agree to House Rules to Book →';
    btn.style.background = '#6b7280';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.opacity = '1';
  }
}

function _hideBookingBar() {
  const bar = document.getElementById('booking-bar');
  if (bar) bar.style.display = 'none';
  document.querySelectorAll('.cal-wrap').forEach(w => w.classList.remove('cal-choosing-checkout'));
}
function _bbToggleMin() {
  document.getElementById('booking-bar')?.classList.toggle('bb-min');
}

// ─── MULTI-INSTANCE CALENDAR ───

async function renderCalInto(prop, wrapId, startOffset) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;

  if (!_calToday) { _calToday = new Date(); _calToday.setHours(0,0,0,0); }

  // Disconnect any existing observer for this wrap
  if (_calInst[wrapId]?.observer) _calInst[wrapId].observer.disconnect();

  wrap.innerHTML = '<div class="cal-loading" style="padding:2rem;text-align:center;color:#888">⏳ Loading availability…</div>';
  wrap.dataset.prop = prop;

  const inst = { prop, wrap, sentinel: null, observer: null, months: 0, startOffset: startOffset || 0 };
  _calInst[wrapId] = inst;

  if (!_calCache[prop]) {
    _calCache[prop] = await _fetchICS(ICAL_URLS[prop]);
  }

  // Guard: instance may have been replaced if user navigated away quickly
  if (_calInst[wrapId] !== inst) return;

  wrap.innerHTML = '';

  _appendInstMonths(wrapId, 4);
  _refreshAllWrapStyles();

  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  wrap.appendChild(sentinel);
  inst.sentinel = sentinel;

  inst.observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      _appendInstMonths(wrapId, 2);
      _refreshAllWrapStyles();
    }
  }, { rootMargin: '300px' });
  inst.observer.observe(sentinel);
}

function _appendInstMonths(wrapId, count) {
  const inst = _calInst[wrapId];
  if (!inst) return;
  const today = _calToday || new Date();
  for (let i = 0; i < count; i++) {
    const monthOffset = inst.startOffset + inst.months;
    const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    inst.months++;
    const el = _buildMonthEl(first, inst.prop, wrapId);
    if (inst.sentinel && inst.sentinel.parentNode === inst.wrap) {
      inst.wrap.insertBefore(el, inst.sentinel);
    } else {
      inst.wrap.appendChild(el);
    }
  }
}

function _buildMonthEl(first, prop, wrapId) {
  const today  = _calToday;
  const ranges = _calCache[prop] || [];
  const hasIcal = !!ICAL_URLS[prop];
  const y = first.getFullYear(), mo = first.getMonth();
  const label   = first.toLocaleString('default', { month: 'long' });
  const days    = new Date(y, mo+1, 0).getDate();
  const startDow = first.getDay();

  // Show property label on every month when rendered in the 3-col stay grid
  const propLabels = { prop1: 'Front Home', prop2: 'Left Suite', prop3: 'Right Suite' };
  const isStayCal = wrapId.startsWith('stay-cal-wrap');
  const propBadge = isStayCal
    ? `<span class="cal-month-prop-badge">${propLabels[prop]}</span>`
    : '';

  const div = document.createElement('div');
  div.className = 'cal-month';

  let html = `<div class="cal-month-hd">${propBadge}${label} ${y}</div><div class="cal-grid">`;
  const isStay = wrapId && wrapId.startsWith('stay-cal-wrap');
  const dowHds = isStay ? ['S','M','T','W','T','F','S'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
  dowHds.forEach(h => { html += `<div class="cal-day-header">${h}</div>`; });
  for (let i = 0; i < startDow; i++) html += '<div class="cal-day cal-empty"></div>';

  for (let d = 1; d <= days; d++) {
    const dt  = new Date(y, mo, d);
    const key = _dateKey(dt);
    let state = 'avail';
    if (dt < today)                            state = 'past';
    else if (hasIcal && _isBooked(dt, ranges)) state = 'booked';
    else if (hasIcal && _isOrphanCheckIn(dt, ranges)) state = 'orphan';

    // Detect prewall: 1 free night before next booking (not orphan)
    let extraCls = '';
    if (state === 'avail' && hasIcal) {
      const nxt = new Date(dt); nxt.setDate(nxt.getDate() + 1);
      const prv = new Date(dt); prv.setDate(prv.getDate() - 1);
      if (_isBooked(nxt, ranges) && !_isBooked(prv, ranges)) extraCls = ' cal-prewall';
    }

    const clickable = state !== 'past' ? `onclick="_dayClick('${key}','${prop}','${wrapId}')"` : '';
    const satCls = dt.getDay() === 6 ? ' cal-saturday' : '';
    // Saturday tooltip takes priority (can still be clickable if orphan, but warn about SAT)
    const tipAttr = state === 'orphan' ? ' data-tip="1-night exception"'
      : (satCls && state !== 'past' && state !== 'booked') ? ' data-tip="No SAT Check In/Out"'
      : extraCls === ' cal-prewall' ? ' data-tip="Only 1 night free · check in earlier"'
      : '';
    html += `<div class="cal-day cal-${state}${satCls}${extraCls}" data-date="${key}"${tipAttr} ${clickable}>` +
      `<span class="cal-num">${d}</span><span class="cal-dot-sm"></span></div>`;
  }

  html += '</div>';
  div.innerHTML = html;
  return div;
}

function _dayClick(key, prop, wrapId) {
  _calProp = prop;
  const ranges = _calCache[prop] || [];
  const dt = _keyToDate(key);
  const isSat = dt.getDay() === 6;
  const isBooked = _isBooked(dt, ranges);

  const isOrphan = _isOrphanCheckIn(dt, ranges);
  if (!_selStart || (_selStart && _selEnd)) {
    if (isSat && !isOrphan) {
      _showCalError('Saturday check-in is not available — please choose a different day.');
      return;
    }
    if (isBooked) {
      _showCalError('That date is already booked. Pick an available (green) date to check in.');
      return;
    }
    // Prewall: next night already booked, only 1 free night — violates 2-night min (unless orphan)
    const nxtCI = new Date(dt); nxtCI.setDate(nxtCI.getDate() + 1);
    const prvCI = new Date(dt); prvCI.setDate(prvCI.getDate() - 1);
    if (_isBooked(nxtCI, ranges) && !_isBooked(prvCI, ranges)) {
      _showCalError('Only 1 free night before the next booking — please choose an earlier check-in date.');
      return;
    }
    _selStart = dt; _selEnd = null;
    _clearCalError();
    _hideBookingBar();
    document.querySelectorAll('.cal-wrap').forEach(w => w.classList.remove('cal-choosing-checkout'));
    document.getElementById(wrapId)?.classList.add('cal-choosing-checkout');
    _refreshAllWrapStyles();
    return;
  }

  if (_dateKey(dt) === _dateKey(_selStart)) {
    _selStart = null; _selEnd = null;
    _clearCalError(); _hideBookingBar();
    _refreshAllWrapStyles();
    return;
  }
  if (dt <= _selStart) {
    if ((!isSat || isOrphan) && !isBooked) {
      const nxtR = new Date(dt); nxtR.setDate(nxtR.getDate() + 1);
      const prvR = new Date(dt); prvR.setDate(prvR.getDate() - 1);
      if (_isBooked(nxtR, ranges) && !_isBooked(prvR, ranges)) {
        _showCalError('Only 1 free night before the next booking — please choose an earlier check-in date.');
        _refreshAllWrapStyles();
        return;
      }
      _selStart = dt; _selEnd = null;
      _clearCalError(); _hideBookingBar();
      document.querySelectorAll('.cal-wrap').forEach(w => w.classList.remove('cal-choosing-checkout'));
      document.getElementById(wrapId)?.classList.add('cal-choosing-checkout');
    } else {
      _showCalError('Please click a later date for check-out, or start over.');
    }
    _refreshAllWrapStyles();
    return;
  }
  const nights = Math.round((dt - _selStart) / 86400000);
  if (isSat && !(nights === 1 && _isOrphanCheckIn(_selStart, ranges))) {
    _showCalError('Saturday check-out is not available — please choose a different day.');
    return;
  }
  if (nights < 2 && !_isOrphanCheckIn(_selStart, ranges)) {
    _showCalError('Minimum stay is 2 nights — please select a later check-out date.');
    return;
  }
  // Check if this day is blocked for checkout
  const allDays = document.querySelectorAll(`.cal-wrap[data-prop="${prop}"] .cal-day[data-date="${key}"]`);
  for (const el of allDays) {
    if (el.classList.contains('cal-checkout-blocked')) return;
  }
  let cur = new Date(_selStart); cur.setDate(cur.getDate() + 1);
  let conflict = false;
  while (cur < dt) {
    if (_isBooked(cur, ranges)) { conflict = true; break; }
    cur.setDate(cur.getDate() + 1);
  }
  if (conflict) {
    _showCalError('That range includes booked nights. Please pick a new check-in date to start over.');
    _selStart = null; _selEnd = null;
    _refreshAllWrapStyles();
    return;
  }
  _selEnd = dt;
  _clearCalError();
  document.querySelectorAll('.cal-wrap').forEach(w => w.classList.remove('cal-choosing-checkout'));
  _fillFormDates(_selStart, _selEnd);
  _refreshAllWrapStyles();
}

function _isOrphanCheckIn(dt, ranges) {
  const prev = new Date(dt); prev.setDate(prev.getDate() - 1);
  const next = new Date(dt); next.setDate(next.getDate() + 1);
  return _isBooked(prev, ranges) && _isBooked(next, ranges);
}

function _refreshAllWrapStyles() {
  document.querySelectorAll('.cal-wrap[data-prop]').forEach(wrap => {
    _refreshWrapStyles(wrap);
  });
  if (_calView === 'timeline') _refreshTimeline();
}

function _tlDayClick(dateKey, propId) {
  const ranges = _calCache[propId] || [];
  const dt = _keyToDate(dateKey);
  const isSat = dt.getDay() === 6;
  const isBooked = _isBooked(dt, ranges);
  const isOrphan = _isOrphanCheckIn(dt, ranges);

  if (!_selStart || (_selStart && _selEnd)) {
    if (isSat && !isOrphan) { _showCalError('Saturday check-in is not available — please choose a different day.'); return; }
    if (isBooked) { _showCalError('That date is already booked. Pick an available date to check in.'); return; }
    const nxt = new Date(dt); nxt.setDate(nxt.getDate() + 1);
    const prv = new Date(dt); prv.setDate(prv.getDate() - 1);
    if (!isOrphan && _isBooked(nxt, ranges) && !_isBooked(prv, ranges)) {
      _showCalError('Only 1 free night before the next booking — please choose an earlier check-in date.'); return;
    }
    _selStart = dt; _selEnd = null; _calProp = propId;
    _clearCalError();
    document.querySelectorAll('.cal-wrap').forEach(w => w.classList.remove('cal-choosing-checkout'));
    _refreshAllWrapStyles(); return;
  }
  if (_dateKey(dt) === _dateKey(_selStart)) {
    _selStart = null; _selEnd = null; _clearCalError(); _hideBookingBar();
    _refreshAllWrapStyles(); return;
  }
  if (dt <= _selStart) {
    if ((!isSat || isOrphan) && !isBooked) {
      const nxt = new Date(dt); nxt.setDate(nxt.getDate() + 1);
      const prv = new Date(dt); prv.setDate(prv.getDate() - 1);
      if (_isBooked(nxt, ranges) && !_isBooked(prv, ranges)) {
        _showCalError('Only 1 free night before the next booking — please choose an earlier check-in date.');
        _refreshAllWrapStyles(); return;
      }
      _selStart = dt; _selEnd = null; _calProp = propId; _clearCalError();
      _refreshAllWrapStyles();
    } else { _showCalError('Please click a later date for check-out, or start over.'); _refreshAllWrapStyles(); }
    return;
  }
  const nights = Math.round((dt - _selStart) / 86400000);
  if (isSat && !(nights === 1 && isOrphan)) { _showCalError('Saturday check-out is not available — please choose a different day.'); return; }
  if (nights < 2 && !_isOrphanCheckIn(_selStart, ranges)) { _showCalError('Minimum stay is 2 nights — please select a later check-out date.'); return; }
  // Check for booked nights in range
  const scan = new Date(_selStart); scan.setDate(scan.getDate() + 1);
  while (scan < dt) {
    if (_isBooked(scan, ranges)) { _showCalError('That range includes booked nights. Please pick a new check-in date to start over.'); _selStart = null; _selEnd = null; _refreshAllWrapStyles(); return; }
    scan.setDate(scan.getDate() + 1);
  }
  _selEnd = dt;
  document.querySelectorAll('.cal-wrap').forEach(w => w.classList.remove('cal-choosing-checkout'));
  _fillFormDates(_selStart, _selEnd);
  _refreshAllWrapStyles();
}

function _refreshTimeline() {
  const wrap = document.getElementById('stay-timeline');
  if (!wrap) return;
  const choosing = _selStart && !_selEnd;

  // Precompute firstWall per prop (same logic as _refreshWrapStyles)
  const firstWalls = {};
  if (choosing) {
    ['prop1','prop2','prop3'].forEach(pid => {
      const ranges = _calCache[pid] || [];
      if (_calProp !== pid) return;
      const scan = new Date(_selStart); scan.setDate(scan.getDate() + 1);
      for (let i = 0; i < 365; i++) {
        if (_isBooked(scan, ranges)) { firstWalls[pid] = new Date(scan); break; }
        scan.setDate(scan.getDate() + 1);
      }
    });
  }

  wrap.querySelectorAll('.tl-cell[data-date][data-prop]').forEach(el => {
    if (el.classList.contains('tl-blocked-2min')) delete el.dataset.tip;
    el.classList.remove('tl-sel-start','tl-sel-end','tl-eligible','tl-blocked','tl-in-range','tl-blocked-2min');
    const key = el.dataset.date;
    const pid = el.dataset.prop;
    const dt = _keyToDate(key);
    const ranges = _calCache[pid] || [];
    const isChoosing = choosing && _calProp === pid;
    const isBooked = el.classList.contains('tl-c-booked');

    if (_selStart && _dateKey(_selStart) === key && _calProp === pid) { el.classList.add('tl-sel-start'); return; }
    if (_selEnd && _dateKey(_selEnd) === key && _calProp === pid) { el.classList.add('tl-sel-end'); return; }
    if (_selStart && _selEnd && _calProp === pid && dt > _selStart && dt < _selEnd) { el.classList.add('tl-in-range'); }

    if (!isChoosing) return;
    if (dt < _selStart) { el.classList.add('tl-blocked'); return; }
    const nights = Math.round((dt - _selStart) / 86400000);
    const fw = firstWalls[pid];
    if (nights === 1) {
      if (_isOrphanCheckIn(_selStart, ranges)) { el.classList.add('tl-eligible'); }
      else { el.classList.add('tl-blocked', 'tl-blocked-2min'); el.dataset.tip = '2-night minimum stay'; }
    } else if (fw && dt > fw) {
      el.classList.add('tl-blocked');
    } else if (dt.getDay() === 6) {
      el.classList.add('tl-blocked');
    } else {
      el.classList.add('tl-eligible');
    }
  });
}

function _refreshWrapStyles(wrap) {
  const prop = wrap.dataset.prop;
  if (!prop) return;
  const ranges = _calCache[prop] || [];
  const choosing = _selStart && !_selEnd && _calProp === prop;

  // Precompute the first booked wall night after check-in so we can grey
  // out ALL days beyond it (not just booked ones) in one efficient pass.
  let firstWall = null;
  if (choosing) {
    const scan = new Date(_selStart); scan.setDate(scan.getDate() + 1);
    for (let i = 0; i < 365; i++) {
      if (_isBooked(scan, ranges)) { firstWall = new Date(scan); break; }
      scan.setDate(scan.getDate() + 1);
    }
  }

  wrap.querySelectorAll('.cal-day[data-date]').forEach(el => {
    if (el.classList.contains('cal-blocked-2min')) delete el.dataset.tip;
    el.classList.remove('cal-sel-start','cal-sel-end','cal-in-range',
      'cal-checkout-eligible','cal-checkout-blocked','cal-one-night','cal-blocked-2min');
    const key = el.dataset.date;
    const dt  = _keyToDate(key);
    const isBooked = el.classList.contains('cal-booked');

    // Only show selection highlights for the active prop
    if (_calProp === prop) {
      if (_selStart && _dateKey(_selStart) === key) el.classList.add('cal-sel-start');
      else if (_selEnd && _dateKey(_selEnd) === key) el.classList.add('cal-sel-end');
      else if (_selStart && _selEnd && dt > _selStart && dt < _selEnd) el.classList.add('cal-in-range');
    }

    if (el.classList.contains('cal-past')) return;

    if (choosing) {
      if (_dateKey(dt) === _dateKey(_selStart)) return; // leave as cal-sel-start
      if (dt < _selStart) {
        el.classList.add('cal-checkout-blocked');
        return;
      }
      // dt > _selStart — determine if valid checkout
      const nights = Math.round((dt - _selStart) / 86400000);
      if (nights === 1) {
        if (_isOrphanCheckIn(_selStart, ranges)) { el.classList.add('cal-checkout-eligible'); }
        else { el.classList.add('cal-checkout-blocked', 'cal-blocked-2min'); el.dataset.tip = '2-night minimum stay'; }
      } else if (firstWall && dt > firstWall) {
        el.classList.add('cal-checkout-blocked');
      } else if (dt.getDay() === 6) {
        el.classList.add('cal-checkout-blocked'); // no Saturday checkout
      } else {
        el.classList.add('cal-checkout-eligible'); // valid — includes firstWall back-to-back
      }
    } else if (isBooked) {
      el.classList.add('cal-checkout-blocked');
    }
  });
}

function _getScrolledMonthOffset(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return 0;
  const months = wrap.querySelectorAll('.cal-month');
  for (let i = 0; i < months.length; i++) {
    const rect = months[i].getBoundingClientRect();
    if (rect.bottom > 150) return i;
  }
  return 0;
}

// ─── CALENDAR / TIMELINE TOGGLE ───
let _calView = 'timeline';

function _toggleCalView() {
  _setCalView(_calView === 'cal' ? 'timeline' : 'cal');
}

function _setCalView(mode, noScroll) {
  _calView = mode;
  const calGrid = document.getElementById('stay-cals-grid');
  const tlWrap  = document.getElementById('stay-timeline');
  const track   = document.getElementById('cal-toggle-track');
  if (track) track.classList.toggle('tl-active', mode === 'timeline');
  document.querySelectorAll('.cal-toggle-opt').forEach(b =>
    b.classList.toggle('active', b.dataset.view === mode));
  if (mode === 'timeline') {
    if (calGrid) calGrid.style.display = 'none';
    if (tlWrap)  {
      tlWrap.style.display = 'block'; _buildTimeline(); _initMobileTabs();
      document.body.classList.add('timeline-mode');
      if (!noScroll) setTimeout(() => {
        const offset = window.innerWidth <= 700 ? 200 : 440;
        const y = tlWrap.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 60);
    }
  } else {
    document.body.classList.remove('timeline-mode');
    tlWrap.style.top = '';
    document.body.classList.remove('timeline-mode');
    if (calGrid) calGrid.style.display = '';
    if (tlWrap)  tlWrap.style.display = 'none';
    _initMobileTabs();
  }
}

function _buildTimeline() {
  const wrap = document.getElementById('stay-timeline');
  if (!wrap) return;

  const today = _calToday || new Date();
  const N  = 120; // days to show
  const DW = 34;  // px per day column
  const LW = 115; // px for property label

  const props = [
    { id: 'prop1', name: 'Front Home',   rating: '4.98' },
    { id: 'prop2', name: 'Left Suite',  rating: '5.0'  },
    { id: 'prop3', name: 'Right Suite', rating: '5.0'  },
  ];
  const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // Build date array starting from today
  const dates = [];
  for (let i = 0; i < N; i++) {
    dates.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  }

  // Month header segments
  let monthSegs = [], curMo = -1, moCount = 0, moLabel = '';
  dates.forEach(d => {
    if (d.getMonth() !== curMo) {
      if (curMo !== -1) monthSegs.push({ label: moLabel, count: moCount });
      curMo = d.getMonth();
      moCount = 1;
      moLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else { moCount++; }
  });
  monthSegs.push({ label: moLabel, count: moCount });

  const mHtml = `<div class="tl-lbl" style="width:${LW}px;min-width:${LW}px"></div>` +
    monthSegs.map(s => `<div class="tl-mhd" style="width:${s.count * DW}px">${s.label}</div>`).join('');

  const dHtml = `<div class="tl-lbl" style="width:${LW}px;min-width:${LW}px"></div>` +
    dates.map(d => {
      const isToday = _dateKey(d) === _dateKey(today);
      const wkd = d.getDay() === 0 || d.getDay() === 6;
      return `<div class="tl-dhd${isToday?' tl-dhd-today':''}${wkd?' tl-dhd-wkd':''}" style="width:${DW}px;min-width:${DW}px">` +
        `<span>${DAY_NAMES[d.getDay()]}</span><strong>${d.getDate()}</strong></div>`;
    }).join('');

  const rowsHtml = props.map(p => {
    const ranges = _calCache[p.id] || [];
    const hasIcal = !!ICAL_URLS[p.id];
    const cells = dates.map((d, i) => {
      const past   = d < today;
      const booked = _isBooked(d, ranges);
      const orphan = !past && !booked && _isOrphanCheckIn(d, ranges);
      const isToday = _dateKey(d) === _dateKey(today);
      const wkd    = d.getDay() === 0 || d.getDay() === 6;
      // Prewall detection for timeline
      const isSat = d.getDay() === 6;
      let prewall = false;
      if (!past && !booked && !orphan && hasIcal) {
        const nxt = new Date(d); nxt.setDate(nxt.getDate() + 1);
        const prv = new Date(d); prv.setDate(prv.getDate() - 1);
        if (_isBooked(nxt, ranges) && !_isBooked(prv, ranges)) prewall = true;
      }
      let cls = 'tl-cell';
      if (past)        cls += ' tl-c-past';
      else if (booked) cls += ' tl-c-booked';
      else if (orphan) cls += ' tl-c-orphan';
      else             cls += ' tl-c-avail';
      if (prewall)  cls += ' tl-c-prewall';
      if (isSat && !past && !booked) cls += ' tl-c-sat';
      if (isToday) cls += ' tl-c-today';
      if (wkd && !booked && !past) cls += ' tl-c-wkd';
      const key = _dateKey(d);
      const clickable = !past ? `onclick="_tlDayClick('${key}','${p.id}')" data-date="${key}" data-prop="${p.id}"` : '';
      // Saturday tooltip takes priority over orphan
    const tlTip = orphan ? ' data-tip="1-night exception"' : (isSat && !booked && !past) ? ' data-tip="No SAT Check In/Out"' : prewall ? ' data-tip="Only 1 night free · check in earlier"' : '';
      return `<div class="${cls}" style="width:${DW}px;min-width:${DW}px"${tlTip} ${clickable}><div class="tl-dot"></div></div>`;
    }).join('');

    return `<div class="tl-prop-row">` +
      `<div class="tl-lbl tl-plbl" style="width:${LW}px;min-width:${LW}px">` +
        `<span class="tl-pname">${p.name}</span><span class="tl-prate">★ ${p.rating}</span>` +
      `</div><div class="tl-cells">${cells}</div></div>`;
  }).join('');

  // Preserve the sticky month label element, rebuild the rest
  const stickyMonthEl = document.getElementById('tl-sticky-month');
  wrap.innerHTML = `<div class="tl-view"><div class="tl-inner">` +
    `<div class="tl-row tl-drow">${dHtml}</div>` +
    rowsHtml +
    `</div></div>`;
  if (stickyMonthEl) wrap.insertBefore(stickyMonthEl, wrap.firstChild);

  // Center today horizontally
  const tlView = wrap.querySelector('.tl-view');
  if (tlView) {
    const viewW = tlView.clientWidth;
    const todayX = LW;
    const initScroll = Math.max(0, todayX - viewW / 2 + DW / 2);
    tlView.scrollLeft = initScroll;

    // Sticky month label on horizontal scroll
    const monthStarts = [];
    let px = LW;
    monthSegs.forEach(s => { monthStarts.push({ label: s.label, x: px }); px += s.count * DW; });

    let _tlLastDate = dates[dates.length - 1];
    let _tlLoading  = false;
    let _tlRightPx  = px; // px was advanced through all monthSegs above

    const appendDays = (count) => {
      if (_tlLoading) return;
      _tlLoading = true;
      const now = _calToday || new Date();
      const newDates = [];
      for (let i = 1; i <= count; i++) {
        newDates.push(new Date(_tlLastDate.getFullYear(), _tlLastDate.getMonth(), _tlLastDate.getDate() + i));
      }
      const drow = wrap.querySelector('.tl-row.tl-drow');
      newDates.forEach(d => {
        const wkd = d.getDay() === 0 || d.getDay() === 6;
        const el  = document.createElement('div');
        el.className = 'tl-dhd' + (wkd ? ' tl-dhd-wkd' : '');
        el.style.cssText = `width:${DW}px;min-width:${DW}px`;
        el.innerHTML = `<span>${DAY_NAMES[d.getDay()]}</span><strong>${d.getDate()}</strong>`;
        drow.appendChild(el);
        if (d.getDate() === 1) monthStarts.push({ label: d.toLocaleString('default', { month: 'long', year: 'numeric' }), x: _tlRightPx });
        _tlRightPx += DW;
      });
      const propRows = wrap.querySelectorAll('.tl-prop-row');
      props.forEach((p, pi) => {
        const cellsDiv = propRows[pi]?.querySelector('.tl-cells');
        if (!cellsDiv) return;
        const ranges  = _calCache[p.id] || [];
        const hasIcal = !!ICAL_URLS[p.id];
        newDates.forEach(d => {
          const past   = d < now;
          const booked = _isBooked(d, ranges);
          const orphan = !past && !booked && _isOrphanCheckIn(d, ranges);
          const isSat  = d.getDay() === 6;
          const wkd    = d.getDay() === 0 || d.getDay() === 6;
          let prewall  = false;
          if (!past && !booked && !orphan && hasIcal) {
            const nxt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
            const prv = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
            if (_isBooked(nxt, ranges) && !_isBooked(prv, ranges)) prewall = true;
          }
          let cls = 'tl-cell';
          if (past)        cls += ' tl-c-past';
          else if (booked) cls += ' tl-c-booked';
          else if (orphan) cls += ' tl-c-orphan';
          else             cls += ' tl-c-avail';
          if (prewall) cls += ' tl-c-prewall';
          if (isSat && !past && !booked) cls += ' tl-c-sat';
          if (wkd && !booked && !past)   cls += ' tl-c-wkd';
          const key = _dateKey(d);
          const el  = document.createElement('div');
          el.className = cls;
          el.style.cssText = `width:${DW}px;min-width:${DW}px`;
          if (!past) { el.onclick = () => _tlDayClick(key, p.id); el.dataset.date = key; el.dataset.prop = p.id; }
          const tip = orphan ? '1-night exception' : (isSat && !booked && !past) ? 'No SAT Check In/Out' : prewall ? 'Only 1 night free · check in earlier' : '';
          if (tip) el.dataset.tip = tip;
          el.innerHTML = '<div class="tl-dot"></div>';
          cellsDiv.appendChild(el);
        });
      });
      _tlLastDate = newDates[newDates.length - 1];
      _tlLoading  = false;
    };

    const updateMonth = () => {
      if (!stickyMonthEl) return;
      const scrollX = tlView.scrollLeft;
      let label = monthStarts[0]?.label || '';
      for (const seg of monthStarts) {
        if (seg.x <= scrollX + LW + DW) label = seg.label;
        else break;
      }
      stickyMonthEl.textContent = label;
      stickyMonthEl.style.display = 'block';
    };
    tlView.addEventListener('scroll', () => {
      updateMonth();
      if (!_tlLoading && tlView.scrollLeft + tlView.clientWidth > tlView.scrollWidth - 600) {
        appendDays(90);
      }
    }, { passive: true });
    updateMonth();
  }
}

function scrollToCalendar(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const section = wrap.closest('.listing-cal-section') || wrap;
  const targetY = section.getBoundingClientRect().top + window.pageYOffset - 160;
  window.scrollTo({ top: targetY, behavior: 'smooth' });
}

function clearDates() {
  _selStart = null; _selEnd = null;
  _attestedRules = false;
  _clearCalError();
  _hideBookingBar();
  _refreshAllWrapStyles();
  _resetAttestBtn();
}

function _resetAttestBtn() {
  const btn = document.getElementById('attest-rules-btn');
  if (!btn) return;
  const visited = _ALL_TABS ? _ALL_TABS.filter(t => _visitedTabs.has(t)).length : 1;
  const allDone = _ALL_TABS && visited === _ALL_TABS.length;
  btn.disabled = !allDone;
  btn.style.background = allDone ? 'var(--gold)' : '#9ca3af';
  btn.style.color = allDone ? 'var(--navy)' : '#fff';
  btn.style.cursor = allDone ? 'pointer' : 'not-allowed';
  btn.textContent = allDone
    ? '✅ I\'ve read and agree to all house rules and policies — unlock booking'
    : `Click all tabs above to unlock (${visited} of ${_ALL_TABS.length} reviewed)`;
}

function _initListingCalObservers() {
  ['prop1','prop2','prop3'].forEach(pid => {
    const page = document.getElementById('page-' + pid);
    if (!page) return;
    const calSection = page.querySelector('.listing-cal-section');
    const btn  = document.getElementById('ltb-check-dates-' + pid);
    const hrBtn = document.getElementById('ltb-house-rules-' + pid);
    if (!calSection || !btn) return;
    new IntersectionObserver(([entry]) => {
      const hide = entry.isIntersecting;
      [btn, hrBtn].forEach(b => { if (b) { b.style.opacity = hide ? '0' : '1'; b.style.pointerEvents = hide ? 'none' : 'auto'; } });
    }, { threshold: 0.05 }).observe(calSection);
  });
}

function _fillFormDates(start, end) {
  // Fill hidden fields used by form submission
  const ci = document.getElementById('form-checkin');
  const co = document.getElementById('form-checkout');
  if (ci) ci.value = _dateKey(start);
  if (co) co.value = _dateKey(end);
  const propMap = { prop1: 'Home in The Heart Of CB (Front)', prop2: 'Left Private Suite', prop3: 'Right Private Suite' };
  const propHid = document.getElementById('form-property-hidden');
  if (propHid) propHid.value = propMap[_calProp] || '';
  // Update locked display fields
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const dispProp = document.getElementById('form-locked-prop');
  const dispCI   = document.getElementById('form-locked-ci');
  const dispCO   = document.getElementById('form-locked-co');
  const propLabels = { prop1: '🏠 Home in The Heart Of CB (Front · 6 guests · 3 bed)', prop2: '🛎️ Left Private Guest Suite (2 guests · 1 bed)', prop3: '🛎️ Right Private Guest Suite (2 guests · 1 bed)' };
  if (dispProp) dispProp.textContent = propLabels[_calProp] || '—';
  if (dispCI)   dispCI.textContent   = fmt(start);
  if (dispCO)   dispCO.textContent   = fmt(end);
  // Change dates → specific property detail page, scrolled to its calendar
  const changeDatesLink = document.getElementById('form-change-dates-link');
  if (changeDatesLink) {
    const prop = _calProp;
    changeDatesLink.onclick = (e) => {
      e.preventDefault();
      showPage(prop);
      setTimeout(() => scrollToCalendar(prop + '-cal-wrap'), 300);
    };
  }
  // Limit guests/pets dropdowns based on property capacity
  const isSuite = (_calProp === 'prop2' || _calProp === 'prop3');
  const guestSel = document.querySelector('select[name="guests"]');
  const petSel   = document.querySelector('select[name="pets"]');
  if (guestSel) {
    Array.from(guestSel.options).forEach(opt => {
      const val = parseInt(opt.value);
      opt.hidden = isSuite && val > 2;
    });
    if (isSuite && parseInt(guestSel.value) > 2) guestSel.value = '';
  }
  if (petSel) {
    Array.from(petSel.options).forEach(opt => {
      opt.hidden = isSuite && opt.value === '2 dogs (main home only)';
    });
    if (isSuite && petSel.value === '2 dogs (main home only)') petSel.value = '';
  }
  _showBookingBar(start, end);
  _updateFormSummary(start, end);
}

function _updateFormSummary(start, end) {
  const box = document.getElementById('form-cost-summary');
  if (!box) return;
  const est = _calcEstimate(start, end, _calProp);
  const propNames = { prop1: 'Front Home', prop2: 'Left Suite', prop3: 'Right Suite' };
  const fmt = d => d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  box.innerHTML = `
    <div class="fcs-title">Your Requested Stay — ${propNames[_calProp] || 'Front Home'}</div>
    <div class="fcs-dates">${fmt(start)} → ${fmt(end)}</div>
    <div class="fcs-rows">
      <div class="fcs-row"><span>Room Fare × ${est.nights} night${est.nights>1?'s':''}</span><span>$${est.subtotal}</span></div>
      <div class="fcs-row"><span>NC Sales Tax (7%)</span><span>$${est.salesTax}</span></div>
      <div class="fcs-row"><span>Room Occupancy Tax (6%)</span><span>$${est.occTax}</span></div>
      <div class="fcs-row fcs-total"><span>Estimated Total</span><span>~$${est.preTax}</span></div>
      <div class="fcs-row" style="font-size:.8rem;color:#6b7280;padding-top:.2rem;"><span>Credit Card Fee (3%)</span><span>$${est.ccFee}</span></div>
    </div>
    <div class="fcs-note">Estimate — Jesse will confirm your exact rate.</div>
  `;
  box.style.display = 'block';
}

function bbProceed() {
  _hideBookingBar();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const bookPage = document.getElementById('page-book');
  if (bookPage) bookPage.classList.add('active');
  if (_selStart && _selEnd) _updateFormSummary(_selStart, _selEnd);
  setTimeout(() => {
    const sec = document.getElementById('booking-form-section');
    if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.pageYOffset - 110, behavior: 'smooth' });
  }, 100);
}

function bbListingPage() {
  if (_attestedRules) { bbProceed(); return; }
  const activePage = document.querySelector('.page.active');
  const onListingPage = activePage && activePage.id === 'page-' + _calProp;
  if (onListingPage) {
    scrollToHouseRules();
  } else {
    showPage(_calProp);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function attestHouseRules() {
  _attestedRules = true;
  _updateBbBtn();
  const bar = document.getElementById('booking-bar');
  const btn = document.getElementById('attest-rules-btn');
  if (btn) { btn.textContent = '✅ House rules acknowledged — click Request to Book in the bar below'; btn.disabled = true; btn.style.opacity = '.6'; }
  if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function scrollToGuide() {
  const section = document.querySelector('.listing-guidebook-section');
  if (!section) return;
  const header = document.querySelector('.site-header');
  const topBar = document.querySelector('.listing-top-bar');
  const offset = (header ? header.getBoundingClientRect().height : 80) + (topBar ? topBar.getBoundingClientRect().height : 85) + 16;
  window.scrollTo({ top: section.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
}

function scrollToHouseRules() {
  scrollToGuide();
}

function _showCalError(msg) {
  let el = document.getElementById('cal-error-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cal-error-toast';
    el.className = 'cal-error-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 5000);
}
function _clearCalError() {
  const el = document.getElementById('cal-error-toast');
  if (el) el.style.display = 'none';
}

// ─── PAGE NAVIGATION ───
function showPage(id) {
  // Save scroll offset of any currently visible listing calendar for scroll sync
  const activePage = document.querySelector('.page.active');
  const activePropMatch = activePage?.id?.match(/^page-(prop\d+)$/);
  if (activePropMatch) {
    const offset = _getScrolledMonthOffset(activePropMatch[1] + '-cal-wrap');
    if (offset > 0) _lastPropCalOffset = offset;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0 });
  }
  // Reset booking form if navigating away from it
  const bookingForm = document.querySelector('.booking-form');
  const bookingConfirm = document.getElementById('booking-confirm');
  if (bookingForm && bookingConfirm && id !== 'stay') {
    bookingForm.classList.remove('hidden');
    bookingForm.reset();
    bookingConfirm.classList.add('hidden');
    const btn = bookingForm.querySelector('button[type="submit"]');
    if (btn) { btn.textContent = 'Send Booking Request'; btn.disabled = false; }
  }
  document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active-nav'));

  if (!_calToday) { _calToday = new Date(); _calToday.setHours(0,0,0,0); }

  if (id === 'stay') {
    // Render all 3 side-by-side calendars, default to timeline view
    setTimeout(async () => {
      await Promise.all([
        renderCalInto('prop1', 'stay-cal-wrap-prop1'),
        renderCalInto('prop2', 'stay-cal-wrap-prop2'),
        renderCalInto('prop3', 'stay-cal-wrap-prop3')
      ]);
      _initMobileTabs();
      _setCalView('timeline', true); // true = no scroll on initial load
    }, 80);
  } else if (id === 'prop1') {
    setTimeout(() => renderCalInto('prop1', 'prop1-cal-wrap', _lastPropCalOffset), 80);
  } else if (id === 'prop2') {
    setTimeout(() => renderCalInto('prop2', 'prop2-cal-wrap', _lastPropCalOffset), 80);
  } else if (id === 'prop3') {
    setTimeout(() => renderCalInto('prop3', 'prop3-cal-wrap', _lastPropCalOffset), 80);
  } else if (id !== 'book') {
    _hideBookingBar();
  }
}

// ─── MOBILE MENU ───
document.getElementById('hamburger').addEventListener('click', function () {
  document.getElementById('mobile-menu').classList.toggle('open');
});
function closeMobile() {
  document.getElementById('mobile-menu').classList.remove('open');
}
function toggleMobileMore() {
  document.getElementById('mobile-more-menu').classList.toggle('open');
}
function closeMobileMore() {
  document.getElementById('mobile-more-menu').classList.remove('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.mobile-more-wrap')) closeMobileMore();
});

// ─── STICKY HEADER SHADOW ───
window.addEventListener('scroll', function () {
  const h = document.getElementById('site-header');
  h.style.boxShadow = window.scrollY > 10 ? '0 4px 24px rgba(0,0,0,.22)' : '0 2px 16px rgba(0,0,0,.18)';
});

// ─── BOOKING FORM ───
async function submitBooking(e) {
  e.preventDefault();
  const ci = document.getElementById('form-checkin');
  const co = document.getElementById('form-checkout');
  if (!ci || !ci.value || !co || !co.value) {
    alert('Please select your check-in and check-out dates on a property calendar first, then return here.');
    return;
  }
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    const fd = new FormData(form);
    const propLabels = { prop1: 'Front Home', prop2: 'Left Suite', prop3: 'Right Suite' };
    const inquiry = {
      first: fd.get('first_name') || '',
      last:  fd.get('last_name')  || '',
      email: fd.get('email')      || '',
      phone: fd.get('phone')      || '',
      prop:  _calProp             || '',
      propLabel: propLabels[_calProp] || _calProp || '',
      ci:    fd.get('checkin')    || '',
      co:    fd.get('checkout')   || '',
      guests: fd.get('guests')    || '',
      pets:  fd.get('pets')       || '',
      message: fd.get('message') || fd.get('notes') || fd.get('trip_description') || '',
      rate:  window._lastAvgNightly || 0,
      ts: Date.now()
    };
    const existing = JSON.parse(localStorage.getItem('thocb_inquiries') || '[]');
    existing.unshift(inquiry);
    localStorage.setItem('thocb_inquiries', JSON.stringify(existing.slice(0, 50)));
    _pushInquiryToCloud(inquiry);
    await _sendGuestConfirmation(inquiry);
    await _notifyHost(inquiry);
    form.classList.add('hidden');
    document.getElementById('booking-confirm').classList.remove('hidden');
    _selStart = null; _selEnd = null; _calProp = null;
    _refreshAllWrapStyles();
    _hideBookingBar();
  } catch {
    btn.textContent = 'Send Booking Request';
    btn.disabled = false;
    alert('Something went wrong — please email Jesse directly at stay@theheartofcb.com');
  }
}

// ─── CONTACT FORMS ───
async function _sendContactEmail(subject, name, email, message, successEl, form) {
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
    <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g,'<br>')}</p>
  </div>`;
  try {
    const r = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: ['jessejonesrealestate@gmail.com'], subject, html })
    });
    if (r.ok) {
      form.classList.add('hidden');
      if (successEl) successEl.classList.remove('hidden');
    } else {
      throw new Error('send failed');
    }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }
    alert('Something went wrong — email Jesse directly at stay@theheartofcb.com');
  }
}
function submitConsult(e) {
  e.preventDefault();
  const form = e.target;
  const inputs = form.querySelectorAll('input, textarea');
  const name = inputs[0]?.value.trim();
  const email = inputs[1]?.value.trim();
  const message = inputs[2]?.value.trim();
  if (!name || !email || !message) return;
  _sendContactEmail(`STR Consulting Inquiry — ${name}`, name, email, message, document.getElementById('consult-confirm'), form);
}
function submitAbout(e) {
  e.preventDefault();
  const form = e.target;
  const inputs = form.querySelectorAll('input, textarea');
  const name = inputs[0]?.value.trim();
  const email = inputs[1]?.value.trim();
  const message = inputs[2]?.value.trim();
  if (!name || !email || !message) return;
  _sendContactEmail(`Message from ${name} — The Heart Of CB`, name, email, message, document.getElementById('about-confirm'), form);
}

// ─── SHOP TABS ───
function switchShopTab(tab, btn) {
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.shop-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('shop-' + tab).classList.add('active');
}

// ─── CART ───
let cart = [];

function addToCart(btn, name) {
  cart.push(name);
  renderCart();
  btn.textContent = '✓ Added';
  btn.style.background = '#16a34a';
  setTimeout(() => {
    btn.textContent = 'Add to Cart';
    btn.style.background = '';
  }, 1800);
}

function renderCart() {
  const drawer = document.getElementById('cart-drawer');
  const itemsEl = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-count');
  countEl.textContent = cart.length;
  itemsEl.innerHTML = cart.map((item, i) =>
    `<div class="cart-item"><span>${item}</span><button onclick="removeFromCart(${i})" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:.85rem">✕</button></div>`
  ).join('');
  drawer.style.display = cart.length > 0 ? 'block' : 'none';
}

function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

// init cart hidden
const _cd = document.getElementById('cart-drawer');
if (_cd) _cd.style.display = 'none';

// Set toggle sticky top on desktop so it sits flush below the compact cards
// Desktop: toggle lives inside wrapper → sticks as one unit with cards.
// Mobile: toggle lives outside wrapper (sibling) → sticks independently through full calendar.
function _repoToggle() {
  const toggle  = document.getElementById('stay-sticky-toggle');
  const wrapper = document.querySelector('.stay-sticky-wrapper');
  if (!toggle || !wrapper) return;
  if (window.innerWidth > 900) {
    if (toggle.parentNode !== wrapper) wrapper.appendChild(toggle);
  } else {
    if (toggle.parentNode !== wrapper.parentNode)
      wrapper.parentNode.insertBefore(toggle, wrapper.nextSibling);
  }
}
window.addEventListener('resize', _repoToggle, { passive: true });
document.addEventListener('DOMContentLoaded', _repoToggle);

// Stay page: collapse card photos when header goes sticky, restore when not
window.addEventListener('scroll', () => {
  const stayPage = document.getElementById('page-stay');
  if (!stayPage || !stayPage.classList.contains('active')) return;
  if (document.body.classList.contains('timeline-mode')) return;
  const header = stayPage.querySelector('.stay-sticky-header');
  if (!header) return;
  const shouldCompact = header.getBoundingClientRect().top <= 151;
  if (shouldCompact === header.classList.contains('cards-compact')) return;
  header.classList.toggle('cards-compact', shouldCompact);
}, { passive: true });

// ─── GUIDEBOOK TABS ───
function lgbAccordion(id) {
  const item = document.getElementById('lgb-acc-' + id);
  if (!item) return;
  const hd = item.querySelector('.lgb-acc-hd');
  const body = item.querySelector('.lgb-acc-body');
  const section = item.closest('.listing-guidebook-section');
  const wasOpen = body && body.classList.contains('open');
  // Close all in same section
  ['rules','cancel','checkin','area','inunit','emergency','checkout'].forEach(tid => {
    const it = section ? section.querySelector('#lgb-acc-' + tid) : document.getElementById('lgb-acc-' + tid);
    if (!it) return;
    const h = it.querySelector('.lgb-acc-hd'); const b = it.querySelector('.lgb-acc-body');
    if (h) h.classList.remove('active'); if (b) b.classList.remove('open');
  });
  // Toggle: only open if it wasn't already open
  if (!wasOpen) {
    if (hd) hd.classList.add('active');
    if (body) body.classList.add('open');
  }
  // Blur immediately so the browser doesn't focus-scroll the button
  if (hd) hd.blur();
  // On desktop, always land on the guidebook section header — prevents any scroll jump
  if (window.innerWidth > 768 && section) {
    const lgbHeader = section.querySelector('.lgb-header') || section;
    const navH = document.querySelector('.site-header')?.offsetHeight || 150;
    const switcherEl = document.querySelector('.prop-switcher');
    const switcherH = switcherEl ? switcherEl.offsetHeight : 0;
    const top = lgbHeader.getBoundingClientRect().top + window.scrollY - navH - switcherH - 8;
    requestAnimationFrame(() => window.scrollTo({ top, behavior: 'smooth' }));
  }
  // Track visited
  _visitedTabs.add(id);
  if (hd) hd.classList.add('visited');
  _checkAttestReady();
}

function lgbTab(id, btn) {
  const panel = document.getElementById('lgb-' + id);
  if (!panel) return;
  panel.closest('.listing-guidebook-section').querySelectorAll('.lgb-panel').forEach(p => p.classList.remove('active'));
  btn.closest('.listing-guidebook-section').querySelectorAll('.lgb-tab-btn').forEach(b => b.classList.remove('active'));
  panel.classList.add('active');
  btn.classList.add('active');
  _visitedTabs.add(id);
  _checkAttestReady();
}

const _ALL_TABS = ['rules','cancel','checkin','area','inunit','emergency','checkout'];

function _checkAttestReady() {
  const visited = _ALL_TABS.filter(t => _visitedTabs.has(t)).length;
  const allDone = visited === _ALL_TABS.length;
  const countEl = document.getElementById('attest-tab-count');
  if (countEl) countEl.textContent = visited;
  const btn = document.getElementById('attest-rules-btn');
  if (!btn || _attestedRules) return;
  if (allDone) {
    btn.disabled = false;
    btn.style.background = 'var(--gold)';
    btn.style.color = 'var(--navy)';
    btn.style.cursor = 'pointer';
    btn.textContent = '✅ I\'ve read and agree to all house rules and policies — unlock booking';
  } else {
    btn.textContent = `Open all sections above to unlock (${visited} of ${_ALL_TABS.length} reviewed)`;
  }
}

function cancelCalc() {
  const val = document.getElementById('cancel-calc-date').value;
  const result = document.getElementById('cancel-calc-result');
  if (!val || !result) return;
  const ci = new Date(val + 'T12:00:00');
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const fullCutoff = new Date(ci); fullCutoff.setDate(fullCutoff.getDate() - 5);
  const halfStart  = new Date(ci); halfStart.setDate(halfStart.getDate() - 4);
  const halfEnd    = new Date(ci); halfEnd.setDate(halfEnd.getDate() - 1);
  document.getElementById('ccr-full').innerHTML =
    `✅ <strong>Full refund:</strong> Cancel by <strong>${fmt(fullCutoff)}</strong>`;
  document.getElementById('ccr-half').innerHTML =
    `⚠️ <strong>50% refund:</strong> Cancel <strong>${fmt(halfStart)}</strong> through <strong>${fmt(halfEnd)}</strong>`;
  document.getElementById('ccr-none').innerHTML =
    `🚫 <strong>No refund:</strong> Cancellations on <strong>${fmt(ci)}</strong> (your check-in day) are not accepted`;
  result.style.display = '';
}

// ─── GLOBAL TOOLTIP (fixed-position, never clipped) ───
(function() {
  const tip = document.createElement('div');
  tip.id = 'cal-tooltip';
  tip.style.cssText = 'position:fixed;background:#1e1e1e;color:#fff;padding:.35rem .75rem;border-radius:6px;font-size:.72rem;font-weight:600;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s;z-index:9999;letter-spacing:.01em;';
  document.body.appendChild(tip);

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    // Don't show tips on selected or checkout-eligible cells
    if (el.classList.contains('tl-sel-start') || el.classList.contains('tl-sel-end') ||
        el.classList.contains('cal-sel-start') || el.classList.contains('cal-sel-end') ||
        el.classList.contains('cal-checkout-eligible') || el.classList.contains('cal-in-range')) return;
    // When choosing checkout, suppress check-in-only tips (prewall, SAT)
    const tipText = el.dataset.tip;
    if (_selStart && tipText === 'Only 1 night free · check in earlier') return;
    tip.textContent = tipText;
    tip.style.opacity = '1';
    _positionTip(el);
  });
  document.addEventListener('mousemove', e => {
    if (tip.style.opacity === '0') return;
    const el = e.target.closest('[data-tip]');
    if (el) _positionTip(el);
  });
  document.addEventListener('mouseout', e => {
    if (!e.target.closest('[data-tip]')) return;
    tip.style.opacity = '0';
  });

  function _positionTip(el) {
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth || 120;
    const th = tip.offsetHeight || 28;
    // Horizontal: center on element, clamp to viewport with 8px margin
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    // Vertical: prefer above, fall back below if not enough room
    let y = r.top - th - 6;
    if (y < 8) y = r.bottom + 6;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }
})();

// ─── MOBILE PROPERTY TABS (stay page) ───
let _mobileTab = 0;
function _setMobileTab(idx) {
  _mobileTab = idx;
  document.querySelectorAll('.stay-mob-tab').forEach((b, i) => b.classList.toggle('active', i === idx));
  // Only filter calendar columns — timeline always shows all 3 rows
  document.querySelectorAll('.stay-cal-col').forEach((col, i) => {
    col.style.display = (i === idx) ? '' : 'none';
  });
}
function _initMobileTabs() {
  // Only apply on small screens; desktop shows all
  if (window.innerWidth > 700) {
    document.querySelectorAll('.stay-cal-col').forEach(col => col.style.display = '');
    return;
  }
  if (_calView === 'timeline') {
    // Hide the property tabs, show all 3 timeline rows
    const tabs = document.getElementById('stay-mob-tabs');
    if (tabs) tabs.style.display = 'none';
    document.querySelectorAll('.tl-prop-row').forEach(row => row.style.display = '');
  } else {
    // Show the property tabs, filter calendar columns to active tab
    const tabs = document.getElementById('stay-mob-tabs');
    if (tabs) tabs.style.display = '';
    _setMobileTab(_mobileTab);
  }
}

document.addEventListener('DOMContentLoaded', _initListingCalObservers);
