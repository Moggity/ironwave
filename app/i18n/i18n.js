/* ============================================================
   IRONWAVE — i18n/i18n.js
   Tiny translation runtime, no dependency and no build step.
   Loads FIRST (before the catalogs and the three app scripts) so
   every later script can call t().

   - Catalogs register themselves via I18N.register (see en.js).
   - t(key, params) looks up: active language -> English -> the key
     itself, so a missing translation degrades to readable English
     and a missing key is visible in dev.
   - {name}-style placeholders are interpolated from params.
   - Plurals stay deliberately simple: explicit `_one` / `_other`
     key pairs chosen by the caller's count (no ICU engine; our
     strings are short and imperative).
   ============================================================ */

'use strict';

const I18N = {
  catalogs: {},   // code -> { code, name, strings }
  lang: 'en',     // active resolved language code
  pref: 'auto',   // the athlete's stored choice ('auto' or a code)

  register(code, name, strings) {
    this.catalogs[code] = { code, name, strings };
  },

  // Resolve a stored preference to a shipped catalog code. 'auto' (or an
  // unknown code) derives from the device language, falling back to English.
  resolve(pref, navLang) {
    if (pref && pref !== 'auto' && this.catalogs[pref]) return pref;
    const nav = String(navLang || (typeof navigator !== 'undefined' && navigator.language) || 'en');
    const short = nav.toLowerCase().split('-')[0];
    return this.catalogs[short] ? short : 'en';
  },

  setLang(pref, navLang) {
    this.pref = pref || 'auto';
    this.lang = this.resolve(pref, navLang);
    return this.lang;
  },

  // Locale for toLocaleDateString and friends: an explicitly chosen language
  // drives date formatting too; on 'auto' the device keeps deciding.
  dateLocale() {
    return this.pref && this.pref !== 'auto' ? this.lang : undefined;
  },
};

function t(key, params) {
  const active = I18N.catalogs[I18N.lang];
  const en = I18N.catalogs.en;
  let s = active && active.strings[key];
  if (s == null && en) s = en.strings[key];
  if (s == null) s = key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : String(params[k])));
  return s;
}
