'use strict';

/* global MiniPlayerStorage */

(() => {
  const MP = globalThis.__MiniPlayer || (globalThis.__MiniPlayer = {});
  const EVENT_BEFORE = globalThis.__MiniPlayerSpaEvents?.EVENT_BEFORE;
  const EVENT_AFTER = globalThis.__MiniPlayerSpaEvents?.EVENT_AFTER;

  const HOST_ID = '__mini_player_overlay_host';
  const DEFAULT_SIZES = {
    small: { width: 220, height: 140 },
    medium: { width: 320, height: 200 },
    large: { width: 420, height: 280 }
  };

  let settingsCache = null;
  let isPinned = false;

  async function getSettings() {
    if (settingsCache) return settingsCache;
    const data = await MiniPlayerStorage.get('settings');
    settingsCache = data.settings || {};
    return settingsCache;
  }

  async function isEnabledForSite() {
    const settings = await getSettings();
    if (settings.enabled === false) return false;
    if (settings.privacyMode) return true;
    const site = location.origin;
    if (Array.isArray(settings.siteDisabled) && settings.siteDisabled.includes(site)) return false;
    if (Array.isArray(settings.blocklist) && settings.blocklist.includes(site)) return false;
    if (Array.isArray(settings.allowlist) && settings.allowlist.length > 0) {
      return settings.allowlist.includes(site);
    }
    return true;
  }

  function buildOverlay() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;

    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-label', 'Previous page preview');
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.inset = 'auto';
    host.style.right = '16px';
    host.style.bottom = '16px';
    host.style.pointerEvents = 'none';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .overlay {
          pointer-events: auto;
          width: 320px;
          height: 200px;
          background: #111;
          color: #fff;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font: 12px/1.4 "SF Mono", "Fira Code", monospace;
        }
        .bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          background: #1d1d1d;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          cursor: move;
          user-select: none;
        }
        .title {
          flex: 1;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .btn {
          border: 0;
          background: #2b2b2b;
          color: #fff;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
          font: inherit;
        }
        .btn:focus {
          outline: 2px solid #fff;
        }
        .body {
          position: relative;
          flex: 1;
          background: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        img.preview {
          max-width: 100%;
          max-height: 100%;
          display: block;
        }
        .empty {
          color: #ccc;
          font-size: 12px;
          padding: 10px;
          text-align: center;
        }
        .resize {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 18px;
          height: 18px;
          cursor: se-resize;
          background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.35) 50%);
        }
      </style>
      <div class="overlay" tabindex="0">
        <div class="bar">
          <div class="title" title="Previous page">Previous page</div>
          <button class="btn back" type="button">Back</button>
          <button class="btn pin" type="button">Pin</button>
          <button class="btn close" type="button" aria-label="Close">x</button>
        </div>
        <div class="body">
          <div class="empty">Loading preview...</div>
          <div class="resize" aria-hidden="true"></div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(host);
    return host;
  }

  function applySize(host, sizeName) {
    const size = DEFAULT_SIZES[sizeName] || DEFAULT_SIZES.medium;
    const overlay = host.shadowRoot.querySelector('.overlay');
    overlay.style.width = `${size.width}px`;
    overlay.style.height = `${size.height}px`;
  }

  function setPreview(host, snapshot) {
    const body = host.shadowRoot.querySelector('.body');
    body.innerHTML = '<div class="resize" aria-hidden="true"></div>';

    if (!snapshot || snapshot.error || !snapshot.dataUrl) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = snapshot?.error
        ? `Preview unavailable (${snapshot.error})`
        : 'Preview unavailable';
      body.appendChild(empty);
      return;
    }

    const img = document.createElement('img');
    img.className = 'preview';
    img.alt = 'Previous page preview';
    img.src = snapshot.dataUrl;
    body.appendChild(img);
  }

  function setupInteractions(host) {
    const overlay = host.shadowRoot.querySelector('.overlay');
    const bar = host.shadowRoot.querySelector('.bar');
    const closeBtn = host.shadowRoot.querySelector('.close');
    const backBtn = host.shadowRoot.querySelector('.back');
    const pinBtn = host.shadowRoot.querySelector('.pin');
    const resize = host.shadowRoot.querySelector('.resize');

    let dragState = null;
    let resizeState = null;

    function getRect() {
      return overlay.getBoundingClientRect();
    }

    function setPosition(x, y) {
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    }

    function snapToCorner() {
      const rect = getRect();
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;

      const targetX = rect.left < midX ? 16 : window.innerWidth - rect.width - 16;
      const targetY = rect.top < midY ? 16 : window.innerHeight - rect.height - 16;
      setPosition(targetX, targetY);
    }

    bar.addEventListener('pointerdown', (e) => {
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        rect: getRect()
      };
      overlay.setPointerCapture(e.pointerId);
    });

    bar.addEventListener('pointermove', (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setPosition(dragState.rect.left + dx, dragState.rect.top + dy);
    });

    bar.addEventListener('pointerup', (e) => {
      if (!dragState) return;
      dragState = null;
      overlay.releasePointerCapture(e.pointerId);
      if (!isPinned) snapToCorner();
    });

    resize.addEventListener('pointerdown', (e) => {
      resizeState = {
        startX: e.clientX,
        startY: e.clientY,
        rect: getRect()
      };
      overlay.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });

    resize.addEventListener('pointermove', (e) => {
      if (!resizeState) return;
      const dx = e.clientX - resizeState.startX;
      const dy = e.clientY - resizeState.startY;
      overlay.style.width = `${Math.max(180, resizeState.rect.width + dx)}px`;
      overlay.style.height = `${Math.max(120, resizeState.rect.height + dy)}px`;
    });

    resize.addEventListener('pointerup', (e) => {
      if (!resizeState) return;
      resizeState = null;
      overlay.releasePointerCapture(e.pointerId);
    });

    closeBtn.addEventListener('click', () => {
      host.remove();
    });

    backBtn.addEventListener('click', () => {
      history.back();
    });

    pinBtn.addEventListener('click', () => {
      isPinned = !isPinned;
      pinBtn.textContent = isPinned ? 'Unpin' : 'Pin';
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') host.remove();
      if (e.key === 'Enter' && document.activeElement === backBtn) history.back();
    });
  }

  async function requestOverlay() {
    if (!(await isEnabledForSite())) return;

    chrome.runtime.sendMessage(
      { type: 'REQUEST_OVERLAY', currentUrl: location.href },
      async (res) => {
        if (!res || !res.ok) return;

        const host = buildOverlay();
        const settings = await getSettings();
        applySize(host, settings.overlaySize || 'medium');
        setPreview(host, res.snapshot);
        setupInteractions(host);
      }
    );
  }

  function setupCaptureHooks() {
    const capture = () => {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_PREVIOUS_PAGE',
        url: location.href,
        title: document.title || ''
      });
    };

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!target) return;

        const href = target.getAttribute('href') || '';
        if (!href || href.startsWith('javascript:')) return;
        if (target.target && target.target !== '_self') return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

        capture();
      },
      true
    );

    window.addEventListener(EVENT_BEFORE, () => {
      capture();
    });

    window.addEventListener(EVENT_AFTER, () => {
      requestOverlay();
    });
  }

  function init() {
    setupCaptureHooks();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', requestOverlay);
    } else {
      requestOverlay();
    }
  }

  init();
})();
