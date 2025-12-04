/**
 * Pinpoint - Event Handlers
 * Handles mouse and click events with rAF optimization
 */

/**
 * Handles mousemove events with rAF throttling
 * @param {MouseEvent} event - Mouse event
 * @returns {void}
 */
function handleMouseMove(event) {
  if (!isActive || isDetailPanelOpen) return;

  lastMouseEvent = {
    target: event.target,
    clientX: event.clientX,
    clientY: event.clientY,
    altKey: event.altKey
  };

  if (rafPending) return;
  
  rafPending = true;
  requestAnimationFrame(processMouseMove);
}

/**
 * Processes mouse movement at most once per frame
 * @returns {void}
 */
function processMouseMove() {
  rafPending = false;
  
  if (!lastMouseEvent) return;
  
  const { target, clientX, clientY, altKey } = lastMouseEvent;
  
  if (isPinpointElement(target)) return;

  if (!altKey) {
    hideTooltipAndClearHighlight();
    return;
  }

  updateHighlight(target);
  updateTooltip(target, clientX, clientY);
}

/**
 * Checks if element is part of Pinpoint UI
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if element is Pinpoint UI
 */
function isPinpointElement(element) {
  return (element.id && element.id.startsWith('pp-')) || 
         (element.closest && element.closest('#pp-panel'));
}

/**
 * Hides tooltip and removes highlight
 * @returns {void}
 */
function hideTooltipAndClearHighlight() {
  tooltip.style.display = 'none';
  
  if (hoveredElement) {
    hoveredElement.classList.remove(HIGHLIGHT_CLASS);
    hoveredElement = null;
  }
}

/**
 * Updates the highlighted element
 * @param {HTMLElement} target - Element to highlight
 * @returns {void}
 */
function updateHighlight(target) {
  if (hoveredElement && hoveredElement !== target) {
    hoveredElement.classList.remove(HIGHLIGHT_CLASS);
  }

  hoveredElement = target;
  target.classList.add(HIGHLIGHT_CLASS);
}

/**
 * Updates tooltip content and position
 * @param {HTMLElement} target - Target element
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 * @returns {void}
 */
function updateTooltip(target, clientX, clientY) {
  const tag = target.tagName.toLowerCase();
  const classes = target.className && typeof target.className === 'string'
    ? target.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-')).join('.')
    : '';
  const label = classes ? `${tag}.${classes}` : tag;
  
  tooltip.textContent = `${label} • Click to capture`;
  tooltip.style.display = 'block';
  tooltip.style.left = (clientX + TOOLTIP_OFFSET_X) + 'px';
  tooltip.style.top = (clientY + TOOLTIP_OFFSET_Y) + 'px';
}

/**
 * Handles click events for element capture
 * @param {MouseEvent} event - Click event
 * @returns {void}
 */
function handleClick(event) {
  if (!isActive || !event.altKey) return;

  event.preventDefault();
  event.stopPropagation();

  const target = event.target;
  
  if (isPinpointElement(target)) return;

  captureElementData(target);
  showDetailPanel();
}

/**
 * Captures and populates element data in the panel
 * Shows Shadow DOM piercing selectors when applicable
 * @param {HTMLElement} target - Element to capture
 * @returns {void}
 */
function captureElementData(target) {
  const selectorData = getAllSelectorFormats(target);
  const rect = target.getBoundingClientRect();
  const dimensions = `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`;
  const angularAttrs = getAngularAttributes(target);
  const domPath = getDomPath(target);

  let selectorDisplay = selectorData.playwright;
  
  if (selectorData.depth > 0) {
    selectorDisplay += `\n\n/* Puppeteer */\n${selectorData.puppeteer}`;
    selectorDisplay += `\n\n/* Shadow Depth: ${selectorData.depth} */`;
  }

  detailPanel.querySelector('#pp-selector').textContent = selectorDisplay;
  detailPanel.querySelector('#pp-dimensions').textContent = dimensions;
  detailPanel.querySelector('#pp-angular').textContent = angularAttrs;
  detailPanel.querySelector('#pp-path').textContent = domPath;
}

/**
 * Shows the detail panel and hides tooltip
 * @returns {void}
 */
function showDetailPanel() {
  detailPanel.style.display = 'block';
  isDetailPanelOpen = true;
  tooltip.style.display = 'none';
}
