/* Starts the beginner app. The function is global so tests can call it; it runs by itself
   only when the browser loads this file through a real script tag. */
function beginnerBoot(env) {
  const e = env || {};
  const nav = e.navigator || (typeof navigator !== 'undefined' ? navigator : {});
  const ui = Object.assign({}, e.ui || {});
  const win = e.window || (typeof window !== 'undefined' ? window : undefined);
  const native = typeof e.isNative === 'boolean' ? e.isNative : BeginnerPlatform.isNative(win);
  // The native platform sits under whatever the caller passed in ui.platform, which wins.
  const platform = Object.assign({}, BeginnerPlatform.create(native ? win : undefined), ui.platform || {});
  ui.platform = platform;
  const first = UI.boot(ui);
  const after = () => {
    try {
      if (native) {
        const p = platform.onBack(() => { if (!UI.back()) platform.exit(); });
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (err) { /* the system back button keeps its default */ }
    try {
      if (!native && nav && 'serviceWorker' in nav) {
        const p = nav.serviceWorker.register('sw.js', { scope: './' });
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (err) { /* the app works without a worker */ }
    try {
      if (nav && nav.storage && typeof nav.storage.persist === 'function') {
        const p = nav.storage.persist();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (err) { /* best effort */ }
  };
  return Promise.resolve(first).then(after, err => { after(); throw err; });
}

if (typeof document !== 'undefined' && document.currentScript) beginnerBoot({});
