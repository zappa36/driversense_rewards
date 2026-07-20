'use strict';

/* ============================================================
 * People Mobile v1 — 8-frame storyboard of the consumer app.
 * Implementation of "People Mobile v1.dc.html" (claude.ai/design).
 *
 * The board markup is static (mobile.html) so ambient animations
 * never reset; this file adds the theme, right-drag pan / scroll
 * zoom, the Otto debrief state machine, the leaderboard toggles,
 * and — when Supabase is configured — the live challenges from
 * Challenge Studio in the Season frame.
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

const board = document.getElementById('board');
const viewport = document.getElementById('viewport');

board.style.setProperty('--brand', theme.brand);
board.style.setProperty('--brand-rgb', rgbArr(theme.brand).join(','));
board.style.setProperty('--brand-l', shift(theme.brand, 42));
board.style.setProperty('--brand-d', shift(theme.brand, -34));
board.style.setProperty('--gold', theme.gold);
board.style.setProperty('--gamify', theme.gamify ? 'flex' : 'none');
board.style.setProperty('--gamify-inline', theme.gamify ? 'inline-flex' : 'none');

/* ---------- pan / zoom (right-drag pan · scroll zoom) ---------- */
let tx = 0, ty = 0, scale = Math.min(1, window.innerWidth / 2060);
tx = Math.max(0, (window.innerWidth - 2060 * scale) / 2);
const applyView = () => { board.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
applyView();

let panning = false, lastX = 0, lastY = 0;
viewport.addEventListener('mousedown', e => {
  if (e.button !== 2) return;
  panning = true; lastX = e.clientX; lastY = e.clientY;
  document.body.style.cursor = 'grabbing';
  e.preventDefault();
});
window.addEventListener('mousemove', e => {
  if (!panning) return;
  tx += e.clientX - lastX; ty += e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  applyView(); e.preventDefault();
});
window.addEventListener('mouseup', () => {
  if (!panning) return;
  panning = false; document.body.style.cursor = '';
});
viewport.addEventListener('contextmenu', e => e.preventDefault());
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = board.getBoundingClientRect();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const ns = Math.min(3, Math.max(0.25, scale * factor));
  const f = ns / scale;
  tx += (e.clientX - rect.left) * (1 - f);
  ty += (e.clientY - rect.top) * (1 - f);
  scale = ns;
  applyView();
}, { passive: false });

/* touch: one-finger pan */
let touchLast = null;
viewport.addEventListener('touchstart', e => { if (e.touches.length === 1) touchLast = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
viewport.addEventListener('touchmove', e => {
  if (!touchLast || e.touches.length !== 1) return;
  tx += e.touches[0].clientX - touchLast[0];
  ty += e.touches[0].clientY - touchLast[1];
  touchLast = [e.touches[0].clientX, e.touches[0].clientY];
  applyView();
}, { passive: true });
viewport.addEventListener('touchend', () => { touchLast = null; });

/* ---------- Frame 2 · Otto debrief state machine ---------- */
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

const EYES = `<span style="display:flex;align-items:center;gap:14px;">
  <span style="position:relative;width:16px;height:22px;border-radius:50%;background:#fff;display:block;animation:blink 3.6s ease-in-out infinite;transform-origin:center;"><span style="position:absolute;left:3px;top:4px;width:6px;height:6px;border-radius:50%;background:#2a3a78;"></span></span>
  <span style="position:relative;width:16px;height:22px;border-radius:50%;background:#fff;display:block;animation:blink 3.6s ease-in-out infinite;transform-origin:center;"><span style="position:absolute;left:3px;top:4px;width:6px;height:6px;border-radius:50%;background:#2a3a78;"></span></span>
</span>`;
const THINK = `<span class="msr fill" style="font-size:40px;color:#fff;animation:breathe 1.3s ease-in-out infinite;">auto_awesome</span>`;

const phaseFor = b => b >= beats.length - 1 ? 'done' : (beats[b].from === 'ai' ? 'listening' : 'thinking');

function renderOtto() {
  const b = beats[beat];
  const phase = phaseFor(beat);
  const el = id => document.getElementById(id);

  el('otto-face').innerHTML = phase === 'thinking' ? THINK : EYES;
  el('otto-ring1').style.display = phase === 'listening' ? '' : 'none';
  el('otto-ring2').style.display = phase === 'listening' ? '' : 'none';

  el('otto-msg').innerHTML = b.from === 'ai'
    ? `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;animation:msgin .3s ease;">
        <span style="display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;color:#aab6ff;"><span style="width:20px;height:20px;border-radius:6px;background:linear-gradient(180deg,#8b9bff,#4458d8);display:flex;align-items:center;justify-content:center;"><span class="msr fill" style="font-size:12px;color:#fff;">auto_awesome</span></span>OTTO</span>
        <div style="font-family:'Saira',sans-serif;font-weight:500;font-size:23px;line-height:1.42;color:#eef2f7;max-width:308px;text-wrap:pretty;">${b.text}</div>
      </div>`
    : `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;animation:msgin .3s ease;">
        <span style="display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;color:var(--brand-l,#3cc0e0);"><img src="assets/profile.png" alt="M. Kaur" style="width:20px;height:20px;border-radius:6px;object-fit:cover;display:block;">M. KAUR</span>
        <div style="font-family:'Saira',sans-serif;font-weight:500;font-size:23px;line-height:1.42;color:#dceaf2;max-width:308px;text-wrap:pretty;">&ldquo;${b.text}&rdquo;</div>
      </div>`;

  el('voice-caption').textContent = phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Otto is thinking…' : 'Saved to the place';
  el('voice-sub').textContent = phase === 'listening' ? 'Speak now — or tap the mic' : phase === 'thinking' ? 'Structuring your answer' : 'Everyone heading to Nº 47 sees it first';
  el('mic-btn').style.display = phase === 'done' ? 'none' : '';
  el('mic-ring').style.display = phase === 'listening' ? '' : 'none';
  el('done-chip').style.display = phase === 'done' && theme.gamify ? 'inline-flex' : 'none';
  el('points-chip').textContent = (phase === 'done' ? 1290 : 1240).toLocaleString('en-US');
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

/* ---------- Frame 4 · leaderboard ---------- */
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

/* ---------- actions ---------- */
board.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'otto-back': setBeat(beat - 1); break;
    case 'otto-next': setBeat(beat + 1); break;
    case 'otto-reset': clearTimeout(ottoTimer); setBeat(0); break;
    case 'otto-mic': setBeat(beat + 1); break;
    case 'lb-depot-mine': lb.depot = 'mine'; renderLeaderboard(); break;
    case 'lb-depot-all': lb.depot = 'all'; renderLeaderboard(); break;
    case 'lb-mode-ind': lb.mode = 'ind'; renderLeaderboard(); break;
    case 'lb-mode-team': lb.mode = 'team'; renderLeaderboard(); break;
  }
});

/* ---------- Frame 6 · live challenges from Challenge Studio ---------- */
const UNIT_ICONS = { STOPS: 'pin_drop', CODES: 'key', PHOTOS: 'photo_camera', NOTES: 'mic', RIDES: 'explore', DOCKS: 'garage' };

function loadSeasonChallenges() {
  if (typeof DB === 'undefined' || !DB.enabled) return;
  Promise.all([DB.listChallenges(false), DB.fetchSettings()]).then(([rows, settingsRow]) => {
    const live = (rows || []).map(DB.rowToChal).filter(c => c.status === 'LIVE');
    if (!live.length) return; // keep the design's static list
    const L = settingsRow ? DB.rowToLogic(settingsRow) : { mode: 'euro', weekendOn: true, weekendMult: 1.5 };
    const fmt = v => L.mode === 'points' ? Math.round(v * 100) + ' P' : '€ ' + v.toFixed(2);
    const eff = c => c.value * (c.boost && L.weekendOn ? L.weekendMult : 1);

    document.getElementById('season-list-header').textContent = 'LIVE CHALLENGES · FROM THE HUB';
    document.getElementById('season-challenges').innerHTML = live.slice(0, 4).map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,255,255,.022);border:1px solid rgba(140,165,200,.1);">
      <span style="flex:none;width:30px;height:30px;border-radius:9px;background:rgba(95,224,180,.12);display:flex;align-items:center;justify-content:center;"><span class="msr fill" style="font-size:17px;color:#7ce0b8;">${UNIT_ICONS[c.unit] || 'pin_drop'}</span></span>
      <span style="flex:1;min-width:0;font-family:'Saira',sans-serif;font-size:13px;color:#dfe6ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(c.title).replace(/</g, '&lt;')}</span>
      <span style="flex:none;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.06em;color:#7ce0b8;">${fmt(eff(c))} · +${Math.round(c.xp * (c.boost && L.weekendOn ? L.weekendMult : 1))} XP</span>
    </div>`).join('');
  }).catch(() => { /* offline — keep the static list */ });
}

/* ---------- boot ---------- */
renderOtto();
scheduleOtto();
renderLeaderboard();
loadSeasonChallenges();
