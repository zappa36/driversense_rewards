'use strict';

/* ============================================================
 * People Mobile v1 — interactive prototype of the consumer app.
 * From "People Mobile v1.dc.html" (claude.ai/design), reworked
 * from the design's storyboard into a navigable single-phone app:
 *
 *   map ── flagged pin / flag card ──► arrival ── Tell Otto ──► otto
 *    │                                                            │ debrief done
 *    ├── avatar ──► profile                    levelup ◄──────────┘
 *    ├── rank chip ──► leaderboard ── season chip ──► season
 *    └── gold FAB ──► tag ── Save place (+50 XP) ──► map
 *
 * The Season screen lists the LIVE challenges published in
 * Challenge Studio when Supabase is configured.
 * ============================================================ */

/* ---------- theme (design props, overridable via URL) ----------
 * ?brand=%230061A0   brand color (#0498BA default)
 * ?coin=%23F6A800    coin/gold color (#FFCC00 default)
 * ?gamify=0          hide gamification chrome (XP, ranks, badges)
 */
const params = new URLSearchParams(location.search);

function rgbArr(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const shift = (hex, amt) => {
  const f = v => Math.max(0, Math.min(255, Math.round(v + amt)));
  return '#' + rgbArr(hex).map(v => f(v).toString(16).padStart(2, '0')).join('');
};

const theme = {
  brand: /^#[0-9a-f]{3,6}$/i.test(params.get('brand') || '') ? params.get('brand') : '#0498BA',
  gold: /^#[0-9a-f]{3,6}$/i.test(params.get('coin') || '') ? params.get('coin') : '#FFCC00',
  gamify: params.get('gamify') !== '0',
};

const rootEl = document.documentElement;
rootEl.style.setProperty('--brand', theme.brand);
rootEl.style.setProperty('--brand-rgb', rgbArr(theme.brand).join(','));
rootEl.style.setProperty('--brand-l', shift(theme.brand, 42));
rootEl.style.setProperty('--brand-d', shift(theme.brand, -34));
rootEl.style.setProperty('--gold', theme.gold);
rootEl.style.setProperty('--gamify', theme.gamify ? 'flex' : 'none');
rootEl.style.setProperty('--gamify-inline', theme.gamify ? 'inline-flex' : 'none');

/* ---------- desktop: scale the phone to fit the window ---------- */
const phone = document.getElementById('phone');
function fitPhone() {
  if (window.innerWidth <= 520 || window.innerHeight <= 620) return; // media query handles full-bleed
  const s = Math.min(1, (window.innerHeight - 28) / 892, (window.innerWidth - 28) / 438);
  phone.style.transform = `scale(${s})`;
}
fitPhone();
window.addEventListener('resize', fitPhone);

/* ---------- navigation ---------- */
const screens = {};
document.querySelectorAll('.screen').forEach(s => { screens[s.dataset.screen] = s; });
let current = 'map';
const stack = [];

function show(name, push = true) {
  if (!screens[name] || name === current) return;
  if (current === 'otto') ottoStop();
  if (current === 'tag') tagVoiceStop();
  if (push) stack.push(current);
  screens[current].classList.remove('active');
  current = name;
  const el = screens[name];
  el.classList.remove('active');
  void el.offsetWidth; // restart the enter animation
  el.classList.add('active');
  if (name === 'otto') ottoStart();
  if (name === 'tag') { startGeolocation(); tagVoiceReset(); }
  if (name === 'map') stack.length = 0;
}

function goBack() {
  show(stack.pop() || 'map', false);
}

/* ---------- points (XP wallet on the map HUD) ---------- */
let ottoBonus = 0;
let tagBonus = 0;
const renderPoints = () => {
  const el = document.getElementById('points-chip');
  if (el) el.textContent = (1240 + ottoBonus + tagBonus).toLocaleString('en-US');
};

/* ---------- Otto debrief state machine ---------- */
const SCRIPT = [
  { q: "Hey M. Kaur — Nº 47 is flagged as changed. What did you find?", a: "The building entrance moved about 50 metres to the left — there's renovation work." },
  { q: "Got it. Is that temporary, or here to stay?", a: "Temporary — just while the renovation's going on." },
  { q: "Thanks. Anything else people should know before they head over?", a: "Yeah, there's no lift — it's a four-floor walk-up." },
];
const FINAL_MSG = "Saved & shared — 12 people have Nº 47 saved. They'll see your note before they set out. Nice work.";

const beats = [];
SCRIPT.forEach(t => { beats.push({ from: 'ai', text: t.q }); beats.push({ from: 'driver', text: t.a }); });
beats.push({ from: 'ai', text: FINAL_MSG });

let beat = 0;
let ottoTimer = null;
let levelTimer = null;

const EYES = `<span style="display:flex;align-items:center;gap:14px;">
  <span style="position:relative;width:16px;height:22px;border-radius:50%;background:#fff;display:block;animation:blink 3.6s ease-in-out infinite;transform-origin:center;"><span style="position:absolute;left:3px;top:4px;width:6px;height:6px;border-radius:50%;background:#2a3a78;"></span></span>
  <span style="position:relative;width:16px;height:22px;border-radius:50%;background:#fff;display:block;animation:blink 3.6s ease-in-out infinite;transform-origin:center;"><span style="position:absolute;left:3px;top:4px;width:6px;height:6px;border-radius:50%;background:#2a3a78;"></span></span>
</span>`;
const THINK = `<span class="msr fill" style="font-size:40px;color:#fff;animation:breathe 1.3s ease-in-out infinite;">auto_awesome</span>`;

const phaseFor = b => b >= beats.length - 1 ? 'done' : (beats[b].from === 'ai' ? 'listening' : 'thinking');

const escT = s => String(s).replace(/</g, '&lt;');
const aiBubble = text => `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;animation:msgin .3s ease;">
    <span style="display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;color:#aab6ff;"><span style="width:20px;height:20px;border-radius:6px;background:linear-gradient(180deg,#8b9bff,#4458d8);display:flex;align-items:center;justify-content:center;"><span class="msr fill" style="font-size:12px;color:#fff;">auto_awesome</span></span>OTTO</span>
    <div style="font-family:'Saira',sans-serif;font-weight:500;font-size:23px;line-height:1.42;color:#eef2f7;max-width:308px;text-wrap:pretty;">${escT(text)}</div>
  </div>`;
const driverBubble = text => `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;animation:msgin .3s ease;">
    <span style="display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;color:var(--brand-l,#3cc0e0);"><img src="assets/profile.png" alt="M. Kaur" style="width:20px;height:20px;border-radius:6px;object-fit:cover;display:block;">M. KAUR</span>
    <div style="font-family:'Saira',sans-serif;font-weight:500;font-size:23px;line-height:1.42;color:#dceaf2;max-width:308px;text-wrap:pretty;">&ldquo;${escT(text)}&rdquo;</div>
  </div>`;

function renderOtto() {
  const b = beats[beat];
  const phase = phaseFor(beat);
  const el = id => document.getElementById(id);

  el('otto-face').innerHTML = phase === 'thinking' ? THINK : EYES;
  el('otto-ring1').style.display = phase === 'listening' ? '' : 'none';
  el('otto-ring2').style.display = phase === 'listening' ? '' : 'none';

  el('otto-msg').innerHTML = b.from === 'ai' ? aiBubble(b.text) : driverBubble(b.text);

  el('voice-caption').textContent = phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Otto is thinking…' : 'Saved to the place';
  el('voice-sub').textContent = phase === 'listening' ? 'Speak now — or tap the mic' : phase === 'thinking' ? 'Structuring your answer' : 'Everyone heading to Nº 47 sees it first';
  el('mic-btn').style.display = phase === 'done' ? 'none' : '';
  el('mic-ring').style.display = phase === 'listening' ? '' : 'none';
  el('done-chip').style.display = phase === 'done' && theme.gamify ? 'inline-flex' : 'none';

  if (phase === 'done') {
    ottoBonus = 50;
    renderPoints();
    /* The no-lift note pushes M. Kaur over the level threshold. */
    clearTimeout(levelTimer);
    levelTimer = setTimeout(() => { if (current === 'otto') show('levelup'); }, 1900);
  }
}

function scheduleOtto() {
  clearTimeout(ottoTimer);
  const phase = phaseFor(beat);
  if (phase === 'done') return;
  ottoTimer = setTimeout(() => setBeat(beat + 1), phase === 'listening' ? 5500 : 2200);
}

function setBeat(n) {
  beat = Math.max(0, Math.min(beats.length - 1, n));
  renderOtto();
  scheduleOtto();
}

/* ---------- Otto live voice · real mic -> OpenAI via Supabase ---------- */
/* When Supabase is configured, the debrief records the phone's real mic;
 * the otto Edge Function (which alone holds the OpenAI key) transcribes
 * the clip and structures it into a tip saved to the tips table. Without
 * Supabase, or if the mic is denied, the scripted demo conversation runs. */
const voice = { mode: 'script', rec: null, busy: false, exchanges: 0, editing: null, challenge: null };

const canLiveVoice = () => typeof DB !== 'undefined' && DB.enabled && window.isSecureContext
  && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof MediaRecorder !== 'undefined';

const placeLabel = () => {
  /* honest position label: reverse-geocoded street, else raw coordinates */
  if (geo) return geoAddr || `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`;
  const t = document.getElementById('flag-title');
  return (t && t.textContent) || 'this place';
};

function renderOttoLive(msg, state) {
  const el = id => document.getElementById(id);
  el('otto-face').innerHTML = state === 'think' ? THINK : EYES;
  el('otto-ring1').style.display = state === 'rec' ? '' : 'none';
  el('otto-ring2').style.display = state === 'rec' ? '' : 'none';
  el('otto-msg').innerHTML = msg.from === 'ai' ? aiBubble(msg.text) : driverBubble(msg.text);
  el('voice-caption').textContent = state === 'rec' ? 'Recording…' : state === 'think' ? 'Otto is thinking…' : 'Tap the mic to talk';
  el('voice-sub').textContent = state === 'rec' ? 'Tap the mic again to send' : state === 'think' ? 'Transcribing & structuring your note' : 'Real voice — transcribed by OpenAI';
  el('mic-btn').style.display = state === 'think' ? 'none' : '';
  el('mic-ring').style.display = state === 'rec' ? '' : 'none';
  el('done-chip').style.display = voice.exchanges > 0 && theme.gamify ? 'inline-flex' : 'none';
}

async function ottoMicLive() {
  if (voice.busy) return;
  if (voice.rec) { voice.rec.stop(); return; } /* second tap sends the clip */
  clearTimeout(levelTimer);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      voice.rec = null;
      sendVoiceClip(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    };
    voice.rec = rec;
    rec.start();
    renderOttoLive({ from: 'ai', text: "I'm listening — tap the mic again when you're done." }, 'rec');
  } catch { /* mic denied: the tap falls back to the scripted demo */
    voice.mode = 'script';
    beat = 0; renderOtto(); scheduleOtto();
  }
}

async function sendVoiceClip(blob) {
  voice.busy = true;
  const place = placeLabel();
  renderOttoLive({ from: 'ai', text: 'Got it — one second…' }, 'think');
  try {
    const d = await DB.ottoVoice(blob, place);
    renderOttoLive({ from: 'driver', text: d.transcript }, 'think');
    if (geoState === 'locating') await waitForFix(); /* pin the tip where it was spoken */
    const patch = {
      transcript: d.transcript,
      title: (d.tip && d.tip.title) || null, category: (d.tip && d.tip.category) || null,
    };
    if (voice.challenge) { /* filing evidence for an investigation challenge */
      const c = voice.challenge;
      const already = iReported(c.id);
      const rrow = {
        challenge_id: c.id, device: deviceId, ...patch,
        lat: geo ? geo.lat : null, lng: geo ? geo.lng : null, accuracy: geo ? geo.acc : null,
      };
      DB.insertReport(rrow).catch(() => { /* run reports.sql once to create the table */ });
      (challengeReports[c.id] = challengeReports[c.id] || []).push(rrow);
      renderLivePins();
      const n = distinctReporters(c.id);
      const solved = isSolved(c.id);
      voice.exchanges++;
      if (!already) { ottoBonus = 50; renderPoints(); }
      document.getElementById('done-chip').innerHTML = solved
        ? `<span class="msr fill" style="font-size:14px;color:#5fe0b0;">task_alt</span>SOLVED · ${escT(fmtReward(c.value))} RELEASED`
        : `<span class="msr fill" style="font-size:14px;color:var(--gold,#FFCC00);">add_circle</span>REPORT ${n}/${REPORTS_NEEDED} FILED`;
      setTimeout(() => {
        if (current !== 'otto' || voice.rec) return;
        renderOttoLive({ from: 'ai', text: solved
          ? `That settles it — ${n} people confirmed it independently. ${fmtReward(c.value)} is released to everyone who reported. Nice work.`
          : `${d.reply || 'Filed.'} You're report ${n} of ${REPORTS_NEEDED} — the payout unlocks when another person confirms on site.` }, 'idle');
        if (solved) {
          clearTimeout(levelTimer);
          levelTimer = setTimeout(() => { if (current === 'otto' && !voice.rec && !voice.busy) show('levelup'); }, 3200);
        }
      }, 1700);
      voice.busy = false;
      return;
    }
    if (voice.editing) { /* retelling an existing tag replaces its content */
      Object.assign(voice.editing, patch);
      if (voice.editing.id) DB.updateTip(voice.editing.id, patch).catch(() => { /* run tips.sql again for edit rights */ });
      renderLivePins();
      document.getElementById('done-chip').innerHTML =
        `<span class="msr fill" style="font-size:14px;color:var(--gold,#FFCC00);">check_circle</span>TIP UPDATED · ${escT(patch.category || 'INFO')}`;
      voice.exchanges++;
      setTimeout(() => {
        if (current !== 'otto' || voice.rec) return;
        renderOttoLive({ from: 'ai', text: d.reply || 'Updated — the next visitor sees the new note.' }, 'idle');
      }, 1700);
      voice.busy = false;
      return;
    }
    const row = { place, ...patch, lat: geo ? geo.lat : null, lng: geo ? geo.lng : null };
    DB.insertTip(row).then(saved => {
      if (Array.isArray(saved) && saved[0] && saved[0].id) row.id = saved[0].id;
    }).catch(() => { /* tips table missing — the conversation still works */ });
    if (geo) { liveTips.unshift(row); renderLivePins(); } /* tag the map right away */
    voice.exchanges++;
    if (voice.exchanges === 1) { ottoBonus = 50; renderPoints(); }
    document.getElementById('done-chip').innerHTML =
      `<span class="msr fill" style="font-size:14px;color:var(--gold,#FFCC00);">add_circle</span>${voice.exchanges} TIP${voice.exchanges > 1 ? 'S' : ''} SAVED · ${escT((d.tip && d.tip.category) || 'INFO')}`;
    setTimeout(() => {
      if (current !== 'otto' || voice.rec) return;
      renderOttoLive({ from: 'ai', text: d.reply || 'Noted — saved for the next visitor.' }, 'idle');
      clearTimeout(levelTimer);
      levelTimer = setTimeout(() => { if (current === 'otto' && !voice.rec && !voice.busy) show('levelup'); }, 3200);
    }, 1700);
  } catch (e) {
    renderOttoLive({ from: 'ai', text: `I couldn't reach the voice service (${(e && e.message) || 'offline'}). Check the otto function is deployed, then tap the mic to try again.` }, 'idle');
  }
  voice.busy = false;
}

function ottoStart() {
  voice.mode = canLiveVoice() ? 'live' : 'script';
  voice.exchanges = 0;
  if (voice.mode === 'live') {
    const c = voice.challenge;
    const t = voice.editing;
    renderOttoLive({ from: 'ai', text: c
      ? `You're at ${c.addr || c.title}. Something around here isn't working the way it should — can you take a look? Tap the mic and describe what you see.`
      : t
        ? `Let's update your tag "${t.title || t.transcript || 'voice tip'}" — tap the mic and tell me the new situation.`
        : `Hey M. Kaur — you're at ${placeLabel()}. What did you find? Tap the mic and just talk.` }, 'idle');
  } else {
    beat = 0; renderOtto(); scheduleOtto();
  }
}

function ottoStop() {
  clearTimeout(ottoTimer);
  clearTimeout(levelTimer);
  if (voice.rec) {
    try { voice.rec.onstop = null; voice.rec.stop(); voice.rec.stream.getTracks().forEach(t => t.stop()); } catch { /* already gone */ }
    voice.rec = null;
  }
  voice.busy = false;
  voice.editing = null;
  voice.challenge = null;
}

/* ---------- phone GPS · tag-a-place ---------- */
let geo = null;            // { lat, lng, acc } from the device
let geoAddr = null;        // reverse-geocoded street ("Kollwitzstraße 18")
let geoState = 'idle';     // 'locating' | 'fix' | 'off'
let geoWaiters = [];       // saves waiting for the fix to arrive
const DEMO_SPOT = { lat: 52.5346, lng: 13.4109, acc: 4, addr: 'Kollwitzstraße 18' };

const geoSettled = () => { geoWaiters.forEach(fn => fn()); geoWaiters = []; };
/* Resolves when the GPS attempt has settled (fix or off), or after ms. */
const waitForFix = (ms = 9000) => geoState !== 'locating'
  ? Promise.resolve()
  : new Promise(res => {
      const t = setTimeout(res, ms);
      geoWaiters.push(() => { clearTimeout(t); res(); });
    });

const setTagChips = text => {
  ['tag-acc-hud', 'tag-acc-sheet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
};

function startGeolocation() {
  if (!('geolocation' in navigator)) return geoFallback();
  geoState = 'locating';
  setTagChips('LOCATING…');
  document.getElementById('tag-gps-note').textContent = 'WAITING FOR GPS FIX…';
  navigator.geolocation.getCurrentPosition(pos => {
    geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy || 0 };
    geoState = 'fix';
    geoSettled();
    storeFix();
    setTagChips('GPS ±' + Math.max(1, Math.round(geo.acc)) + ' m');
    document.getElementById('tag-gps-note').textContent = `DROPPED AT ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`;
    document.getElementById('tag-addr').textContent = `${geo.lat.toFixed(4)}°N, ${geo.lng.toFixed(4)}°E`;
    updateLiveMaps();
    renderLivePins(); /* hide the fiction now — don't wait for the map image */
    reverseGeocode(geo).then(res => {
      if (!res) return;
      if (res.street) {
        geoAddr = res.street;
        document.getElementById('tag-addr').textContent = res.street;
      }
      if (res.area) {
        const chip = document.getElementById('map-area');
        if (chip) chip.textContent = res.area.toUpperCase().slice(0, 16);
      }
      storeFix({ area: res.area || null });
    });
  }, err => geoFallback(err), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
}

/* ---------- instant boot · cached fix kills the Berlin flash ---------- */
/* The illustrated demo city is the default first paint, so returning users
 * with location already granted briefly saw Berlin fiction before the real
 * map loaded. Remember the last fix (plus neighborhood) on-device; on boot,
 * if permission is already granted, start from it: hide the fiction at
 * once and load the real map immediately, then the fresh fix corrects it. */
const FIX_KEY = 'ds_last_fix';

function storeFix(extra) {
  if (!geo) return;
  try {
    const prev = JSON.parse(localStorage.getItem(FIX_KEY) || '{}') || {};
    localStorage.setItem(FIX_KEY, JSON.stringify({ area: prev.area || null, lat: geo.lat, lng: geo.lng, acc: geo.acc, ...(extra || {}) }));
  } catch { /* private mode */ }
}

function primeLiveMap() {
  if (!window.GMAPS_KEY || !navigator.permissions || !navigator.permissions.query) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(FIX_KEY) || 'null'); } catch { /* private mode */ }
  if (!cached || typeof cached.lat !== 'number' || typeof cached.lng !== 'number') return;
  navigator.permissions.query({ name: 'geolocation' }).then(s => {
    if (s.state !== 'granted' || geo) return; /* prompt/denied: the illustration is the right waiting screen */
    geo = { lat: cached.lat, lng: cached.lng, acc: cached.acc || 50 };
    if (cached.area) {
      const chip = document.getElementById('map-area');
      if (chip) chip.textContent = String(cached.area).toUpperCase().slice(0, 16);
    }
    updateLiveMaps();   /* liveMapState -> 'loading' */
    renderLivePins();   /* hides the fiction right now, before the image lands */
  }).catch(() => { /* permissions API unavailable */ });
}

function geoFallback(err) {
  geo = null;
  geoAddr = null;
  geoState = 'off';
  geoSettled();
  hideLiveMaps();
  /* Say WHY it failed: 1 = permission, 2 = no position source, 3 = timeout */
  const code = err && err.code;
  const chip = code === 1 ? 'GPS BLOCKED · TAP TO RETRY'
    : code === 2 ? 'NO GPS SIGNAL · TAP TO RETRY'
      : code === 3 ? 'GPS TIMEOUT · TAP TO RETRY'
        : 'GPS OFF · TAP TO RETRY';
  const note = code === 1 ? 'ALLOW LOCATION FOR THIS SITE, THEN TAP THE GPS CHIP'
    : 'DEMO LOCATION · TAP THE GPS CHIP TO RETRY';
  setTagChips(chip);
  document.getElementById('tag-gps-note').textContent = note;
  document.getElementById('tag-addr').textContent = DEMO_SPOT.addr;
}

/* ---------- live map · real Google Map centered on the device ---------- */
/* When a Maps key is configured and the GPS fix arrives, the illustrated
 * city under the map/tag HUDs is replaced by a real Maps Static API image
 * centered on the phone's position (dark-styled to match the UI), and the
 * avatar moves to the exact center — it IS the position marker. If the fix
 * is lost, the key is missing, or the API rejects the request, the
 * illustration stays/returns. */
const MAP_STYLE = [
  'feature:all|element:geometry|color:0x0e1b17',
  'feature:all|element:labels.text.fill|color:0x6b8f85',
  'feature:all|element:labels.text.stroke|color:0x081513',
  'feature:all|element:labels.icon|visibility:off',
  'feature:road|element:geometry|color:0x1e3a33',
  'feature:road.arterial|element:geometry|color:0x24443c',
  'feature:road.highway|element:geometry|color:0x2c5148',
  'feature:water|element:geometry|color:0x0e3346',
  'feature:poi.park|element:geometry|color:0x123f2c',
  'feature:poi|element:labels|visibility:off',
  'feature:transit|visibility:off',
];
const MAP_STYLE_QS = MAP_STYLE.map(s => 'style=' + encodeURIComponent(s)).join('&');

const centerPlayer = on => {
  const p = document.getElementById('map-player');
  if (p) p.style.top = on ? '50%' : '57%'; // 57% = spot in the illustration
};

let liveMapState = 'off'; // 'off' | 'loading' | 'on' | 'failed' — the map screen's live layer

function updateLiveMaps() {
  const gkey = window.GMAPS_KEY || '';
  [['live-map', 17], ['live-map-tag', 18]].forEach(([id, zoom]) => {
    const img = document.getElementById(id);
    if (!img) return;
    if (!gkey || !geo) {
      img.style.display = 'none';
      if (id === 'live-map') liveMapState = 'off';
      return;
    }
    img.onload = () => {
      img.style.display = 'block';
      if (id === 'live-map') { liveMapState = 'on'; centerPlayer(true); renderLivePins(); }
    };
    img.onerror = () => {
      img.style.display = 'none';
      if (id === 'live-map') { liveMapState = 'failed'; centerPlayer(false); renderLivePins(); }
    };
    const src = 'https://maps.googleapis.com/maps/api/staticmap'
      + `?center=${geo.lat},${geo.lng}&zoom=${zoom}&size=390x640&scale=2`
      + `&${MAP_STYLE_QS}&key=${gkey}`;
    if (id === 'live-map' && img.src !== src && liveMapState !== 'on') liveMapState = 'loading';
    img.src = src;
  });
}

function hideLiveMaps() {
  ['live-map', 'live-map-tag'].forEach(id => {
    const img = document.getElementById(id);
    if (img) { img.onerror = null; img.removeAttribute('src'); img.style.display = 'none'; }
  });
  liveMapState = 'off';
  centerPlayer(false);
  renderLivePins();
}

/* ---------- real tagged places & voice tips, pinned on the live map ---------- */
let livePlaces = [];
let liveTips = [];

/* ---------- investigation challenges · consensus before payout ---------- */
/* A challenge from the studio is deliberately vague ("deliveries here run
 * slower than planned — find out why"). People physically at the spot file
 * a voice report through Otto; the payout releases only when reports from
 * REPORTS_NEEDED different devices agree, so one person can't cheat. */
const REPORTS_NEEDED = 2;
const REPORT_RADIUS = 75; // metres — how close you must be to file a report

const deviceId = (() => {
  try {
    let d = localStorage.getItem('ds_device');
    if (!d) { d = 'dev-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('ds_device', d); }
    return d;
  } catch { return 'dev-anon'; }
})();

let challengeReports = {}; // challenge_id -> [{ device, ... }]
const reportsFor = id => challengeReports[id] || [];
const distinctReporters = id => new Set(reportsFor(id).map(r => r.device)).size;
const iReported = id => reportsFor(id).some(r => r.device === deviceId);
const isSolved = id => distinctReporters(id) >= REPORTS_NEEDED;

function loadPlaces() {
  const local = () => { try { return JSON.parse(localStorage.getItem('ds_places') || '[]'); } catch { return []; } };
  const on = typeof DB !== 'undefined' && DB.enabled;
  Promise.all([
    on ? DB.listPlaces(50).catch(() => []) : Promise.resolve([]),
    on ? DB.listTips(50).catch(() => []) : Promise.resolve([]),
    on ? DB.listReports(500).catch(() => []) : Promise.resolve([]),
  ]).then(([rows, tips, reports]) => {
    livePlaces = (rows || []).concat(local()).filter(p =>
      typeof p.lat === 'number' && typeof p.lng === 'number' && !String(p.name || '').startsWith('Demo spot'));
    liveTips = (tips || []).filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');
    challengeReports = {};
    (reports || []).forEach(r => { (challengeReports[r.challenge_id] = challengeReports[r.challenge_id] || []).push(r); });
    renderLivePins();
  });
}

/* Projects lat/lng to CSS pixels inside the map screen: Web Mercator at the
 * map's zoom, scaled the same way object-fit:cover scales the 390x640 image. */
function mapProjector(img) {
  const W = img.parentElement.clientWidth || 390;
  const H = img.parentElement.clientHeight || 844;
  const cover = Math.max(W / 390, H / 640);
  const world = 256 * Math.pow(2, 17);
  const px = (lat, lng) => {
    const s = Math.min(.9999, Math.max(-.9999, Math.sin(lat * Math.PI / 180)));
    return { x: world * (lng / 360 + .5), y: world * (.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) };
  };
  const c = px(geo.lat, geo.lng);
  return { W, H, xy: (lat, lng) => { const q = px(lat, lng); return { x: W / 2 + (q.x - c.x) * cover, y: H / 2 + (q.y - c.y) * cover }; } };
}

function renderLivePins() {
  const wrap = document.getElementById('live-pins');
  const img = document.getElementById('live-map');
  if (!wrap || !img) return;
  /* 'loading' counts as live: the fiction must not flash back in while the
   * map image is still on its way */
  const liveOn = !!geo && (liveMapState === 'on' || liveMapState === 'loading');
  /* the illustration's fictional pins make no sense on the real map */
  document.querySelectorAll('.design-pin').forEach(el => { el.style.display = liveOn ? 'none' : ''; });
  renderFlag(liveOn);
  if (!liveOn) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const { W, H, xy } = mapProjector(img);
  const onMap = (lat, lng) => {
    const q = xy(lat, lng);
    return (q.x < 26 || q.x > W - 26 || q.y < 150 || q.y > H - 250) ? null : q; // off-screen, or under the HUD/card
  };

  /* Icons anchor EXACTLY on their coordinates (never nudged — positions are
   * truth). Only the labels get de-conflicted: when two would overlap, the
   * less important one is hidden — the tap card always has the full text.
   * Priority: your voice tips, then challenges, then saved places. */
  const TIP_ICONS = { ACCESS: 'elevator', CLOSURE: 'block', HAZARD: 'warning', ENTRANCE: 'door_front', HOURS: 'schedule', INFO: 'info' };
  const pins = [];
  liveChallenges.forEach((c, i) => {
    const q = onMap(c.lat, c.lng);
    if (!q) return;
    const solved = isSolved(c.id);
    const mine = iReported(c.id);
    pins.push({
      kind: 'chal', i, x: q.x, y: q.y, prio: 1, iconH: 44, anchor: 36,
      label: solved ? 'SOLVED ✓' : mine ? `${distinctReporters(c.id)}/${REPORTS_NEEDED} · NEEDS MORE` : 'INVESTIGATE',
      solved, rgb: solved ? '70,211,154' : '255,107,107', tx: solved ? '#7ce0b8' : '#ff9b9b',
    });
  });
  livePlaces.forEach((p, i) => {
    const q = onMap(p.lat, p.lng);
    if (!q) return;
    pins.push({ kind: 'place', i, x: q.x, y: q.y, prio: 2, iconH: 38, anchor: 33, label: escT(p.name || 'Saved place').toUpperCase() });
  });
  liveTips.forEach((t, i) => {
    const q = onMap(t.lat, t.lng);
    if (!q) return;
    pins.push({ kind: 'tip', i, x: q.x, y: q.y, prio: 0, iconH: 38, anchor: 33, label: escT(t.title || t.transcript || 'Voice tip').toUpperCase(), icon: TIP_ICONS[t.category] || 'info' });
  });

  const labelRects = [];
  [...pins].sort((a, b) => a.prio - b.prio).forEach(p => {
    const w = Math.min(170, 26 + p.label.length * 5.4);
    const cy = p.y - (p.anchor + p.iconH / 2 + 12); // label rides above the icon
    const rect = { l: p.x - w / 2, r: p.x + w / 2, t: cy - 9, b: cy + 9 };
    p.showLabel = !labelRects.some(o => o.l < rect.r && rect.l < o.r && o.t < rect.b && rect.t < o.b);
    if (p.showLabel) labelRects.push(rect);
  });

  /* translate anchors the ICON CENTER on the coordinate; the glow ellipse
   * below and the label above are decoration */
  const shell = (p, labelHtml, iconHtml, glow) => `
    <div data-action="open-tag" data-kind="${p.kind}" data-i="${p.i}" style="position:absolute;left:${Math.round(p.x)}px;top:${Math.round(p.y)}px;transform:translate(-50%,calc(-100% + ${p.anchor}px));text-align:center;pointer-events:auto;cursor:pointer;">
      <div style="animation:bobble2 3.2s ease-in-out infinite;display:flex;flex-direction:column;align-items:center;gap:4px;">${p.showLabel ? labelHtml : ''}${iconHtml}</div>
      <div style="margin:3px auto 0;width:34px;height:11px;border-radius:50%;background:radial-gradient(circle,${glow},transparent 70%);"></div>
    </div>`;

  wrap.innerHTML = pins.map(p => {
    if (p.kind === 'chal') {
      return shell(p, `
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:7px;background:rgba(8,18,16,.85);border:1px solid rgba(${p.rgb},.55);box-shadow:0 3px 9px rgba(0,0,0,.4);font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.04em;color:${p.tx};white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis;"><span class="msr fill" style="font-size:10px;">${p.solved ? 'task_alt' : 'travel_explore'}</span>${p.label}</span>`, `
        <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(180deg,rgba(${p.solved ? '112,224,176' : '255,143,143'},.95),rgba(${p.solved ? '24,158,106' : '214,58,58'},.95));border:2px solid rgba(255,255,255,.55);box-shadow:0 8px 18px rgba(${p.rgb},.5),inset 0 1px 0 rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;${p.solved ? '' : 'animation:glowpulse 2.4s ease-in-out infinite;'}">
          <span class="msr fill" style="font-size:24px;color:#fff;">${p.solved ? 'task_alt' : 'apartment'}</span>
        </div>`, `rgba(${p.rgb},.45)`);
    }
    if (p.kind === 'place') {
      return shell(p, `
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:7px;background:rgba(8,18,16,.85);border:1px solid rgba(60,192,224,.55);box-shadow:0 3px 9px rgba(0,0,0,.4);font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.04em;color:#7fd6ea;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;"><span class="msr fill" style="font-size:10px;">bookmark</span>${p.label}</span>`, `
        <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(180deg,#3cc0e0,#02769c);border:2px solid rgba(255,255,255,.5);box-shadow:0 7px 16px rgba(4,152,186,.5),inset 0 1px 0 rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;">
          <span class="msr fill" style="font-size:20px;color:#fff;">bookmark</span>
        </div>`, 'rgba(4,152,186,.5)');
    }
    return shell(p, `
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:7px;background:rgba(8,18,16,.85);border:1px solid rgba(245,197,66,.5);box-shadow:0 3px 9px rgba(0,0,0,.4);font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.04em;color:#ffe39a;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis;"><span class="msr fill" style="font-size:10px;">graphic_eq</span>${p.label}</span>`, `
        <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(180deg,#ffd95e,#f3ac10);border:2px solid rgba(255,255,255,.55);box-shadow:0 7px 16px rgba(243,172,16,.5),inset 0 1px 0 rgba(255,255,255,.45);display:flex;align-items:center;justify-content:center;">
          <span class="msr fill" style="font-size:20px;color:#5a3d06;">${p.icon}</span>
        </div>`, 'rgba(245,197,66,.45)');
  }).join('');
  wrap.style.display = 'block';
}

window.addEventListener('resize', renderLivePins);

/* ---------- flagged destination · nearest LIVE studio challenge ---------- */
let liveChallenges = [];   // LIVE challenges that carry real coordinates
let seasonMode = 'euro';
const fmtReward = v => seasonMode === 'points' ? Math.round(v * 100) + ' P' : '€ ' + Number(v).toFixed(2);
const flagDefaults = {};   // the design's fiction, restored with the illustrated fallback
['flag-label', 'flag-kicker', 'flag-title', 'flag-chips'].forEach(id => {
  const el = document.getElementById(id);
  if (el) flagDefaults[id] = el.innerHTML;
});

const distMeters = (a, b) => {
  const rad = x => x * Math.PI / 180;
  const s = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
};
const fmtDist = m => m < 950 ? Math.round(m) + ' m'
  : m < 100000 ? (m / 1000).toFixed(1) + ' km'
    : Math.round(m / 1000).toLocaleString('en-US') + ' km';

function renderFlag(liveOn) {
  const pin = document.getElementById('map-flag');
  const row = document.getElementById('flag-row');
  if (!pin || !row) return;
  if (!liveOn) { /* illustrated fallback: the design's fiction returns */
    row.style.display = 'flex'; /* its inline style is flex — '' would wipe it */
    pin.style.display = '';
    pin.style.left = '50%';
    pin.style.top = '27%';
    Object.keys(flagDefaults).forEach(id => { document.getElementById(id).innerHTML = flagDefaults[id]; });
    const chips = document.getElementById('flag-chips');
    if (chips) chips.style.display = '';
    tagSel = null;
    renderTagCard(); /* no real pins on the illustration */
    return;
  }
  /* live map: challenges render as their own investigate pins, and the
   * bottom banner only appears when a tag is tapped */
  row.style.display = 'none';
  pin.style.display = 'none';
}

/* ---------- tag inspector · tap your own pin to view / edit / delete ---------- */
let tagSel = null;       // { kind: 'tip'|'place', i: index }
let tagEdit = false;     // typing edit open
let tagDelArmed = false; // two-tap delete

const tagSelObj = () => !tagSel ? null
  : tagSel.kind === 'tip' ? liveTips[tagSel.i]
    : tagSel.kind === 'chal' ? liveChallenges[tagSel.i]
      : livePlaces[tagSel.i];

function renderTagCard() {
  const card = document.getElementById('tag-card');
  if (!card) return;
  const obj = tagSelObj();
  /* one Otto entry point at a time: the always-on bar steps aside while a
   * tag card (with its own report/retell actions) is open */
  const bar = document.getElementById('otto-bar');
  if (bar) bar.style.display = obj ? 'none' : 'flex';
  if (!obj) {
    tagSel = null; tagEdit = false; tagDelArmed = false;
    card.style.display = 'none'; card.innerHTML = '';
    return;
  }
  if (tagSel.kind === 'chal') { /* investigation challenge from the studio */
    const n = distinctReporters(obj.id);
    const solved = isSolved(obj.id);
    const mine = iReported(obj.id);
    const away = geo && typeof obj.lat === 'number' ? distMeters(geo, obj) : Infinity;
    const rgb = solved ? '70,211,154' : '255,107,107';
    const tx = solved ? '#7ce0b8' : '#ff9b9b';
    const BTN = "cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;";
    const NOTE = "display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;";
    const action = solved
      ? `<span style="${NOTE}background:rgba(70,211,154,.12);border:1px solid rgba(70,211,154,.4);color:#7ce0b8;"><span class="msr fill" style="font-size:13px;">paid</span>${escT(fmtReward(obj.value))} RELEASED TO ALL REPORTERS</span>`
      : mine
        ? `<span style="${NOTE}background:rgba(245,197,66,.1);border:1px solid rgba(245,197,66,.4);color:#ffe39a;"><span class="msr" style="font-size:13px;">hourglass_top</span>YOU REPORTED · WAITING FOR ${REPORTS_NEEDED - n} MORE</span>`
        : away <= REPORT_RADIUS
          ? `<span data-action="chal-report" style="${BTN}background:linear-gradient(180deg,#aab6ff,#4458d8);border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:700;"><span class="msr fill" style="font-size:13px;">mic</span>REPORT TO OTTO</span>`
          : `<span style="${NOTE}background:rgba(255,255,255,.05);border:1px solid rgba(140,165,200,.2);color:#8b97a8;"><span class="msr" style="font-size:13px;">near_me</span>GET WITHIN ${REPORT_RADIUS} M TO REPORT</span>`;
    card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="flex:none;width:44px;height:44px;border-radius:13px;background:linear-gradient(180deg,rgba(${rgb},.25),rgba(${rgb},.08));border:1px solid rgba(${rgb},.45);display:flex;align-items:center;justify-content:center;">
        <span class="msr fill" style="font-size:23px;color:${tx};">${solved ? 'task_alt' : 'apartment'}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;color:${tx};">${solved ? 'SOLVED · CONFIRMED BY ' + n : 'INVESTIGATE · ' + escT(fmtDist(away)).toUpperCase() + ' FROM YOU'}</span>
          <span data-action="tag-close" style="margin-left:auto;cursor:pointer;width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,.06);display:inline-flex;align-items:center;justify-content:center;"><span class="msr" style="font-size:14px;color:#8b97a8;">close</span></span>
        </div>
        <div style="font-family:'Saira Semi Condensed',sans-serif;font-weight:600;font-size:18px;line-height:1.05;color:#eef2f7;margin-top:3px;">${escT(obj.addr || obj.title)}</div>
        ${obj.desc ? `<div style="font-family:'Saira',sans-serif;font-size:12px;color:#94a1b2;margin-top:4px;">${escT(obj.desc)}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;align-items:center;">
          <span style="${NOTE}padding:4px 8px;background:rgba(95,224,180,.1);border:1px solid rgba(95,224,180,.3);color:#7ce0b8;">${escT(fmtReward(obj.value))}</span>
          <span style="${NOTE}padding:4px 8px;background:rgba(247,179,43,.1);border:1px solid rgba(247,179,43,.3);color:#f7c45e;">+${obj.xp} XP</span>
          <span style="${NOTE}padding:4px 8px;background:rgba(255,255,255,.05);border:1px solid rgba(140,165,200,.18);color:#cdd6e2;">${n}/${REPORTS_NEEDED} REPORTS</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;">${action}</div>
      </div>
    </div>`;
    card.style.display = 'block';
    return;
  }
  const isTip = tagSel.kind === 'tip';
  const accent = isTip ? '245,197,66' : '60,192,224';
  const text = isTip ? '#ffe39a' : '#7fd6ea';
  const titleText = isTip ? (obj.title || obj.transcript || 'Voice tip') : (obj.name || 'Saved place');
  const BTN = "cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;";
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="flex:none;width:44px;height:44px;border-radius:13px;background:linear-gradient(180deg,rgba(${accent},.25),rgba(${accent},.08));border:1px solid rgba(${accent},.45);display:flex;align-items:center;justify-content:center;">
        <span class="msr fill" style="font-size:23px;color:${text};">${isTip ? 'graphic_eq' : 'bookmark'}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;color:${text};">${isTip ? 'YOUR VOICE TAG · ' + escT(obj.category || 'INFO') : 'YOUR SAVED PLACE'}${geo && typeof obj.lat === 'number' ? ' · ' + fmtDist(distMeters(geo, obj)).toUpperCase() + ' FROM YOU' : ''}</span>
          <span data-action="tag-close" style="margin-left:auto;cursor:pointer;width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,.06);display:inline-flex;align-items:center;justify-content:center;"><span class="msr" style="font-size:14px;color:#8b97a8;">close</span></span>
        </div>
        ${tagEdit
    ? `<div style="display:flex;gap:7px;margin-top:6px;">
            <input id="tag-edit-input" value="${escT(titleText).replace(/"/g, '&quot;')}" maxlength="80" style="flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(${accent},.45);border-radius:9px;padding:8px 10px;color:#eef2f7;font-family:'Saira',sans-serif;font-size:14px;outline:none;">
            <span data-action="tag-type-save" style="${BTN}background:linear-gradient(180deg,#ffd95e,#f3ac10);color:#5a3d06;border:1px solid rgba(255,255,255,.4);font-weight:700;">SAVE</span>
          </div>`
    : `<div style="font-family:'Saira Semi Condensed',sans-serif;font-weight:600;font-size:18px;line-height:1.05;color:#eef2f7;margin-top:3px;">${escT(titleText)}</div>`}
        ${!tagEdit && (isTip ? obj.transcript : obj.note) ? `<div style="font-family:'Saira',sans-serif;font-size:12px;color:#94a1b2;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">&ldquo;${escT(isTip ? obj.transcript : obj.note)}&rdquo;</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;">
          ${isTip ? `<span data-action="tag-talk" style="${BTN}background:rgba(124,140,255,.14);border:1px solid rgba(124,140,255,.4);color:#aab6ff;"><span class="msr fill" style="font-size:13px;">mic</span>RETELL OTTO</span>` : ''}
          <span data-action="tag-type" style="${BTN}background:rgba(${accent},.12);border:1px solid rgba(${accent},.4);color:${text};"><span class="msr" style="font-size:13px;">edit</span>TYPE</span>
          <span data-action="tag-del" style="${BTN}background:rgba(255,107,107,${tagDelArmed ? '.3' : '.1'});border:1px solid rgba(255,107,107,.45);color:#ff9b9b;"><span class="msr" style="font-size:13px;">delete</span>${tagDelArmed ? 'SURE?' : 'DELETE'}</span>
        </div>
      </div>
    </div>`;
  card.style.display = 'block';
}

async function reverseGeocode({ lat, lng }) {
  /* Server-side Google via the geocode Edge Function first (worldwide
   * coverage, key in Supabase secrets), then the browser key, then OSM. */
  if (typeof DB !== 'undefined' && DB.enabled) {
    try {
      const d = await DB.geocode({ lat, lng });
      if (d && (d.street || d.area)) return d;
    } catch { /* function not deployed — fall through */ }
  }
  const gkey = window.GMAPS_KEY || '';
  if (gkey) {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${gkey}`);
      if (r.ok) {
        const d = await r.json();
        if (d.status === 'OK' && d.results && d.results.length) {
          const comp = type => {
            for (const res of d.results) {
              const c = (res.address_components || []).find(x => x.types.includes(type));
              if (c) return c.long_name;
            }
            return null;
          };
          const road = comp('route');
          const num = comp('street_number');
          const area = comp('neighborhood') || comp('sublocality_level_1') || comp('sublocality') || comp('locality');
          if (road) return { street: num ? `${road} ${num}` : road, area };
        }
      }
    } catch { /* fall through to Nominatim */ }
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    const road = a.road || a.pedestrian || a.footway || a.square || null;
    return {
      street: road ? (a.house_number ? `${road} ${a.house_number}` : road) : (d.name || null),
      area: a.suburb || a.city_district || a.neighbourhood || null,
    };
  } catch { return null; }
}

/* ---------- tag screen · real voice note through Otto ---------- */
const tagVoice = { rec: null, busy: false, note: null, title: null };

function setTagVoiceUI(state, heard) {
  const q = document.getElementById('tag-voice-q');
  const st = document.getElementById('tag-voice-status');
  if (q) {
    q.innerHTML = state === 'rec' ? '&ldquo;I&rsquo;m listening&hellip;&rdquo;'
      : state === 'think' ? '&ldquo;Got it — one second&hellip;&rdquo;'
        : state === 'done' ? '&ldquo;Noted — add more, or hit Save.&rdquo;'
          : state === 'denied' ? '&ldquo;I can&rsquo;t hear — allow the microphone.&rdquo;'
            : '&ldquo;What&rsquo;s here? A name, a note — anything.&rdquo;';
  }
  if (st) st.textContent = state === 'rec' ? 'Recording · tap the mic to send' : state === 'think' ? 'Transcribing your note' : 'Tap the mic and talk';
  const heardEl = document.getElementById('tag-heard');
  if (heard && heardEl) heardEl.innerHTML = `&ldquo;${escT(heard)}&rdquo;`;
}

function tagVoiceStop() {
  if (tagVoice.rec) {
    try { tagVoice.rec.onstop = null; tagVoice.rec.stop(); tagVoice.rec.stream.getTracks().forEach(t => t.stop()); } catch { /* already gone */ }
    tagVoice.rec = null;
  }
  tagVoice.busy = false;
}

function tagVoiceReset() {
  tagVoiceStop();
  tagVoice.note = null;
  tagVoice.title = null;
  if (canLiveVoice()) setTagVoiceUI('idle', 'Nothing yet — tap the mic and talk');
}

async function tagMicTap() {
  if (tagVoice.busy || !canLiveVoice()) return; /* demo mode: decorative */
  if (tagVoice.rec) { tagVoice.rec.stop(); return; } /* second tap sends */
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      tagVoice.rec = null;
      sendTagClip(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    };
    tagVoice.rec = rec;
    rec.start();
    setTagVoiceUI('rec');
  } catch { setTagVoiceUI('denied'); }
}

async function sendTagClip(blob) {
  tagVoice.busy = true;
  setTagVoiceUI('think');
  try {
    const d = await DB.ottoVoice(blob, placeLabel());
    tagVoice.note = d.transcript;
    tagVoice.title = (d.tip && d.tip.title) || null;
    setTagVoiceUI('done', d.transcript);
  } catch (e) {
    setTagVoiceUI('idle', `Couldn't reach the voice service (${(e && e.message) || 'offline'}) — try again`);
  }
  tagVoice.busy = false;
}

function localSavePlace(row) {
  try {
    const list = JSON.parse(localStorage.getItem('ds_places') || '[]');
    list.push({ ...row, created_at: new Date().toISOString() });
    localStorage.setItem('ds_places', JSON.stringify(list));
  } catch { /* private mode */ }
}

function localPatchPlaces(fn) {
  try {
    localStorage.setItem('ds_places', JSON.stringify(fn(JSON.parse(localStorage.getItem('ds_places') || '[]'))));
  } catch { /* private mode */ }
}

async function saveTaggedPlace() {
  const label = document.getElementById('tag-save-label');

  /* Never silently save the demo spot while the fix is still coming in —
   * wait for the GPS attempt to settle first. */
  if (geoState === 'locating') {
    label.textContent = 'Waiting for GPS…';
    await waitForFix();
  }

  const row = geo
    ? {
        /* the spoken note names the place; street or coordinates otherwise */
        name: tagVoice.title || geoAddr || `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`,
        note: tagVoice.note,
        lat: geo.lat, lng: geo.lng,
        accuracy: Math.round((geo.acc || 0) * 10) / 10,
      }
    : {
        /* clearly marked so demo rows are never mistaken for real places */
        name: `Demo spot (no GPS) · ${DEMO_SPOT.addr}`,
        note: 'Saved without a GPS fix — demo location',
        lat: DEMO_SPOT.lat, lng: DEMO_SPOT.lng, accuracy: null,
      };

  label.textContent = 'Saving…';
  const finish = shared => {
    label.textContent = shared ? 'Saved ✓' : 'Saved on this phone ✓';
    tagBonus = 50; /* first to map */
    renderPoints();
    if (geo) { livePlaces.push(row); renderLivePins(); } /* pin it right away */
    setTimeout(() => { show('map'); label.textContent = 'Save place'; }, 700);
  };
  if (typeof DB !== 'undefined' && DB.enabled) {
    DB.insertPlace(row).then(saved => {
      if (Array.isArray(saved) && saved[0] && saved[0].id) row.id = saved[0].id; /* editable later */
      finish(true);
    }).catch(() => { localSavePlace(row); finish(false); });
  } else {
    localSavePlace(row);
    finish(false);
  }
}

/* ---------- leaderboard ---------- */
const lb = { depot: 'all', mode: 'ind' };

const LB_IND = [
  { rank: 1, name: 'T. Köhler', initials: 'TK', route: 'Prenzlauer Berg', tips: 47, stops: 31, streak: 9 },
  { rank: 2, name: 'L. Sommer', initials: 'LS', route: 'Mitte', tips: 44, stops: 28, streak: 7 },
  { rank: 3, name: 'M. Kaur', initials: 'MK', route: 'Prenzlauer Berg', tips: 41, stops: 26, streak: 6, me: true },
  { rank: 4, name: 'A. Riedel', initials: 'AR', route: 'Kreuzberg', tips: 29, stops: 19, streak: 4 },
  { rank: 5, name: 'Marco Brandt', initials: 'MB', route: 'Neukölln', tips: 24, stops: 16, streak: 3 },
  { rank: 6, name: 'J. Vogel', initials: 'JV', route: 'Wedding', tips: 18, stops: 12, streak: 2 },
  { rank: 7, name: 'N. Acar', initials: 'NA', route: 'Friedrichshain', tips: 12, stops: 8, streak: 1 },
];
const LB_TEAM = [
  { rank: 1, name: 'Prenzlauer Berg', initials: 'PB', route: 'Kiez team', tips: 318, stops: 214, me: true },
  { rank: 2, name: 'Mitte', initials: 'MI', route: 'Kiez team', tips: 286, stops: 241 },
  { rank: 3, name: 'Kreuzberg', initials: 'KB', route: 'Kiez team', tips: 241, stops: 188 },
  { rank: 4, name: 'Neukölln', initials: 'NK', route: 'Kiez team', tips: 198, stops: 176 },
];

function renderLeaderboard() {
  const accentFor = r => r === 1 ? 'var(--gold,#FFCC00)' : r === 2 ? '#cfd8e3' : r === 3 ? '#e8a45a' : '#7b8799';
  const list = lb.mode === 'team' ? LB_TEAM : LB_IND;

  document.getElementById('lb-rows').innerHTML = list.map(d => {
    const bg = d.me ? 'rgba(var(--brand-rgb,4,152,186),.1)' : 'rgba(255,255,255,.022)';
    const bd = d.me ? 'rgba(var(--brand-rgb,4,152,186),.45)' : 'rgba(140,165,200,.1)';
    const metaLine = lb.mode === 'team'
      ? `${d.route} · ${d.stops} members`
      : `${d.route} · ${d.stops} places mapped${d.streak ? ' · streak ' + d.streak : ''}`;
    return `
    <div style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:12px;background:${bg};border:1px solid ${bd};">
      <span style="flex:none;width:24px;text-align:center;font-family:'Saira Semi Condensed',sans-serif;font-weight:700;font-size:16px;color:${accentFor(d.rank)};">${d.rank}</span>
      <span style="flex:none;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.04);border:1.5px solid ${bd};display:flex;align-items:center;justify-content:center;font-family:'Saira Semi Condensed',sans-serif;font-weight:700;font-size:13px;color:#cdd6e2;">${d.initials}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Saira Semi Condensed',sans-serif;font-weight:600;font-size:14px;color:#eef2f7;line-height:1.1;">${d.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#7b8799;margin-top:2px;">${metaLine}</div>
      </div>
      <div style="flex:none;text-align:right;">
        <div style="font-family:'Saira Semi Condensed',sans-serif;font-weight:700;font-size:18px;color:#eef2f7;line-height:1;">${d.tips}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:.1em;color:#7b8799;margin-top:1px;">HELPFUL</div>
      </div>
    </div>`;
  }).join('');

  const seg = (id, on) => {
    const b = document.getElementById(id);
    b.style.cssText += on
      ? ';background:rgba(var(--brand-rgb,4,152,186),.16);border:1px solid rgba(var(--brand-rgb,4,152,186),.55);color:var(--brand-l,#3cc0e0);'
      : ';background:rgba(255,255,255,.03);border:1px solid rgba(140,165,200,.16);color:#8b97a8;';
  };
  seg('lb-depot-mine', lb.depot === 'mine');
  seg('lb-depot-all', lb.depot === 'all');
  seg('lb-mode-ind', lb.mode === 'ind');
  seg('lb-mode-team', lb.mode === 'team');
}

/* ---------- Season · live challenges from Challenge Studio ---------- */
const UNIT_ICONS = { STOPS: 'pin_drop', CODES: 'key', PHOTOS: 'photo_camera', NOTES: 'mic', RIDES: 'explore', DOCKS: 'garage' };

function loadSeasonChallenges() {
  if (typeof DB === 'undefined' || !DB.enabled) return;
  Promise.all([DB.listChallenges(false), DB.fetchSettings()]).then(([rows, settingsRow]) => {
    const live = (rows || []).map(DB.rowToChal).filter(c => c.status === 'LIVE');
    liveChallenges = live.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number');
    renderLivePins(); /* the flagged pin follows the nearest live challenge */
    if (!live.length) return; // keep the design's static list
    const L = settingsRow ? DB.rowToLogic(settingsRow) : { mode: 'euro' };
    seasonMode = L.mode || 'euro';
    const fmt = v => L.mode === 'points' ? Math.round(v * 100) + ' P' : '€ ' + v.toFixed(2);

    document.getElementById('season-list-header').textContent = 'LIVE CHALLENGES · FROM THE HUB';
    document.getElementById('season-challenges').innerHTML = live.slice(0, 4).map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,255,255,.022);border:1px solid rgba(140,165,200,.1);">
      <span style="flex:none;width:30px;height:30px;border-radius:9px;background:rgba(95,224,180,.12);display:flex;align-items:center;justify-content:center;"><span class="msr fill" style="font-size:17px;color:#7ce0b8;">${UNIT_ICONS[c.unit] || 'pin_drop'}</span></span>
      <span style="flex:1;min-width:0;font-family:'Saira',sans-serif;font-size:13px;color:#dfe6ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(c.title).replace(/</g, '&lt;')}</span>
      <span style="flex:none;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.06em;color:#7ce0b8;">${fmt(c.value)} · +${c.xp} XP</span>
    </div>`).join('');
  }).catch(() => { /* offline — keep the static list */ });
}

/* ---------- events ---------- */
document.getElementById('phone-screen').addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    const to = nav.dataset.nav;
    if (to === 'back') goBack();
    else show(to);
    return;
  }
  const act = e.target.closest('[data-action]');
  if (!act) return;
  switch (act.dataset.action) {
    case 'otto-mic':
      if (voice.mode === 'live') ottoMicLive();
      else setBeat(beat + 1);
      break;
    case 'lb-depot-mine': lb.depot = 'mine'; renderLeaderboard(); break;
    case 'lb-depot-all': lb.depot = 'all'; renderLeaderboard(); break;
    case 'lb-mode-ind': lb.mode = 'ind'; renderLeaderboard(); break;
    case 'lb-mode-team': lb.mode = 'team'; renderLeaderboard(); break;
    case 'vote': {
      /* Helped/Outdated feedback — visual only in the prototype. */
      const row = act.parentElement;
      row.querySelectorAll('[data-action="vote"]').forEach(b => b.classList.add('vote-dim'));
      act.classList.remove('vote-dim');
      act.classList.add('vote-picked');
      break;
    }
    case 'gps-retry':
      if (geoState !== 'locating') startGeolocation();
      break;
    case 'tag-save':
      saveTaggedPlace();
      break;
    case 'tag-mic':
      tagMicTap();
      break;
    case 'open-tag':
      tagSel = { kind: act.dataset.kind, i: +act.dataset.i };
      tagEdit = false; tagDelArmed = false;
      renderTagCard();
      break;
    case 'tag-close':
      tagSel = null;
      renderTagCard();
      break;
    case 'tag-type': {
      tagEdit = true;
      renderTagCard();
      const inp = document.getElementById('tag-edit-input');
      if (inp) { inp.focus(); inp.select(); }
      break;
    }
    case 'tag-type-save': {
      const obj = tagSelObj();
      const inp = document.getElementById('tag-edit-input');
      const v = inp ? inp.value.trim() : '';
      const dbOn = typeof DB !== 'undefined' && DB.enabled;
      if (obj && v) {
        if (tagSel.kind === 'tip') {
          if (obj.id && dbOn) DB.updateTip(obj.id, { title: v }).catch(() => { /* run tips.sql again for edit rights */ });
          obj.title = v;
        } else {
          if (obj.id && dbOn) DB.updatePlace(obj.id, { name: v }).catch(() => { /* run places.sql again for edit rights */ });
          else localPatchPlaces(list => list.map(r => r.lat === obj.lat && r.lng === obj.lng && r.name === obj.name ? { ...r, name: v } : r));
          obj.name = v;
        }
      }
      tagEdit = false;
      renderTagCard();
      renderLivePins();
      break;
    }
    case 'chal-report': {
      const c = tagSel && tagSel.kind === 'chal' ? liveChallenges[tagSel.i] : null;
      if (!c || !geo || distMeters(geo, c) > REPORT_RADIUS || isSolved(c.id) || iReported(c.id)) break;
      voice.challenge = c;
      tagSel = null;
      renderTagCard();
      show('otto');
      break;
    }
    case 'tag-talk': {
      const obj = tagSelObj();
      if (obj && tagSel.kind === 'tip') {
        voice.editing = obj;
        tagSel = null;
        renderTagCard();
        show('otto');
      }
      break;
    }
    case 'tag-del': {
      const obj = tagSelObj();
      if (!obj) break;
      if (!tagDelArmed) { /* two-tap confirm, like the studio */
        tagDelArmed = true;
        renderTagCard();
        setTimeout(() => { if (tagDelArmed) { tagDelArmed = false; renderTagCard(); } }, 3000);
        break;
      }
      const dbOn = typeof DB !== 'undefined' && DB.enabled;
      if (tagSel.kind === 'tip') {
        if (obj.id && dbOn) DB.deleteTip(obj.id).catch(() => { /* run tips.sql again for delete rights */ });
        liveTips.splice(tagSel.i, 1);
      } else {
        if (obj.id && dbOn) DB.deletePlace(obj.id).catch(() => { /* run places.sql again for delete rights */ });
        else localPatchPlaces(list => list.filter(r => !(r.lat === obj.lat && r.lng === obj.lng && r.name === obj.name)));
        livePlaces.splice(tagSel.i, 1);
      }
      tagSel = null; tagDelArmed = false;
      renderTagCard();
      renderLivePins();
      break;
    }
  }
});

/* ---------- boot ---------- */
renderOtto();
renderPoints();
renderLeaderboard();
loadSeasonChallenges();
loadPlaces();
primeLiveMap();     // returning users: real map first, no illustrated flash
startGeolocation(); // the map is the home screen — center it on the real position
