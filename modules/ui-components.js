// pinpoint - ui components
// tooltip and detail panel creation, selector highlighting

/**
 * tokenizes selector string for syntax highlighting
 * @param {string} sel
 * @returns {string} html with token spans
 */
function highlightSelector(sel) {
  return sel
    .replace(/(\[.*?\])/g, '<span class="tok-attr">$1</span>')
    .replace(/(#[\w-]+)/g, '<span class="tok-id">$1</span>')
    .replace(/(\.[\w-]+)/g, '<span class="tok-class">$1</span>');
}

/**
 * creates svg element from path data
 * @param {string} type - 'copy' or 'check'
 * @returns {SVGElement}
 */
function createIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  
  if (type === 'copy') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '9');
    rect.setAttribute('y', '9');
    rect.setAttribute('width', '13');
    rect.setAttribute('height', '13');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
    
    svg.appendChild(rect);
    svg.appendChild(path);
  } else if (type === 'check') {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '20 6 9 17 4 12');
    svg.appendChild(polyline);
  }
  
  return svg;
}

/**
 * creates hover tooltip in shadow dom
 * @returns {HTMLElement}
 */
function createTooltip() {
  if (!shadowRoot) createShadowRoot();
  const el = document.createElement('div');
  el.id = 'pp-tooltip';
  shadowRoot.appendChild(el);
  return el;
}

/**
 * creates detail panel with copy buttons (csp-safe)
 * @returns {HTMLElement}
 */
function createDetailPanel() {
  if (!shadowRoot) createShadowRoot();
  
  const panel = document.createElement('div');
  panel.id = 'pp-panel';
  
  // header
  const header = document.createElement('div');
  header.className = 'pp-panel-header';
  
  const title = document.createElement('h3');
  title.textContent = 'pinpoint';
  
  const closeBtn = document.createElement('button');
  closeBtn.id = 'pp-close';
  closeBtn.textContent = '×';
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // body
  const body = document.createElement('div');
  body.className = 'pp-panel-body';
  
  body.appendChild(createField('selector', 'pp-selector'));
  body.appendChild(createField('dimensions', 'pp-dimensions'));
  body.appendChild(createField('framework attrs', 'pp-angular'));
  body.appendChild(createField('dom path', 'pp-path'));
  
  panel.appendChild(header);
  panel.appendChild(body);
  
  shadowRoot.appendChild(panel);
  attachDetailPanelEventListeners(panel);
  return panel;
}

/**
 * creates single field with copy button
 * @param {string} labelText
 * @param {string} id
 * @returns {HTMLElement}
 */
function createField(labelText, id) {
  const section = document.createElement('div');
  section.className = 'pp-section';
  
  const label = document.createElement('label');
  label.textContent = labelText;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'pp-field-wrapper';
  
  const code = document.createElement('code');
  code.id = id;
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'pp-copy-btn';
  copyBtn.setAttribute('data-copy-target', id);
  copyBtn.appendChild(createIcon('copy'));
  
  wrapper.appendChild(code);
  wrapper.appendChild(copyBtn);
  
  section.appendChild(label);
  section.appendChild(wrapper);
  
  return section;
}

/**
 * attaches event listeners to panel
 * @param {HTMLElement} panel
 */
function attachDetailPanelEventListeners(panel) {
  const header = panel.querySelector('.pp-panel-header');
  
  panel.querySelector('#pp-close').addEventListener('click', closePanel);
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isDetailPanelOpen) closePanel();
  });

  panel.querySelectorAll('.pp-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => handleCopyClick(btn, panel));
  });
  
  header.addEventListener('mousedown', e => handleDragStart(e, panel));
}

/**
 * handles copy with visual feedback
 * @param {HTMLElement} btn
 * @param {HTMLElement} panel
 */
async function handleCopyClick(btn, panel) {
  const targetId = btn.getAttribute('data-copy-target');
  const text = panel.querySelector(`#${targetId}`).textContent;
  
  try {
    await navigator.clipboard.writeText(text);
    showCopySuccess(btn);
  } catch {}
}

/**
 * shows checkmark feedback on copy (csp-safe)
 * @param {HTMLElement} btn
 */
function showCopySuccess(btn) {
  btn.classList.add('copied');
  btn.replaceChildren(createIcon('check'));
  
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.replaceChildren(createIcon('copy'));
  }, COPY_SUCCESS_DURATION_MS);
}

/**
 * closes detail panel, clears highlight
 */
function closePanel() {
  if (!detailPanel) return;
  detailPanel.style.display = 'none';
  isDetailPanelOpen = false;
  
  const overlay = shadowRoot?.getElementById('pp-overlay');
  if (overlay) overlay.style.opacity = '0';
}

/**
 * initiates drag on panel header
 * @param {MouseEvent} e
 * @param {HTMLElement} panel
 */
function handleDragStart(e, panel) {
  if (e.target.id === 'pp-close') return;
  
  isDragging = true;
  dragStartX = e.clientX - panelOffsetX;
  dragStartY = e.clientY - panelOffsetY;
  
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
  
  e.preventDefault();
}

/**
 * processes drag movement with raf throttling
 * @param {MouseEvent} e
 */
function handleDragMove(e) {
  if (!isDragging) return;
  
  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;
  
  if (dragRafPending) return;
  dragRafPending = true;
  
  requestAnimationFrame(() => {
    dragRafPending = false;
    panelOffsetX = deltaX;
    panelOffsetY = deltaY;
    
    detailPanel.style.transform = `translate(calc(-50% + ${panelOffsetX}px), calc(-50% + ${panelOffsetY}px))`;
  });
}

/**
 * completes drag, removes listeners
 */
function handleDragEnd() {
  isDragging = false;
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
}
