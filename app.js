'use strict';

/* ============================================================
 * Driver Rewards — PostNord Berlin Nord rewards pilot
 * Implementation of "Driver Rewards Share.dc.html" (claude.ai/design).
 *
 * Single-page app, no dependencies. State lives in one object;
 * every mutation re-renders the whole view from a computed
 * view-model, mirroring the original design component.
 * ============================================================ */

/* ---------- configuration (design props, overridable via URL) ----------
 * ?mode=points   pay in points instead of euros
 * ?boost=0       disable the weekend ×1.5 boost
 * ?streak=9      reporting-streak day count (3–30)
 */
const params = new URLSearchParams(location.search);
const props = {
  payoutMode: params.get('mode') === 'points' ? 'points' : 'euro',
  weekendBoost: params.get('boost') !== '0',
  streakDays: Math.min(30, Math.max(3, parseInt(params.get('streak'), 10) || 6)),
};

/* Google Maps / Street View integration.
 * With a key (?gkey=... or window.GMAPS_KEY), challenge cards load live
 * Street View Static imagery and the zones map uses the Maps Embed API.
 * Without one, cards keep the illustrated skyline and the zones map falls
 * back to the keyless Google Maps embed. Address chips and stops always
 * deep-link into Street View / Google Maps. */
const GMAPS_KEY = params.get('gkey') || window.GMAPS_KEY || '';

const TARGET = 25;
const MULT = props.weekendBoost ? 1.5 : 1;

/* ---------- state ---------- */
const state = {
  page: 'dashboard',
  balance: 22.90,
  cashed: false,
  method: 'sepa',
  selZone: 'z1',
  started: { c4: true },
  prog: { c4: 7 },
  claimed: {},
  history: [
    { d: 'JUL 11', m: 'SEPA transfer', v: 25.00, st: 'PAID' },
    { d: 'JUL 04', m: 'REWE voucher', v: 25.00, st: 'PAID' },
    { d: 'JUN 27', m: 'SEPA transfer', v: 26.40, st: 'PAID' },
  ],
};

/* ---------- static data ---------- */
const ACCENTS = {
  gold: { accent: '#ffd95e', rgb: '245,197,66', sky: 'linear-gradient(180deg,#131c2e 0%,#2c2a28 62%,#4a3418 100%)' },
  cyan: { accent: '#3cc0e0', rgb: '60,192,224', sky: 'linear-gradient(180deg,#0d1c2c 0%,#15303f 62%,#1d4152 100%)' },
  mint: { accent: '#5fe0b4', rgb: '95,224,180', sky: 'linear-gradient(180deg,#0e1e26 0%,#153a34 62%,#1d4a40 100%)' },
};

const SPECIAL = {
  id: 'c0', tone: 'gold', title: 'District Master: Prenzlauer Berg', value: 15.00, xp: 400,
  zone: 'PRENZLAUER BERG', left: 'ENDS SUN 24:00', tier: 'EPIC', unit: '12 STOPS', addr: 'Prenzlauer Berg',
  lat: 52.53688, lng: 13.420892,
  desc: 'Own your home zone this weekend — leave every stop verified, coded and noted. Top payout of the week, and the whole hub sees it.',
};

const CHALLENGES = [
  { id: 'c1', tone: 'gold', title: 'Mystery Stop Hunter', value: 8.50, xp: 180, zone: 'PRENZLAUER BERG', left: '3D LEFT', tier: 'MEDIUM', unit: '5 STOPS', addr: 'Rykestraße 21', lat: 52.53688, lng: 13.420892, desc: 'Refresh field notes at five unverified stops on tomorrow’s route.' },
  { id: 'c2', tone: 'cyan', title: 'Access Code Collector', value: 5.20, xp: 120, zone: 'MITTE', left: '5D LEFT', tier: 'MEDIUM', unit: '8 CODES', addr: 'Rosenthaler Str. 40', lat: 52.524001, lng: 13.402501, desc: 'Confirm door codes at eight buildings around Rosenthaler Platz.' },
  { id: 'c3', tone: 'mint', title: 'New Zone Scout', value: 12.00, xp: 240, zone: 'WEISSENSEE', left: '6D LEFT', tier: 'EPIC', unit: '6 RIDES', addr: 'Berliner Allee 250', lat: 52.559737, lng: 13.46724, desc: 'First rides in Weißensee — map access where the system is blind.' },
  { id: 'c4', tone: 'mint', title: 'Voice Note Sprint', value: 3.80, xp: 90, zone: 'YOUR ROUTE', left: '2D LEFT', tier: 'EASY', unit: '10 NOTES', addr: 'Route DE-1184', lat: 52.550859, lng: 13.413536, svLoc: '52.550859,13.413536', desc: 'Speak ten hands-free approach notes for the next driver.' },
  { id: 'c5', tone: 'cyan', title: 'Safe Drop Scout', value: 4.60, xp: 110, zone: 'PANKOW', left: '4D LEFT', tier: 'EASY', unit: '6 PHOTOS', addr: 'Breite Str. 5', lat: 52.571484, lng: 13.410986, desc: 'Photograph agreed safe-drop points at six stops missing one.' },
  { id: 'c6', tone: 'gold', title: 'Loading Dock Mapper', value: 9.00, xp: 200, zone: 'GESUNDBRUNNEN', left: '7D LEFT', tier: 'MEDIUM', unit: '4 DOCKS', addr: 'Badstraße 20', lat: 52.55178, lng: 13.383148, desc: 'Chart dock access and waiting rules at four retail stops.' },
];

const ALL_CHALLENGES = Object.fromEntries([SPECIAL, ...CHALLENGES].map(c => [c.id, c]));

const GOALS = { c0: 12, c1: 5, c2: 8, c3: 6, c4: 10, c5: 6, c6: 4 };

const PATCHES = {
  c0: 'left:26%;top:14%;width:48%;height:54%;',
  c1: 'left:8%;top:20%;width:26%;height:36%;',
  c2: 'right:6%;top:16%;width:30%;height:42%;',
  c3: 'left:30%;top:12%;width:44%;height:56%;',
  c4: 'left:38%;top:40%;width:24%;height:30%;',
  c5: 'left:10%;top:36%;width:28%;height:32%;',
  c6: 'right:8%;top:34%;width:32%;height:34%;',
};

const ZONES = [
  { id: 'z1', name: 'Prenzlauer Berg', code: 'DE-1184 · HOME', pct: 78, boosted: true, stops: [
    { addr: 'Schönhauser Allee 112', tag: 'STALE NOTE', v: 0.40, lat: 52.550859, lng: 13.413536 },
    { addr: 'Kastanienallee 8', tag: 'NO CODE', v: 0.60, lat: 52.536052, lng: 13.407086 },
    { addr: 'Rykestraße 21', tag: 'NEW STOP', v: 0.80, lat: 52.53688, lng: 13.420892 },
  ] },
  { id: 'z2', name: 'Mitte', code: 'DE-1162', pct: 54, boosted: false, stops: [
    { addr: 'Rosenthaler Str. 40', tag: 'NO CODE', v: 0.60, lat: 52.524001, lng: 13.402501 },
    { addr: 'Torstraße 98', tag: 'STALE NOTE', v: 0.40, lat: 52.529473, lng: 13.404289 },
    { addr: 'Ackerstraße 14', tag: 'DOCK UNKNOWN', v: 0.70, lat: 52.53103, lng: 13.396877 },
  ] },
  { id: 'z3', name: 'Pankow', code: 'DE-1190', pct: 31, boosted: false, stops: [
    { addr: 'Breite Str. 5', tag: 'STALE NOTE', v: 0.40, lat: 52.571484, lng: 13.410986 },
    { addr: 'Florastraße 33', tag: 'NEW STOP', v: 0.80, lat: 52.565031, lng: 13.405278 },
  ] },
  { id: 'z4', name: 'Weißensee', code: 'NEW AREA', pct: 6, boosted: true, stops: [
    { addr: 'Berliner Allee 250', tag: 'NEW STOP', v: 0.80, lat: 52.559737, lng: 13.46724 },
    { addr: 'Pistoriusstraße 12', tag: 'NEW STOP', v: 0.80, lat: 52.551226, lng: 13.455488 },
    { addr: 'Langhansstraße 74', tag: 'NO CODE', v: 0.60, lat: 52.554686, lng: 13.430807 },
  ] },
  { id: 'z5', name: 'Gesundbrunnen', code: 'DE-1201', pct: 44, boosted: false, stops: [
    { addr: 'Badstraße 20', tag: 'DOCK UNKNOWN', v: 0.70, lat: 52.55178, lng: 13.383148 },
    { addr: 'Brunnenstraße 64', tag: 'STALE NOTE', v: 0.40, lat: 52.540436, lng: 13.394635 },
  ] },
  { id: 'z6', name: 'Wedding', code: 'DE-1177', pct: 22, boosted: false, stops: [
    { addr: 'Müllerstraße 143', tag: 'NO CODE', v: 0.60, lat: 52.548182, lng: 13.354267 },
    { addr: 'Seestraße 49', tag: 'STALE NOTE', v: 0.40, lat: 52.550833, lng: 13.353482 },
  ] },
];

const CLAIM_ROWS = [
  { id: 'k1', v: 2.20, label: `Day ${props.streakDays} reporting streak`, sub: 'Report again tomorrow to keep it alive' },
  { id: 'k2', v: 0.80, label: 'Voice notes at 3 stops', sub: 'Completed this morning on DE-1184' },
  { id: 'k3', v: 3.50, label: `Day ${props.streakDays + 1} reporting streak`, sub: 'Unlocks tomorrow', locked: true },
];

const SHOP_ITEMS = [
  { id: 's1', icon: 'local_cafe', name: 'Depot coffee flat', desc: 'Free coffee at Nord Hub, one full week.', cost: 3 },
  { id: 's2', icon: 'schedule', name: 'Early Friday finish', desc: 'Wrap your route one hour early, fully paid.', cost: 12 },
  { id: 's3', icon: 'card_giftcard', name: 'REWE gift card', desc: '€ 20 grocery card, code delivered instantly.', cost: 20 },
];

const METHODS = [
  { id: 'sepa', icon: 'account_balance', name: 'SEPA transfer', sub: 'Lands with the Friday salary run' },
  { id: 'voucher', icon: 'card_giftcard', name: 'Store voucher', sub: 'REWE / dm code by email, instant' },
  { id: 'fuel', icon: 'local_gas_station', name: 'Fuel card top-up', sub: 'Loaded to your PostNord fuel card, instant' },
];

/* ---------- style tokens ---------- */
const MONO = "font-family:'JetBrains Mono',monospace;";
const COND = "font-family:'Saira Semi Condensed',sans-serif;";
const CARD = 'border:1px solid rgba(140,165,200,.12);border-radius:16px;background:rgba(12,20,32,.55);';

/* ---------- helpers ---------- */
const fmt = v => props.payoutMode === 'points' ? Math.round(v * 100) + ' P' : '€ ' + v.toFixed(2);

/* Google Maps / Street View URLs */
const svPanoUrl = (lat, lng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
const mapSearchUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + ', Berlin')}`;
const svImageUrl = c => GMAPS_KEY
  ? `https://maps.googleapis.com/maps/api/streetview?size=640x300&location=${encodeURIComponent(c.svLoc || c.addr + ', Berlin')}&fov=80&key=${GMAPS_KEY}`
  : null;
const zoneMapEmbedUrl = z => GMAPS_KEY
  ? `https://www.google.com/maps/embed/v1/place?key=${GMAPS_KEY}&q=${encodeURIComponent(z.name + ', Berlin')}&zoom=14`
  : `https://maps.google.com/maps?q=${encodeURIComponent(z.name + ', Berlin')}&z=14&output=embed`;

function icon(name, size, color, filled) {
  return `<span class="msr${filled ? ' fill' : ''}" style="font-size:${size}px;${color ? `color:${color};` : ''}">${name}</span>`;
}

function tierChipStyle(tier) {
  const map = { EASY: ['rgba(95,224,180,.1)', '#5fe0b4'], MEDIUM: ['rgba(4,152,186,.12)', '#3cc0e0'], EPIC: ['rgba(245,197,66,.12)', '#ffd95e'] };
  const [bg, col] = map[tier] || map.MEDIUM;
  return `flex:none;padding:3px 9px;border-radius:6px;background:${bg};${MONO}font-size:9.5px;letter-spacing:.14em;font-weight:700;color:${col};`;
}

function stopTagStyle(tag) {
  const map = { 'NEW STOP': ['rgba(95,224,180,.1)', '#5fe0b4'], 'NO CODE': ['rgba(4,152,186,.12)', '#3cc0e0'], 'STALE NOTE': ['rgba(245,197,66,.1)', '#ffd95e'], 'DOCK UNKNOWN': ['rgba(140,165,200,.1)', '#aebccd'] };
  const [bg, col] = map[tag] || map['STALE NOTE'];
  return `flex:none;padding:3px 9px;border-radius:6px;background:${bg};${MONO}font-size:9.5px;letter-spacing:.1em;color:${col};`;
}

/* Challenge view-model: state flags, payout labels, patch + tier styles. */
function chalVm(c) {
  const a = ACCENTS[c.tone];
  const goal = GOALS[c.id] || 5;
  const started = !!state.started[c.id];
  const prog = Math.min(goal, state.prog[c.id] || 0);
  const claimed = !!state.claimed[c.id];
  const complete = started && prog >= goal;
  return {
    ...c, ...a,
    tierStyle: tierChipStyle(c.tier),
    patchStyle: `position:absolute;z-index:2;display:flex;align-items:center;justify-content:center;border:1.5px dashed rgba(${a.rgb},.65);border-radius:6px;background:repeating-linear-gradient(45deg,rgba(${a.rgb},.12) 0 6px,rgba(${a.rgb},.02) 6px 12px);${PATCHES[c.id] || PATCHES.c1}`,
    meta: `${c.zone} · ${c.unit} · ${c.left}`,
    xpLabel: '+' + Math.round(c.xp * MULT) + ' XP',
    rewardLabel: fmt(c.value * MULT),
    showStart: !started,
    showProg: started && !complete,
    showClaim: complete && !claimed,
    showPaid: claimed,
    progLabel: `${prog}/${goal}`,
    progW: Math.round((prog / goal) * 100) + '%',
  };
}

/* ---------- view-model (mirrors the design's renderVals) ---------- */
function computeVm() {
  const s = state;

  const claims = CLAIM_ROWS.map(r => {
    const done = !!s.claimed[r.id];
    return {
      ...r,
      chip: fmt(r.v),
      claimable: !r.locked && !done,
      done,
      lockedShown: !!r.locked && !done,
      labelColor: r.locked ? '#8b97a8' : '#eef2f7',
      rowStyle: `display:flex;align-items:center;gap:18px;padding:17px 24px;border-bottom:1px solid rgba(140,165,200,.09);${r.locked ? 'opacity:.55;' : ''}`,
    };
  });
  const openClaims = claims.filter(c => c.claimable).length;

  const challenges = CHALLENGES.map(chalVm);
  const sp = chalVm(SPECIAL);
  const trackingCount = [SPECIAL, ...CHALLENGES]
    .filter(c => s.started[c.id] && !s.claimed[c.id] && (s.prog[c.id] || 0) < (GOALS[c.id] || 5)).length;

  const zoneRow = (z, i, arr) => ({
    ...z, pctLabel: z.pct + '%', pctW: z.pct + '%',
    rowStyle: `display:flex;align-items:center;gap:22px;padding:17px 24px;${i < arr.length - 1 ? 'border-bottom:1px solid rgba(140,165,200,.09);' : ''}`,
  });
  const zonesHome = ZONES.slice(0, 4).map(zoneRow);
  const zoneList = ZONES.map((z, i, arr) => ({
    ...z, pctLabel: z.pct + '%',
    nameColor: s.selZone === z.id ? '#3cc0e0' : '#eef2f7',
    rowStyle: `display:flex;align-items:center;gap:12px;padding:15px 20px;cursor:pointer;${i < arr.length - 1 ? 'border-bottom:1px solid rgba(140,165,200,.09);' : ''}${s.selZone === z.id ? 'background:rgba(4,152,186,.09);box-shadow:inset 2px 0 0 #3cc0e0;' : ''}`,
  }));
  const selRaw = ZONES.find(z => z.id === s.selZone) || ZONES[0];
  const sel = {
    ...selRaw, pctLabel: selRaw.pct + '%', pctW: selRaw.pct + '%',
    badgeNote: `LOCAL EXPERT BADGE AT 100% · +${fmt(5.00)} BONUS`,
    stopsLabel: `${selRaw.stops.length} STOPS NEED YOU${selRaw.boosted ? ' · PAYOUTS COUNT DOUBLE XP' : ''}`,
    stops: selRaw.stops.map(st => ({ ...st, reward: fmt(st.v * (selRaw.boosted ? MULT : 1)), tagStyle: stopTagStyle(st.tag) })),
  };

  const shop = SHOP_ITEMS.map(t => {
    const claimed = !!s.claimed[t.id];
    const enabled = s.balance >= t.cost && !claimed;
    return {
      ...t, costLabel: fmt(t.cost), enabled,
      btnLabel: claimed ? 'CLAIMED ✓' : enabled ? 'CLAIM' : 'LOCKED',
      btnStyle: `${MONO}font-size:11px;letter-spacing:.1em;font-weight:700;${claimed ? 'color:#5fe0b4;cursor:default;' : enabled ? 'color:#ffd95e;cursor:pointer;' : 'color:#5f6e80;cursor:not-allowed;'}`,
    };
  });

  const methods = METHODS.map(m => ({
    ...m, selected: s.method === m.id,
    iconColor: s.method === m.id ? '#5fe0b4' : '#8b97a8',
    rowStyle: `display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:13px;cursor:pointer;border:1px solid ${s.method === m.id ? 'rgba(95,224,180,.45);background:rgba(95,224,180,.05);' : 'rgba(140,165,200,.12);background:transparent;'}`,
  }));

  const history = s.history.map(h => ({
    ...h, vLabel: fmt(h.v),
    stStyle: `flex:none;width:64px;text-align:center;padding:3px 0;border-radius:6px;${MONO}font-size:9.5px;letter-spacing:.1em;${h.st === 'PENDING' ? 'background:rgba(245,197,66,.1);color:#ffd95e;' : 'background:rgba(95,224,180,.08);color:#5fe0b4;'}`,
  }));
  const paidHistory = s.history.filter(h => h.st === 'PAID');
  const paidTotal = paidHistory.reduce((a, h) => a + h.v, 0);

  const ready = s.balance >= TARGET && !s.cashed;

  return {
    page: s.page,
    boostOn: props.weekendBoost,
    balanceLabel: fmt(s.balance),
    targetLabel: fmt(TARGET),
    pctW: Math.min(100, (s.balance / TARGET) * 100).toFixed(1) + '%',
    heroNote: s.cashed ? 'Cashout requested — lands with Friday’s salary run.'
      : s.balance >= TARGET ? 'Threshold reached — cash out whenever you like.'
        : `Claim ${fmt(TARGET - s.balance)} more to unlock the next cashout.`,
    claimCountLabel: `${openClaims} OPEN`,
    chalStatLabel: `${CHALLENGES.length + 1} LIVE · ${trackingCount} TRACKING`,
    claims, featured: challenges.slice(0, 3), challenges, sp, zonesHome, zoneList, sel, shop, methods, history,
    seasonTotal: fmt(paidTotal),
    seasonCount: String(paidHistory.length),
    cashBtnLabel: s.cashed ? 'REQUESTED · LANDS FRIDAY ✓' : ready ? 'CASH OUT ' + fmt(s.balance) : fmt(TARGET - s.balance) + ' TO UNLOCK',
    cashBtnStyle: `display:block;width:100%;margin-top:16px;padding:13px;border-radius:12px;${COND}font-weight:700;font-size:14px;letter-spacing:.04em;transition:transform .15s ease;` +
      (s.cashed ? 'background:rgba(95,224,180,.08);border:1px solid rgba(95,224,180,.45);color:#7ce0b8;cursor:default;'
        : ready ? 'background:linear-gradient(180deg,#63dfae,#2fae7d);border:none;color:#05231a;cursor:pointer;box-shadow:0 12px 26px -12px rgba(47,174,125,.6);'
          : 'background:rgba(255,255,255,.03);border:1px solid rgba(140,165,200,.18);color:#5f6e80;cursor:not-allowed;'),
  };
}

/* ---------- shared partials ---------- */

/* Street-view style skyline illustration layers. */
function scenery(c, { glow = '.13', mid = true, dash = true } = {}) {
  return `
    <div style="position:absolute;left:0;right:0;top:50%;height:28%;background:radial-gradient(62% 100% at 50% 0%,rgba(255,214,110,${glow}),transparent 72%);"></div>
    <div style="position:absolute;left:-2%;bottom:32%;width:29%;height:54%;background:repeating-linear-gradient(0deg,transparent 0 9px,rgba(255,209,120,.07) 9px 11px),repeating-linear-gradient(90deg,transparent 0 11px,rgba(4,8,14,.5) 11px 13px),linear-gradient(180deg,#17232f,#0b121a);"></div>
    ${mid ? '<div style="position:absolute;left:28%;bottom:32%;width:15%;height:40%;background:repeating-linear-gradient(0deg,transparent 0 8px,rgba(255,209,120,.05) 8px 10px),linear-gradient(180deg,#111b26,#0a1119);"></div>' : ''}
    <div style="position:absolute;right:-3%;bottom:32%;width:34%;height:62%;background:repeating-linear-gradient(0deg,transparent 0 10px,rgba(255,209,120,.08) 10px 12px),repeating-linear-gradient(90deg,transparent 0 12px,rgba(4,8,14,.5) 12px 14px),linear-gradient(180deg,#141f2b,#0b121a);"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:32%;background:linear-gradient(180deg,#0f1b25,#0a1218);"></div>
    <div style="position:absolute;left:24%;right:24%;bottom:0;height:32%;clip-path:polygon(43% 0,57% 0,100% 100%,0 100%);background:linear-gradient(180deg,#1c2b39,#121e2a);"></div>
    ${dash ? '<div style="position:absolute;left:49.3%;width:1.4%;bottom:0;height:32%;background:repeating-linear-gradient(180deg,rgba(215,230,245,.4) 0 5px,transparent 5px 12px);"></div>' : ''}
    <div style="${c.patchStyle}"><span style="${MONO}font-size:8.5px;letter-spacing:.16em;color:${c.accent};">UNMAPPED</span></div>`;
}

/* Live Street View photo layered between the illustrated skyline and the
 * overlay chips; if Google can't serve it, it removes itself and the
 * illustration shows through. */
function svOverlay(c) {
  const url = svImageUrl(c);
  if (!url) return '';
  return `<img src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" style="position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;">`;
}

/* Address chip deep-links into the real Street View panorama. */
function addrChip(c, pos) {
  return `<a href="${svPanoUrl(c.lat, c.lng)}" target="_blank" rel="noopener" style="position:absolute;${pos};z-index:3;display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;background:rgba(7,13,22,.78);${MONO}font-size:9px;letter-spacing:.08em;color:#cdd6e2;">${icon('location_on', 12, c.accent, true)}${c.addr}</a>`;
}

function streetViewCredit(pos) {
  return `<span style="position:absolute;${pos};z-index:3;${MONO}font-size:8px;letter-spacing:.06em;color:rgba(205,220,235,.45);">© GOOGLE STREET VIEW</span>`;
}

/* Animated progress fill (width transitions between renders, see applyAnimatedWidths). */
function progressFill(key, width, gradient, transition, sheenWidth) {
  return `<div data-aw-key="${key}" data-aw="${width}" style="height:100%;width:${width};border-radius:4px;background:${gradient};transition:width ${transition} ease;position:relative;overflow:hidden;">
    <span style="position:absolute;top:0;bottom:0;width:${sheenWidth}px;background:linear-gradient(105deg,transparent,rgba(255,255,255,.45),transparent);animation:sheen 1.8s ease-in-out infinite;"></span>
  </div>`;
}

/* Start / progress / claim / paid footer shared by featured + challenge cards. */
function chalControls(c) {
  if (c.showStart) {
    return `<button data-action="start-chal" data-id="${c.id}" class="btn-start" style="display:block;width:100%;margin-top:12px;padding:10px;border-radius:10px;background:rgba(4,152,186,.1);border:1px solid rgba(4,152,186,.45);${COND}font-weight:700;font-size:13px;letter-spacing:.06em;color:#3cc0e0;cursor:pointer;">START</button>`;
  }
  if (c.showProg) {
    return `<div style="margin-top:14px;display:flex;align-items:center;gap:10px;">
      <div style="flex:1;height:6px;border-radius:4px;background:rgba(140,165,200,.14);overflow:hidden;">
        ${progressFill('chal-' + c.id, c.progW, 'linear-gradient(90deg,#0f6d8c,#3cc0e0)', '.6s', 30)}
      </div>
      <span style="${MONO}font-size:11px;font-weight:700;color:#3cc0e0;">${c.progLabel}</span>
    </div>`;
  }
  if (c.showClaim) {
    return `<button data-action="claim-chal" data-id="${c.id}" class="hover-lift" style="display:block;width:100%;margin-top:12px;padding:10px;border-radius:10px;border:none;background:linear-gradient(180deg,#63dfae,#2fae7d);${COND}font-weight:700;font-size:13px;letter-spacing:.06em;color:#05231a;cursor:pointer;box-shadow:0 10px 22px -10px rgba(47,174,125,.6);">CLAIM ${c.rewardLabel}</button>`;
  }
  return `<div style="margin-top:14px;display:flex;align-items:center;gap:7px;${MONO}font-size:11px;letter-spacing:.08em;color:#5fe0b4;">${icon('check_circle', 16, null, true)}PAID INTO BALANCE</div>`;
}

/* ---------- sections ---------- */
function renderTopbar(vm) {
  const nav = (page, label) => {
    const style = `cursor:pointer;${COND}font-size:14px;` +
      (vm.page === page ? 'font-weight:600;color:#eef2f7;' : 'font-weight:500;color:#7b8799;');
    return `<span data-action="nav" data-page="${page}" style="${style}">${label}</span>`;
  };
  return `
  <div style="position:sticky;top:0;z-index:50;background:rgba(7,13,22,.85);backdrop-filter:blur(10px);border-bottom:1px solid rgba(140,165,200,.1);">
    <div style="max-width:1120px;margin:0 auto;padding:0 40px;height:64px;display:flex;align-items:center;gap:22px;">
      <div style="display:flex;align-items:center;gap:12px;flex:none;">
        <span style="${MONO}font-size:10px;letter-spacing:.18em;color:#6f7c8e;">REWARDS</span>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:30px;">
        ${nav('dashboard', 'Dashboard')}
        ${nav('challenges', 'Challenges')}
        ${nav('zones', 'Zones')}
        ${nav('cashout', 'Cashout')}
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex:none;">
        <span style="${MONO}font-size:13px;font-weight:700;color:#5fe0b4;">${vm.balanceLabel}</span>
        <a href="challenge-studio.html" title="Planner sign-in" style="position:relative;width:34px;height:34px;flex:none;display:block;">
          <img src="assets/profile.png" alt="M. Kaur" style="width:34px;height:34px;border-radius:50%;object-fit:cover;display:block;border:1.5px solid rgba(140,165,200,.35);transition:border-color .15s ease;">
          <span style="position:absolute;right:-4px;bottom:-4px;width:16px;height:16px;border-radius:50%;background:linear-gradient(180deg,#ffd95e,#f3ac10);border:2px solid #0a121d;display:flex;align-items:center;justify-content:center;${COND}font-weight:700;font-size:9px;color:#5a3d06;">6</span>
        </a>
      </div>
    </div>
  </div>`;
}

function renderFeaturedCard(c) {
  return `
  <div class="card-hover-cyan" style="display:flex;flex-direction:column;overflow:hidden;${CARD}">
    <div style="position:relative;height:118px;flex:none;background:${c.sky};">
      ${scenery(c)}
      ${svOverlay(c)}
      ${addrChip(c, 'left:12px;top:12px')}
      ${streetViewCredit('right:12px;bottom:10px')}
    </div>
    <div style="display:flex;flex-direction:column;flex:1;padding:16px 22px 20px;">
      <div style="${COND}font-weight:600;font-size:18px;">${c.title}</div>
      <div style="margin:6px 0 18px;font-size:13px;line-height:1.55;color:#94a1b2;">${c.desc}</div>
      <div style="margin-top:auto;padding-top:14px;border-top:1px solid rgba(140,165,200,.12);">
        <div style="display:flex;align-items:baseline;justify-content:space-between;">
          <span style="${MONO}font-size:14px;font-weight:700;color:#5fe0b4;">${c.rewardLabel}</span>
          <span style="${MONO}font-size:10px;letter-spacing:.1em;color:#8b97a8;">${c.xpLabel}</span>
        </div>
        ${chalControls(c)}
      </div>
    </div>
  </div>`;
}

function renderDashboard(vm) {
  return `
  <div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:40px;">
      <div>
        <div style="${MONO}font-size:11px;letter-spacing:.2em;color:#6f7c8e;margin-bottom:14px;">SEASON 3 · M. KAUR · DE-1184</div>
        <div style="${COND}font-weight:700;font-size:64px;line-height:.95;letter-spacing:-0.01em;color:#7ce0b8;">${vm.balanceLabel}</div>
        <div style="margin-top:10px;font-size:14.5px;color:#94a1b2;">Your balance from field reporting. ${vm.heroNote}</div>
      </div>
      <div style="width:360px;flex:none;padding-bottom:6px;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px;">
          <span style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;">NEXT CASHOUT</span>
          <span style="${MONO}font-size:11px;color:#6f7c8e;">${vm.targetLabel} MIN</span>
        </div>
        <div style="height:6px;border-radius:4px;background:rgba(140,165,200,.14);overflow:hidden;"><div data-aw-key="cash" data-aw="${vm.pctW}" style="height:100%;width:${vm.pctW};border-radius:4px;background:linear-gradient(90deg,#1f8a63,#5fe0b4);transition:width .5s ease;"></div></div>
        <button data-action="nav" data-page="cashout" class="hover-lift" style="${vm.cashBtnStyle}">${vm.cashBtnLabel}</button>
      </div>
    </div>

    <div style="margin-top:56px;">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:18px;">
        <span style="${COND}font-weight:700;font-size:22px;">Ready to claim</span>
        <span style="${MONO}font-size:11px;color:#6f7c8e;">${vm.claimCountLabel}</span>
      </div>
      <div style="${CARD}overflow:hidden;">
        ${vm.claims.map(r => `
        <div style="${r.rowStyle}">
          <span style="flex:none;min-width:70px;text-align:center;padding:6px 10px;border-radius:9px;background:rgba(95,224,180,.09);${MONO}font-size:12px;font-weight:700;color:#5fe0b4;">${r.chip}</span>
          <div style="flex:1;min-width:0;">
            <div style="${COND}font-weight:600;font-size:15px;color:${r.labelColor};">${r.label}</div>
            <div style="font-size:12px;color:#7b8799;margin-top:1px;">${r.sub}</div>
          </div>
          ${r.claimable ? `<button data-action="claim-row" data-id="${r.id}" class="hover-lift" style="flex:none;padding:9px 22px;border-radius:10px;border:none;background:linear-gradient(180deg,#63dfae,#2fae7d);${COND}font-weight:700;font-size:13px;letter-spacing:.05em;color:#05231a;cursor:pointer;">CLAIM</button>` : ''}
          ${r.done ? `<span style="display:inline-flex;align-items:center;gap:6px;${MONO}font-size:11px;color:#5fe0b4;">${icon('check_circle', 17, null, true)}CLAIMED</span>` : ''}
          ${r.lockedShown ? `<span style="${MONO}font-size:11px;color:#5f6e80;">TOMORROW</span>` : ''}
        </div>`).join('')}
      </div>
    </div>

    <div style="margin-top:56px;">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:18px;">
        <span style="${COND}font-weight:700;font-size:22px;">Live challenges</span>
        ${vm.boostOn ? `<span style="${MONO}font-size:11px;color:#ffd95e;">WEEKEND ×1.5 UNTIL SUN</span>` : ''}
        <span data-action="nav" data-page="challenges" style="margin-left:auto;cursor:pointer;${MONO}font-size:11px;letter-spacing:.08em;color:#3cc0e0;">VIEW ALL →</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;">
        ${vm.featured.map(renderFeaturedCard).join('')}
      </div>
    </div>

    <div style="margin-top:56px;">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:18px;">
        <span style="${COND}font-weight:700;font-size:22px;">Explore the city</span>
        <span style="${MONO}font-size:11px;color:#6f7c8e;">ZONE MASTERY · BERLIN NORD</span>
        <span data-action="nav" data-page="zones" style="margin-left:auto;cursor:pointer;${MONO}font-size:11px;letter-spacing:.08em;color:#3cc0e0;">VIEW ALL →</span>
      </div>
      <div style="${CARD}overflow:hidden;">
        ${vm.zonesHome.map(z => `
        <div style="${z.rowStyle}">
          <div style="width:230px;flex:none;">
            <span style="${COND}font-weight:600;font-size:16px;">${z.name}</span>
            <span style="margin-left:9px;${MONO}font-size:10px;letter-spacing:.1em;color:#6f7c8e;">${z.code}</span>
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:14px;">
            <div style="flex:1;height:5px;border-radius:3px;background:rgba(140,165,200,.14);overflow:hidden;"><div style="height:100%;width:${z.pctW};border-radius:3px;background:linear-gradient(90deg,#0f6d8c,#3cc0e0);"></div></div>
            <span style="width:38px;flex:none;text-align:right;${MONO}font-size:11px;color:#8b97a8;">${z.pctLabel}</span>
          </div>
          <div style="width:120px;flex:none;text-align:center;">
            ${z.boosted ? `<span style="display:inline-flex;align-items:center;gap:4px;${MONO}font-size:11px;font-weight:700;color:#ffd95e;">${icon('bolt', 13, null, true)}×2 XP</span>` : ''}
          </div>
          <span data-action="open-zone" data-id="${z.id}" style="flex:none;cursor:pointer;display:inline-flex;align-items:center;gap:5px;${MONO}font-size:10.5px;letter-spacing:.08em;color:#3cc0e0;">OPEN${icon('arrow_forward', 14)}</span>
        </div>`).join('')}
      </div>
    </div>

    <div style="margin-top:56px;">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:18px;">
        <span style="${COND}font-weight:700;font-size:22px;">Spend it</span>
        <span style="${MONO}font-size:11px;color:#6f7c8e;">REWARDS COME OFF YOUR BALANCE</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;">
        ${vm.shop.map(t => `
        <div class="card-hover-gold" style="display:flex;flex-direction:column;${CARD}padding:24px;">
          <span style="width:42px;height:42px;border-radius:12px;background:rgba(245,197,66,.12);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">${icon(t.icon, 22, '#ffd95e', true)}</span>
          <div style="${COND}font-weight:600;font-size:18px;">${t.name}</div>
          <div style="margin:6px 0 18px;font-size:13px;line-height:1.55;color:#94a1b2;">${t.desc}</div>
          <div style="margin-top:auto;padding-top:14px;border-top:1px solid rgba(140,165,200,.12);display:flex;align-items:center;justify-content:space-between;">
            <span style="${MONO}font-size:14px;font-weight:700;color:#cdd6e2;">${t.costLabel}</span>
            <span data-action="claim-shop" data-id="${t.id}" style="${t.btnStyle}">${t.btnLabel}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderChallengeCard(c) {
  return `
  <div class="card-hover-cyan" style="display:flex;flex-direction:column;overflow:hidden;${CARD}">
    <div style="position:relative;height:132px;flex:none;background:${c.sky};">
      ${scenery(c)}
      ${svOverlay(c)}
      ${addrChip(c, 'left:12px;top:12px')}
      <span style="position:absolute;right:12px;top:12px;z-index:3;"><span style="${c.tierStyle}">${c.tier}</span></span>
      <span style="position:absolute;left:12px;bottom:10px;z-index:3;display:inline-flex;align-items:center;gap:5px;${MONO}font-size:8px;letter-spacing:.12em;color:rgba(205,220,235,.55);"><span style="width:5px;height:5px;border-radius:50%;background:#5fe0b4;"></span>LIVE SNAPSHOT</span>
      ${streetViewCredit('right:12px;bottom:10px')}
    </div>
    <div style="display:flex;flex-direction:column;flex:1;padding:16px 22px 20px;">
      <div style="${COND}font-weight:600;font-size:18px;">${c.title}</div>
      <div style="margin-top:4px;${MONO}font-size:10px;letter-spacing:.12em;color:#8b97a8;">${c.meta}</div>
      <div style="margin:8px 0 18px;font-size:13px;line-height:1.55;color:#94a1b2;">${c.desc}</div>
      <div style="margin-top:auto;padding-top:14px;border-top:1px solid rgba(140,165,200,.12);">
        <div style="display:flex;align-items:baseline;justify-content:space-between;">
          <span style="${MONO}font-size:14px;font-weight:700;color:#5fe0b4;">${c.rewardLabel}</span>
          <span style="${MONO}font-size:10px;letter-spacing:.1em;color:#8b97a8;">${c.xpLabel}</span>
        </div>
        ${chalControls(c)}
      </div>
    </div>
  </div>`;
}

function renderSpecialBanner(vm) {
  const sp = vm.sp;
  let controls;
  if (sp.showStart) {
    controls = `<button data-action="start-chal" data-id="${sp.id}" class="hover-lift" style="display:block;width:100%;margin-top:14px;padding:12px;border-radius:11px;border:none;background:linear-gradient(180deg,#ffd95e,#f3ac10);${COND}font-weight:700;font-size:14px;letter-spacing:.06em;color:#5a3d06;cursor:pointer;box-shadow:0 12px 26px -12px rgba(243,172,16,.6);">START THE WEEKEND RUN</button>`;
  } else if (sp.showProg) {
    controls = `<div style="margin-top:18px;display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:7px;border-radius:4px;background:rgba(140,165,200,.14);overflow:hidden;">
          ${progressFill('chal-' + sp.id, sp.progW, 'linear-gradient(90deg,#b47c10,#ffd95e)', '.6s', 34)}
        </div>
        <span style="${MONO}font-size:12px;font-weight:700;color:#ffd95e;">${sp.progLabel}</span>
      </div>
      <div style="margin-top:7px;${MONO}font-size:9.5px;letter-spacing:.14em;color:#8b97a8;">TRACKING LIVE ON YOUR ROUTE</div>`;
  } else if (sp.showClaim) {
    controls = `<button data-action="claim-chal" data-id="${sp.id}" class="hover-lift" style="display:block;width:100%;margin-top:14px;padding:12px;border-radius:11px;border:none;background:linear-gradient(180deg,#63dfae,#2fae7d);${COND}font-weight:700;font-size:14px;letter-spacing:.06em;color:#05231a;cursor:pointer;box-shadow:0 12px 26px -12px rgba(47,174,125,.6);">CLAIM ${sp.rewardLabel}</button>`;
  } else {
    controls = `<div style="margin-top:18px;display:flex;align-items:center;gap:7px;${MONO}font-size:11px;letter-spacing:.08em;color:#5fe0b4;">${icon('check_circle', 16, null, true)}PAID INTO BALANCE</div>`;
  }
  return `
  <div style="margin-top:34px;position:relative;overflow:hidden;border:1px solid rgba(245,197,66,.3);border-radius:18px;background:linear-gradient(115deg,rgba(245,197,66,.12),rgba(12,20,32,.55) 58%);padding:28px 32px;display:flex;align-items:center;gap:44px;">
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="${sp.tierStyle}">${sp.tier}</span>
        <span style="${MONO}font-size:10px;letter-spacing:.16em;color:#c9a85c;">WEEKEND SPECIAL · ${sp.left}</span>
      </div>
      <div style="margin-top:12px;${COND}font-weight:700;font-size:30px;line-height:1.05;">${sp.title}</div>
      <div style="margin-top:8px;max-width:520px;font-size:14px;line-height:1.55;color:#94a1b2;">${sp.desc}</div>
      <div style="margin-top:10px;${MONO}font-size:10px;letter-spacing:.12em;color:#8b97a8;">${sp.meta}</div>
    </div>
    <div style="position:relative;width:238px;height:150px;flex:none;border-radius:12px;overflow:hidden;border:1px solid rgba(245,197,66,.3);background:${sp.sky};">
      ${scenery(sp, { glow: '.15', mid: false, dash: false })}
      ${svOverlay(sp)}
      ${addrChip(sp, 'left:10px;top:10px')}
      ${streetViewCredit('right:10px;bottom:8px')}
    </div>
    <div style="width:280px;flex:none;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;">
        <span style="${COND}font-weight:700;font-size:34px;color:#7ce0b8;">${sp.rewardLabel}</span>
        <span style="${MONO}font-size:11px;letter-spacing:.1em;font-weight:700;color:#ffd95e;">${sp.xpLabel}</span>
      </div>
      ${controls}
    </div>
  </div>`;
}

function renderChallenges(vm) {
  return `
  <div>
    <div style="${MONO}font-size:11px;letter-spacing:.2em;color:#6f7c8e;margin-bottom:14px;">SEASON 3 · BERLIN NORD HUB</div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:30px;">
      <div>
        <h1 style="margin:0;${COND}font-weight:700;font-size:44px;line-height:1;">Challenges</h1>
        <p style="margin:10px 0 0;font-size:14.5px;color:#94a1b2;max-width:560px;">Structured field work that pays extra — pick one, it tracks automatically while you drive. Snapshots stream in from Google Maps &amp; Street View.</p>
      </div>
      <div style="flex:none;text-align:right;padding-bottom:4px;">
        <div style="${MONO}font-size:11px;color:#6f7c8e;">${vm.chalStatLabel}</div>
        ${vm.boostOn ? `<div style="margin-top:5px;${MONO}font-size:11px;color:#ffd95e;">WEEKEND ×1.5 ON ALL PAYOUTS · ENDS SUN 24:00</div>` : ''}
      </div>
    </div>
    ${renderSpecialBanner(vm)}
    <div style="margin-top:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;">
      ${vm.challenges.map(renderChallengeCard).join('')}
    </div>
  </div>`;
}

function renderZones(vm) {
  const sel = vm.sel;
  return `
  <div>
    <div style="${MONO}font-size:11px;letter-spacing:.2em;color:#6f7c8e;margin-bottom:14px;">BERLIN NORD HUB · 6 ZONES</div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:30px;">
      <div>
        <h1 style="margin:0;${COND}font-weight:700;font-size:44px;line-height:1;">Explore the city</h1>
        <p style="margin:10px 0 0;font-size:14.5px;color:#94a1b2;max-width:560px;">Master a zone by keeping its stops verified. Boosted zones pay double XP this week.</p>
      </div>
    </div>
    <div style="margin-top:34px;display:grid;grid-template-columns:360px minmax(0,1fr);gap:18px;align-items:start;">
      <div style="${CARD}overflow:hidden;">
        ${vm.zoneList.map(z => `
        <div data-action="select-zone" data-id="${z.id}" style="${z.rowStyle}">
          <div style="flex:1;min-width:0;">
            <div style="${COND}font-weight:600;font-size:15.5px;color:${z.nameColor};">${z.name}</div>
            <div style="${MONO}font-size:9.5px;letter-spacing:.1em;color:#6f7c8e;margin-top:2px;">${z.code}</div>
          </div>
          ${z.boosted ? `<span class="msr fill" style="flex:none;font-size:15px;color:#ffd95e;">bolt</span>` : ''}
          <span style="flex:none;width:34px;text-align:right;${MONO}font-size:11px;color:#8b97a8;">${z.pctLabel}</span>
        </div>`).join('')}
      </div>
      <div style="${CARD}padding:28px;">
        <div style="display:flex;align-items:baseline;gap:12px;">
          <span style="${COND}font-weight:700;font-size:26px;">${sel.name}</span>
          <span style="${MONO}font-size:10.5px;letter-spacing:.12em;color:#6f7c8e;">${sel.code}</span>
          ${sel.boosted ? `<span style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;${MONO}font-size:11px;font-weight:700;color:#ffd95e;">${icon('bolt', 13, null, true)}×2 XP THIS WEEK</span>` : ''}
        </div>
        <div style="margin-top:22px;display:flex;align-items:center;justify-content:space-between;">
          <span style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;">LOCAL EXPERT PROGRESS</span>
          <span style="${MONO}font-size:12px;font-weight:700;color:#3cc0e0;">${sel.pctLabel}</span>
        </div>
        <div style="margin-top:8px;height:6px;border-radius:4px;background:rgba(140,165,200,.14);overflow:hidden;"><div style="height:100%;width:${sel.pctW};border-radius:4px;background:linear-gradient(90deg,#0f6d8c,#3cc0e0);"></div></div>
        <div style="margin-top:7px;${MONO}font-size:10px;letter-spacing:.08em;color:#6f7c8e;">${sel.badgeNote}</div>
        <div style="margin-top:24px;position:relative;border-radius:12px;overflow:hidden;border:1px solid rgba(140,165,200,.15);" class="map-dark">
          <iframe src="${zoneMapEmbedUrl(sel)}" title="Map of ${sel.name}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" style="display:block;width:100%;height:230px;border:0;"></iframe>
          <span style="position:absolute;left:10px;top:10px;z-index:2;pointer-events:none;display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;background:rgba(7,13,22,.78);${MONO}font-size:9px;letter-spacing:.08em;color:#cdd6e2;"><span style="width:5px;height:5px;border-radius:50%;background:#5fe0b4;"></span>LIVE MAP · GOOGLE MAPS</span>
          <a href="${mapSearchUrl(sel.name)}" target="_blank" rel="noopener" style="position:absolute;right:10px;top:10px;z-index:2;display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;background:rgba(7,13,22,.78);${MONO}font-size:9px;letter-spacing:.08em;color:#3cc0e0;">OPEN IN MAPS${icon('open_in_new', 11, '#3cc0e0')}</a>
        </div>
        <div style="margin-top:26px;${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;">${sel.stopsLabel}</div>
        <div style="margin-top:10px;border-top:1px solid rgba(140,165,200,.1);">
          ${sel.stops.map(st => `
          <div style="display:flex;align-items:center;gap:14px;padding:13px 2px;border-bottom:1px solid rgba(140,165,200,.09);">
            <a class="stop-link" href="${svPanoUrl(st.lat, st.lng)}" target="_blank" rel="noopener" title="Open in Street View" style="flex:1;min-width:0;display:flex;align-items:center;gap:14px;">
              ${icon('location_on', 17, '#5f6e80')}
              <span style="flex:1;${COND}font-weight:500;font-size:15px;">${st.addr}</span>
              <span class="stop-peek" style="display:inline-flex;align-items:center;gap:4px;${MONO}font-size:9px;letter-spacing:.08em;color:#3cc0e0;opacity:0;transition:opacity .15s ease;">${icon('visibility', 12, '#3cc0e0')}STREET VIEW</span>
            </a>
            <span style="${st.tagStyle}">${st.tag}</span>
            <span style="width:60px;text-align:right;${MONO}font-size:12px;font-weight:700;color:#5fe0b4;">${st.reward}</span>
          </div>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;color:#94a1b2;">Fix these on your next run through — payouts land instantly.</span>
          <span data-action="nav" data-page="challenges" style="cursor:pointer;${MONO}font-size:11px;letter-spacing:.08em;color:#3cc0e0;">ZONE CHALLENGES →</span>
        </div>
      </div>
    </div>
  </div>`;
}

function renderCashout(vm) {
  return `
  <div>
    <div style="${MONO}font-size:11px;letter-spacing:.2em;color:#6f7c8e;margin-bottom:14px;">SEASON 3 · M. KAUR · DE-1184</div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:30px;">
      <div>
        <h1 style="margin:0;${COND}font-weight:700;font-size:44px;line-height:1;">Cashout</h1>
        <p style="margin:10px 0 0;font-size:14.5px;color:#94a1b2;max-width:560px;">Move your reward balance where you want it. ${vm.heroNote}</p>
      </div>
    </div>
    <div style="margin-top:34px;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start;">
      <div style="${CARD}padding:28px;">
        <div style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;">AVAILABLE BALANCE</div>
        <div style="margin-top:10px;${COND}font-weight:700;font-size:54px;line-height:.95;color:#7ce0b8;">${vm.balanceLabel}</div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;height:6px;border-radius:4px;background:rgba(140,165,200,.14);overflow:hidden;"><div data-aw-key="cash" data-aw="${vm.pctW}" style="height:100%;width:${vm.pctW};border-radius:4px;background:linear-gradient(90deg,#1f8a63,#5fe0b4);transition:width .5s ease;"></div></div>
          <span style="${MONO}font-size:10.5px;color:#6f7c8e;">${vm.targetLabel} MIN</span>
        </div>
        <div style="margin-top:30px;${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;">PAYOUT METHOD</div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:9px;">
          ${vm.methods.map(m => `
          <div data-action="select-method" data-id="${m.id}" style="${m.rowStyle}">
            <span style="width:38px;height:38px;flex:none;border-radius:11px;background:rgba(140,165,200,.08);display:flex;align-items:center;justify-content:center;">${icon(m.icon, 19, m.iconColor)}</span>
            <div style="flex:1;min-width:0;">
              <div style="${COND}font-weight:600;font-size:15px;">${m.name}</div>
              <div style="font-size:12px;color:#7b8799;margin-top:1px;">${m.sub}</div>
            </div>
            ${m.selected ? icon('check_circle', 19, '#5fe0b4', true) : ''}
          </div>`).join('')}
        </div>
        <button data-action="cashout" class="hover-lift" style="${vm.cashBtnStyle}">${vm.cashBtnLabel}</button>
        <div style="margin-top:12px;${MONO}font-size:10px;letter-spacing:.08em;color:#6f7c8e;">PAYOUTS ARE PROCESSED WITH THE FRIDAY SALARY RUN · NO FEES</div>
      </div>
      <div style="${CARD}padding:28px;">
        <div style="${MONO}font-size:10px;letter-spacing:.16em;color:#8b97a8;margin-bottom:6px;">HISTORY</div>
        ${vm.history.map(h => `
        <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(140,165,200,.09);">
          <span style="width:52px;flex:none;${MONO}font-size:10px;letter-spacing:.06em;color:#6f7c8e;">${h.d}</span>
          <span style="flex:1;${COND}font-weight:500;font-size:14px;color:#cdd6e2;">${h.m}</span>
          <span style="${MONO}font-size:12.5px;font-weight:700;color:#5fe0b4;">${h.vLabel}</span>
          <span style="${h.stStyle}">${h.st}</span>
        </div>`).join('')}
        <div style="margin-top:16px;font-size:12.5px;line-height:1.55;color:#7b8799;">Season 3 so far: <span style="color:#cdd6e2;">${vm.seasonTotal}</span> paid out across ${vm.seasonCount} cashouts.</div>
      </div>
    </div>
  </div>`;
}

/* ---------- render loop ---------- */
const root = document.getElementById('app');

/* Remembers each progress bar's last width so CSS transitions animate
 * across full re-renders: fresh elements mount at the previous width,
 * then move to the new one on the next frame. */
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
  const vm = computeVm();
  const pages = { dashboard: renderDashboard, challenges: renderChallenges, zones: renderZones, cashout: renderCashout };
  root.innerHTML = `
  <div style="min-height:100vh;">
    ${renderTopbar(vm)}
    <div style="max-width:1120px;margin:0 auto;padding:52px 40px 80px;">
      ${pages[vm.page](vm)}
      <div style="margin-top:56px;${MONO}font-size:10px;letter-spacing:.14em;color:#4f5a69;">POSTNORD · REAL-WORLD INTELLIGENCE LAYER · REWARDS PILOT · BERLIN NORD${typeof AUTH !== 'undefined' && AUTH.isAdmin() ? ' · <a href="challenge-studio.html" style="color:#3cc0e0;">PLANNER CONSOLE →</a>' : ''}</div>
    </div>
  </div>`;
  applyAnimatedWidths();
}

/* ---------- state transitions ---------- */
function setPage(page) {
  state.page = page;
  render();
  window.scrollTo(0, 0);
}

function addBalance(v) {
  state.balance = Math.round((state.balance + v) * 100) / 100;
}

/* Challenge progress simulation: one step every 1.1s until goal. */
const timers = {};
function tickChal(id) {
  const goal = GOALS[id] || 5;
  if (timers[id] || (state.prog[id] || 0) >= goal) return;
  timers[id] = setInterval(() => {
    state.prog[id] = Math.min(goal, (state.prog[id] || 0) + 1);
    if (state.prog[id] >= goal) {
      clearInterval(timers[id]);
      delete timers[id];
    }
    render();
  }, 1100);
}

const actions = {
  nav(d) { setPage(d.page); },

  'claim-row'(d) {
    const row = CLAIM_ROWS.find(r => r.id === d.id);
    if (!row || row.locked || state.claimed[row.id]) return;
    addBalance(row.v);
    state.claimed[row.id] = true;
    render();
  },

  'start-chal'(d) {
    if (state.started[d.id]) return;
    state.started[d.id] = true;
    state.prog[d.id] = state.prog[d.id] || 0;
    render();
    tickChal(d.id);
  },

  'claim-chal'(d) {
    const c = ALL_CHALLENGES[d.id];
    if (!c || state.claimed[c.id]) return;
    addBalance(c.value * MULT);
    state.claimed[c.id] = true;
    render();
  },

  'open-zone'(d) {
    state.selZone = d.id;
    setPage('zones');
  },

  'select-zone'(d) {
    state.selZone = d.id;
    render();
  },

  'claim-shop'(d) {
    const t = SHOP_ITEMS.find(x => x.id === d.id);
    if (!t || state.claimed[t.id] || state.balance < t.cost) return;
    state.balance = Math.round((state.balance - t.cost) * 100) / 100;
    state.claimed[t.id] = true;
    render();
  },

  'select-method'(d) {
    state.method = d.id;
    render();
  },

  cashout() {
    if (!(state.balance >= TARGET && !state.cashed)) return;
    const m = METHODS.find(x => x.id === state.method);
    state.history = [{ d: 'TODAY', m: m.name, v: state.balance, st: 'PENDING' }, ...state.history];
    state.balance = 0;
    state.cashed = true;
    render();
  },
};

root.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || !root.contains(el)) return;
  const handler = actions[el.dataset.action];
  if (handler) handler(el.dataset);
});

/* ---------- boot ---------- */
render();
Object.keys(state.started).forEach(id => tickChal(id));
