'use strict';

const DEFAULT_SETTINGS = {
  enabled: true,
  privacyMode: false,
  overlaySize: 'medium',
  allowlist: [],
  blocklist: [],
  siteDisabled: []
};

function parseList(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatList(list) {
  return (list || []).join('\n');
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});

  document.getElementById('enabled').checked = !!settings.enabled;
  document.getElementById('privacyMode').checked = !!settings.privacyMode;

  const sizeInput = document.querySelector(`input[name="size"][value="${settings.overlaySize}"]`);
  if (sizeInput) sizeInput.checked = true;

  document.getElementById('allowlist').value = formatList(settings.allowlist);
  document.getElementById('blocklist').value = formatList(settings.blocklist);

  const tab = await getActiveTab();
  const origin = getOrigin(tab?.url || '');
  const disableSite = origin && settings.siteDisabled.includes(origin);
  document.getElementById('disableSite').checked = !!disableSite;
}

async function saveSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});

  settings.enabled = document.getElementById('enabled').checked;
  settings.privacyMode = document.getElementById('privacyMode').checked;

  const size = document.querySelector('input[name="size"]:checked');
  settings.overlaySize = size ? size.value : 'medium';

  settings.allowlist = parseList(document.getElementById('allowlist').value);
  settings.blocklist = parseList(document.getElementById('blocklist').value);

  const tab = await getActiveTab();
  const origin = getOrigin(tab?.url || '');
  if (origin) {
    const disabled = document.getElementById('disableSite').checked;
    const list = new Set(settings.siteDisabled || []);
    if (disabled) list.add(origin);
    else list.delete(origin);
    settings.siteDisabled = Array.from(list);
  }

  await chrome.storage.local.set({ settings });
  const status = document.getElementById('status');
  status.textContent = 'Saved.';
  setTimeout(() => (status.textContent = ''), 1200);
}

document.getElementById('save').addEventListener('click', saveSettings);
loadSettings();
