1) Problem & Goal
Problem you described

When you click a link and navigate away, you lose the previous page context (text you were reading, data you were referencing), and sometimes you lose form progress (half-filled form).

Goal

Build a Chrome extension that:

Shows a floating “mini preview” of the previous page after navigation (Option A).

Auto-saves form state on the previous page and restores it when you return (Option C).

2) Core Concept (What the extension does)
Option A — “Mini Preview Overlay”

Before leaving a page, capture a snapshot (screenshot or simplified preview data).

On the next page, show a draggable mini overlay containing that snapshot.

User can close/pin/resize it.

This is reliable because you’re not trying to embed the old site inside the new site (which is often blocked by CSP / X-Frame-Options).

Option C — “Form Autosave & Restore”

Continuously or on navigation:

Save form input values (input, textarea, select)

Save scroll position

Save focused field (optional)

When user returns to the page:

Restore values and scroll so the user continues from where they stopped.

3) Key Chrome Extension APIs & Platform Constraints
Manifest V3 foundation

MV3 is the standard modern extension model, using a service worker instead of a persistent background page.

Capturing page preview (screenshot)

Use the Tabs API capabilities to take a screenshot of the visible area of the current tab (commonly done via captureVisibleTab). The Tabs API supports screenshot capture features.

Important limitation: “sensitive pages” like chrome:// cannot be captured normally.

Detecting navigation & SPA URL changes

For “real navigation events”, use chrome.webNavigation events (requires permission).

For SPA sites (React/Next/Vue apps), URL changes may happen without full reload; webNavigation offers events like history-state updates for those scenarios.

Injecting overlay UI + form capture logic

Use content scripts to run on pages and manipulate the DOM (inject overlay, read form values).

For dynamic injection decisions at runtime, use chrome.scripting.

Storing data safely

Use chrome.storage for persistence; it’s designed for extensions.

For session-only storage (not written permanently), session storage exists in WebExtensions (memory-only for the session; browser support varies).

In Chrome, you’ll commonly use chrome.storage.session (where available) or fallback to chrome.storage.local with TTL cleanup.

4) Proposed UX (How it feels to the user)
Default flow

User is on Page A.

User clicks a link to Page B.

Extension instantly:

Saves Page A form state

Captures a preview of Page A

On Page B:

A small floating “Mini Preview” appears (bottom-right)

Buttons:

Back to previous tab/page

Open preview in a new side panel

Close

Pin

Optional nice features (high value)

“Hold-to-peek” hotkey (press and hold to show preview, release hides)

“Remember only on forms” mode (privacy-friendly)

Domain allowlist/denylist

Resize + snap-to-corners

5) System Design (Architecture)
Components

(A) Content Script

Runs on all pages

Responsibilities:

Track form changes + save state

Detect link clicks (and navigation intent)

Inject mini overlay UI on the next page

Request screenshot capture from background

(B) Background Service Worker (MV3)

Coordinates logic

Responsibilities:

Receives “about to navigate” event

Calls tab screenshot capture

Stores snapshot + metadata (previous URL, title, timestamp)

Sends data to the content script on the new page

(C) Storage Layer

chrome.storage.session or chrome.storage.local

Stores:

lastSnapshot: image data URL (or compressed)

lastPageMeta: url/title/time

formStateByUrl: keyed by URL (or origin + path)

(D) Overlay UI

Injected by content script

Draggable/resizable floating window

Shows snapshot image + metadata

6) Data Model (What you store)
Snapshot record

id

fromUrl

fromTitle

capturedAt

imageDataUrl (or Blob stored in IndexedDB for size)

Form state record (per URL)

urlKey (normalize URL: remove tracking params)

timestamp

scrollY

fields: list of { selector, type, value, checked, selectedOptions }

Important: Don’t store passwords or sensitive fields by default.

7) Permissions Strategy (Minimize scary permissions)

You want this to feel safe and get approved.

Likely needed permissions

storage (save snapshot + form state)

scripting (inject overlay / scripts when needed)

activeTab (temporary permission after user action; helpful for capture)

Optional: webNavigation (more reliable nav detection; but can look scary to users because it implies browsing activity).

Recommendation

MVP: try without webNavigation (use click listeners + page load).

Add webNavigation only if SPA support becomes a must-have.

8) Security & Privacy Design (Critical)

This extension will handle:

screenshots of pages (could contain private info)

form values (could contain private info)

Must-do rules

Default: do everything locally, no server.

Never capture on:

banking/payment sites (or provide a strong “blocklist default”)

Never save:

password inputs

credit card inputs

Add a “Private Mode” toggle: disables capturing anytime.

Why this matters: some malicious extensions abuse screenshot capture + scripting permissions, and Chrome users are sensitive to it.

9) MVP Build Plan (Practical milestones)
Milestone 1 — Mini Preview (Option A)

Detect link click → store current URL/title

Background captures screenshot

New page injects overlay showing last screenshot

Milestone 2 — Form Autosave (Option C)

Track form changes (debounced)

Save values + scroll position

On page load: restore if matches URL key

Milestone 3 — SPA + Edge Cases

Handle History API changes (SPA routing)

Improve URL normalization

Better overlay UX (drag/resize/snap)

Milestone 4 — Store Listing Readiness

Strong privacy text

Clear permission explanation

Blocklist/allowlist UI

10) Risks & How to Handle Them
Risk: Screenshot capture limitations

Some pages can’t be captured (system pages, chrome pages).
Mitigation: show “Preview not available” and still keep form restore.

Risk: Storage size

Screenshot data URLs can be large.
Mitigation: keep only 1–3 most recent snapshots; compress; use IndexedDB for blobs.

Risk: Form selectors break

Using CSS selectors can fail if DOM changes.
Mitigation: store a more stable field identity (name/id + label text + type).

11) Recommended Product Name Ideas

PagePeek

KeepView

TabMemory

FormGuard + Peek

MiniContext