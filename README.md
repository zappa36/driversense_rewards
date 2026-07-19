# Driver Rewards — PostNord Berlin Nord

Static single-page implementation of the **Driver Rewards Share** design
(`Driver Rewards Share.dc.html` from the *Driver-voice* claude.ai/design project).

A gamified rewards dashboard for delivery drivers in the Berlin Nord hub:
drivers earn money for field reporting (fresh door codes, voice notes, photos of
safe-drop points) and cash it out with their salary run.

**Live demo:** https://zappa36.github.io/driversense_rewards/ — deployed to
GitHub Pages automatically on every push to `main` (see
`.github/workflows/pages.yml`).

## Screens

Driver app (`index.html`):

- **Dashboard** — balance, cashout progress, claimable rewards, featured
  challenges, zone mastery overview, and a reward shop.
- **Challenges** — the weekend special banner plus six live challenges.
  Starting a challenge simulates live tracking (progress ticks in ~1.1s steps),
  then the payout can be claimed into the balance.
- **Zones** — zone mastery list with per-zone stops that need attention.
- **Cashout** — payout method selection, cashout (unlocks at € 25), and history.

Planner console (`challenge-studio.html`, from `Challenge Studio.dc.html`):

- **Challenges tab** — challenge library with a full editor (title, status,
  description, zone, task type, goal, duration, reward, XP, tier, boost
  eligibility), a live driver-card preview, and per-challenge cost economics.
  Supports publish/unpublish, duplicate, archive and new drafts.
- **Reward logic tab** — hub-wide rules: payout currency (euro/points),
  weekend boost multiplier, reporting-streak ladder, cashout minimum and
  daily cap, verification guardrails, and a season budget with a live
  projection bar fed by the estimated cost of all LIVE challenges.

## Running

No build step and no dependencies — everything is plain HTML/CSS/JS:

```sh
# any static file server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk also works.

## Configuration

The design's props are exposed as URL query parameters:

| Page                    | Parameter | Values            | Default | Effect                              |
|-------------------------|-----------|-------------------|---------|-------------------------------------|
| `index.html`            | `mode`    | `euro` / `points` | `euro`  | Show payouts in euros or points     |
| `index.html`            | `boost`   | `1` / `0`         | `1`     | Weekend ×1.5 payout boost on/off    |
| `index.html`            | `streak`  | `3`–`30`          | `6`     | Reporting-streak day count          |
| `index.html`            | `gkey`    | API key           | —       | Google Maps API key (see below)     |
| `challenge-studio.html` | `drivers` | `5`–`200`         | `24`    | Hub driver count for cost estimates |
| `challenge-studio.html` | `eco`     | `1` / `0`         | `1`     | Show/hide the economics panel       |

Example: `index.html?mode=points&boost=0&streak=9`

## Roles & access

Creating and editing challenges requires the **admin role**. The studio
(`challenge-studio.html`) opens on a lock screen; entering the planner code
(**`1184`** — demo value, defined in `auth.js`) stores the admin role in the
browser's localStorage. Admins get a "PLANNER CONSOLE →" link in the driver
app's footer and a SIGN OUT link in the studio topbar.

> ⚠️ This is **demo-level** access control: the check runs entirely in the
> browser, so it signals who should be here rather than enforcing it. For real
> enforcement, put the studio behind a backend or an access layer (e.g.
> Netlify Identity / password-protected site, Cloudflare Access, or an OAuth
> proxy) when this moves past the pilot mock.

## Google Maps & Street View

Every challenge and stop is a real, geocoded Berlin address, and the app is
connected to Google Maps / Street View at three levels:

**Always on (no API key needed):**

- The address chip on every challenge card opens the real **Street View
  panorama** at that location (Google Maps URLs API).
- Each stop on the Zones page links into **Street View** at the stop;
  "OPEN IN MAPS" opens the zone in **Google Maps**.
- The Zones page embeds a **live Google Map** of the selected zone
  (keyless embed), re-tinted to match the dark UI.

**With an API key**, the illustrated card headers are replaced by live
**Street View Static API** photos of each challenge address, and the zone
map upgrades to the **Maps Embed API**. Supply the key either way:

```text
index.html?gkey=YOUR_API_KEY
```

or define it globally before `app.js` loads (in `index.html`):

```html
<script>window.GMAPS_KEY = 'YOUR_API_KEY';</script>
```

Create the key in the [Google Cloud console](https://console.cloud.google.com/google/maps-apis)
with **Street View Static API** and **Maps Embed API** enabled. The key is
used client-side, which is normal for these APIs — restrict it to your
site's HTTP referrer. If a photo can't be served, the card falls back to
the illustrated skyline automatically.

## Structure

| File                    | Purpose                                            |
|-------------------------|----------------------------------------------------|
| `index.html`            | Driver app shell: fonts, stylesheet, mount point   |
| `app.js`                | Driver app: state, data, renderers, interactions   |
| `challenge-studio.html` | Planner console shell                              |
| `studio.js`             | Planner console: library/editor, reward logic      |
| `auth.js`               | Shared demo role gate (admin unlock, localStorage) |
| `styles.css`            | Base styles, icon helpers, hover states, keyframes |
| `fonts.css`             | `@font-face` declarations for the vendored fonts   |
| `assets/profile.png`    | Avatar                                             |
| `assets/fonts/`         | Vendored fonts (Saira, Saira Semi Condensed, JetBrains Mono, Material Symbols Rounded) — the apps work fully offline |
