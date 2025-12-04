// pinpoint - event handlers
// mouse/click with raf throttling

/**
 * handles mousemove with raf throttling
 * @param {MouseEvent} event
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
 * processes mouse movement once per frame
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
 * @param {HTMLElement} el
 * @returns {boolean} true if element is pinpoint ui
 */
function isPinpointElement(el) {
  return (el.id?.startsWith('pp-')) || el.closest?.('#pp-panel');
}

/**
 * hides tooltip and overlay
 */
function hideTooltipAndClearHighlight() {
  tooltip.style.display = 'none';
  const overlay = shadowRoot?.getElementById('pp-overlay');
  if (overlay) overlay.style.opacity = '0';
  hoveredElement = null;
}

/**
 * updates overlay to highlight element
 * @param {HTMLElement} target
 */
function updateHighlight(target) {
  hoveredElement = target;
  const overlay = shadowRoot?.getElementById('pp-overlay');
  if (!overlay) return;
  
  const rect = target.getBoundingClientRect();
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
  overlay.style.opacity = '1';
}

/**
 * updates tooltip content and position
 * @param {HTMLElement} target
 * @param {number} clientX
 * @param {number} clientY
 */
function updateTooltip(target, clientX, clientY) {
  const tag = target.tagName.toLowerCase();
  const classes = typeof target.className === 'string'
    ? target.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-')).join('.')
    : '';
  
  tooltip.textContent = `${classes ? `${tag}.${classes}` : tag} • Click to capture`;
  tooltip.style.display = 'block';
  tooltip.style.left = (clientX + TOOLTIP_OFFSET_X) + 'px';
  tooltip.style.top = (clientY + TOOLTIP_OFFSET_Y) + 'px';
}

/**
 * handles alt+click for element capture
 * @param {MouseEvent} event
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
 * captures element data and populates panel
 * @param {HTMLElement} target
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
 * shows detail panel, hides tooltip
 */
function showDetailPanel() {
  detailPanel.style.display = 'block';
  isDetailPanelOpen = true;
  tooltip.style.display = 'none';
}
