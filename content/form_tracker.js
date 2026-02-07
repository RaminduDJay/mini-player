'use strict';

/* global MiniPlayerStorage, MiniPlayerURL, MiniPlayerDOM */

(() => {
  const MP = globalThis.__MiniPlayer || (globalThis.__MiniPlayer = {});
  const EVENT_BEFORE = globalThis.__MiniPlayerSpaEvents?.EVENT_BEFORE;
  const EVENT_AFTER = globalThis.__MiniPlayerSpaEvents?.EVENT_AFTER;

  const SENSITIVE_NAME_RE = /(password|pass|card|cvc|cvv|otp)/i;
  const SENSITIVE_AUTOCOMPLETE_RE = /(cc-|cc_)/i;

  let currentKey = '';
  let debounceTimer = null;
  let settingsCache = null;

  function normalizeKey(url) {
    return MiniPlayerURL.normalizeUrl(url);
  }

  function isSensitive(el) {
    const type = (el.type || '').toLowerCase();
    if (type === 'password' || type === 'file') return true;
    const id = el.id || '';
    const name = el.name || '';
    const autocomplete = el.getAttribute('autocomplete') || '';
    if (SENSITIVE_NAME_RE.test(id) || SENSITIVE_NAME_RE.test(name)) return true;
    if (SENSITIVE_AUTOCOMPLETE_RE.test(autocomplete)) return true;
    if (autocomplete.toLowerCase().includes('cc-')) return true;
    return false;
  }

  function isSavableField(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (isSensitive(el)) return false;
      return true;
    }
    return false;
  }

  function serializeField(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();
    const key = MiniPlayerDOM.fieldKey(el);

    const data = {
      tag,
      type,
      key,
      id: el.id || '',
      name: el.name || '',
      selector: MiniPlayerDOM.cssPath(el),
      value: null,
      checked: null,
      selectedOptions: null
    };

    if (tag === 'input') {
      if (type === 'checkbox' || type === 'radio') {
        data.checked = !!el.checked;
      } else {
        data.value = el.value;
      }
    } else if (tag === 'textarea') {
      data.value = el.value;
    } else if (tag === 'select') {
      if (el.multiple) {
        data.selectedOptions = Array.from(el.selectedOptions).map((o) => o.value);
      } else {
        data.value = el.value;
      }
    }

    return data;
  }

  function findField(entry) {
    if (entry.id) {
      const byId = document.getElementById(entry.id);
      if (byId) return byId;
    }

    if (entry.name) {
      const list = document.getElementsByName(entry.name);
      if (list && list.length) {
        for (const el of Array.from(list)) {
          if (entry.type && el.type && el.type.toLowerCase() === entry.type) return el;
        }
        return list[0];
      }
    }

    if (entry.selector) {
      try {
        const el = document.querySelector(entry.selector);
        if (el) return el;
      } catch {
        // ignore bad selector
      }
    }

    return null;
  }

  async function getSettings() {
    if (settingsCache) return settingsCache;
    const data = await MiniPlayerStorage.get('settings');
    settingsCache = data.settings || {};
    return settingsCache;
  }

  async function isEnabledForSite() {
    const settings = await getSettings();
    if (settings.enabled === false) return false;
    const site = location.origin;
    if (Array.isArray(settings.siteDisabled) && settings.siteDisabled.includes(site)) return false;
    if (Array.isArray(settings.blocklist) && settings.blocklist.includes(site)) return false;
    if (Array.isArray(settings.allowlist) && settings.allowlist.length > 0) {
      return settings.allowlist.includes(site);
    }
    return true;
  }

  async function saveFormState() {
    if (!(await isEnabledForSite())) return;

    const fields = Array.from(document.querySelectorAll('input, textarea, select'))
      .filter(isSavableField)
      .map(serializeField);

    const payload = {
      url: location.href,
      ts: Date.now(),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      fields
    };

    const key = `forms:${currentKey}`;
    await MiniPlayerStorage.set({ [key]: payload });
  }

  async function restoreFormState() {
    if (!(await isEnabledForSite())) return;

    const key = `forms:${currentKey}`;
    const data = await MiniPlayerStorage.get(key);
    const payload = data[key];
    if (!payload || !payload.fields) return;

    for (const entry of payload.fields) {
      const el = findField(entry);
      if (!el || !isSavableField(el)) continue;

      const tag = (el.tagName || '').toLowerCase();
      const type = (el.type || '').toLowerCase();

      if (tag === 'input') {
        if (type === 'checkbox' || type === 'radio') {
          el.checked = !!entry.checked;
        } else if (typeof entry.value === 'string') {
          el.value = entry.value;
        }
      } else if (tag === 'textarea') {
        if (typeof entry.value === 'string') el.value = entry.value;
      } else if (tag === 'select') {
        if (el.multiple && Array.isArray(entry.selectedOptions)) {
          for (const opt of Array.from(el.options)) {
            opt.selected = entry.selectedOptions.includes(opt.value);
          }
        } else if (typeof entry.value === 'string') {
          el.value = entry.value;
        }
      }
    }

    if (typeof payload.scrollX === 'number' && typeof payload.scrollY === 'number') {
      setTimeout(() => {
        window.scrollTo(payload.scrollX, payload.scrollY);
      }, 50);
    }
  }

  function scheduleSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveFormState, 400);
  }

  function init() {
    currentKey = normalizeKey(location.href);

    document.addEventListener(
      'input',
      (e) => {
        if (isSavableField(e.target)) scheduleSave();
      },
      true
    );

    document.addEventListener(
      'change',
      (e) => {
        if (isSavableField(e.target)) scheduleSave();
      },
      true
    );

    window.addEventListener(EVENT_BEFORE, () => {
      saveFormState();
    });

    window.addEventListener(EVENT_AFTER, () => {
      currentKey = normalizeKey(location.href);
      setTimeout(restoreFormState, 50);
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', restoreFormState);
    } else {
      restoreFormState();
    }
  }

  init();
})();
