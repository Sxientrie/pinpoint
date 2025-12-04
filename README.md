# Pinpoint

> _pinpoint any element, anywhere_

Universal DOM inspector with shadow-piercing selectors for Playwright, Puppeteer, and automation testing.

---

## Features

- alt+Hover to highlight elements
- alt+Click to capture stable CSS selectors
- generates selectors that work across Shadow boundaries
- supports Playwright (`>>`) and Puppeteer (`pierce/`)
- individual copy buttons for selector, dimensions, path
- works on any website

---

## Installation

1. Clone or download this repo
2. Open chrome://extensions/
3. Enable Developer mode
4. Click Load unpacked
5. Select the `pinpoint` folder

---

## Usage

| Action               | Result               |
| -------------------- | -------------------- |
| Click extension icon | Toggle ON/OFF        |
| Alt + Hover      | Highlight + tooltip  |
| Alt + Click      | Capture element data |
| ESC              | Close panel          |

---

## Selector Priority

Pinpoint generates the most stable selector possible:
```
1. Unique ID — #submit-button
2. Data Attributes — [data-testid="login"]
3. ARIA Attributes — [aria-label="Close"]
4. CSS Classes — button.primary`
5. Structural Path — div > form > button:nth-of-type(2)
```
---

## Shadow DOM Support

For elements inside Shadow DOM, Pinpoint generates piercing selectors:

```javascript
// Playwright format
page.locator("component >> .internal-button");

// Puppeteer format
page.$("pierce/component .internal-button");
```

The panel shows:

- Shadow depth level
- Multiple selector formats
- Validation-ready selectors

---

## Project Structure

```
pinpoint/
├── manifest.json
├── background.js
├── content.js
├── styles.css
├── icon.png
├── modules/
│   ├── constants.js
│   ├── state.js
│   ├── shadow-dom.js
│   ├── shadow-pierce.js
│   ├── selector-engine.js
│   ├── ui-components.js
│   ├── event-handlers.js
│   └── lifecycle.js
└── README.md
```

---

## Use Cases

- QA Automation — Generate stable selectors for Playwright/Puppeteer
- Agent Navigation — Provide DOM context for AI agents and browser automation
- Web Scraping — Find reliable element paths
- Component Development — Inspect Shadow DOM internals
- Debugging — Understand DOM structure quickly

---

## Permissions

| Permission   | Purpose                               |
| ------------ | ------------------------------------- |
| `activeTab`  | Access current tab when clicked       |
| `scripting`  | Inject content script                 |
| `storage`    | Persist state across browser sessions |
| `<all_urls>` | Universal site support                |

---

## License

MIT

---

_Built for developers.