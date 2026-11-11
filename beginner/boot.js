/* Starts the beginner app. The function is global so tests can call it; it runs by itself
   only when the browser loads this file through a real script tag. */
function beginnerBoot(env) {
  const e = env || {};
  const nav = e.navigator || (typeof navigator !== 'undefined' ? navigator : {});
  const ui = Object.assign({}, e.ui || {});
  const first = UI.boot(ui);
  const after = () => {
    try {
      if (!e.isNative && nav && 'serviceWorker' in nav) {
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
