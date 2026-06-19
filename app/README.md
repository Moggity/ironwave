# IRONWAVE

A self-hosted powerbuilding webapp built on the **Juggernaut Method 2.0** wave system (Chad Wesley Smith), styled after the JuggernautAI app. Vanilla HTML/CSS/JS frontend — no build step, no accounts. State is persisted server-side as a single JSON file (`database.json`) via a small Node/Express backend (`server.js`), so your data survives browser storage eviction and is shared across any device pointed at the same server.

## Run it on your computer (localhost)

```bash
cd app
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The server (`server.js`) serves the static files *and* exposes two endpoints the app uses for persistence:

- `GET /api/state` — returns the full state JSON (creates a default `database.json` on first run)
- `POST /api/state` — overwrites `database.json` with the posted state

All training data lives in `database.json` next to `server.js`.

## Use it on your iPhone (Brave)

1. Make sure your iPhone and computer are on the **same Wi-Fi network**.
2. Find your computer's LAN IP:
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
   - Windows: `ipconfig` → IPv4 Address
3. Start the server as above, then in Brave on the iPhone open:
   `http://YOUR_LAN_IP:3000` (e.g. `http://192.168.1.42:3000`)
4. Optional: Share → **Add to Home Screen** for a full-screen, app-like launch (dark status bar, no browser chrome).

### Backing up your data

Your training data now lives in `database.json` on the machine running the server, not in the browser, so iOS storage eviction no longer threatens it. Back up by copying `database.json`, or use **More → Settings & Data → Export JSON** in the app. **Import JSON** restores a backup (it overwrites server state via `POST /api/state`).

## What's inside

| File | What it is |
|---|---|
| `index.html` | App shell |
| `styles.css` | Dark Juggernaut-style theme, iPhone-12-first |
| `data.js` | ~130-exercise catalog, day templates (3–6 days/week), wave percentage tables, program template |
| `engine.js` | The training brain (see below) |
| `app.js` | All views: dashboard, workout, check-in, session logging, history, library, settings |
| `server.js` | Node/Express backend: serves static files, persists state to `database.json` via `/api/state` |
| `database.json` | The single source of truth for all your data (auto-created on first run) |

## How the engine works

**Methodology: Juggernaut + Bodybuilding** (see `CHANGELOG.md`). Every block declares a prescription *scheme*; the engine routes everything through it and never mixes methodologies.

**Program structure (Powerbuilding):** 3 hypertrophy blocks (10s, 8s, 8s waves, scheme `jbb-hyp`) + 2 strength blocks (5s, 3s waves, scheme `jm2-wave`). Each block is 5 weeks.

**Hypertrophy blocks (`jbb-hyp`, ascending volume / MEV→MRV style):**

1. **Calibration** — 3 sets at the wave's reps, RPE-capped, fine-tunes your working max
2. **Build Volume** — 4 main sets; accessories climb to 3 sets, RIR tightens
3. **Build Volume** — 5 main sets; accessories at 4 sets
4. **Peak Volume + AMRAP** — 4 sets + one **AMRAP** at the book's realization % (mains only); accessories peak at 5 sets, RPE 9
5. **Deload** — 40/50/60% × 5, accessories at half volume

**Strength blocks (`jm2-wave`, the 2012 book verbatim):**

1. **Calibration** — accumulation volume, RPE-capped
2. **Accumulation** — book percentages, last set 2–3 reps in the tank
3. **Intensification** — heavier, volume drops, last set 1–2 in the tank
4. **Realization** — ramp to one **AMRAP** set (main lifts only)
5. **Deload** — 40/50/60% × 5

**Working max:** set to 90% of your entered 1RM (or calibrated from ramping RPE sets in week 1 if you leave it blank). After each realization AMRAP:

```
newWM = WM + min(repsOver standard, 10) × increment
```

with 2.5 kg/rep for lower-body lifts and 1.25 kg/rep for upper-body (editable per lift in the exercise's Settings tab).

**Bold weight prescription:** unlike the original app, IRONWAVE prescribes direct weights whenever it has data. Accessories use an RPE-adjusted Epley e1RM from your logged sets. Exercises with no history run a 3-set ascending calibration (you eyeball the weight, log reps + RPE) and get prescribed weights from the next session. Custom exercises can be seeded with a known 1RM/10RM to skip calibration.

**Readiness (0–30):** sleep + muscle-group check-in sliders + last session rating + RPE accuracy + consistency − skip penalty. It's for *you*, not the algorithm — it never changes your weights. One exception in spirit: **sleeping under 6 h flags** the last accessory sets as extra-fatigue risk (they're marked optional, never removed). **Skip Workout** lowers readiness; the penalty decays over a few days.

**Weeks are completed manually** from the dashboard, so you can shift days around real life.

## Extending it

- New methodologies (e.g. a pure hypertrophy program): `Engine.registerScheme('my-id', {...})` in `engine.js`, then a `PROGRAM_TEMPLATES` entry whose blocks reference that scheme id. The resolver consults only `block.scheme` — existing schemes are never touched or blended.
- New programs on existing schemes: add an entry to `PROGRAM_TEMPLATES` and day layouts to `DAY_TEMPLATES` in `data.js`.

*Non-commercial personal project. The Juggernaut Method 2.0 is Chad Wesley Smith's work — buy the book.*
