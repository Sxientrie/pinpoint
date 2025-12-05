// pinpoint - shadow dom
// shadow root creation, encapsulated styles

(function(P) {
  'use strict';
  
  const S = P.State;
  const SD = P.ShadowDOM;
  
  /**
   * creates shadow root for style isolation
   * @returns {ShadowRoot}
   */
  SD.createShadowRoot = function() {
    S.shadowHost = document.createElement('pinpoint-root');
    S.shadowHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    
    S.shadowRoot = S.shadowHost.attachShadow({ mode: 'open' });
    
    const style = document.createElement('style');
    style.textContent = SD.getShadowStyles();
    S.shadowRoot.appendChild(style);
    
    const overlay = document.createElement('div');
    overlay.id = 'pp-overlay';
    S.shadowRoot.appendChild(overlay);
    
    document.body.appendChild(S.shadowHost);
    return S.shadowRoot;
  };
  
  /**
   * @returns {string} encapsulated css
   */
  SD.getShadowStyles = function() {
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

#pp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.8);
  z-index: 2147483645;
  display: none;
}

#pp-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  overflow-x: hidden;
  background: rgba(9, 9, 11, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(39, 39, 42, 0.5);
  border-radius: 8px;
  z-index: 2147483646;
  display: none;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #e4e4e7;
  pointer-events: auto;
  will-change: transform;
  padding: 0;
}

.pp-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(24, 24, 27, 0.6);
  border-bottom: 1px solid rgba(39, 39, 42, 0.4);
  cursor: move;
  user-select: none;
}

.pp-panel-header h3 {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: lowercase;
  letter-spacing: 0.05em;
  color: #f97316;
}

#pp-close {
  background: none;
  border: none;
  color: #52525b;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 2px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
}

#pp-close:hover {
  color: #e4e4e7;
  background: rgba(63, 63, 70, 0.5);
}

.pp-panel-body {
  display: grid;
  gap: 1px;
  background: rgba(39, 39, 42, 0.3);
}

.pp-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(9, 9, 11, 0.9);
}

.pp-section label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #52525b;
  font-weight: 600;
}

.pp-field-wrapper {
  position: relative;
}

.pp-section code {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
  padding: 6px 28px 6px 8px;
  background: rgba(24, 24, 27, 0.6);
  border: 1px solid rgba(39, 39, 42, 0.3);
  border-radius: 4px;
  color: #e4e4e7;
  line-height: 1.5;
  display: block;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 80px;
  overflow-y: auto;
  overflow-x: hidden;
}

.pp-section code::-webkit-scrollbar {
  width: 8px;
}

.pp-section code::-webkit-scrollbar-track {
  background: rgba(39, 39, 42, 0.4);
  border-radius: 4px;
}

.pp-section code::-webkit-scrollbar-thumb {
  background: #71717a;
  border-radius: 4px;
}

.pp-section code::-webkit-scrollbar-thumb:hover {
  background: #a1a1aa;
}

.tok-id { color: var(--tok-id, #facc15); }
.tok-class { color: var(--tok-class, #60a5fa); }
.tok-attr { color: var(--tok-attr, #4ade80); }

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

.pp-crumb {
  display: inline-block;
  padding: 3px 8px;
  margin: 2px 0;
  background: rgba(63, 63, 70, 0.4);
  border: 1px solid rgba(82, 82, 91, 0.3);
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s;
}

.pp-crumb:hover {
  background: rgba(82, 82, 91, 0.6);
  color: #fafafa;
  border-color: rgba(113, 113, 122, 0.5);
}

.pp-crumb-current {
  background: rgba(249, 115, 22, 0.15);
  border-color: rgba(249, 115, 22, 0.4);
  color: #f97316;
  cursor: default;
}

.pp-crumb-current:hover {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.pp-crumb-sep {
  display: inline-block;
  margin: 0 4px;
  color: #52525b;
  font-size: 10px;
}

.pp-detached-warning {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 11px;
  font-weight: 600;
  color: #f87171;
  text-align: center;
}

.pp-detached {
  opacity: 0.4;
  text-decoration: line-through;
}
  `;
  };


})(window.Pinpoint);
