'use strict';

(() => {
  const EVENT_BEFORE = '__mini_player_spa_before';
  const EVENT_AFTER = '__mini_player_spa_after';

  function dispatch(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function wrapHistory(fnName) {
    const original = history[fnName];
    history[fnName] = function (...args) {
      const oldUrl = location.href;
      dispatch(EVENT_BEFORE, { oldUrl, newUrl: args[2] || oldUrl, type: fnName });
      const ret = original.apply(this, args);
      const newUrl = location.href;
      dispatch(EVENT_AFTER, { oldUrl, newUrl, type: fnName });
      return ret;
    };
  }

  wrapHistory('pushState');
  wrapHistory('replaceState');

  window.addEventListener('popstate', () => {
    const newUrl = location.href;
    dispatch(EVENT_AFTER, { oldUrl: '', newUrl, type: 'popstate' });
  });

  globalThis.__MiniPlayerSpaEvents = { EVENT_BEFORE, EVENT_AFTER };
})();
