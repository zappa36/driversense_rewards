'use strict';

/* ============================================================
 * Demo role gate shared by the driver app and Challenge Studio.
 *
 * The role lives in localStorage; the studio unlocks with the
 * planner code. This is DEMO-LEVEL access control — the check
 * runs entirely in the browser, so it signals who should be
 * here rather than enforcing it. Real enforcement needs a
 * backend or an access proxy in front of the page.
 * ============================================================ */

const AUTH = (() => {
  const KEY = 'ds_role';
  const ADMIN_CODE = '1184'; // demo planner code — the hub's route number

  let memoryRole = null; // fallback when localStorage is unavailable
  const store = {
    get() {
      try { return localStorage.getItem(KEY); } catch { return memoryRole; }
    },
    set(v) {
      try { localStorage.setItem(KEY, v); } catch { memoryRole = v; }
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch { memoryRole = null; }
    },
  };

  /* When Supabase is configured (config.js + db.js), the admin role is a
   * real authenticated session and the demo code gate is bypassed. */
  const supa = () => typeof DB !== 'undefined' && DB.enabled;

  return {
    isAdmin: () => supa() ? DB.hasSession() : store.get() === 'admin',
    signIn(code) {
      if (String(code).trim() === ADMIN_CODE) { store.set('admin'); return true; }
      return false;
    },
    signOut() {
      if (supa()) DB.signOut();
      store.clear();
    },
  };
})();
