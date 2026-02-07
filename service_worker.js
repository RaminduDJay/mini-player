'use strict';

/* global MiniPlayerStorage, MiniPlayerURL */

importScripts('storage.js', 'url_normalize.js');

const DEFAULT_SETTINGS = {
  enabled: true,
  privacyMode: false,
  overlaySize: 'medium',
  allowlist: [],
  blocklist: [],
  siteDisabled: []
};

const SNAPSHOT_MAX = 3;

function normalizeSite(url) {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return '';
  }
}

function isAllowedBySettings(url, settings) {
  if (!settings.enabled) return false;
  const site = normalizeSite(url);
  if (!site) return false;
  if (settings.siteDisabled.includes(site)) return false;
  if (settings.blocklist.includes(site)) return false;
  if (settings.allowlist.length > 0 && !settings.allowlist.includes(site)) return false;
  return true;
}

async function getSettings() {
  const data = await MiniPlayerStorage.get('settings');
  return Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
}

async function setSettings(next) {
  const current = await getSettings();
  const merged = Object.assign({}, current, next);
  await MiniPlayerStorage.set({ settings: merged });
  return merged;
}

async function storeSnapshot(tabId, snapshot) {
  const key = `snapshots:${tabId}`;
  const data = await MiniPlayerStorage.getSession(key);
  const list = Array.isArray(data[key]) ? data[key] : [];
  list.unshift(snapshot);
  const pruned = list.slice(0, SNAPSHOT_MAX);
  await MiniPlayerStorage.setSession({ [key]: pruned });
}

async function getSnapshotForTab(tabId, currentUrl) {
  const key = `snapshots:${tabId}`;
  const data = await MiniPlayerStorage.getSession(key);
  const list = Array.isArray(data[key]) ? data[key] : [];
  if (!list.length) return null;

  for (const snap of list) {
    if (!currentUrl || snap.url !== currentUrl) {
      return snap;
    }
  }
  return list[0] || null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender?.tab?.id;
  const windowId = sender?.tab?.windowId;

  if (message?.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message?.type === 'UPDATE_SETTINGS') {
    setSettings(message.payload || {}).then(sendResponse);
    return true;
  }

  if (message?.type === 'CAPTURE_PREVIOUS_PAGE') {
    (async () => {
      if (!tabId || windowId == null) {
        sendResponse({ ok: false, error: 'No tab context' });
        return;
      }

      const settings = await getSettings();
      if (!isAllowedBySettings(message.url, settings)) {
        sendResponse({ ok: false, error: 'Blocked by settings' });
        return;
      }

      const snapshot = {
        url: message.url || '',
        title: message.title || '',
        ts: Date.now(),
        dataUrl: null,
        error: null
      };

      if (settings.privacyMode) {
        snapshot.error = 'Privacy mode enabled';
        await storeSnapshot(tabId, snapshot);
        sendResponse({ ok: true, privacyMode: true });
        return;
      }

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: 'jpeg',
          quality: 70
        });
        snapshot.dataUrl = dataUrl;
      } catch (err) {
        snapshot.error = String(err && err.message ? err.message : err);
      }

      await storeSnapshot(tabId, snapshot);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === 'REQUEST_OVERLAY') {
    (async () => {
      if (!tabId) {
        sendResponse({ ok: false, error: 'No tab context' });
        return;
      }
      const snap = await getSnapshotForTab(tabId, message.currentUrl || '');
      if (!snap) {
        sendResponse({ ok: false, error: 'No snapshot' });
        return;
      }
      sendResponse({ ok: true, snapshot: snap });
    })();
    return true;
  }

  if (message?.type === 'CLEAR_SNAPSHOTS') {
    (async () => {
      if (!tabId) {
        sendResponse({ ok: false, error: 'No tab context' });
        return;
      }
      await MiniPlayerStorage.setSession({ [`snapshots:${tabId}`]: [] });
      sendResponse({ ok: true });
    })();
    return true;
  }
});
