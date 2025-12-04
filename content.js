// pinpoint - content script entry
// message listener, routes to init/destroy

if (window.__PINPOINT_LOADED__) {
  // already injected, skip re-execution
} else {
  window.__PINPOINT_LOADED__ = true;

  (function() {
    'use strict';

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'PING':
          sendResponse({ status: 'alive' });
          break;
        case 'ACTIVATE':
          init();
          sendResponse({ success: true });
          break;
        case 'DEACTIVATE':
          destroy();
          sendResponse({ success: true });
          break;
      }
    });
  })();
}
