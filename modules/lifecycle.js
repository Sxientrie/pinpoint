// pinpoint - lifecycle
// init/destroy, orphaned context handling

(function(P) {
  'use strict';
  
  const S = P.State;
  const UI = P.UI;
  const E = P.Events;
  const L = P.Lifecycle;
  
  L.isContextValid = function() {
    return !!(chrome.runtime?.id);
  };
  
  L.cleanupOrphaned = function() {
    document.removeEventListener('mousemove', E.handleMouseMove, true);
    document.removeEventListener('click', E.handleClick, true);
    document.removeEventListener('keydown', E.handleKeyDown, true);
    
    // disconnect mutation observer
    if (S.elementObserver) {
      S.elementObserver.disconnect();
      S.elementObserver = null;
    }
    
    if (S.shadowHost?.parentNode) {
      S.shadowHost.parentNode.removeChild(S.shadowHost);
    }
    
    S.shadowHost = null;
    S.shadowRoot = null;
    S.tooltip = null;
    S.detailPanel = null;
    S.hoveredElement = null;
    S.isActive = false;
  };
  
  L.init = function() {
    if (!L.isContextValid()) {
      L.cleanupOrphaned();
      return;
    }
    
    if (S.isActive) return;
    
    if (!S.tooltip) S.tooltip = UI.createTooltip();
    if (!S.detailPanel) S.detailPanel = UI.createDetailPanel();

    document.addEventListener('mousemove', E.handleMouseMove, true);
    document.addEventListener('click', E.handleClick, true);
    document.addEventListener('keydown', E.handleKeyDown, true);
    
    S.isActive = true;
  };
  
  L.destroy = function() {
    if (!L.isContextValid()) {
      L.cleanupOrphaned();
      return;
    }
    
    if (!S.isActive) return;
    
    document.removeEventListener('mousemove', E.handleMouseMove, true);
    document.removeEventListener('click', E.handleClick, true);
    document.removeEventListener('keydown', E.handleKeyDown, true);
    
    // disconnect mutation observer
    E.disconnectObserver();
    
    if (S.tooltip) S.tooltip.style.display = 'none';
    if (S.detailPanel) S.detailPanel.style.display = 'none';
    
    const overlay = S.shadowRoot?.getElementById('pp-overlay');
    if (overlay) overlay.style.opacity = '0';
    
    S.hoveredElement = null;
    S.isDetailPanelOpen = false;
    S.isActive = false;
    S.lastMouseEvent = null;
    S.rafPending = false;
  };

})(window.Pinpoint);
