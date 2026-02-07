# Mini Preview Overlay + Form Autosave (MV3)

## Install (Unpacked)
1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode (top right).
3. Click "Load unpacked" and select the `mini-player` folder.

## How it Works
- When you click a link, the extension captures a screenshot of the current page.
- After navigation, a floating overlay shows the previous page preview.
- Forms are autosaved per URL and restored when you return.
- SPA navigation (History API) is detected and treated like page changes.

## Permissions
- `storage`: store settings and form state locally.
- `activeTab`: capture the visible tab after user interaction.
- `scripting`: reserved for future injection needs.
- `host_permissions: <all_urls>`: needed for form tracking and overlay on most sites.

## Privacy
- No server calls. All data is local.
- Password fields, credit card fields, OTP, etc. are never saved.
- Privacy mode disables screenshots and form saving.
- You can disable per-site, and use allowlist/blocklist.

## Limitations
- Screenshot capture may fail on restricted pages (e.g., Chrome Web Store).
- Overlay uses last visible snapshot, not a full-page image.
- Heavy CSP pages can still run content scripts, but some pages may block interaction.

## Folder Structure
- `manifest.json` MV3 definition
- `service_worker.js` background worker and screenshot capture
- `content/` content scripts
- `popup/` popup UI
- `storage.js`, `url_normalize.js`, `dom_selectors.js` shared utilities
