/**
 * Pinpoint - Lifecycle Management
 * Initialization and cleanup
 */

/**
 * Initializes the inspection engine
 * @returns {void}
 */
function init() {
  if (isActive) return;
  
  if (!tooltip) tooltip = createTooltip();
  if (!detailPanel) detailPanel = createDetailPanel();

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  
  isActive = true;
}

/**
 * Deactivates the inspection engine and cleans up
 * @returns {void}
 */
function destroy() {
  if (!isActive) return;
  
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  
  if (tooltip) tooltip.style.display = 'none';
  if (detailPanel) detailPanel.style.display = 'none';
  
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(element => {
    element.classList.remove(HIGHLIGHT_CLASS);
  });
  
  hoveredElement = null;
  isDetailPanelOpen = false;
  isActive = false;
  lastMouseEvent = null;
  rafPending = false;
}
