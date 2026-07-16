# Exercise media: recording, compression, and upload guide (Epic H8)

The app-side plumbing shipped in v1.16.0 and is fully inert until clips
exist: the exercise detail modal shows a clip when one is listed in
`app/media/manifest.json` and the emoji placeholder otherwise. Record at
your own pace; every clip you add lights up the moment it is committed,
with no version bump and no code change.

## The one-line spec

**One clean rep, 3 to 5 seconds, square crop, no audio, H.264 MP4 under
500 KB, named by exercise id.**

## Recording good practices

- **One rep.** Start and end in the same position (top of the rep for most
  lifts) so the loop is seamless. The video autoplays muted on a loop.
- **3 to 5 seconds.** Enough for one controlled rep. If a rep is naturally
  longer (deadlift setup), trim to the movement itself; the setup belongs
  to the text cues, not the loop.
- **Framing:** whole body plus the implement in frame for compounds; the
  working joint centered for isolation work. Square (1:1) crop reads best
  in the modal; 4:5 portrait also works. Leave a little margin, the CSS
  `object-fit: cover` crops edges.
- **Camera:** landscape phone on a tripod at chest height, 2 to 4 m back.
  Do not follow the movement; a static frame compresses far better.
- **Light and background:** one strong light source, plain background,
  no mirrors behind you (double image confuses the eye). Wear clothing
  that contrasts with the background so joint angles read.
- **Consistency:** same spot, same light, same outfit across sessions
  makes the library look like one product, not a collage.

## Format and compression (the performance contract)

| Property | Target | Why |
| --- | --- | --- |
| Container/codec | MP4, H.264 (libx264), `yuv420p` | Plays everywhere incl. older iOS WebViews |
| Resolution | 480x480 (square) or 480x600 | The modal is under 500 px wide; more is wasted bytes |
| Frame rate | 24 fps | Motion stays smooth; 60 fps doubles size for nothing |
| Duration | 3 to 5 s | One rep |
| Audio | none (`-an`) | Muted autoplay; an audio track is dead weight |
| Quality | CRF 28 | Visually clean at this size; drop to 26 only if artifacts show |
| Fast start | `+faststart` | The moov atom leads, so playback starts before the file finishes |
| Size | 150 to 300 KB typical, **500 KB hard cap** | 80 clips cached ~= 25 MB on device |
| GIF | **never** | 10x the bytes of the same H.264 clip |

The ffmpeg one-liner (crop to square, scale, strip audio, compress):

```sh
ffmpeg -i raw.mov -t 5 -an \
  -vf "crop='min(iw,ih)':'min(iw,ih)',scale=480:480,fps=24" \
  -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart \
  comp-squat.mp4
```

Batch a folder of raw takes (each file already named by exercise id):

```sh
for f in raw/*.mov; do
  id=$(basename "$f" .mov)
  ffmpeg -y -i "$f" -t 5 -an \
    -vf "crop='min(iw,ih)':'min(iw,ih)',scale=480:480,fps=24" \
    -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart \
    "app/media/$id.mp4"
done
```

## Naming: the exercise id IS the filename

Files are keyed by the exercise id in `data.js` (e.g. `comp-squat.mp4`,
`db-fly.mp4`). Print the full list of the 179 ids:

```sh
cd app && node -e "
const src = require('fs').readFileSync('data.js', 'utf8');
eval(src + ';console.log(EXERCISE_LIST.map(e => e[0]).join(String.fromCharCode(10)))');
"
```

To replace a clip later, do NOT overwrite the file under the same name
(devices keep the old copy cached): add a version to the filename
(`comp-squat.v2.mp4`) and point the manifest at it.

## Upload: two steps per clip

1. Copy the compressed file into **`app/media/`**.
2. Add one line to **`app/media/manifest.json`**:

```json
{
  "schemaVersion": 1,
  "items": {
    "comp-squat": "comp-squat.mp4",
    "db-fly": "db-fly.mp4"
  }
}
```

Commit and push both. That is the whole deployment: the manifest is
fetched network-first at runtime, so new clips appear on installed PWAs
without a version bump. Ids not in the manifest keep the emoji
placeholder; a typo in an id simply never matches (the test suite's
manifest checks run in CI, and a broken file removes itself from the
modal at runtime).

## How the app keeps this fast (already built, nothing to do)

- **Lazy everywhere.** Nothing media-related is fetched until an exercise
  detail modal opens; the manifest is fetched once per session; clips load
  with `preload="metadata"` only when their modal renders.
- **Never in the app shell.** The service worker routes `media/` to its
  own cache (`ironwave-media-v1`), capped at 80 clips with oldest-first
  eviction, and that cache survives app updates. The shell stays instant
  and offline-safe whether you upload 0 or 179 clips.
- **Offline:** a clip you have opened before plays offline; one you have
  not shows the placeholder. Both are correct.

## Licensing

Only your own recordings or license-clean assets you have the rights to
redistribute. Never scraped clips: this repo is the distribution.
