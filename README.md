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
- **Challenges** — the featured challenge banner plus six live challenges.
  Starting a challenge simulates live tracking (progress ticks in ~1.1s steps),
  then the payout can be claimed into the balance.
- **Zones** — zone mastery list with per-zone stops that need attention.
- **Cashout** — payout method selection, cashout (unlocks at € 25), and history.

Mobile app (`mobile.html`, from `People Mobile v1.dc.html`) — the app people
use to collect data about the city and its buildings. An interactive
single-phone prototype with eight connected screens:

- **City map** (home) → tap the flagged building or its card to **arrive**
  at the place and read tips left by people before you; vote them
  Helped/Outdated. "Something changed? Tell Otto" starts the **voice
  debrief** — with Supabase configured it uses the **phone's real mic**:
  the clip goes to the `otto` Edge Function, is transcribed and structured
  by OpenAI, and lands in the `tips` table (see below). Without Supabase
  (or if the mic is denied) the animated demo conversation runs instead.
  Either way it ends with your note saved, +50 XP, and a **level-up
  celebration**.
- From the map: tap your **avatar** for place mastery & badges, the **rank
  chip** for the leaderboard (working area/team toggles; the season chip
  opens the **Winter Streets season** screen), or the **gold pin** to tag a
  brand-new place and earn First-to-map XP.
- **Tag a place uses the phone's real GPS**: opening the screen asks for
  location permission, shows your live coordinates and accuracy, and
  reverse-geocodes the street name (OpenStreetMap Nominatim). "Save place"
  writes the location to the Supabase `places` table (run
  [`supabase/places.sql`](supabase/places.sql) once to create it); if GPS is
  denied or the backend is unreachable, it falls back to a demo spot and
  saves on-device. Geolocation requires HTTPS — the GitHub Pages URL
  qualifies.
- On a phone-sized viewport the app runs full-bleed; on desktop it's a
  centered phone. When Supabase is configured, the Season screen lists the
  **LIVE challenges published in Challenge Studio** with reward and XP
  labels; otherwise it falls back to the design's static content.

Planner console (`challenge-studio.html`, from `Challenge Studio.dc.html`):

- **Challenges tab** — challenge library with a full editor (title, status,
  description, address with Google Maps lookup, task type, goal, duration,
  reward, XP), a live driver-card preview, and per-challenge cost economics.
  Supports publish/unpublish, duplicate, archive and new drafts.
- **Reward logic tab** — hub-wide rules: payout currency (euro/points),
  reporting-streak ladder, cashout minimum and
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
| `index.html`            | `streak`  | `3`–`30`          | `6`     | Reporting-streak day count          |
| `index.html`            | `gkey`    | API key           | —       | Google Maps API key (see below)     |
| `challenge-studio.html` | `drivers` | `5`–`200`         | `24`    | Hub driver count for cost estimates |
| `challenge-studio.html` | `eco`     | `1` / `0`         | `1`     | Show/hide the economics panel       |
| `mobile.html`           | `brand`   | hex color         | `#0498BA` | Brand color (URL-encode the `#`)  |
| `mobile.html`           | `coin`    | hex color         | `#FFCC00` | Coin/gold accent color            |
| `mobile.html`           | `gamify`  | `1` / `0`         | `1`     | Show/hide gamification chrome       |

Example: `index.html?mode=points&streak=9`

## Connecting to Supabase

With a (free) Supabase project, the planner console and the driver app share
one real backend: challenges a planner publishes appear in every driver's
browser, reward-logic changes apply hub-wide, and planner access becomes real
authentication with server-side enforcement (Row Level Security).

Setup, once:

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase **SQL editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the `challenges` and `settings` tables, the security rules
   (anonymous visitors read LIVE challenges only; signed-in planners read and
   write everything), and seeds the demo data. Then run
   [`supabase/places.sql`](supabase/places.sql) the same way — it creates the
   `places` table the mobile app saves GPS-tagged locations into (open to the
   anon key by design, since the pilot people app has no accounts).
3. In **Authentication → Users**, click "Add user" and create your planner
   account (email + password, "Auto confirm user" on).
4. In **Project Settings → API**, copy the **Project URL** and the **anon
   public key** into [`config.js`](config.js), commit, and push.

That's it — the apps detect the configuration automatically:

- The studio lock screen becomes an **email + password sign-in** against
  Supabase Auth. Every edit write-through-saves (a sync indicator in the
  topbar shows SAVING…/SYNCED), so the library survives reloads and is shared
  between planners.
- The driver app loads **LIVE challenges** and the **reward rules** from the
  database on every visit. The highest-paying live challenge headlines as the
  featured challenge; publish/unpublish in the studio adds/removes cards in
  the driver app. Cashout minimum, streak amounts, and
  euro/points mode all follow the studio's Reward logic tab.
- Drafts and scheduled challenges are **not readable anonymously** — that's
  enforced by the database, not the browser.

With `config.js` left empty, everything runs in **local demo mode**: hardcoded
data, and the studio unlocks with the planner code **`1184`** (defined in
`auth.js`). Demo mode's gate is browser-only and not real security.

## Route data → automatic challenges

The carrier's delivery data shows *where* stops run behind plan — never
*why* (a broken elevator and a closed road both just look like lost
minutes). The studio's **Route data** tab turns that signal into
investigation challenges:

1. **Inject** per-stop timings — paste a JSON export
   (`{ route, days: [{ date, stops: [{ address, area, lat, lng,
   planned_min, actual_min }] }] }`; adapt the real carrier feed to this
   shape later), or click **Load demo route** for a simulated week of
   deliveries through Beitou, Taipei with three engineered frictions.
2. The system **aggregates delay per location** and ranks friction
   hotspots (≥3 visits averaging ≥2 min behind plan).
3. **Set a route budget** — it's split across hotspots in proportion to
   the minutes they cost (€4–20 each); the worst offenders are funded
   first and the tail waits when the budget is tight.
4. **Generate** — as drafts for review or published LIVE at once. Each
   auto-challenge carries the hotspot's address and coordinates, a
   people-facing brief citing the measured slowdown, and the standard
   2-report consensus. Re-running updates the same challenges in place.

## Investigation challenges (consensus payouts)

Challenges published in Challenge Studio with an address appear on the
mobile app's live map as red **INVESTIGATE** pins. They're deliberately
vague — "deliveries here run slower than planned, find out why". Someone
physically within **75 m** of the pin can tap it and **report to Otto** by
voice; the report (transcript + structured summary + GPS) is stored in the
`reports` table (run [`supabase/reports.sql`](supabase/reports.sql) once).
The payout releases only when reports from **2 different devices** agree —
one person alone can't claim the money. When the second report lands, the
pin flips to a green SOLVED state and Otto announces the released amount.
(Later, challenges like these can be generated automatically from
longer-than-planned delivery times.)

## Otto voice debrief (OpenAI)

With Supabase configured, Otto collects **real voice observations**
("the elevator is broken", "the road is closed") through an Edge Function
that transcribes the clip (OpenAI speech-to-text) and structures it into a
shareable tip (category + one-line summary), saved to the `tips` table.

Setup, once:

1. In the Supabase **SQL editor**, run [`supabase/tips.sql`](supabase/tips.sql).
2. In the Supabase dashboard, open **Edge Functions → Deploy a new function**,
   name it exactly `otto`, and paste the contents of
   [`supabase/functions/otto/index.ts`](supabase/functions/otto/index.ts)
   (or deploy with the CLI: `supabase functions deploy otto`).
3. Create an API key at [platform.openai.com](https://platform.openai.com/api-keys)
   and store it as a **function secret** — Edge Functions → Secrets → add
   `OPENAI_API_KEY`. **The key lives only there**: server-side, never in
   `config.js`, the repo, or the browser. The function also refuses
   requests from other websites and caps clip size, and you should set a
   monthly spend limit on the OpenAI account as a backstop.

No OpenAI setup → the debrief automatically falls back to the scripted
demo conversation.

## Server-side geocoding (worldwide addresses)

The browser Maps key is referrer-locked, and Google's Geocoding web
service refuses referrer-locked keys, so address lookup falls back to
OpenStreetMap — which has weak coverage outside Europe (Taiwanese house
numbers, for example, mostly aren't in it). The
[`supabase/functions/geocode`](supabase/functions/geocode/index.ts) Edge
Function fixes this with a **second, server-side Google key** that never
reaches the browser:

1. Google Cloud console → Credentials → Create credentials → API key.
   Under **API restrictions** tick only **Geocoding API**; leave
   application restrictions off (the key lives server-side).
2. Supabase → Edge Functions → deploy a new function named `geocode`
   (paste the file), then add the key as the secret `GMAPS_SERVER_KEY`.

The studio's address lookup and the mobile app's street names then use
Google worldwide, with the previous fallbacks kept. Without the function,
the studio also accepts **pasted coordinates** ("25.1183, 121.5091" —
long-press a spot in the Google Maps app to copy them) to drop a
challenge pin anywhere.

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
| `mobile.html`           | Mobile app shell: 8 screens in one phone           |
| `mobile.js`             | Mobile app: navigation, Otto debrief, XP, leaderboard, live challenges |
| `auth.js`               | Role gate: Supabase session or demo code fallback  |
| `config.js`             | Supabase project URL + anon key (empty = demo mode)|
| `db.js`                 | Minimal Supabase REST client (auth, challenges, settings) |
| `supabase/schema.sql`   | Tables, Row Level Security, seed data              |
| `supabase/places.sql`   | Places table for GPS-tagged locations              |
| `styles.css`            | Base styles, icon helpers, hover states, keyframes |
| `fonts.css`             | `@font-face` declarations for the vendored fonts   |
| `assets/profile.png`    | Avatar                                             |
| `assets/fonts/`         | Vendored fonts (Saira, Saira Semi Condensed, JetBrains Mono, Material Symbols Rounded) — the apps work fully offline |
