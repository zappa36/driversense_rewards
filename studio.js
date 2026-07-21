'use strict';

/* ============================================================
 * Challenge Studio — planner console for the Driver Rewards pilot
 * Implementation of "Challenge Studio.dc.html" (claude.ai/design).
 *
 * Same architecture as app.js: one state object, every mutation
 * re-renders the view from a computed view-model. Text fields
 * live-update the driver preview; focus/caret are restored across
 * re-renders. Number fields and selects commit on change.
 * ============================================================ */

/* ---------- configuration (design props, overridable via URL) ----------
 * ?drivers=24   hub driver count used in the economics estimates (5–200)
 * ?eco=0        hide the economics panel
 */
const params = new URLSearchParams(location.search);
const props = {
  hubDrivers: Math.min(200, Math.max(5, parseInt(params.get('drivers'), 10) || 24)),
  showEconomics: params.get('eco') !== '0',
};

/* ---------- state ---------- */
const state = {
  tab: 'chal',
  selId: 'c1',
  chals: [
    { id: 'c1', title: 'Mystery Stop Hunter', desc: "Refresh field notes at five unverified stops on tomorrow's route.", zone: 'Prenzlauer Berg', tier: 'MEDIUM', unit: 'STOPS', goal: 5, days: 3, value: 8.5, xp: 180, boost: true, status: 'LIVE' },
    { id: 'c2', title: 'Access Code Collector', desc: 'Confirm door codes at eight buildings around Rosenthaler Platz.', zone: 'Mitte', tier: 'MEDIUM', unit: 'CODES', goal: 8, days: 5, value: 5.2, xp: 120, boost: true, status: 'LIVE' },
    { id: 'c3', title: 'New Zone Scout', desc: 'First rides in Weißensee — map access where the system is blind.', zone: 'Weißensee', tier: 'EPIC', unit: 'RIDES', goal: 6, days: 6, value: 12, xp: 240, boost: true, status: 'LIVE' },
    { id: 'c4', title: 'Voice Note Sprint', desc: 'Speak ten hands-free approach notes for the next driver.', zone: 'Your route', tier: 'EASY', unit: 'NOTES', goal: 10, days: 2, value: 3.8, xp: 90, boost: false, status: 'LIVE' },
    { id: 'c5', title: 'Safe Drop Scout', desc: 'Photograph agreed safe-drop points at six stops missing one.', zone: 'Pankow', tier: 'EASY', unit: 'PHOTOS', goal: 6, days: 4, value: 4.6, xp: 110, boost: false, status: 'SCHEDULED' },
    { id: 'c6', title: 'District Master: Prenzlauer Berg', desc: 'Own your home zone this weekend — leave every stop verified, coded and noted.', zone: 'Prenzlauer Berg', tier: 'EPIC', unit: 'STOPS', goal: 12, days: 2, value: 15, xp: 400, boost: true, status: 'DRAFT' },
  ],
  logic: { mode: 'euro', weekendOn: true, weekendMult: 1.5, s3: 2.2, s7: 3.5, s14: 5, cashMin: 25, dailyCap: 15, autoConf: 90, photoTier: 'EPIC', budget: 1800, spent: 642 },
};

/* ---------- static data ---------- */
const ZONE_OPTS = ['Prenzlauer Berg', 'Mitte', 'Pankow', 'Weißensee', 'Gesundbrunnen', 'Wedding', 'Your route'];
const UNIT_OPTS = [
  { v: 'STOPS', l: 'Verify stops' }, { v: 'CODES', l: 'Confirm door codes' }, { v: 'PHOTOS', l: 'Safe-drop photos' },
  { v: 'NOTES', l: 'Voice notes' }, { v: 'RIDES', l: 'New-zone rides' }, { v: 'DOCKS', l: 'Map loading docks' },
];
const TIER_MAP = { EASY: ['rgba(95,224,180,.1)', '#5fe0b4'], MEDIUM: ['rgba(4,152,186,.12)', '#3cc0e0'], EPIC: ['rgba(245,197,66,.12)', '#ffd95e'] };
const ST_MAP = { LIVE: ['#5fe0b4', 'rgba(95,224,180,.09)'], SCHEDULED: ['#ffd95e', 'rgba(245,197,66,.1)'], DRAFT: ['#8b97a8', 'rgba(140,165,200,.1)'] };
const TAKEUP_RATES = { EASY: .7, MEDIUM: .45, EPIC: .25 };

/* Google Maps key (config.js) — powers address lookup + Street View preview */
const GMAPS = window.GMAPS_KEY || '';

/* ---------- style tokens ---------- */
const MONO = "font-family:'JetBrains Mono',monospace;";
const COND = "font-family:'Saira Semi Condensed',sans-serif;";
const CARD = 'border:1px solid rgba(140,165,200,.12);border-radius:16px;background:rgba(12,20,32,.55);';
const LABEL = `${MONO}font-size:9.5px;letter-spacing:.16em;color:#8b97a8;margin-bottom:7px;`;
const FIELD = 'width:100%;padding:10px;border-radius:10px;border:1px solid rgba(140,165,200,.2);background:rgba(7,13,22,.6);color:#eef2f7;outline:none;';

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = v => state.logic.mode === 'points' ? Math.round(v * 100) + ' P' : '€ ' + v.toFixed(2);
const sel = () => state.chals.find(c => c.id === state.selId) || state.chals[0];
const num = (raw, int) => {
  const v = parseFloat(raw);
  const n = isNaN(v) ? 0 : v;
  return Math.max(0, int ? Math.round(n) : n);
};
const eff = c => c.value * (c.boost && state.logic.weekendOn ? state.logic.weekendMult : 1);
const estCost = c => props.hubDrivers * (TAKEUP_RATES[c.tier] || .45) * eff(c);
const projected = () => state.logic.spent + state.chals.filter(c => c.status === 'LIVE').reduce((a, c) => a + estCost(c), 0);

const options = (list, cur) => list.map(o => `<option value="${esc(o.v)}"${o.v === cur ? ' selected' : ''}>${esc(o.l)}</option>`).join('');

const toggle = (action, on) =>
  `<div data-action="${action}" style="position:relative;flex:none;width:40px;height:22px;border-radius:999px;cursor:pointer;transition:background .15s;${on ? 'background:rgba(95,224,180,.55);' : 'background:rgba(140,165,200,.25);'}">
    <span style="position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#eef2f7;transition:transform .15s;${on ? 'transform:translateX(18px);' : ''}"></span>
  </div>`;

let idSeq = Date.now();
const newId = () => 'c' + (++idSeq);

/* ---------- address lookup (Google Geocoding, Berlin-biased) ---------- */
let addrSuggestions = [];
let addrTimer = null;

function scheduleAddrLookup(q) {
  clearTimeout(addrTimer);
  if (!GMAPS || !q || q.trim().length < 4) {
    if (addrSuggestions.length) { addrSuggestions = []; render(); }
    return;
  }
  addrTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&bounds=52.33,13.08%7C52.68,13.77&key=${GMAPS}`);
      const d = await r.json();
      addrSuggestions = (d.status === 'OK' ? d.results.slice(0, 4) : []).map(res => ({
        label: res.formatted_address,
        lat: res.geometry.location.lat,
        lng: res.geometry.location.lng,
      }));
    } catch { addrSuggestions = []; }
    render();
  }, 650);
}

/* ---------- Supabase sync ---------- */
let syncStatus = 'synced';
const SYNC_TEXT = { loading: 'SYNCING…', saving: 'SAVING…', synced: '● SYNCED', error: 'SYNC ERROR — RETRY SAVES ON NEXT EDIT' };

function setSync(s) {
  syncStatus = s;
  const el = document.querySelector('[data-sync]');
  if (el) {
    el.textContent = SYNC_TEXT[s];
    el.style.color = s === 'error' ? '#ff8a7a' : s === 'synced' ? '#5fe0b4' : '#8b97a8';
  }
}

/* Pull the shared library + rules from Supabase (planner session). */
async function loadRemote() {
  if (!DB.enabled) return;
  setSync('loading');
  try {
    const [rows, settingsRow] = await Promise.all([DB.listChallenges(true), DB.fetchSettings()]);
    if (rows && rows.length) {
      state.chals = rows.map(DB.rowToChal);
      if (!state.chals.find(c => c.id === state.selId)) state.selId = state.chals[0].id;
    }
    if (settingsRow) state.logic = DB.rowToLogic(settingsRow);
    syncStatus = 'synced';
  } catch {
    syncStatus = 'error';
  }
  render();
}

const saveTimers = new Map();
function persistChallenge(id, delay = 0) {
  if (!DB.enabled) return;
  clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(() => {
    const c = state.chals.find(x => x.id === id);
    if (!c) return;
    setSync('saving');
    DB.upsertChallenge(DB.chalToRow(c)).then(() => setSync('synced')).catch(() => setSync('error'));
  }, delay));
}

function persistDelete(id) {
  if (!DB.enabled) return;
  clearTimeout(saveTimers.get(id));
  setSync('saving');
  DB.deleteChallenge(id).then(() => setSync('synced')).catch(() => setSync('error'));
}

let logicTimer = null;
function persistLogic() {
  if (!DB.enabled) return;
  clearTimeout(logicTimer);
  logicTimer = setTimeout(() => {
    setSync('saving');
    DB.saveSettings(DB.logicToRow(state.logic)).then(() => setSync('synced')).catch(() => setSync('error'));
  }, 300);
}

/* ---------- admin lock screen ---------- */
let authError = false;
let signingIn = false;

function renderLockScreen() {
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;">
    <div style="position:sticky;top:0;z-index:50;background:rgba(7,13,22,.85);backdrop-filter:blur(10px);border-bottom:1px solid rgba(140,165,200,.1);">
      <div style="max-width:1180px;margin:0 auto;padding:0 40px;height:64px;display:flex;align-items:center;gap:12px;">
        <a href="index.html" style="display:inline-flex;align-items:center;gap:5px;${MONO}font-size:11px;letter-spacing:.08em;color:#8b97a8;"><span class="msr" style="font-size:15px;">arrow_back</span>HOME</a>
        <div style="width:1px;height:15px;background:rgba(140,165,200,.2);"></div>
        <span style="${MONO}font-size:10px;letter-spacing:.18em;color:#6f7c8e;">CHALLENGE STUDIO</span>
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:60px 40px;">
      <form data-form="unlock" style="width:400px;${CARD}padding:34px;">
        <div style="${MONO}font-size:10px;letter-spacing:.2em;color:#6f7c8e;">PLANNER CONSOLE · RESTRICTED</div>
        <div style="margin-top:12px;${COND}font-weight:700;font-size:27px;line-height:1.1;">Admin access required</div>
        <p style="margin:10px 0 0;font-size:13.5px;line-height:1.55;color:#94a1b2;">Creating and editing challenges is limited to network planners. ${DB.enabled ? 'Sign in with your planner account to continue.' : 'Enter the planner code to continue.'}</p>
        ${DB.enabled ? `
        <div style="margin-top:22px;${LABEL}">EMAIL</div>
        <input id="admin-email" type="email" autocomplete="username" autofocus style="${FIELD}padding:12px 13px;font-family:'Saira',sans-serif;font-size:14px;">
        <div style="margin-top:14px;${LABEL}">PASSWORD</div>
        <input id="admin-pass" type="password" autocomplete="current-password" style="${FIELD}padding:12px 13px;${MONO}font-size:14px;">
        ${authError ? `<div style="margin-top:9px;${MONO}font-size:10px;letter-spacing:.08em;color:#ff8a7a;">SIGN-IN FAILED — CHECK EMAIL AND PASSWORD</div>` : ''}
        ` : `
        <div style="margin-top:22px;${LABEL}">ADMIN CODE</div>
        <input id="admin-code" type="password" inputmode="numeric" autocomplete="off" autofocus style="${FIELD}padding:12px 13px;${MONO}font-size:15px;letter-spacing:.3em;">
        ${authError ? `<div style="margin-top:9px;${MONO}font-size:10px;letter-spacing:.08em;color:#ff8a7a;">WRONG CODE — ASK YOUR HUB LEAD FOR PLANNER ACCESS</div>` : ''}
        `}
        <button type="submit" ${signingIn ? 'disabled' : ''} style="display:block;width:100%;margin-top:16px;padding:12px;border-radius:11px;border:none;background:linear-gradient(180deg,#63dfae,#2fae7d);${COND}font-weight:700;font-size:13.5px;letter-spacing:.05em;color:#05231a;cursor:pointer;box-shadow:0 10px 22px -10px rgba(47,174,125,.6);${signingIn ? 'opacity:.6;cursor:wait;' : ''}">${signingIn ? 'SIGNING IN…' : 'UNLOCK STUDIO'}</button>
        <a href="index.html" style="display:block;margin-top:16px;text-align:center;${MONO}font-size:10px;letter-spacing:.1em;color:#8b97a8;">BACK TO DRIVER APP</a>
      </form>
    </div>
  </div>`;
}

/* ---------- sections ---------- */
function renderTopbar() {
  return `
  <div style="position:sticky;top:0;z-index:50;background:rgba(7,13,22,.85);backdrop-filter:blur(10px);border-bottom:1px solid rgba(140,165,200,.1);">
    <div style="max-width:1180px;margin:0 auto;padding:0 40px;height:64px;display:flex;align-items:center;gap:22px;">
      <div style="display:flex;align-items:center;gap:12px;flex:none;">
        <a href="index.html" style="display:inline-flex;align-items:center;gap:5px;${MONO}font-size:11px;letter-spacing:.08em;color:#8b97a8;"><span class="msr" style="font-size:15px;">arrow_back</span>HOME</a>
        <div style="width:1px;height:15px;background:rgba(140,165,200,.2);"></div>
        <span style="${MONO}font-size:10px;letter-spacing:.18em;color:#6f7c8e;">CHALLENGE STUDIO</span>
      </div>
      <div style="flex:1;"></div>
      ${DB.enabled ? `<span data-sync style="${MONO}font-size:9.5px;letter-spacing:.1em;color:${syncStatus === 'error' ? '#ff8a7a' : syncStatus === 'synced' ? '#5fe0b4' : '#8b97a8'};">${SYNC_TEXT[syncStatus]}</span>
      <div style="width:1px;height:15px;background:rgba(140,165,200,.2);"></div>` : ''}
      <span style="${MONO}font-size:11.5px;font-weight:700;color:#5fe0b4;">BUDGET ${fmt(projected())} / ${fmt(state.logic.budget)}</span>
      <div style="display:flex;align-items:center;gap:9px;flex:none;">
        <div style="text-align:right;line-height:1.1;"><div style="${COND}font-weight:600;font-size:13px;">${DB.enabled && DB.userEmail() ? esc(DB.userEmail()) : 'L. Hoffmann'}</div><div style="${MONO}font-size:9px;letter-spacing:.12em;color:#6f7c8e;">NETWORK PLANNER</div></div>
        <img src="assets/profile.png" alt="L. Hoffmann" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(140,165,200,.35);display:block;">
      </div>
      <div style="width:1px;height:15px;background:rgba(140,165,200,.2);"></div>
      <span data-action="signout" style="cursor:pointer;${MONO}font-size:10px;letter-spacing:.1em;color:#8b97a8;">SIGN OUT</span>
    </div>
  </div>`;
}

function renderHeader() {
  const tab = active => `cursor:pointer;border:none;padding:8px 18px;border-radius:9px;${COND}font-weight:600;font-size:13.5px;transition:all .15s;` +
    (active ? 'background:rgba(4,152,186,.16);color:#3cc0e0;box-shadow:inset 0 0 0 1px rgba(4,152,186,.4);' : 'background:transparent;color:#7b8799;');
  return `
  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:30px;">
    <div>
      <div style="${MONO}font-size:11px;letter-spacing:.2em;color:#6f7c8e;margin-bottom:12px;">SEASON 3 · BERLIN NORD HUB · PLANNER CONSOLE</div>
      <h1 style="margin:0;${COND}font-weight:700;font-size:42px;line-height:1;">Challenge Studio</h1>
      <p style="margin:10px 0 0;font-size:14.5px;color:#94a1b2;max-width:600px;">Define what drivers get paid extra for — and the rules every payout follows. Changes go live in the driver app instantly.</p>
    </div>
    <div style="flex:none;display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(140,165,200,.16);">
      <button data-action="tab" data-tab="chal" style="${tab(state.tab === 'chal')}">Challenges</button>
      <button data-action="tab" data-tab="logic" style="${tab(state.tab === 'logic')}">Reward logic</button>
    </div>
  </div>`;
}

function renderLibrary() {
  return `
  <div style="${CARD}overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(140,165,200,.12);">
      <span style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;">LIBRARY · ${state.chals.length}</span>
      <button data-action="new" style="cursor:pointer;border:1px solid rgba(4,152,186,.45);background:rgba(4,152,186,.1);border-radius:8px;padding:6px 12px;${MONO}font-size:10px;letter-spacing:.1em;font-weight:700;color:#3cc0e0;">+ NEW</button>
    </div>
    ${state.chals.map(c => {
      const [col, bg] = ST_MAP[c.status];
      const active = state.selId === c.id;
      return `
      <div data-action="select-chal" data-id="${c.id}" style="display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;border-bottom:1px solid rgba(140,165,200,.09);${active ? 'background:rgba(4,152,186,.09);box-shadow:inset 2px 0 0 #3cc0e0;' : ''}">
        <span style="flex:none;width:8px;height:8px;border-radius:50%;background:${col};"></span>
        <div style="flex:1;min-width:0;">
          <div style="${COND}font-weight:600;font-size:14.5px;line-height:1.2;color:${active ? '#3cc0e0' : '#eef2f7'};">${esc(c.title)}</div>
          <div style="${MONO}font-size:9px;letter-spacing:.08em;color:#6f7c8e;margin-top:3px;">${c.tier} · ${fmt(c.value)} · ${esc(c.zone.toUpperCase())}</div>
        </div>
        <span style="flex:none;padding:3px 8px;border-radius:6px;${MONO}font-size:9px;letter-spacing:.12em;font-weight:700;background:${bg};color:${col};">${c.status}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function renderEditor() {
  const f = sel();
  const L = state.logic;
  const tierPills = ['EASY', 'MEDIUM', 'EPIC'].map(t => {
    const on = f.tier === t;
    const [bg, col] = TIER_MAP[t];
    return `<span data-action="pick-tier" data-tier="${t}" style="cursor:pointer;padding:7px 14px;border-radius:8px;${MONO}font-size:10px;letter-spacing:.12em;font-weight:700;transition:all .15s;${on ? `background:${bg};color:${col};box-shadow:inset 0 0 0 1px ${col};` : 'background:rgba(255,255,255,.03);color:#7b8799;box-shadow:inset 0 0 0 1px rgba(140,165,200,.18);'}">${t}</span>`;
  }).join('');
  const boostNote = f.boost ? (L.weekendOn ? `×${L.weekendMult} ON WEEKENDS` : 'BOOST PAUSED GLOBALLY') : 'BASE RATE ONLY';
  return `
  <div>
    <div style="display:flex;gap:12px;">
      <div style="flex:1;">
        <div style="${LABEL}">TITLE</div>
        <input data-input="title" value="${esc(f.title)}" style="${FIELD}padding:11px 13px;${COND}font-weight:600;font-size:17px;">
      </div>
      <div style="width:138px;flex:none;">
        <div style="${LABEL}">STATUS</div>
        <select data-change="status" style="${FIELD}padding:11px 10px;${MONO}font-size:11px;letter-spacing:.08em;">
          ${options([{ v: 'DRAFT', l: 'DRAFT' }, { v: 'SCHEDULED', l: 'SCHEDULED' }, { v: 'LIVE', l: 'LIVE' }], f.status)}
        </select>
      </div>
    </div>
    <div style="margin-top:16px;">
      <div style="${LABEL}">DRIVER-FACING DESCRIPTION</div>
      <textarea data-input="desc" rows="2" style="${FIELD}resize:vertical;padding:11px 13px;color:#cdd6e2;font-family:'Saira',sans-serif;font-size:13.5px;line-height:1.5;">${esc(f.desc)}</textarea>
    </div>
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      <div>
        <div style="${LABEL}">ZONE</div>
        <select data-change="zone" style="${FIELD}font-family:'Saira',sans-serif;font-size:13.5px;">${options(ZONE_OPTS.map(z => ({ v: z, l: z })), f.zone)}</select>
      </div>
      <div>
        <div style="${LABEL}">TASK TYPE</div>
        <select data-change="unit" style="${FIELD}font-family:'Saira',sans-serif;font-size:13.5px;">${options(UNIT_OPTS, f.unit)}</select>
      </div>
      <div>
        <div style="${LABEL}">GOAL (COUNT)</div>
        <input data-change="goal" type="number" min="1" value="${f.goal}" style="${FIELD}${MONO}font-size:13px;">
      </div>
      <div>
        <div style="${LABEL}">DURATION (DAYS)</div>
        <input data-change="days" type="number" min="1" value="${f.days}" style="${FIELD}${MONO}font-size:13px;">
      </div>
      <div>
        <div style="${LABEL}">BASE REWARD €</div>
        <input data-change="value" type="number" min="0" step="0.1" value="${f.value}" style="${FIELD}border-color:rgba(95,224,180,.35);color:#5fe0b4;${MONO}font-size:13px;font-weight:700;">
      </div>
      <div>
        <div style="${LABEL}">BONUS XP</div>
        <input data-change="xp" type="number" min="0" step="10" value="${f.xp}" style="${FIELD}${MONO}font-size:13px;">
      </div>
    </div>
    <div style="margin-top:16px;">
      <div style="${LABEL}">PLACE · ADDRESS${GMAPS ? ` <span style="color:#5f6e80;">· GOOGLE MAPS LOOKUP</span>` : ''}</div>
      <div style="position:relative;">
        <input data-input="addr" value="${esc(f.addr || '')}" placeholder="${GMAPS ? 'Search a real address — e.g. Rykestraße 21' : 'Address label shown on the driver card'}" autocomplete="off" style="${FIELD}padding:11px 13px;font-family:'Saira',sans-serif;font-size:13.5px;">
        ${addrSuggestions.length ? `<div style="position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:20;border-radius:12px;border:1px solid rgba(4,152,186,.4);background:rgba(7,13,22,.97);overflow:hidden;box-shadow:0 18px 40px -12px rgba(0,0,0,.8);">
          ${addrSuggestions.map((s, i) => `<div data-action="pick-addr" data-i="${i}" style="display:flex;align-items:center;gap:9px;padding:10px 13px;cursor:pointer;border-bottom:1px solid rgba(140,165,200,.08);" onmouseover="this.style.background='rgba(4,152,186,.12)'" onmouseout="this.style.background='transparent'">
            <span class="msr fill" style="font-size:15px;color:#3cc0e0;pointer-events:none;">location_on</span>
            <span style="flex:1;font-family:'Saira',sans-serif;font-size:13px;color:#dfe6ee;pointer-events:none;">${esc(s.label)}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>
      ${f.lat != null && f.lng != null ? `
      <div style="margin-top:9px;display:flex;align-items:center;gap:10px;">
        <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;background:rgba(95,224,180,.09);${MONO}font-size:10px;color:#5fe0b4;"><span class="msr fill" style="font-size:12px;">location_on</span>${(+f.lat).toFixed(5)}, ${(+f.lng).toFixed(5)}</span>
        <span style="${MONO}font-size:9px;letter-spacing:.08em;color:#6f7c8e;">SHOWN ON THE DRIVER CARD</span>
        <span data-action="clear-addr" style="margin-left:auto;cursor:pointer;${MONO}font-size:10px;letter-spacing:.08em;color:#8b97a8;">CLEAR</span>
      </div>
      ${GMAPS ? `<div style="margin-top:9px;border-radius:12px;overflow:hidden;border:1px solid rgba(140,165,200,.15);"><img src="https://maps.googleapis.com/maps/api/streetview?size=640x160&location=${f.lat},${f.lng}&fov=80&key=${GMAPS}" alt="Street View preview" loading="lazy" style="display:block;width:100%;height:118px;object-fit:cover;" onerror="this.parentElement.style.display='none'"></div>` : ''}` : ''}
    </div>
    <div style="margin-top:18px;display:flex;align-items:center;gap:26px;">
      <div>
        <div style="${LABEL}margin-bottom:8px;">DIFFICULTY TIER</div>
        <div style="display:flex;gap:8px;">${tierPills}</div>
      </div>
      <div>
        <div style="${LABEL}margin-bottom:8px;">WEEKEND BOOST ELIGIBLE</div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${toggle('toggle-boost', f.boost)}
          <span style="${MONO}font-size:10px;letter-spacing:.08em;color:${f.boost && L.weekendOn ? '#ffd95e' : '#6f7c8e'};">${boostNote}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function renderSidecar() {
  const f = sel();
  const L = state.logic;
  const [tierBg, tierCol] = TIER_MAP[f.tier];
  const effV = eff(f);
  const rate = TAKEUP_RATES[f.tier] || .45;
  const isLive = f.status === 'LIVE';
  const eco = !props.showEconomics ? '' : `
    <div style="border:1px solid rgba(140,165,200,.12);border-radius:14px;background:rgba(7,13,22,.4);padding:16px 18px;">
      <div style="${LABEL}margin-bottom:10px;">ECONOMICS</div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;color:#94a1b2;"><span>Est. take-up</span><span style="${MONO}color:#cdd6e2;">${Math.round(rate * 100)}% × ${props.hubDrivers} DRIVERS</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;color:#94a1b2;"><span>Payout / completion</span><span style="${MONO}color:#cdd6e2;">${fmt(effV)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:7px 0 0;margin-top:5px;border-top:1px solid rgba(140,165,200,.12);font-size:12.5px;color:#cdd6e2;"><span style="font-weight:600;">Est. total cost</span><span style="${MONO}font-weight:700;color:#5fe0b4;">${fmt(estCost(f))}</span></div>
      <div style="margin-top:8px;${MONO}font-size:9px;letter-spacing:.08em;color:#6f7c8e;">${f.boost && L.weekendOn ? `INCLUDES WEEKEND ×${L.weekendMult} · CAP ${fmt(L.dailyCap)}/DAY` : `CAP ${fmt(L.dailyCap)}/DAY/DRIVER`}</div>
    </div>`;
  return `
  <div style="display:flex;flex-direction:column;gap:14px;">
    <div>
      <div style="${LABEL}margin-bottom:8px;">DRIVER PREVIEW</div>
      <div style="border:1px solid rgba(4,152,186,.35);border-radius:14px;background:rgba(7,13,22,.7);padding:18px;">
        <span style="display:inline-block;padding:3px 9px;border-radius:6px;${MONO}font-size:9.5px;letter-spacing:.14em;font-weight:700;background:${tierBg};color:${tierCol};">${f.tier}</span>
        <div style="margin-top:10px;${COND}font-weight:600;font-size:17px;line-height:1.2;">${esc(f.title)}</div>
        <div style="margin-top:4px;${MONO}font-size:9.5px;letter-spacing:.1em;color:#8b97a8;">${esc(f.zone.toUpperCase())} · ${f.goal} ${f.unit} · ${f.days}D LEFT</div>
        <div style="margin-top:6px;font-size:12px;line-height:1.5;color:#94a1b2;">${esc(f.desc)}</div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(140,165,200,.12);display:flex;align-items:baseline;justify-content:space-between;">
          <span style="${MONO}font-size:14px;font-weight:700;color:#5fe0b4;">${fmt(effV)}</span>
          <span style="${MONO}font-size:10px;letter-spacing:.1em;color:#8b97a8;">+${Math.round(f.xp * (f.boost && L.weekendOn ? L.weekendMult : 1))} XP</span>
        </div>
      </div>
    </div>
    ${eco}
    <button data-action="publish" style="display:block;width:100%;padding:12px;border-radius:11px;${COND}font-weight:700;font-size:13.5px;letter-spacing:.05em;cursor:pointer;transition:transform .15s;${isLive ? 'background:rgba(255,255,255,.03);border:1px solid rgba(140,165,200,.25);color:#94a1b2;' : 'border:none;background:linear-gradient(180deg,#63dfae,#2fae7d);color:#05231a;box-shadow:0 10px 22px -10px rgba(47,174,125,.6);'}">${isLive ? 'UNPUBLISH → DRAFT' : 'PUBLISH LIVE'}</button>
    <div style="display:flex;justify-content:center;gap:20px;">
      <span data-action="duplicate" style="cursor:pointer;${MONO}font-size:10px;letter-spacing:.1em;color:#3cc0e0;">DUPLICATE</span>
      <span data-action="archive" style="cursor:pointer;${MONO}font-size:10px;letter-spacing:.1em;color:#8b97a8;">ARCHIVE</span>
    </div>
  </div>`;
}

function renderChallengesTab() {
  return `
  <div style="margin-top:32px;display:grid;grid-template-columns:330px minmax(0,1fr);gap:18px;align-items:start;">
    ${renderLibrary()}
    <div style="${CARD}padding:26px;display:grid;grid-template-columns:minmax(0,1fr) 288px;gap:26px;align-items:start;">
      ${renderEditor()}
      ${renderSidecar()}
    </div>
  </div>`;
}

function renderLogicTab() {
  const L = state.logic;
  const modeCard = on => `flex:1;cursor:pointer;padding:14px 16px;border-radius:12px;transition:all .15s;border:1px solid ${on ? 'rgba(95,224,180,.45);background:rgba(95,224,180,.05);' : 'rgba(140,165,200,.14);background:transparent;'}`;
  const proj = projected();
  const rawPct = L.budget > 0 ? (proj / L.budget) * 100 : Infinity;
  const pctW = Math.min(100, rawPct).toFixed(1) + '%';
  const barColor = rawPct > 90 ? 'linear-gradient(90deg,#b4544a,#ff8a7a)' : rawPct > 70 ? 'linear-gradient(90deg,#b47c10,#ffd95e)' : 'linear-gradient(90deg,#1f8a63,#5fe0b4)';
  const note = rawPct > 100 ? 'OVER BUDGET — PAUSE A CHALLENGE OR RAISE THE CAP' : Math.round(100 - rawPct) + '% HEADROOM LEFT THIS SEASON';
  return `
  <div style="margin-top:32px;">
    <p style="margin:0 0 18px;font-size:13.5px;color:#94a1b2;">Hub-wide rules — these apply to every challenge and payout on this page and in the driver app.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;">

      <div style="${CARD}padding:24px;">
        <div style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;margin-bottom:14px;">PAYOUT CURRENCY</div>
        <div style="display:flex;gap:10px;">
          <div data-action="mode-euro" style="${modeCard(L.mode === 'euro')}">
            <div style="${COND}font-weight:700;font-size:16px;color:#5fe0b4;">€ Euro balance</div>
            <div style="margin-top:3px;font-size:12px;color:#94a1b2;">Real money, cashed out via SEPA, voucher or fuel card.</div>
          </div>
          <div data-action="mode-points" style="${modeCard(L.mode === 'points')}">
            <div style="${COND}font-weight:700;font-size:16px;color:#cdd6e2;">Points</div>
            <div style="margin-top:3px;font-size:12px;color:#94a1b2;">100 P = € 1.00 · spent in the rewards shop only.</div>
          </div>
        </div>
        <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(140,165,200,.12);">
          <div style="display:flex;align-items:center;gap:12px;">
            ${toggle('toggle-wk', L.weekendOn)}
            <div style="flex:1;">
              <div style="${COND}font-weight:600;font-size:14.5px;">Weekend boost</div>
              <div style="font-size:12px;color:#7b8799;">Multiplies reward + XP on boost-eligible challenges, Sat–Sun.</div>
            </div>
            <select data-change="wkmult" style="width:92px;flex:none;padding:9px 10px;border-radius:10px;border:1px solid rgba(245,197,66,.35);background:rgba(7,13,22,.6);color:#ffd95e;${MONO}font-size:12px;font-weight:700;outline:none;">
              ${options([{ v: '1.25', l: '×1.25' }, { v: '1.5', l: '×1.5' }, { v: '2', l: '×2' }], String(L.weekendMult))}
            </select>
          </div>
        </div>
      </div>

      <div style="${CARD}padding:24px;">
        <div style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;margin-bottom:14px;">REPORTING STREAK LADDER</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">DAY 3 €</div>
            <input data-change="s3" type="number" min="0" step="0.1" value="${L.s3}" style="${FIELD}${MONO}font-size:13px;">
          </div>
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">DAY 7 €</div>
            <input data-change="s7" type="number" min="0" step="0.1" value="${L.s7}" style="${FIELD}${MONO}font-size:13px;">
          </div>
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">DAY 14 €</div>
            <input data-change="s14" type="number" min="0" step="0.1" value="${L.s14}" style="${FIELD}${MONO}font-size:13px;">
          </div>
        </div>
        <div style="margin-top:12px;${MONO}font-size:10px;letter-spacing:.08em;color:#ffd95e;">DAY 3 → ${fmt(L.s3)} · DAY 7 → ${fmt(L.s7)} · DAY 14 → ${fmt(L.s14)}</div>
        <div style="margin-top:6px;font-size:12px;color:#7b8799;">A missed day resets the streak to day 1. Paid the morning the milestone is hit.</div>
      </div>

      <div style="${CARD}padding:24px;">
        <div style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;margin-bottom:14px;">CASHOUT &amp; CAPS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">MIN CASHOUT €</div>
            <input data-change="cashmin" type="number" min="0" value="${L.cashMin}" style="${FIELD}${MONO}font-size:13px;">
          </div>
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">DAILY CAP € / DRIVER</div>
            <input data-change="dailycap" type="number" min="0" value="${L.dailyCap}" style="${FIELD}${MONO}font-size:13px;">
          </div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:#7b8799;">Payouts land with the Friday salary run, no fees. The daily cap keeps reporting honest — quality over volume.</div>
      </div>

      <div style="${CARD}padding:24px;">
        <div style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;margin-bottom:14px;">VERIFICATION GUARDRAILS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">AUTO-APPROVE ≥ CONF %</div>
            <input data-change="autoconf" type="number" min="50" max="100" value="${L.autoConf}" style="${FIELD}${MONO}font-size:13px;">
          </div>
          <div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">PHOTO PROOF REQUIRED</div>
            <select data-change="phototier" style="${FIELD}font-family:'Saira',sans-serif;font-size:13px;">
              ${options([{ v: 'NONE', l: 'Never' }, { v: 'EPIC', l: 'Epic tier only' }, { v: 'MEDIUM', l: 'Medium + Epic' }, { v: 'ALL', l: 'All tiers' }], L.photoTier)}
            </select>
          </div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:#7b8799;">Below the confidence bar, payouts hold until a second driver confirms or dispatch reviews.</div>
      </div>

      <div style="grid-column:1 / -1;${CARD}padding:24px;display:flex;align-items:center;gap:28px;">
        <div style="width:180px;flex:none;">
          <div style="${MONO}font-size:9.5px;letter-spacing:.14em;color:#6f7c8e;margin-bottom:7px;">SEASON BUDGET €</div>
          <input data-change="budget" type="number" min="0" step="50" value="${L.budget}" style="${FIELD}border-color:rgba(95,224,180,.35);color:#5fe0b4;${MONO}font-size:13px;font-weight:700;">
        </div>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;${MONO}font-size:10px;letter-spacing:.1em;"><span style="color:#8b97a8;">${fmt(L.spent)} SPENT</span><span style="color:#cdd6e2;">${fmt(proj)} PROJECTED</span></div>
          <div style="height:7px;border-radius:4px;background:rgba(140,165,200,.14);overflow:hidden;"><div data-aw-key="budget" data-aw="${pctW}" style="height:100%;width:${pctW};border-radius:4px;background:${barColor};transition:width .4s ease;"></div></div>
          <div style="margin-top:8px;${MONO}font-size:10px;letter-spacing:.1em;color:#6f7c8e;">${note}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- render loop ---------- */
const root = document.getElementById('app');

const widthMemo = new Map();
function applyAnimatedWidths() {
  root.querySelectorAll('[data-aw-key]').forEach(el => {
    const key = el.dataset.awKey;
    const target = el.dataset.aw;
    const prev = widthMemo.get(key);
    widthMemo.set(key, target);
    if (prev !== undefined && prev !== target) {
      el.style.width = prev;
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = target; }));
    }
  });
}

function render() {
  if (!AUTH.isAdmin()) {
    root.innerHTML = renderLockScreen();
    const first = root.querySelector(DB.enabled ? '#admin-email' : '#admin-code');
    if (first) first.focus();
    return;
  }

  /* Text fields live-update the preview, so remember focus + caret and
   * restore them after the DOM is rebuilt. */
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.input : undefined;
  const caret = focusKey && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null;

  root.innerHTML = `
  <div style="min-height:100vh;">
    ${renderTopbar()}
    <div style="max-width:1180px;margin:0 auto;padding:44px 40px 80px;">
      ${renderHeader()}
      ${state.tab === 'chal' ? renderChallengesTab() : renderLogicTab()}
      <div style="margin-top:56px;${MONO}font-size:10px;letter-spacing:.14em;color:#4f5a69;">POSTNORD · REAL-WORLD INTELLIGENCE LAYER · REWARDS PILOT · PLANNER CONSOLE</div>
    </div>
  </div>`;

  if (focusKey) {
    const el = root.querySelector(`[data-input="${focusKey}"]`);
    if (el) {
      el.focus();
      if (caret) el.setSelectionRange(caret[0], caret[1]);
    }
  }
  applyAnimatedWidths();
}

/* ---------- state transitions ---------- */
function updSel(key, value) {
  const c = sel();
  if (c) {
    c[key] = value;
    persistChallenge(c.id, key === 'title' || key === 'desc' || key === 'addr' ? 600 : 0);
  }
  render();
}

const clickActions = {
  tab(d) { state.tab = d.tab; addrSuggestions = []; render(); },
  'select-chal'(d) { state.selId = d.id; addrSuggestions = []; render(); },
  'pick-addr'(d) {
    const s = addrSuggestions[+d.i];
    if (!s) return;
    const c = sel();
    if (c) {
      c.addr = s.label.split(',')[0]; /* short label for the driver card chip */
      c.lat = s.lat;
      c.lng = s.lng;
      persistChallenge(c.id);
    }
    addrSuggestions = [];
    render();
  },
  'clear-addr'() {
    const c = sel();
    if (c) { c.addr = null; c.lat = null; c.lng = null; persistChallenge(c.id); }
    addrSuggestions = [];
    render();
  },
  'pick-tier'(d) { updSel('tier', d.tier); },
  'toggle-boost'() { updSel('boost', !sel().boost); },
  publish() { updSel('status', sel().status === 'LIVE' ? 'DRAFT' : 'LIVE'); },
  duplicate() {
    const src = sel();
    const copy = { ...src, id: newId(), title: src.title + ' (copy)', status: 'DRAFT' };
    state.chals.push(copy);
    state.selId = copy.id;
    persistChallenge(copy.id);
    render();
  },
  archive() {
    if (state.chals.length < 2) return;
    const gone = state.selId;
    state.chals = state.chals.filter(c => c.id !== gone);
    state.selId = state.chals[0].id;
    persistDelete(gone);
    render();
  },
  new() {
    const fresh = { id: newId(), title: 'New challenge', desc: 'What should the driver do, and why it matters.', zone: 'Prenzlauer Berg', tier: 'EASY', unit: 'STOPS', goal: 5, days: 3, value: 4, xp: 100, boost: false, status: 'DRAFT' };
    state.chals.push(fresh);
    state.selId = fresh.id;
    state.tab = 'chal';
    persistChallenge(fresh.id);
    render();
  },
  'mode-euro'() { state.logic.mode = 'euro'; persistLogic(); render(); },
  'mode-points'() { state.logic.mode = 'points'; persistLogic(); render(); },
  'toggle-wk'() { state.logic.weekendOn = !state.logic.weekendOn; persistLogic(); render(); },
  signout() { AUTH.signOut(); authError = false; render(); },
};

/* Selects and number fields commit on change. */
const changeActions = {
  status: v => updSel('status', v),
  zone: v => updSel('zone', v),
  unit: v => updSel('unit', v),
  goal: v => updSel('goal', Math.max(1, num(v, true))),
  days: v => updSel('days', Math.max(1, num(v, true))),
  value: v => updSel('value', num(v)),
  xp: v => updSel('xp', num(v, true)),
  wkmult: v => { state.logic.weekendMult = parseFloat(v); persistLogic(); render(); },
  s3: v => { state.logic.s3 = num(v); persistLogic(); render(); },
  s7: v => { state.logic.s7 = num(v); persistLogic(); render(); },
  s14: v => { state.logic.s14 = num(v); persistLogic(); render(); },
  cashmin: v => { state.logic.cashMin = num(v); persistLogic(); render(); },
  dailycap: v => { state.logic.dailyCap = num(v); persistLogic(); render(); },
  autoconf: v => { state.logic.autoConf = Math.min(100, num(v, true)); persistLogic(); render(); },
  phototier: v => { state.logic.photoTier = v; persistLogic(); render(); },
  budget: v => { state.logic.budget = num(v); persistLogic(); render(); },
};

root.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || !root.contains(el)) return;
  const handler = clickActions[el.dataset.action];
  if (handler) handler(el.dataset);
});

/* Title and description live-update the driver preview as you type. */
root.addEventListener('input', e => {
  const key = e.target.dataset && e.target.dataset.input;
  if (key === 'title') updSel('title', e.target.value);
  else if (key === 'desc') updSel('desc', e.target.value);
  else if (key === 'addr') {
    scheduleAddrLookup(e.target.value);
    updSel('addr', e.target.value);
  }
});

root.addEventListener('change', e => {
  const key = e.target.dataset && e.target.dataset.change;
  if (key && changeActions[key]) changeActions[key](e.target.value);
});

root.addEventListener('submit', async e => {
  if (!e.target.dataset || e.target.dataset.form !== 'unlock') return;
  e.preventDefault();
  if (DB.enabled) {
    if (signingIn) return;
    const email = root.querySelector('#admin-email');
    const pass = root.querySelector('#admin-pass');
    signingIn = true;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'SIGNING IN…'; }
    const ok = await DB.signIn(email ? email.value : '', pass ? pass.value : '');
    signingIn = false;
    authError = !ok;
    if (ok) await loadRemote();
    else render();
  } else {
    const code = root.querySelector('#admin-code');
    authError = !AUTH.signIn(code ? code.value : '');
    render();
  }
});

/* ---------- boot ---------- */
render();
if (DB.enabled && AUTH.isAdmin()) loadRemote();
