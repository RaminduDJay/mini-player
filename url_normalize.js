'use strict';

(() => {
  const MP = globalThis.__MiniPlayer || (globalThis.__MiniPlayer = {});
  const STRIP_PARAMS = [
    'gclid',
    'fbclid',
    'mc_cid',
    'mc_eid',
    'ref',
    'ref_src'
  ];

  function normalizeUrl(input) {
    try {
      const url = new URL(input);
      const params = new URLSearchParams(url.search);

      for (const key of Array.from(params.keys())) {
        if (key.toLowerCase().startsWith('utm_')) {
          params.delete(key);
        }
      }

      for (const key of STRIP_PARAMS) {
        params.delete(key);
      }

      const entries = Array.from(params.entries()).sort((a, b) => {
        return a[0].localeCompare(b[0]);
      });

      const cleanParams = new URLSearchParams(entries);
      const search = cleanParams.toString();
      const hash = url.hash || '';

      return `${url.origin}${url.pathname}${search ? `?${search}` : ''}${hash}`;
    } catch {
      return input || '';
    }
  }

  MP.MiniPlayerURL = { normalizeUrl };
  globalThis.MiniPlayerURL = MP.MiniPlayerURL;
})();
