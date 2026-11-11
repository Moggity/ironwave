// Device features for the Android shell (Capacitor). Pure: it only touches the window object it
// is handed, never the DOM. On the web create() returns only no-op hooks, so the browser
// defaults in ui.js stay in charge. Plugins are read from Capacitor.Plugins (the native bridge
// fills it with every installed plugin, no bundler needed), with registerPlugin as a fallback.
// Every native call is wrapped: a missing plugin or a failed call never throws and never
// leaves an unhandled rejection.
const BeginnerPlatform = (function () {
  'use strict';

  function isNative(win) {
    try {
      const cap = win && win.Capacitor;
      return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() === true;
    } catch (e) { return false; }
  }

  function create(win) {
    const noop = () => Promise.resolve();
    const web = { scheduleRestEnd: noop, cancelRestEnd: noop, onBack: noop, exit: noop };
    if (!isNative(win)) return web;

    const found = {};
    function plugin(name) {
      if (found[name]) return found[name];
      try {
        const cap = win.Capacitor;
        let p = cap.Plugins && cap.Plugins[name];
        if (!p && typeof cap.registerPlugin === 'function') p = cap.registerPlugin(name);
        if (p) found[name] = p;
        return p || null;
      } catch (e) { return null; }
    }
    // Resolves to the plugin's answer, or to undefined when anything goes wrong.
    function call(name, method, ...args) {
      try {
        const p = plugin(name);
        if (!p || typeof p[method] !== 'function') return Promise.resolve(undefined);
        return Promise.resolve(p[method](...args)).catch(() => undefined);
      } catch (e) { return Promise.resolve(undefined); }
    }
    const has = (name, method) => { const p = plugin(name); return !!p && typeof p[method] === 'function'; };

    const C = () => BEGINNER_CONFIG.platform;
    // Signal operations run one after the other so a cancel never overtakes a schedule.
    let queue = Promise.resolve();
    const enqueue = fn => { queue = queue.then(fn).catch(() => undefined); return queue; };

    // Permission and channel work happen at the first rest signal, never earlier.
    let ready = null;
    function prepare() {
      if (!ready) {
        ready = (async () => {
          let perm = await call('LocalNotifications', 'checkPermissions');
          if (!perm || perm.display !== 'granted') perm = await call('LocalNotifications', 'requestPermissions');
          if (!perm || perm.display !== 'granted') return false;
          await call('LocalNotifications', 'createChannel', {
            id: C().restChannelId, name: BEGINNER_STRINGS.rest.channelName, importance: C().restChannelImportance, vibration: true,
          });
          return true;
        })();
      }
      return ready;
    }

    return Object.assign(web, {
      vibrate: ms => call('Haptics', 'vibrate', { duration: ms }),
      saveFile: async (name, text) => {
        const r = await call('Filesystem', 'writeFile', { path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
        if (!r || !r.uri) return;
        await call('Share', 'share', { files: [r.uri] });
      },
      scheduleRestEnd: atMs => enqueue(async () => {
        if (!(await prepare())) return;
        await call('LocalNotifications', 'schedule', {
          notifications: [{
            id: C().restNotificationId,
            title: BEGINNER_STRINGS.rest.notifyTitle,
            body: BEGINNER_STRINGS.rest.notifyBody,
            channelId: C().restChannelId,
            schedule: { at: new Date(atMs), allowWhileIdle: true },
          }],
        });
      }),
      cancelRestEnd: () => enqueue(() => call('LocalNotifications', 'cancel', { notifications: [{ id: C().restNotificationId }] })),
      onBack: handler => call('App', 'addListener', 'backButton', () => {
        try {
          const r = handler();
          if (r && typeof r.catch === 'function') r.catch(() => {});
        } catch (e) { /* the press is lost, the app stays open */ }
      }),
      exit: () => call('App', has('App', 'minimizeApp') ? 'minimizeApp' : 'exitApp'),
    });
  }

  return { isNative, create };
})();
