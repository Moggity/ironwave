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

## Use it on your iPhone (installable PWA, works offline)

IRONWAVE is a Progressive Web App: install it once at home, and it runs as a
standalone app with **no network at all** afterward (e.g. a gym with no signal).
Training data is stored **on the phone**, so the server does not need to be
running once it is installed.

1. Make sure your iPhone and computer are on the **same Wi-Fi network**.
2. Find your computer's LAN IP:
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
   - Windows: `ipconfig` → IPv4 Address
3. Start the server as above, then in **Safari** on the iPhone open
   `http://YOUR_LAN_IP:3000` (e.g. `http://192.168.1.42:3000`).
   (Installable PWAs on iOS require Safari for the install step; you can use
   any browser afterward.)
4. Share → **Add to Home Screen**. You get a full-screen, app-like launch with
   the IRONWAVE icon, a dark status bar, and no browser chrome. The service
   worker caches the app shell so it launches with no connection.
5. From then on the app works **fully offline** — you can leave Wi-Fi and the
   server can be off. All your training data is saved on the phone.

### Installing over HTTPS (required for true offline)

The offline service worker only activates on a **secure context** (`https://` or
`localhost`), so a plain `http://YOUR_LAN_IP` address lets you Add to Home Screen
but will **not** cache for offline use. To install once over HTTPS, run a free
Cloudflare quick tunnel (no account needed) while the server is up:

```bash
npm run tunnel   # prints an https://<random>.trycloudflare.com URL
```

Send that `https://…` link to yourself (WhatsApp/Telegram/etc.), open it **in
Safari** on the iPhone, then Share → **Add to Home Screen**. The service worker
installs and the app launches fully offline afterward. The tunnel only needs to
be up for that first install; you can close it once installed.

> A PWA is a website, not a file: you are sending yourself the *link*, not the
> app. The phone installs it by loading that URL once.

### How storage works (phone is the source of truth)

State lives in the phone's local storage and is read/written on-device, so it
survives with no server and no signal. When a server *is* reachable (back home
on Wi-Fi), the app also mirrors each save to `database.json` as a convenience,
but it is never required. A failed mirror while offline is silent and is **not**
data loss.

### Backing up your data

Use **More → Settings & Data → Export JSON** in the app to save a backup file
(via the iOS share sheet / Files), and **Import JSON** to restore one. This is
the recommended backup path now that data lives on the device; on a desktop with
the server running you can also copy `database.json`.

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
