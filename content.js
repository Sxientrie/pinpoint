// pinpoint - content script entry
// message listener, keepalive connection, routes to init/destroy

if (window.__PINPOINT_LOADED__) {
  // already injected, skip re-execution
} else {
  window.__PINPOINT_LOADED__ = true;

  (function() {
    'use strict';
    
    const P = window.Pinpoint;
    let port = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    
    /**
     * establishes keepalive port to background
     * auto-reconnects on service worker restart
     */
    function connectToBackground() {
      try {
        // check if extension context is still valid
        if (!chrome.runtime?.id) {
          P.Lifecycle.cleanupOrphaned();
          return;
        }
        
        port = chrome.runtime.connect({ name: 'pinpoint-keepalive' });
        reconnectAttempts = 0;
        
        port.onDisconnect.addListener(() => {
          port = null;
          
          // check if this is a real disconnect (extension unloaded)
          // vs service worker going idle (should reconnect)
          if (!chrome.runtime?.id) {
            P.Lifecycle.cleanupOrphaned();
            return;
          }
          
          // service worker went idle, try to reconnect
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connectToBackground, 100);
          }
        });
      } catch (e) {
        // extension context invalidated
        P.Lifecycle.cleanupOrphaned();
      }
    }
    
    // initial connection
    connectToBackground();

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
