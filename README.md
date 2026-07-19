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

Example: `index.html?mode=points&boost=0&streak=9`

## Structure

| File                 | Purpose                                            |
|----------------------|----------------------------------------------------|
| `index.html`         | Shell: fonts, stylesheet, app mount point          |
| `styles.css`         | Base styles, icon helpers, hover states, keyframes |
| `fonts.css`          | `@font-face` declarations for the vendored fonts   |
| `app.js`             | State, data, view-model, renderers, interactions   |
| `assets/profile.png` | Driver avatar                                      |
| `assets/fonts/`      | Vendored fonts (Saira, Saira Semi Condensed, JetBrains Mono, Material Symbols Rounded) — the app works fully offline |
