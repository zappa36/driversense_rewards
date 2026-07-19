# Driver Rewards — PostNord Berlin Nord

Static single-page implementation of the **Driver Rewards Share** design
(`Driver Rewards Share.dc.html` from the *Driver-voice* claude.ai/design project).

A gamified rewards dashboard for delivery drivers in the Berlin Nord hub:
drivers earn money for field reporting (fresh door codes, voice notes, photos of
safe-drop points) and cash it out with their salary run.

## Screens

- **Dashboard** — balance, cashout progress, claimable rewards, featured
  challenges, zone mastery overview, and a reward shop.
- **Challenges** — the weekend special banner plus six live challenges.
  Starting a challenge simulates live tracking (progress ticks in ~1.1s steps),
  then the payout can be claimed into the balance.
- **Zones** — zone mastery list with per-zone stops that need attention.
- **Cashout** — payout method selection, cashout (unlocks at € 25), and history.

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

| Parameter | Values            | Default | Effect                              |
|-----------|-------------------|---------|-------------------------------------|
| `mode`    | `euro` / `points` | `euro`  | Show payouts in euros or points     |
| `boost`   | `1` / `0`         | `1`     | Weekend ×1.5 payout boost on/off    |
| `streak`  | `3`–`30`          | `6`     | Reporting-streak day count          |
| `gkey`    | API key           | —       | Google Maps API key (see below)     |

Example: `index.html?mode=points&boost=0&streak=9`

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

| File                 | Purpose                                            |
|----------------------|----------------------------------------------------|
| `index.html`         | Shell: fonts, stylesheet, app mount point          |
| `styles.css`         | Base styles, icon helpers, hover states, keyframes |
| `fonts.css`          | `@font-face` declarations for the vendored fonts   |
| `app.js`             | State, data, view-model, renderers, interactions   |
| `assets/profile.png` | Driver avatar                                      |
| `assets/fonts/`      | Vendored fonts (Saira, Saira Semi Condensed, JetBrains Mono, Material Symbols Rounded) — the app works fully offline |
