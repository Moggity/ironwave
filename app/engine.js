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

  // ---------- week typing ----------
  weekType(weekIdx) {
    return ['intro', 'accumulation', 'intensification', 'realization', 'deload'][weekIdx] || 'accumulation';
  },
  weekTypeLabel(weekIdx) {
    return ['Week 1 · Calibration', 'Week 2 · Accumulation', 'Week 3 · Intensification',
            'Week 4 · Realization', 'Week 5 · Deload'][weekIdx] || '';
  },

  // ---------- MAIN LIFT PRESCRIPTION (the Juggernaut tables) ----------
  // Returns array of set objects: {weight?, reps, rpe?, amrap?, note?}
  prescribeMain(wave, weekIdx, workingMax, rounding, pctMod = 1) {
    const W = WAVES[wave];
    const wm = workingMax * pctMod;
    const R = (p) => this.roundLoad(wm * p, rounding);
    const type = this.weekType(weekIdx);
    const sets = [];

    if (!workingMax) {
      // No working max yet → calibration ramp (3 ascending sets, eyeball + RPE)
      return [
        { reps: W.acc.reps, rpe: 6, calib: true, note: 'Calibration · build up' },
        { reps: W.acc.reps, rpe: 7, calib: true, note: 'Calibration' },
        { reps: W.acc.reps, rpe: 8, calib: true, note: 'Calibration · top set' },
      ];
    }

    if (type === 'intro') {
      // Week 1: accumulation volume, RPE-led but with a bold suggested weight
      const w = this.roundLoad(wm * (W.acc.pct - 0.025), rounding);
      for (let i = 0; i < W.acc.sets; i++) {
        sets.push({ weight: w, reps: W.acc.reps, rpe: 7,
          note: i === W.acc.sets - 1 ? 'Leave 2–3 reps in the tank' : null });
      }
    } else if (type === 'accumulation') {
      for (let i = 0; i < W.acc.sets; i++) {
        sets.push({ weight: R(W.acc.pct), reps: W.acc.reps,
          rpe: i === W.acc.sets - 1 ? 8 : 7,
          note: i === W.acc.sets - 1 ? 'Last set: 2–3 reps shy of failure' : null });
      }
    } else if (type === 'intensification') {
      W.int.ramp.forEach(([p, r]) => sets.push({ weight: R(p), reps: r, ramp: true }));
      for (let i = 0; i < W.int.work.sets; i++) {
        sets.push({ weight: R(W.int.work.pct), reps: W.int.work.reps,
          rpe: i === W.int.work.sets - 1 ? 9 : 8,
          note: i === W.int.work.sets - 1 ? 'Last set: 1–2 reps shy of failure' : null });
      }
    } else if (type === 'realization') {
      W.real.ramp.forEach(([p, r]) => sets.push({ weight: R(p), reps: r, ramp: true }));
      sets.push({ weight: R(W.real.amrap.pct), reps: W.standard, rpe: 10, amrap: true,
        note: `AMRAP. Standard is ${W.standard}, and every rep over moves your working max up.` });
    } else if (type === 'deload') {
      DELOAD_SETS.forEach(([p, r]) => sets.push({ weight: R(p), reps: r, note: 'Deload, move well and recover' }));
    }
    return sets;
  },

  // Secondary main-lift volume work (Inverted Juggernaut style)
  prescribeSecondary(blockType, weekIdx, workingMax, rounding, pctMod = 1) {
    const type = this.weekType(weekIdx);
    const S = SECONDARY_SCHEMES[blockType] || SECONDARY_SCHEMES.hypertrophy;
    if (!workingMax) {
      return [{ reps: S.reps, rpe: 6, calib: true }, { reps: S.reps, rpe: 7, calib: true }, { reps: S.reps, rpe: 8, calib: true }];
    }
    const wm = workingMax * pctMod;
    if (type === 'deload') {
      return [[0.40, 5], [0.50, 5]].map(([p, r]) =>
        ({ weight: this.roundLoad(wm * p, rounding), reps: r, note: 'Deload' }));
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
  prescribeAccessory(blockType, weekIdx, records, rounding) {
    const type = this.weekType(weekIdx);
    const S = ACC_SCHEMES[blockType] || ACC_SCHEMES.hypertrophy;
    const e1 = this.bestE1RM(records);
    const sets = [];
    const deload = type === 'deload';
    const nSets = deload ? Math.max(2, Math.floor(S.sets / 2)) : S.sets;
    const rpe = deload ? 6 : S.rpe;

    if (!e1) {
      return [
        { reps: S.reps + 2, rpe: 5, calib: true, note: 'Calibration · light' },
        { reps: S.reps, rpe: 7, calib: true, note: 'Calibration · medium' },
        { reps: S.reps, rpe: 8, calib: true, note: 'Calibration · top set' },
      ];
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
      if (s.done && s.weight > 0 && s.reps > 0) t += s.weight * s.reps;
      // A logged drop set adds the volume of each mini-set it carried.
      if (s.done && Array.isArray(s.drops)) {
        for (const d of s.drops) if (d.weight > 0 && d.reps > 0) t += d.weight * d.reps;
      }
    }
    return Math.round(t);
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

  // Time cost of one prescribed set, technique-aware (Cluster B). A plain set is
  // exec(reps) + one rest; a drop set adds each mini-set's exec plus a short
  // transition per drop, but still only one full rest at the end. `restSec` is
  // the already-resolved rest for this set kind (normal or compressed).
  setTimeSec(st, TM, kind, restSec) {
    let t = (st.reps || 0) * TM.execSecPerRep[kind] + restSec;
    if (Array.isArray(st.drops)) {
      for (const d of st.drops) t += (d.reps || 0) * TM.execSecPerRep[kind] + TM.dropTransitionSec;
    }
    return t;
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
  // Total volume load (sum of weight * reps) each day.
  volumeLoadTrend(records, days = 120) {
    return this._recordsByDay(records, days).map(g =>
      ({ ts: g.ts, value: g.recs.reduce((a, r) => a + r.weight * r.reps, 0) }));
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
    main(block, w, wm, rounding, pctMod = 1) {
      return Engine.prescribeMain(block.wave, w, wm, rounding, pctMod);
    },
    secondary(block, w, wm, rounding, pctMod = 1) {
      return Engine.prescribeSecondary(block.type, w, wm, rounding, pctMod);
    },
    accessory(block, w, records, rounding) {
      return Engine.prescribeAccessory(block.type, w, records, rounding);
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
    main(block, w, wm, rounding, pctMod = 1) {
      const W = WAVES[block.wave];
      if (!wm) return Engine.prescribeMain(block.wave, w, null, rounding, pctMod); // calibration ramp
      const t = Engine.weekType(w);
      const wmE = wm * pctMod;
      const R = p => Engine.roundLoad(wmE * p, rounding);
      if (t === 'deload') {
        return DELOAD_SETS.map(([p, r]) => ({ weight: R(p), reps: r, note: 'Deload, move well and recover' }));
      }
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const nSets = JBB_HYP.mainSets[m][idx];
      const sets = [];
      for (let i = 0; i < nSets; i++) {
        sets.push({ weight: R(W.acc.pct + JBB_HYP.dPct[idx]), reps: W.standard, rpe: JBB_HYP.rpe[idx],
          note: i === nSets - 1 && idx < 3 ? `Meso ${m + 1} \u00b7 volume week ${idx + 1} of 4, sets climb next week` : null });
      }
      if (idx === 3) {
        sets.push({ weight: R(W.real.amrap.pct), reps: W.standard, rpe: 10, amrap: true,
          note: `AMRAP. Standard is ${W.standard}, and every rep over moves your working max up.` });
      }
      return sets;
    },
    secondary(block, w, wm, rounding, pctMod = 1) {
      if (!wm) return Engine.prescribeSecondary(block.type, w, null, rounding, pctMod);
      const t = Engine.weekType(w);
      const wmE = wm * pctMod;
      if (t === 'deload') {
        const w0 = Engine.roundLoad(wmE * JBB_HYP.deload.secPct, rounding);
        return Array.from({ length: JBB_HYP.deload.secSets }, () => ({ weight: w0, reps: JBB_HYP.secReps, note: 'Deload' }));
      }
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const wt = Engine.roundLoad(wmE * (JBB_HYP.secPct + JBB_HYP.secStep * idx), rounding);
      return Array.from({ length: JBB_HYP.secSets[m][idx] }, () => ({ weight: wt, reps: JBB_HYP.secReps, rpe: 7 }));
    },
    accessory(block, w, records, rounding) {
      const e1 = Engine.bestE1RM(records);
      if (!e1) return Engine.prescribeAccessory(block.type, w, records, rounding); // calibration ramp
      const t = Engine.weekType(w);
      if (t === 'deload') {
        const wt = Engine.weightFor(e1, JBB_HYP.accReps, JBB_HYP.deload.accRpe, rounding);
        return Array.from({ length: JBB_HYP.deload.accSets },
          () => ({ weight: wt, reps: JBB_HYP.accReps, rpe: JBB_HYP.deload.accRpe, note: 'Deload, half volume' }));
      }
      const m = this._meso(block);
      const idx = Math.min(w, 3);
      const rpe = JBB_HYP.accRpe[idx];
      const wt = Engine.weightFor(e1, JBB_HYP.accReps, Math.min(rpe, 9), rounding);
      const last = m === JBB_HYP.accSets.length - 1 && idx === 3;
      return Array.from({ length: JBB_HYP.accSets[m][idx] }, (_, i) => ({
        weight: wt, reps: JBB_HYP.accReps, rpe,
        note: i === 0 ? (last ? 'Hardest week of the macrocycle, deload is next' :
                         idx === 3 ? 'Peak volume week, deload is next' : null) : null }));
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
