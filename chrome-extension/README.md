# Chrome Extension — MSCI AEM Publisher

Manifest V3 extension with ES modules. Automates AEM publishing from a side panel.

```
manifest.json           → extension config (type: module for background)
sidepanel.html          → side panel UI (type="module" script)
sidepanel.css           → all side panel styles
sidepanel/
  index.js              → entry: DOMContentLoaded + event listeners
  state.js              → module-singleton shared state
  config.js             → Supabase URL/key, AEM host, app host
  api/                  → supabase.js (REST fetch), background.js (sendBackground/runInAEM)
  ui/                   → articleList, escHtml, validationOverlay
  steps/                → navigation + step modules (step2Assets, step3Page, step4Content)
background/
  index.js              → service worker entry: message router
  aemTabs.js            → find AEM editor tabs
  runInPage.js          → chrome.scripting.executeScript wrapper
  messageHandlers.js    → routes message types to handlers
  injected/             → self-contained functions injected into AEM pages (no imports allowed)
```

**Key constraint:** Functions in `background/injected/` are serialized via `.toString()` — they must be fully self-contained with no imports or closure references.
