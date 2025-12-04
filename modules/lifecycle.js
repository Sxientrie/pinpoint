// pinpoint - lifecycle
// init/destroy, orphaned context handling

/**
 * @returns {boolean} true if extension context valid
 */
function isContextValid() {
  return !!(chrome.runtime?.id);
}

/**
 * cleans up orphaned script after extension reload
 */
function cleanupOrphaned() {
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  
  if (shadowHost?.parentNode) {
    shadowHost.parentNode.removeChild(shadowHost);
  }
  
  shadowHost = null;
  shadowRoot = null;
  tooltip = null;
  detailPanel = null;
  hoveredElement = null;
  isActive = false;
}

/**
 * initializes inspection engine
 */
function init() {
  if (!isContextValid()) {
    cleanupOrphaned();
    return;
  }
  
  if (isActive) return;
  
  if (!tooltip) tooltip = createTooltip();
  if (!detailPanel) detailPanel = createDetailPanel();

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  isActive = true;
}

/**
 * deactivates inspection engine, cleans up
 */
function destroy() {
  if (!isContextValid()) {
    cleanupOrphaned();
    return;
  }
  
  if (!isActive) return;
  
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  
  if (tooltip) tooltip.style.display = 'none';
  if (detailPanel) detailPanel.style.display = 'none';
  
  const overlay = shadowRoot?.getElementById('pp-overlay');
  if (overlay) overlay.style.opacity = '0';
  
  hoveredElement = null;
  isDetailPanelOpen = false;
  isActive = false;
  lastMouseEvent = null;
  rafPending = false;
}

