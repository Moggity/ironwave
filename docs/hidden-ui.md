# Hidden UI (owner call, 2026-07) and the copy style pass

This documents the surfaces deliberately hidden in the 2026-07 copywriting
pass, why, and how to bring each one back. None of the underlying mechanics
were removed; everything hidden here keeps working under the hood.

## 1. Powerbuilding is not an onboarding option

**What changed.** `OB_TRACKS` in `app.js` no longer lists `'powerbuilding'`,
so the goal step offers only Bodybuilding (Culturismo) and Powerlifting.

**What did NOT change.** The track itself is fully supported:

- `'powerbuilding'` stays the internal default for legacy saves
  (`migrateState`) and for `makeProgram` when no track is given.
- The golden master (`test/golden-master.test.js`) still builds and pins the
  default Powerbuilding program; scheme isolation is untouched.
- Existing powerbuilding programs keep rendering and prescribing normally.
- The `track.powerbuilding` / `track.powerbuilding_desc` catalog keys stay in
  `en.js` / `es.js`.

**To restore.** Add `'powerbuilding'` back to `OB_TRACKS`
(`feedback-round3.test.js` only pins that bodybuilding stays first).

## 2. Readiness is hidden, but still affecting

**What changed.** `SHOW_READINESS_UI = false` in `app.js` (defined above
`sparklineHTML`) hides every surface that exposes the 0-30 readiness score:

- the dashboard readiness hero (score + sparkline),
- the "Readiness context" card in the end-of-week feel modal (the next-week
  line stays),
- the readiness row in the post-workout summary.

The athlete-facing *wording* also stopped naming the metric: the pre-workout
check-in is now "Quick check-in", the ratings strip in the session view is
"Today's check-in", the skip/reorder toasts no longer mention a readiness
penalty, and deload/volume copy says "recovery" instead of "readiness".

**What did NOT change.** Readiness is still computed and still drives
behavior: the check-in flow collects the same inputs, `computeReadiness`,
`readinessLog`, skip penalties, `readinessTrendingDown`, deload depth, and
the early-deload advisor all keep working. Only the number is invisible.

**To restore.** Flip `SHOW_READINESS_UI` to `true`. The catalog keys
(`dash.readiness*`, `week.readiness_ctx`, `week.ctx_*`) were kept for this.

## 3. "Tap a week to preview" hint removed

The timeline legend no longer prints the hint; tapping a week still opens
the preview (discoverable interaction, no caption needed). The
`timeline.tap_hint` key was deleted from both catalogs. To restore, re-add
the key and the `<span>` in `timelineHTML`.

## Copy style rules applied in this pass

These are the editorial rules the 2026-07 pass enforced. Apply them to any
new athlete-facing string, in both languages:

1. **No fluff, no pep talk.** "Skipping them today is smart, not soft",
   "Don't chase numbers", "the engine follows you" - all cut. State the
   fact; the athlete supplies the motivation.
2. **Don't explain what the system enforces anyway.** If the routine adapts
   on its own ("keep skipping it and it gets dropped next block", "your
   answer never changes your working max"), the sentence goes. The behavior
   is the message.
3. **Don't explain what a tap will reveal.** Detail belongs in tap-to-open
   explainers (calibration modal, finisher info, volume-screen footers),
   which keep their depth. Inline cards and subtitles stay to one or two
   short sentences.
4. **No methodology name-dropping on first-run surfaces.** Onboarding no
   longer cites Juggernaut Method wave systems; My Program keeps a single
   short methodology line.
5. **Latam gym Spanish**, checked against how Spanish fitness apps and
   evidence-based content actually name things: polea al pecho (not jalón,
   which is Mexico-only; "tirón" stays for the movement patterns where it
   is standard), culturismo (owner call; fisicoculturismo also exists),
   agregar not añadir, pantorrillas, femorales. Gym terms conventionally
   said in English stay in English: pump (not bombeo), drop set (not serie
   descendente), finisher (not remate, which is soccer vocabulary),
   myo-reps, AMRAP, RIR. Exception: rest-pause is "pausa-descanso", the
   name used in Spanish fitness literature, because English "rest" reads
   like "resto" and misleads.
6. **No em dashes in athlete-facing strings** (pre-existing hard rule,
   enforced by `i18n.test.js`).
