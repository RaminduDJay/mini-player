'use strict';

(() => {
  const MP = globalThis.__MiniPlayer || (globalThis.__MiniPlayer = {});
  const HAS_SESSION = !!(chrome.storage && chrome.storage.session);

  function storageGet(area, key) {
    return new Promise((resolve) => {
      area.get(key, (items) => resolve(items || {}));
    });
  }

  function storageSet(area, items) {
    return new Promise((resolve) => {
      area.set(items, () => resolve());
    });
  }

  function storageRemove(area, key) {
    return new Promise((resolve) => {
      area.remove(key, () => resolve());
    });
  }

  async function get(key) {
    return storageGet(chrome.storage.local, key);
  }

  async function set(items) {
    return storageSet(chrome.storage.local, items);
  }

  async function remove(key) {
    return storageRemove(chrome.storage.local, key);
  }

  async function getSession(key) {
    if (!HAS_SESSION) return get(key);
    return storageGet(chrome.storage.session, key);
  }

  async function setSession(items) {
    if (!HAS_SESSION) return set(items);
    return storageSet(chrome.storage.session, items);
  }

  async function removeSession(key) {
    if (!HAS_SESSION) return remove(key);
    return storageRemove(chrome.storage.session, key);
  }

  async function setWithTTL(key, value, ttlMs) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : 0;
    await set({ [key]: { value, expiresAt } });
  }

  async function getWithTTL(key) {
    const data = await get(key);
    const entry = data[key];
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await remove(key);
      return null;
    }
    return entry.value;
  }

  MP.MiniPlayerStorage = {
    get,
    set,
    remove,
    getSession,
    setSession,
    removeSession,
    setWithTTL,
    getWithTTL
  };

  globalThis.MiniPlayerStorage = MP.MiniPlayerStorage;
})();
