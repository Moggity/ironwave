/* ============================================================
   IRONWAVE — engine.js
   The training brain. Juggernaut Method 2.0 math + RPE/e1RM
   estimation + readiness scoring + plate math.
   ============================================================ */

const Engine = {

  // ---------- rounding / plates ----------
  roundLoad(w, rounding) {
    const r = rounding || 2.5;
    return Math.round(w / r) * r;
  },

  // Per-side plate breakdown. Returns {plates:[{w,color}], achieved, perSide}
  plateMath(total, barWeight, inventory) {
    const target = Math.max(0, total - barWeight) / 2;
    let remaining = target;
    const out = [];
    const inv = [...inventory].sort((a, b) => b.w - a.w);
    for (const p of inv) {
      let avail = Math.floor(p.count / 2); // pairs
      while (avail > 0 && p.w <= remaining + 1e-9) {
        out.push({ w: p.w, color: PLATE_COLORS[String(p.w)] || '#6b7280' });
        remaining -= p.w; avail--;
      }
    }
    const perSide = target - remaining;
    return { plates: out, achieved: barWeight + perSide * 2, perSide };
  },

  // ---------- e1RM / RPE math (Epley + reps-in-reserve) ----------
  e1rm(weight, reps, rpe) {
    const rir = Math.max(0, 10 - (rpe ?? 8));
    const totalReps = reps + rir;
    if (totalReps <= 1) return weight;
    return weight * (1 + totalReps / 30);
  },

  // Weight that should produce `reps` at `rpe`, given an e1RM
  weightFor(e1rm, reps, rpe, rounding) {
    const rir = Math.max(0, 10 - rpe);
    const w = e1rm / (1 + (reps + rir) / 30);
    return this.roundLoad(w, rounding);
  },

  // Best recent e1RM for an exercise from logged records (last 120 days, top of last 5)
  bestE1RM(records) {
    if (!records || !records.length) return null;
    const cutoff = Date.now() - 120 * 864e5;
    const recent = records.filter(r => r.ts > cutoff && r.weight > 0 && r.reps > 0);
    if (!recent.length) return null;
    const last = recent.slice(-8);
    return Math.max(...last.map(r => this.e1rm(r.weight, r.reps, r.rpe)));
  },

  // PRESCRIPTION anchor for a target rep range: prefer recent records whose rep
  // count is close to the target. A stated 10RM is better evidence for a 12 rep
  // prescription than a heavier 1RM pushed through Epley (the conversion
  // degrades across rep ranges, so max-of-everything can price a 12 rep set at
  // or above the athlete's actual 10RM). Same recency window as bestE1RM and
  // falls back to it when nothing is close; bestE1RM stays the DISPLAY estimate.
  anchorE1RM(records, targetReps) {
    if (!records || !records.length) return null;
    const cutoff = Date.now() - 120 * 864e5;
    const recent = records.filter(r => r.ts > cutoff && r.weight > 0 && r.reps > 0).slice(-8);
    if (!recent.length) return null;
    const near = recent.filter(r => Math.abs(r.reps - targetReps) <= 4);
    const pool = near.length ? near : recent;
    return Math.max(...pool.map(r => this.e1rm(r.weight, r.reps, r.rpe)));
  },

  // ---------- week typing ----------
  weekType(weekIdx) {
    return ['intro', 'accumulation', 'intensification', 'realization', 'deload'][weekIdx] || 'accumulation';
  },
  weekTypeLabel(weekIdx) {
    return ['Week 1 · Calibration', 'Week 2 · Accumulation', 'Week 3 · Intensification',
            'Week 4 · Realization', 'Week 5 · Deload'][weekIdx] || '';
  },

  // ---------- technique periodization (Epic G5) ----------
  // When in a meso an intensity technique (myo-reps / drop set) is scheduled.
  // Our own simple mapping, not a clone of any product's protocol: intensifiers
  // live in the back half of a meso (intensification + realization), never on the
  // calibration/intro or deload week. They escalate across the macrocycle, so an
  // early meso (mesoIdx 0) only carries the realization drop set, while later
  // mesos (the athlete has adapted) add a myo-rep week. A deficit holds the added
  // myo back, since recovery is lower. Experience gates it: a beginner gets none
  // (build a base on straight sets first), an advanced lifter gets the myo from
  // meso 0. Returns a technique id or null. Pure and display-first: it drives the
  // timeline markers and the weekly recommendation, not the prescription itself
  // (the athlete still opts a finisher in).
  scheduledTech(weekIdx, mesoIdx, opts) {
    opts = opts || {};
    if (opts.experience === 'beginner') return null;
    const type = this.weekType(weekIdx);
    if (type === 'intro' || type === 'accumulation' || type === 'deload') return null;
    if (type === 'realization') return 'drop';
    const myoMeso = opts.experience === 'advanced' ? 0 : 1;
    if (type === 'intensification' && (mesoIdx || 0) >= myoMeso && !opts.deficit) return 'myo';
    return null;
  },

  // ---------- CALIBRATION RAMP ----------
  // Three ascending feeler sets, weightless (the athlete eyeballs the load),
  // used when there is no working max / e1RM yet. We read the working weight from
  // the top set, so it is built for a clean, low-fatigue e1RM estimate:
  //   · reads in RIR (RIR 4 / 3 / 2), the flip side of RPE that novices prefer;
  //     RPE stays the stored value (rir = 10 - rpe).
  //   · reps DESCEND (R, R-2, R-4) floored at 3 as the load climbs, the standard
  //     ramp shape. Fewer total reps means lower fatigue, and a moderate top set
  //     estimates e1RM more accurately than a high-rep one (the conversion
  //     degrades past ~10 reps); the floor keeps us off a near-max single on a
  //     cold, never-calibrated lift.
  //   · experience gating: beginners stop at RIR 3, never close to failure on a
  //     guessed weight.
  // Bodybuilding meso 1 and every track share this ramp (it is the uncalibrated
  // path), so changing it deliberately moves the golden master.
  calibrationRamp(baseReps, experience) {
    const topRir = experience === 'beginner' ? 3 : 2;
    // [i18n phase 3] Sets carry a noteKey (translated at render, 'note.<key>'
    // in the catalogs) instead of a baked-in English string. Legacy stored
    // notes still render verbatim on the UI side.
    const noteKeys = ['calib_build', 'calib', 'calib_top'];
    return [4, 3, topRir].map((rir, i) => ({
      reps: Math.max(3, baseReps - 2 * i),
      rpe: 10 - rir,
      calib: true,
      noteKey: noteKeys[i],
    }));
  },

  // ---------- MAIN LIFT PRESCRIPTION (the Juggernaut tables) ----------
  // Returns array of set objects: {weight?, reps, rpe?, amrap?, noteKey?, noteParams?}
  prescribeMain(wave, weekIdx, workingMax, rounding, pctMod = 1, experience) {
    const W = WAVES[wave];
    const wm = workingMax * pctMod;
    const R = (p) => this.roundLoad(wm * p, rounding);
    const type = this.weekType(weekIdx);
    const sets = [];

    if (!workingMax) {
      // No working max yet → calibration ramp (descending reps, RIR-led).
      return this.calibrationRamp(W.acc.reps, experience);
    }

    if (type === 'intro') {
      // Week 1: accumulation volume, RPE-led but with a bold suggested weight
      const w = this.roundLoad(wm * (W.acc.pct - 0.025), rounding);
      for (let i = 0; i < W.acc.sets; i++) {
        sets.push({ weight: w, reps: W.acc.reps, rpe: 7,
          noteKey: i === W.acc.sets - 1 ? 'intro_tank' : null });
      }
    } else if (type === 'accumulation') {
      for (let i = 0; i < W.acc.sets; i++) {
        sets.push({ weight: R(W.acc.pct), reps: W.acc.reps,
          rpe: i === W.acc.sets - 1 ? 8 : 7,
          noteKey: i === W.acc.sets - 1 ? 'acc_last' : null });
      }
    } else if (type === 'intensification') {
      W.int.ramp.forEach(([p, r]) => sets.push({ weight: R(p), reps: r, ramp: true }));
      for (let i = 0; i < W.int.work.sets; i++) {
        sets.push({ weight: R(W.int.work.pct), reps: W.int.work.reps,
          rpe: i === W.int.work.sets - 1 ? 9 : 8,
          noteKey: i === W.int.work.sets - 1 ? 'int_last' : null });
      }
    } else if (type === 'realization') {
      W.real.ramp.forEach(([p, r]) => sets.push({ weight: R(p), reps: r, ramp: true }));
      sets.push({ weight: R(W.real.amrap.pct), reps: W.standard, rpe: 10, amrap: true,
        noteKey: 'amrap', noteParams: { standard: W.standard } });
    } else if (type === 'deload') {
      DELOAD_SETS.forEach(([p, r]) => sets.push({ weight: R(p), reps: r, noteKey: 'deload_main' }));
    }
    return sets;
  },

  // Secondary main-lift volume work (Inverted Juggernaut style)
  prescribeSecondary(blockType, weekIdx, workingMax, rounding, pctMod = 1, experience) {
    const type = this.weekType(weekIdx);
    const S = SECONDARY_SCHEMES[blockType] || SECONDARY_SCHEMES.hypertrophy;
    if (!workingMax) {
      return this.calibrationRamp(S.reps, experience);
    }
    const wm = workingMax * pctMod;
    if (type === 'deload') {
      return [[0.40, 5], [0.50, 5]].map(([p, r]) =>
        ({ weight: this.roundLoad(wm * p, rounding), reps: r, noteKey: 'deload' }));
    }
    // Slight ramp across the block: +2.5% per work week
    const bump = { intro: -0.025, accumulation: 0, intensification: 0.025, realization: 0.05 }[type] || 0;
    const w = this.roundLoad(wm * (S.pct + bump), rounding);
    const sets = [];
    for (let i = 0; i < S.sets; i++) sets.push({ weight: w, reps: S.reps, rpe: 7 });
    return sets;
  },

  // Accessory prescription — BOLD: compute weight from e1RM when records exist,
  // otherwise run a 3-set calibration ramp.
  prescribeAccessory(blockType, weekIdx, records, rounding, experience) {
    const type = this.weekType(weekIdx);
    const S = ACC_SCHEMES[blockType] || ACC_SCHEMES.hypertrophy;
    const e1 = this.anchorE1RM(records, S.reps);
    const sets = [];
    const deload = type === 'deload';
    const nSets = deload ? Math.max(2, Math.floor(S.sets / 2)) : S.sets;
    const rpe = deload ? 6 : S.rpe;

    if (!e1) {
      return this.calibrationRamp(S.reps, experience);
    }
    // gentle wave inside the block: +1 RPE worth of load by week 3-4 via rpe target
    const weekRpe = { intro: rpe - 1, accumulation: rpe, intensification: rpe + 0.5, realization: rpe + 0.5, deload: 6 }[type] ?? rpe;
    const w = this.weightFor(e1, S.reps, Math.min(weekRpe, 9), rounding);
    for (let i = 0; i < nSets; i++) {
      sets.push({ weight: w, reps: S.reps, rpe: Math.min(weekRpe, 9) });
    }
    return sets;
  },

  // ---------- WORKING MAX PROGRESSION (the heart of JM 2.0) ----------
  // newWM = WM + min(repsOver, 10) * increment
  amrapAdjust(workingMax, repsPerformed, standard, incrementPerRep) {
    const over = Math.min(repsPerformed - standard, 10);
    if (over <= 0) return { newWM: workingMax, delta: 0, capped: false,
      msg: repsPerformed < standard ? 'Below standard, working max held. Consider recovery.' : 'Standard met, working max held.' };
    const delta = over * incrementPerRep;
    return { newWM: workingMax + delta, delta, capped: (repsPerformed - standard) > 10,
      msg: `+${delta} kg working max` };
  },

  defaultIncrement(liftId) {
    // lower body 2.5 kg/rep, upper body 1.25 kg/rep (book's metric-equivalent)
    const lower = ['comp-squat', 'comp-deadlift'];
    return lower.includes(liftId) ? 2.5 : 1.25;
  },

  // Auto-recalibration after calibration sets or intro week:
  // logs imply a different max → snap WM to 0.9 × e1RM if deviation > 5%
  recalibratedWM(currentWM, loggedSets) {
    const ests = loggedSets.filter(s => s.weight > 0 && s.reps > 0 && s.rpe)
      .map(s => this.e1rm(s.weight, s.reps, s.rpe));
    if (!ests.length) return null;
    const e1 = Math.max(...ests);
    const implied = e1 * 0.9;
    if (!currentWM) return implied;
    const dev = Math.abs(implied - currentWM) / currentWM;
    return dev > 0.05 ? implied : null;
  },

  // ---------- WARMUP GENERATOR ----------
  warmupSets(topWeight, barWeight, rounding) {
    if (!topWeight || topWeight <= barWeight) return [];
    const scheme = [[0.0, 10], [0.40, 5], [0.60, 3], [0.80, 2], [0.90, 1]];
    const out = [];
    let prev = -1;
    for (const [p, r] of scheme) {
      const w = p === 0 ? barWeight : Math.max(barWeight, this.roundLoad(topWeight * p, rounding));
      if (w >= topWeight || w === prev) continue;
      out.push({ weight: w, reps: r });
      prev = w;
    }
    return out;
  },

  // ---------- READINESS (0–30 composite) ----------
  // Inputs: latest check-in (sleep hours, muscle sliders 1–5),
  // last session rating (5–10), RPE accuracy of last session, skip penalty.
  readinessScore(d) {
    const sleep = Math.min(d.sleepHours ?? 7.5, 9) / 9 * 8;                   // 0–8
    const sliders = d.sliderAvg != null ? (d.sliderAvg / 5) * 10 : 6;          // 0–10
    const rec = d.lastSessionRating != null ? (10 - d.lastSessionRating) * 1.4 : 4; // 0–7
    let acc = 3;                                                               // 0–3
    if (d.rpeDeviation != null) acc = Math.max(0, 3 - Math.abs(d.rpeDeviation) * 2);
    const consistency = Math.min(d.streak ?? 0, 3) * 0.7;                      // 0–2.1
    const penalty = d.skipPenalty ?? 0;
    return Math.max(0, Math.min(30, sleep + sliders + rec + acc + consistency - penalty));
  },

  // ---------- tonnage ----------
  tonnage(entries) {
    let t = 0;
    for (const e of entries) for (const s of e.sets) {
      // Optional s.bw (bodyweight counted, frozen at log time): each rep moves
      // the body plus the added load. Absent bw leaves the math unchanged.
      const bw = s.bw > 0 ? s.bw : 0;
      if (s.done && s.weight + bw > 0 && s.reps > 0) t += (s.weight + bw) * s.reps;
      // A logged drop set adds the volume of each mini-set it carried; the same
      // body moves on every mini-set, so the parent's bw rides along.
      if (s.done && Array.isArray(s.drops)) {
        for (const d of s.drops) if (d.weight + bw > 0 && d.reps > 0) t += (d.weight + bw) * d.reps;
      }
    }
    return Math.round(t);
  },

  // ---------- outlier guard ----------
  // A manually entered weight far outside an exercise's history is almost always
  // a logging slip (the classic one: typing your bodyweight into a bodyweight
  // lift), and one bad record poisons the e1RM that prescribes future weights.
  // Flags a weight at least double AND 20+ kg above the best weight on record.
  // Needs 3+ real (non-seeded) records so early exploration is never nagged,
  // but a seeded max DOES raise the anchor: an athlete who entered a 120 kg 1RM
  // is not questioned for loading 100 kg over a light logged history.
  weightOutlier(records, weight) {
    const all = (records || []).filter(r => r.weight > 0);
    const real = all.filter(r => !r.seed);
    if (real.length < 3 || !(weight > 0)) return false;
    const best = Math.max(...all.map(r => r.weight));
    return weight >= best * 2 && weight - best >= 20;
  },

  // ---------- INTENSITY TECHNIQUES (Cluster B) ----------
  // A technique is a prescribable set modifier: it takes a plain working set and
  // returns a richer set object carrying child mini-sets. Self-contained and
  // opt-in (bodybuilding only); nothing here runs for a default user, so the
  // golden master is untouched. Built to extend: myo-reps / rest-pause register
  // here later the same way schemes register in Engine.schemes.

  // A drop set: keep the top set, then `drops` strips each `dropPct` lighter,
  // run to roughly the same rep target. Needs a real weight to strip from, so a
  // weightless (calibration / RIR-only) set is returned unchanged.
  buildDropSet(set, opts = {}) {
    const o = (typeof DROP_DEFAULTS !== 'undefined') ? DROP_DEFAULTS : { drops: 2, dropPct: 0.2, repFactor: 1 };
    const n = opts.drops ?? o.drops;
    const pct = opts.dropPct ?? o.dropPct;
    const repFactor = opts.repFactor ?? o.repFactor;
    const rounding = opts.rounding || 2.5;
    if (!set || !(set.weight > 0) || n < 1) return set;
    const drops = [];
    let w = set.weight;
    for (let i = 0; i < n; i++) {
      w = this.roundLoad(w * (1 - pct), rounding);
      drops.push({ weight: w, reps: Math.max(1, Math.round(set.reps * repFactor)) });
    }
    return Object.assign({}, set, { technique: 'drop', drops });
  },

  // Myo-reps: keep the activation (working) set, then `minis` short mini-sets at
  // the SAME weight (no strip), each `miniReps` reps to roughly failure. Shares
  // the `drops` child-set field so logging / tonnage / time accounting treat it
  // the same; the `technique` tag is what distinguishes it from a drop set. Needs
  // a real weight, so a weightless (calibration / RIR-only) set is unchanged.
  buildMyoReps(set, opts = {}) {
    const o = (typeof MYO_DEFAULTS !== 'undefined') ? MYO_DEFAULTS : { minis: 3, miniReps: 5 };
    const n = opts.minis ?? o.minis;
    const reps = opts.miniReps ?? o.miniReps;
    if (!set || !(set.weight > 0) || n < 1) return set;
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ weight: set.weight, reps: Math.max(1, reps) });
    return Object.assign({}, set, { technique: 'myo', drops });
  },

  // Rest-pause: the working set to failure, then `bursts` short bursts at the
  // SAME weight, each `burstReps` reps. Shares the `drops` child-set field; the
  // `technique` tag is what marks it. Weightless set returned unchanged.
  buildRestPause(set, opts = {}) {
    const o = (typeof RESTPAUSE_DEFAULTS !== 'undefined') ? RESTPAUSE_DEFAULTS : { bursts: 2, burstReps: 3 };
    const n = opts.bursts ?? o.bursts;
    const reps = opts.burstReps ?? o.burstReps;
    if (!set || !(set.weight > 0) || n < 1) return set;
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ weight: set.weight, reps: Math.max(1, reps) });
    return Object.assign({}, set, { technique: 'restpause', drops });
  },

  // Lengthened partials: keep the working set, then `sets` burst(s) of partial-ROM
  // reps at the SAME weight (no strip), in the stretched position. Shares the
  // `drops` child-set field so logging / tonnage / time accounting treat it the
  // same; the `technique` tag is what marks it. Weightless set returned unchanged.
  buildPartials(set, opts = {}) {
    const o = (typeof PARTIAL_DEFAULTS !== 'undefined') ? PARTIAL_DEFAULTS : { sets: 1, partialReps: 6 };
    const n = opts.sets ?? o.sets;
    const reps = opts.partialReps ?? o.partialReps;
    if (!set || !(set.weight > 0) || n < 1) return set;
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ weight: set.weight, reps: Math.max(1, reps) });
    return Object.assign({}, set, { technique: 'partials', drops });
  },

  // The intrinsic intra-set rest (seconds) charged between a technique's child
  // mini-sets: a myo mini-rest, a rest-pause pause, a partials slowdown, or a
  // drop's strip transition. Single source of truth for the time estimate and the
  // in-modal cue.
  techTransitionSec(tech, TM) {
    if (tech === 'myo') return TM.myoRestSec;
    if (tech === 'restpause') return TM.restPauseSec;
    if (tech === 'partials') return TM.partialsSec;
    return TM.dropTransitionSec;
  },

  // Time cost of one prescribed set, technique-aware (Cluster B). A plain set is
  // exec(reps) + one rest; a set carrying child mini-sets (drop / myo / rest-
  // pause) adds each mini-set's exec plus its intrinsic transition, but still
  // only one full rest at the end. `restSec` is the resolved rest for this kind.
  setTimeSec(st, TM, kind, restSec) {
    let t = (st.reps || 0) * TM.execSecPerRep[kind] + restSec;
    if (Array.isArray(st.drops)) {
      const transition = this.techTransitionSec(st.technique, TM);
      for (const d of st.drops) t += (d.reps || 0) * TM.execSecPerRep[kind] + transition;
    }
    return t;
  },

  // Prescribed rest (seconds) for one set of a given kind. The same source the
  // session-time estimate reads (TM.restSec / restSecTight), surfaced so the
  // in-app rest timer counts down the real prescription rather than a guess.
  // `tight` picks the compressed table a time-capped athlete trains on. Pure;
  // unknown kinds fall back to accessory so a caller never gets NaN.
  restSecFor(kind, tight, TM) {
    const table = tight ? TM.restSecTight : TM.restSec;
    return table[kind] != null ? table[kind] : table.accessory;
  },

  // ---------- RIR <-> RPE (presentation only) ----------
  // RIR (reps in reserve) reads easier for novices; the engine keeps RPE as the
  // stored/canonical intensity and these convert for display and logging input.
  // No prescription math changes: rir = 10 - rpe (the same identity e1rm uses).
  rpeToRir(rpe) { return Math.max(0, 10 - (rpe ?? 8)); },
  rirToRpe(rir) { return Math.min(10, Math.max(0, 10 - rir)); },

  // ---------- progression trends (Cluster A charts) ----------
  // Group logged records into one bucket per calendar day (UTC) inside the
  // window. Pure and deterministic (callers seed ts), ascending by time. Only
  // real working sets (weight>0, reps>0) count; warmups never carry weight=0
  // into a record, so this mirrors what bestE1RM already trusts.
  _recordsByDay(records, days) {
    const cutoff = Date.now() - days * 864e5;
    const groups = new Map();
    for (const r of records || []) {
      if (!(r.ts > cutoff) || !(r.weight > 0) || !(r.reps > 0)) continue;
      const key = new Date(r.ts).toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, { ts: r.ts, recs: [] });
      groups.get(key).recs.push(r);
    }
    return [...groups.values()].sort((a, b) => a.ts - b.ts);
  },
  // Best (max) estimated 1RM achieved each day.
  e1rmTrend(records, days = 120) {
    return this._recordsByDay(records, days).map(g =>
      ({ ts: g.ts, value: Math.max(...g.recs.map(r => this.e1rm(r.weight, r.reps, r.rpe))) }));
  },
  // Total volume load (sum of weight * reps) each day. Records carrying the
  // optional bw field (bodyweight counted at log time) move body plus load.
  volumeLoadTrend(records, days = 120) {
    return this._recordsByDay(records, days).map(g =>
      ({ ts: g.ts, value: g.recs.reduce((a, r) => a + (r.weight + (r.bw || 0)) * r.reps, 0) }));
  },

  // Dated max milestones for the Maxes tab, newest first: every set that put
  // the estimated 1RM at a new all-time high ('new'), and every athlete-entered
  // max ('entered', shown as the entered weight for a true 1RM). An entered max
  // also raises the running best, so later sets below it are not hailed as PRs.
  maxMilestones(records) {
    const out = [];
    let best = 0;
    for (const r of records || []) {
      if (!(r.weight > 0) || !(r.reps > 0)) continue;
      const e1 = this.e1rm(r.weight, r.reps, r.rpe ?? 10);
      if (r.seed) {
        out.push({ ts: r.ts, kind: 'entered', value: r.reps === 1 ? r.weight : e1 });
        best = Math.max(best, e1);
      } else if (e1 > best) {
        best = e1;
        out.push({ ts: r.ts, kind: 'new', value: e1 });
      }
    }
    return out.reverse();
  },
};

/* ============================================================
   [Juggernaut + Bodybuilding] — PRESCRIPTION SCHEME REGISTRY
   Every block declares a scheme id; resolveSlot routes through
   this registry and nothing else. Schemes are self-contained:
   main / secondary / accessory prescriptions + a weekVolume
   index for the program timeline. Loading a new methodology
   later = Engine.registerScheme('my-id', {...}) — zero mixing.
   ============================================================ */

Engine.schemes = {

  // The 2012 book, verbatim: descending volume, rising intensity,
  // realization AMRAP. Used for strength blocks.
  'jm2-wave': {
    label: 'Juggernaut 2.0 wave',
    short: 'JM2 wave',
    main(block, w, wm, rounding, pctMod = 1, experience) {
      return Engine.prescribeMain(block.wave, w, wm, rounding, pctMod, experience);
    },
    secondary(block, w, wm, rounding, pctMod = 1, experience) {
      return Engine.prescribeSecondary(block.type, w, wm, rounding, pctMod, experience);
    },
    accessory(block, w, records, rounding, experience) {
      return Engine.prescribeAccessory(block.type, w, records, rounding, experience);
    },
    // Volume index: main working reps + one accessory's weekly reps
    weekVolume(block, w) {
      const W = WAVES[block.wave];
      const t = Engine.weekType(w);
      const A = ACC_SCHEMES[block.type] || ACC_SCHEMES.strength;
      let main;
      if (t === 'intro' || t === 'accumulation') main = W.acc.sets * W.acc.reps;
      else if (t === 'intensification') main = W.int.ramp.reduce((a, [, r]) => a + r, 0) + W.int.work.sets * W.int.work.reps;
      else if (t === 'realization') main = W.real.ramp.reduce((a, [, r]) => a + r, 0) + W.standard;
      else main = 15; // deload 3×5
      const acc = t === 'deload' ? Math.floor(A.sets / 2) * A.reps : A.sets * A.reps;
      return main + acc;
    },
  },

  // [Juggernaut + Bodybuilding] ascending-volume hypertrophy:
  // MEV→MRV style. Sets climb week over week, RIR tightens 3→1,
  // week 4 keeps the AMRAP (at the book's realization %) so the
  // working max still progresses block to block. Deload halves.
  'jbb-hyp': {
    label: 'Ascending volume hypertrophy',
    short: 'JBB ascending',
    weekLabel(w) {
      return ['Week 1 \u00b7 Calibration', 'Week 2 \u00b7 Build Volume', 'Week 3 \u00b7 Build Volume',
              'Week 4 \u00b7 Peak Volume + AMRAP', 'Week 5 \u00b7 Deload'][w] || '';
    },
    // mesoIdx (block.mesoIdx, 0-based among same-scheme blocks) selects
    // the macrocycle row; clamped so longer programs reuse the top row.
    _meso(block) { return Math.min(block.mesoIdx || 0, JBB_HYP.mainSets.length - 1); },
    main(block, w, wm, rounding, pctMod = 1, experience) {
      const W = WAVES[block.wave];
      if (!wm) return Engine.prescribeMain(block.wave, w, null, rounding, pctMod, experience); // calibration ramp
      const t = Engine.weekType(w);
      const wmE = wm * pctMod;
      const R = p => Engine.roundLoad(wmE * p, rounding);
      if (t === 'deload') {
        return DELOAD_SETS.map(([p, r]) => ({ weight: R(p), reps: r, noteKey: 'deload_main' }));
      }
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const nSets = JBB_HYP.mainSets[m][idx];
      const sets = [];
      for (let i = 0; i < nSets; i++) {
        const last = i === nSets - 1 && idx < 3;
        sets.push({ weight: R(W.acc.pct + JBB_HYP.dPct[idx]), reps: W.standard, rpe: JBB_HYP.rpe[idx],
          noteKey: last ? 'meso_week' : null, noteParams: last ? { m: m + 1, w: idx + 1 } : null });
      }
      if (idx === 3) {
        sets.push({ weight: R(W.real.amrap.pct), reps: W.standard, rpe: 10, amrap: true,
          noteKey: 'amrap', noteParams: { standard: W.standard } });
      }
      return sets;
    },
    secondary(block, w, wm, rounding, pctMod = 1, experience) {
      // Uncalibrated: ramp at the scheme's own rep target (8s), not the
      // strength-flavored 5s the shared prescribeSecondary path uses.
      if (!wm) return Engine.calibrationRamp(JBB_HYP.secReps, experience);
      const t = Engine.weekType(w);
      const wmE = wm * pctMod;
      if (t === 'deload') {
        const w0 = Engine.roundLoad(wmE * JBB_HYP.deload.secPct, rounding);
        return Array.from({ length: JBB_HYP.deload.secSets }, () => ({ weight: w0, reps: JBB_HYP.secReps, noteKey: 'deload' }));
      }
      // Weight from the same anchor math accessories use: the working max is
      // 0.9 x e1RM, so weightFor(wmE / 0.9, ...) prices the set to actually
      // reach the displayed RIR (roughly 73-78% e1RM across the ramp).
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const rpe = JBB_HYP.secRpe[idx];
      const wt = Engine.weightFor(wmE / 0.9, JBB_HYP.secReps, Math.min(rpe, 9), rounding);
      return Array.from({ length: JBB_HYP.secSets[m][idx] }, () => ({ weight: wt, reps: JBB_HYP.secReps, rpe }));
    },
    accessory(block, w, records, rounding, experience) {
      const e1 = Engine.anchorE1RM(records, JBB_HYP.accReps);
      if (!e1) return Engine.prescribeAccessory(block.type, w, records, rounding, experience); // calibration ramp
      const t = Engine.weekType(w);
      if (t === 'deload') {
        const wt = Engine.weightFor(e1, JBB_HYP.accReps, JBB_HYP.deload.accRpe, rounding);
        return Array.from({ length: JBB_HYP.deload.accSets },
          () => ({ weight: wt, reps: JBB_HYP.accReps, rpe: JBB_HYP.deload.accRpe, noteKey: 'deload_half' }));
      }
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const rpe = JBB_HYP.accRpe[idx];
      const wt = Engine.weightFor(e1, JBB_HYP.accReps, Math.min(rpe, 9), rounding);
      const last = m === JBB_HYP.accSets.length - 1 && idx === 3;
      return Array.from({ length: JBB_HYP.accSets[m][idx] }, (_, i) => ({
        weight: wt, reps: JBB_HYP.accReps, rpe,
        noteKey: i === 0 ? (last ? 'hardest_week' : idx === 3 ? 'peak_week' : null) : null }));
    },
    weekVolume(block, w) {
      const W = WAVES[block.wave];
      const t = Engine.weekType(w);
      if (t === 'deload') return 15 + JBB_HYP.deload.accSets * JBB_HYP.accReps;
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const main = JBB_HYP.mainSets[m][idx] * W.standard + (idx === 3 ? W.standard : 0); // + AMRAP
      return main + JBB_HYP.accSets[m][idx] * JBB_HYP.accReps;
    },
  },
};

// Future methodologies (e.g. a pure hypertrophy program) plug in here.
Engine.registerScheme = function (id, impl) { Engine.schemes[id] = impl; };
Engine.schemeFor = function (block) {
  const id = block.scheme || (block.type === 'hypertrophy' ? 'jbb-hyp' : 'jm2-wave');
  return Engine.schemes[id] || Engine.schemes['jm2-wave'];
};

/* ============================================================
   DYNAMIC ROUTINE ADAPTATION ENGINE — per-athlete landmarks
   See docs/dynamic-routine-engine-design.md (5.5-5.7). These read
   the data tables in data.js. Nothing here runs for a default
   (Powerbuilding / unlimited-time) user, so legacy output is intact.
   ============================================================ */

// Seed a fresh per-athlete landmark grid from the published RP grid, scaled by
// training experience. Stored on profile.landmarks, then evolved over time.
Engine.seedLandmarks = function (experience) {
  const f = (typeof EXPERIENCE_FACTOR !== 'undefined' && EXPERIENCE_FACTOR[experience]) || 0.85;
  const out = {};
  for (const m in VOLUME_LANDMARKS) {
    const L = VOLUME_LANDMARKS[m];
    const mv = Math.round(L.mv * f);
    const mev = Math.max(mv, Math.round(L.mev * f));   // mev>=0 preserved (glutes/abs MEV 0)
    const mrv = Math.max(mev + 1, Math.round(L.mrv * f));
    out[m] = { mv, mev, mrv };
  }
  return out;
};

// [Cluster D] Classify a muscle's weekly working sets against its landmarks.
// Pure and read-only (no prescription change): below MV is undertraining, MEV..MRV
// is the productive window, above MRV is more than you can recover from. Returns a
// status key + label plus a 0..100 fill (sets relative to MRV) for the bar.
Engine.volumeStatus = function (sets, lm) {
  if (!lm) return { key: 'none', label: 'No landmark', pct: 0 };
  const { mv, mev, mrv } = lm;
  let key, label;
  if (sets <= 0) { key = 'none'; label = 'Not trained'; }
  else if (sets < mv) { key = 'under'; label = 'Below maintenance'; }
  else if (sets < mev) { key = 'maint'; label = 'Maintenance'; }
  else if (sets <= mrv) { key = 'productive'; label = 'Productive'; }
  else { key = 'over'; label = 'Over MRV'; }
  return { key, label, pct: mrv > 0 ? Math.min(100, Math.round(sets / mrv * 100)) : 0, mv, mev, mrv };
};

// [Cluster C] Per-HEAD landmark, derived from the whole-muscle landmark by an even
// split across the muscle's heads (our own simple model, deliberately not a
// product's per-head table). A muscle split into N heads needs roughly its volume
// spread across them: each head gets a share of MEV (floored so a head still needs
// real direct work to grow) and of MRV (floored above its MEV, and never above the
// whole-muscle MRV). A single-head or unsplit muscle keeps the whole-muscle
// landmark unchanged, so this is inert where heads do not differ. Pure.
Engine.headLandmark = function (lm, nHeads) {
  if (!lm) return null;
  const n = nHeads || 1;
  if (n <= 1) return { mv: lm.mv, mev: lm.mev, mrv: lm.mrv };
  const mev = Math.max(2, Math.round(lm.mev / n));
  const mrv = Math.min(lm.mrv, Math.max(mev + 2, Math.round(lm.mrv / n)));
  const mv = Math.min(mev, Math.max(0, Math.round(lm.mv / n)));
  return { mv, mev, mrv };
};

// [Cluster E] Per-muscle volume autoregulation (our OWN simple model, not a clone
// of any product's signal set/scale/mapping). Given a small feedback signal and
// the muscle's current weekly sets vs its landmarks, recommend whether to add,
// hold, or cut sets next time, ramping MEV -> MRV and backing off when recovery
// or performance says so. Pure and deterministic (callers pass the signal), so it
// unit-tests with seeded feedback. This slice RECOMMENDS only; wiring the delta
// into prescribed set counts is the next slice.
//   sig.recovery     1..5 (1 wrecked / still sore, 5 fully fresh); default 3
//   sig.performance  -1 reps down, 0 held, +1 up vs last; default 0
//   sig.pump         1..3 or null (advisory only for now)
// `phase` (Cluster F) modulates recovery: in an energy deficit (cut / minicut)
// recovery capacity drops, so we never add volume (retain, do not grow) and back
// off one notch sooner. Omitted -> surplus/maintenance behavior (unchanged).
Engine.autoregVolume = function (sig, sets, lm, phase) {
  // `reasonKey` is a stable id for the reason, so the UI can translate it at
  // render time ('vol.rec_<key>' in the i18n catalogs); `reason` stays the
  // English sentence for logs and tests.
  if (!lm) return { action: 'hold', delta: 0, nextSets: sets, reason: 'No landmark yet', reasonKey: 'no_landmark' };
  const s = sig || {};
  const rec = s.recovery == null ? 3 : s.recovery;
  const perf = s.performance == null ? 0 : s.performance;
  const deficit = phase === 'cut' || phase === 'minicut';
  const addRec = deficit ? 5 : 4;     // harder to justify adding when under-fed
  const cutRec = deficit ? 3 : 2;     // back off sooner
  let delta, why, whyKey;
  if (perf < 0 || rec <= cutRec) {
    delta = -1;
    why = perf < 0 ? 'Reps are dropping, back off' : 'Still under-recovered, back off';
    whyKey = perf < 0 ? 'perf_down' : 'under_recovered';
  }
  else if (deficit) { delta = 0; why = 'In a deficit, hold volume and keep what you have'; whyKey = 'deficit_hold'; }
  else if (sets < lm.mev) { delta = Math.min(2, lm.mev - sets); why = 'Below MEV, ramp the volume in'; whyKey = 'below_mev'; }
  else if (sets >= lm.mrv) { delta = 0; why = 'At your MRV, hold here'; whyKey = 'at_mrv'; }
  else if (rec >= addRec && perf >= 0) { delta = 1; why = 'Recovered well, add a set'; whyKey = 'recovered_add'; }
  else { delta = 0; why = 'On track, hold and let it adapt'; whyKey = 'on_track'; }
  // Clamp direction-safely: an add caps at MRV, a cut floors at MV but never
  // turns into an increase when the muscle is already below maintenance.
  const nextSets = delta >= 0
    ? Math.min(lm.mrv, sets + delta)
    : Math.min(sets, Math.max(lm.mv, sets + delta));
  const applied = nextSets - sets;
  const action = applied > 0 ? 'add' : applied < 0 ? 'cut' : 'hold';
  // If clamping turned an intended move into a hold, say why plainly.
  const clamped = applied === 0 && delta !== 0;
  const reason = clamped
    ? (delta > 0 ? 'At your MRV, hold here' : 'Already at maintenance, hold here') : why;
  const reasonKey = clamped ? (delta > 0 ? 'at_mrv' : 'at_maint') : whyKey;
  return { action, delta: applied, nextSets, reason, reasonKey };
};

// [Cluster F] Fatigue saturation: how many muscles sit at or near MRV (over the
// top, or within ~10% of it). When that reaches the threshold a minicut (a short
// deficit to shed fatigue) is worth suggesting. Pure; caller passes volumeStatus
// objects ({ key, pct }).
Engine.fatigueSaturated = function (statuses, threshold = 3) {
  const over = (statuses || []).filter(s => s && (s.key === 'over' || s.pct >= 90)).length;
  return { over, saturated: over >= threshold, threshold };
};

// [Cluster D] Overreach detection (sharper than fatigueSaturated, which counts
// near-MRV for the minicut nudge): how many muscles are STRICTLY over their MRV,
// i.e. past recoverable volume. Overreaching when two-plus muscles are over, or
// one is over while recovery is sliding. Pure; drives the volume-screen warning
// and the per-muscle deload suggestion, distinct from sizing the block deload.
Engine.overreaching = function (statuses, trendDown) {
  const over = (statuses || []).filter(s => s && s.key === 'over').length;
  const overreaching = over >= 2 || (over >= 1 && !!trendDown);
  return {
    over, overreaching,
    reason: overreaching
      ? `${over} muscle${over === 1 ? '' : 's'} over MRV${trendDown ? ' and recovery is sliding' : ''}`
      : '',
  };
};

// [Cluster D] Autoregulated deload depth. Sizes the deload to accumulated
// fatigue: a fried athlete (many muscles at/near MRV, or readiness trending down)
// deloads DEEPER (one fewer set on top of the scheme's already-halved deload); a
// fresh athlete takes a LIGHTER deload (one more set) so they shed fatigue
// without losing momentum. `setDelta` composes with the existing deload
// prescription, so 0 = today's behavior. Pure; caller passes volumeStatus objects
// and a readiness-trend flag. Bodybuilding-surfaced and inert (delta 0) without
// enough fatigue signal, so the default routine is unchanged.
Engine.deloadDepth = function (statuses, trendDown) {
  const sat = Engine.fatigueSaturated(statuses);
  if (sat.saturated || (sat.over >= 2 && trendDown)) {
    // A deeper deload pulls back BOTH volume (a set) and intensity (one more rep
    // in reserve), so a fried athlete sheds fatigue on two axes, not just one.
    return { level: 'deep', setDelta: -1, rpeDelta: -1, over: sat.over,
      reason: `High fatigue this block (${sat.over} muscles near MRV), taking a deeper deload` };
  }
  // "Light" needs positive evidence of low fatigue (trained muscles, none near
  // MRV), not just an absence of data; no statuses falls through to standard.
  if (statuses && statuses.length && sat.over === 0 && !trendDown) {
    return { level: 'light', setDelta: 1, rpeDelta: 0, over: 0,
      reason: 'Low fatigue this block, a lighter deload to keep momentum' };
  }
  return { level: 'standard', setDelta: 0, rpeDelta: 0, over: sat.over, reason: 'Standard deload' };
};

// [Cluster D] Early-deload TIMING trigger. Mid-block, decide whether accumulated
// fatigue warrants pulling the deload in BEFORE the scheduled week-5 deload. Same
// fatigue read as the deload DEPTH sizing (fatigueSaturated + readiness trend):
// advise when the athlete is truly saturated, or several muscles sit near MRV
// while readiness is sliding. Pure; the caller gates eligibility to mid-block work
// weeks and the bodybuilding track, so other tracks and the default never trigger.
Engine.earlyDeloadAdvised = function (statuses, trendDown) {
  const sat = Engine.fatigueSaturated(statuses);
  const advised = sat.saturated || (sat.over >= 2 && !!trendDown);
  return {
    advised, over: sat.over,
    reason: advised
      ? `${sat.over} muscles are at or near MRV${trendDown ? ' and readiness is sliding' : ''}`
      : '',
  };
};
