// pinpoint - state
// shared mutable state for inspection engine

(function(P) {
  'use strict';
  
  const S = P.State;
  
  // element references
  S.hoveredElement = null;
  S.capturedElement = null;
  S.originalCapturedElement = null;
  S.activeCrumbIndex = -1;
  
  // ui elements
  S.tooltip = null;
  S.detailPanel = null;
  S.isDetailPanelOpen = false;
  S.isActive = false;
  S.shadowRoot = null;
  S.shadowHost = null;
  
  // raf throttling
  S.rafPending = false;
  S.lastMouseEvent = null;
  
  // drag state
  S.isDragging = false;
  S.dragStartX = 0;
  S.dragStartY = 0;
  S.panelOffsetX = 0;
  S.panelOffsetY = 0;
  S.dragRafPending = false;
  
  // cached dimensions
  S.viewportWidth = 0;
  S.viewportHeight = 0;
  S.tooltipWidth = 0;
  S.tooltipHeight = 0;
  
  // mutation observer for captured element
  S.elementObserver = null;


})(window.Pinpoint);
