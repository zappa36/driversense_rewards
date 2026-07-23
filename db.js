'use strict';

/* ============================================================
 * Minimal Supabase client (REST only, no SDK).
 *
 * Talks to PostgREST (/rest/v1) and GoTrue (/auth/v1) directly
 * with fetch. Sessions are stored in localStorage and refreshed
 * on 401. When config.js is empty, DB.enabled is false and both
 * apps run in local demo mode.
 * ============================================================ */

const DB = (() => {
  const url = (window.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = window.SUPABASE_ANON_KEY || '';
  const enabled = !!(url && key);
  const SKEY = 'ds_supabase_session';

  let session = null;
  try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { /* private mode */ }
  const saveSession = s => {
    session = s;
    try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch { /* private mode */ }
  };

  async function refresh() {
    if (!session || !session.refresh_token) return false;
    const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!r.ok) { saveSession(null); return false; }
    saveSession(await r.json());
    return true;
  }

  async function rest(path, opts = {}, useAuth = false, retried = false) {
    const bearer = useAuth && session ? session.access_token : key;
    const r = await fetch(url + path, {
      ...opts,
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (r.status === 401 && useAuth && !retried && await refresh()) return rest(path, opts, useAuth, true);
    if (!r.ok) throw new Error('supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.status === 204 ? null : r.json();
  }

  /* DB rows use snake_case and `descr` (desc is reserved in SQL). */
  const rowToChal = r => ({
    id: r.id, title: r.title, desc: r.descr, zone: r.zone, tier: r.tier, unit: r.unit,
    goal: Number(r.goal), days: Number(r.days), value: Number(r.value), xp: Number(r.xp),
    boost: !!r.boost, status: r.status, addr: r.addr || null,
    lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
  });
  const chalToRow = c => ({
    id: c.id, title: c.title, descr: c.desc, zone: c.zone, tier: c.tier, unit: c.unit,
    goal: c.goal, days: c.days, value: c.value, xp: c.xp, boost: !!c.boost, status: c.status,
    addr: c.addr ?? null, lat: c.lat ?? null, lng: c.lng ?? null,
  });
  const rowToLogic = r => ({
    mode: r.mode,
    s3: Number(r.s3), s7: Number(r.s7), s14: Number(r.s14),
    cashMin: Number(r.cash_min), dailyCap: Number(r.daily_cap),
    autoConf: Number(r.auto_conf), photoTier: r.photo_tier,
    budget: Number(r.budget), spent: Number(r.spent),
  });
  const logicToRow = L => ({
    mode: L.mode,
    s3: L.s3, s7: L.s7, s14: L.s14, cash_min: L.cashMin, daily_cap: L.dailyCap,
    auto_conf: L.autoConf, photo_tier: L.photoTier, budget: L.budget, spent: L.spent,
  });

  return {
    enabled,
    rowToChal, chalToRow, rowToLogic, logicToRow,
    hasSession: () => !!session,
    userEmail: () => (session && session.user && session.user.email) || '',
    async signIn(email, password) {
      try {
        const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!r.ok) return false;
        saveSession(await r.json());
        return true;
      } catch { return false; }
    },
    signOut: () => saveSession(null),
    /* useAuth=true lets planners see DRAFT/SCHEDULED rows; anon RLS only exposes LIVE. */
    listChallenges: useAuth => rest('/rest/v1/challenges?select=*&order=created_at.asc', {}, !!useAuth),
    fetchSettings: () => rest('/rest/v1/settings?select=*&id=eq.1').then(rows => (rows && rows[0]) || null),
    upsertChallenge: row => rest('/rest/v1/challenges?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([row]),
    }, true),
    deleteChallenge: id => rest('/rest/v1/challenges?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }, true),
    saveSettings: row => rest('/rest/v1/settings?id=eq.1', { method: 'PATCH', body: JSON.stringify(row) }, true),
    /* Places tagged from the mobile app (anon insert by design — the pilot
     * people app has no accounts; see supabase/places.sql). */
    insertPlace: row => rest('/rest/v1/places', { method: 'POST', body: JSON.stringify([row]), headers: { Prefer: 'return=representation' } }),
    listPlaces: limit => rest('/rest/v1/places?select=*&order=created_at.desc&limit=' + (limit || 20)),
    updatePlace: (id, patch) => rest('/rest/v1/places?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
    deletePlace: id => rest('/rest/v1/places?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }),
    insertTip: row => rest('/rest/v1/tips', { method: 'POST', body: JSON.stringify([row]), headers: { Prefer: 'return=representation' } }),
    listTips: limit => rest('/rest/v1/tips?select=*&order=created_at.desc&limit=' + (limit || 30)),
    updateTip: (id, patch) => rest('/rest/v1/tips?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
    deleteTip: id => rest('/rest/v1/tips?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }),
    insertReport: row => rest('/rest/v1/reports', { method: 'POST', body: JSON.stringify([row]) }),
    listReports: limit => rest('/rest/v1/reports?select=challenge_id,device,created_at&order=created_at.desc&limit=' + (limit || 500)),
    /* Server-side Google geocoding via the geocode Edge Function (its key
     * never reaches the browser). Throws when the function isn't deployed. */
    geocode: async body => {
      const r = await fetch(`${url}/functions/v1/geocode`, {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('geocode ' + r.status);
      return r.json();
    },
    /* Voice debrief: post the recorded clip to the otto Edge Function, which
     * holds the OpenAI key server-side and returns transcript + reply + tip. */
    ottoVoice: async (blob, place) => {
      const fd = new FormData();
      fd.append('audio', blob, 'clip.' + (blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'));
      fd.append('place', place || '');
      const r = await fetch(`${url}/functions/v1/otto`, {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key }, // no Content-Type: browser sets the multipart boundary
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'otto ' + r.status);
      return d;
    },
  };
})();
