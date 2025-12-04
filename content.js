/**
 * Pinpoint - Content Script Main Entry Point
 * 
 * Coordinates all modules and manages communication with background script.
 * Modules are loaded in dependency order via manifest.json.
 */

(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ACTIVATE') {
      init();
      sendResponse({ success: true });
    } else if (message.action === 'DEACTIVATE') {
      destroy();
      sendResponse({ success: true });
    }
  });
})();
