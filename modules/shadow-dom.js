// pinpoint - shadow dom
// shadow root creation, encapsulated styles

/**
 * creates shadow root for style isolation
 * @returns {ShadowRoot}
 */
function createShadowRoot() {
  shadowHost = document.createElement('pinpoint-root');
  shadowHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  
  shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  
  const style = document.createElement('style');
  style.textContent = getShadowStyles();
  shadowRoot.appendChild(style);
  
  const overlay = document.createElement('div');
  overlay.id = 'pp-overlay';
  shadowRoot.appendChild(overlay);
  
  document.body.appendChild(shadowHost);
  return shadowRoot;
}

/**
 * @returns {string} encapsulated css
 */
function getShadowStyles() {
  return `
#pp-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 2147483645;
  border: 1px solid #ff0000;
  background: rgba(186, 0, 0, 0.1);
  opacity: 0;
  transition: top 0.15s cubic-bezier(0.2, 0, 0.2, 1),
              left 0.15s cubic-bezier(0.2, 0, 0.2, 1),
              width 0.15s cubic-bezier(0.2, 0, 0.2, 1),
              height 0.15s cubic-bezier(0.2, 0, 0.2, 1),
              opacity 0.1s ease-out;
  will-change: top, left, width, height, opacity;
}

#pp-tooltip {
  position: fixed;
  display: none;
  padding: 5px 9px;
  background: #d4a574;
  color: #1c1917;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
  font-weight: 600;
  border-radius: 5px;
  pointer-events: none;
  z-index: 2147483647;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
}

#pp-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  background: rgba(9, 9, 11, 0.97);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(63, 63, 70, 0.4);
  border-radius: 12px;
  z-index: 2147483646;
  display: none;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #e4e4e7;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  pointer-events: auto;
}

.pp-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(63, 63, 70, 0.3);
  background: rgba(24, 24, 27, 0.5);
}

.pp-panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: lowercase;
  letter-spacing: 0.05em;
  color: #f97316;
}

#pp-close {
  background: none;
  border: none;
  color: #52525b;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s;
}

#pp-close:hover {
  color: #e4e4e7;
  background: rgba(63, 63, 70, 0.5);
}

.pp-panel-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pp-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pp-section label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #71717a;
  font-weight: 600;
}

.pp-field-wrapper {
  position: relative;
}

.pp-section code {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  padding: 10px 42px 10px 12px;
  background: rgba(24, 24, 27, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.3);
  border-radius: 6px;
  color: #fafafa;
  word-break: break-all;
  line-height: 1.6;
  display: block;
  white-space: pre-wrap;
}

.pp-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  background: rgba(63, 63, 70, 0.3);
  border: 1px solid rgba(82, 82, 91, 0.3);
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  opacity: 0.5;
  padding: 0;
}

.pp-copy-btn:hover {
  background: rgba(82, 82, 91, 0.6);
  opacity: 1;
  border-color: rgba(113, 113, 122, 0.5);
}

.pp-copy-btn:active {
  transform: scale(0.92);
}

.pp-copy-btn svg {
  width: 14px;
  height: 14px;
  stroke: #a1a1aa;
  stroke-width: 2;
  fill: none;
}

.pp-copy-btn:hover svg {
  stroke: #fafafa;
}

.pp-copy-btn.copied {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.5);
  opacity: 1;
}

.pp-copy-btn.copied svg {
  stroke: #22c55e;
}

#pp-panel::-webkit-scrollbar {
  width: 6px;
}

#pp-panel::-webkit-scrollbar-track {
  background: transparent;
}

#pp-panel::-webkit-scrollbar-thumb {
  background: rgba(63, 63, 70, 0.5);
  border-radius: 3px;
}

#pp-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(82, 82, 91, 0.6);
}
  `;
}
