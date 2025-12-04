// pinpoint - content script entry
// message listener, keepalive connection, routes to init/destroy

if (window.__PINPOINT_LOADED__) {
  // already injected, skip re-execution
} else {
  window.__PINPOINT_LOADED__ = true;

  (function() {
    'use strict';
    
    const P = window.Pinpoint;
    
    // establish keepalive connection to background
    const port = chrome.runtime.connect({ name: 'pinpoint-keepalive' });
    
    // handle disconnect (extension reload, etc.)
    port.onDisconnect.addListener(() => {
      P.Lifecycle.cleanupOrphaned();
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'ACTIVATE':
          P.Lifecycle.init();
          sendResponse({ success: true });
          break;
        case 'DEACTIVATE':
          P.Lifecycle.destroy();
          sendResponse({ success: true });
          break;
      }
    });
  })();
}
