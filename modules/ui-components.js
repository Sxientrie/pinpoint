// pinpoint - ui components
// tooltip and detail panel creation, selector highlighting

/**
 * creates a text span with optional token class
 * @param {string} text
 * @param {string} [className]
 * @returns {HTMLSpanElement|Text}
 */
function createTokenSpan(text, className) {
  if (!className) {
    return document.createTextNode(text);
  }
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/**
 * tokenizes selector string for syntax highlighting (xss-safe)
 * @param {string} sel
 * @returns {DocumentFragment}
 */
function highlightSelector(sel) {
  const frag = document.createDocumentFragment();
  
  // regex to match tokens: attributes [...], ids #..., classes .
  const tokenPattern = /(\[.*?\])|(#[\w-]+)|(\.[\w-]+)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tokenPattern.exec(sel)) !== null) {
    // text before this match
    if (match.index > lastIndex) {
      frag.appendChild(createTokenSpan(sel.slice(lastIndex, match.index)));
    }
    
    // determine token type
    const [fullMatch] = match;
    let className = null;
    
    if (match[1]) className = 'tok-attr';      // [attribute]
    else if (match[2]) className = 'tok-id';   // #id
    else if (match[3]) className = 'tok-class'; // .class
    
    frag.appendChild(createTokenSpan(fullMatch, className));
    lastIndex = tokenPattern.lastIndex;
  }
  
  // remaining text after last match
  if (lastIndex < sel.length) {
    frag.appendChild(createTokenSpan(sel.slice(lastIndex)));
  }
  
  return frag;
}

/**
 * safely renders highlighted selector into container
 * @param {string} selectorText
 * @param {HTMLElement} container
 */
function renderSelector(selectorText, container) {
  const frag = highlightSelector(selectorText);
  container.replaceChildren(frag);
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
 * renders interactive breadcrumb path from segment array
 * @param {Array<{label: string, depth: number}>} pathData
 * @param {HTMLElement} container
 * @param {number} activeIndex - which crumb is currently active
 */
function renderPathCrumbs(pathData, container, activeIndex) {
  container.replaceChildren();
  
  pathData.forEach((segment, index) => {
    const crumb = document.createElement('button');
    crumb.className = 'pp-crumb';
    crumb.textContent = segment.label;
    crumb.setAttribute('data-index', index);
    
    if (index === activeIndex) {
      crumb.classList.add('pp-crumb-current');
    } else {
      crumb.addEventListener('click', () => handleCrumbClick(index));
    }
    
    container.appendChild(crumb);
    
    // separator between crumbs
    if (index < pathData.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'pp-crumb-sep';
      sep.textContent = '→';
      container.appendChild(sep);
    }
  });
}

/**
 * updates active crumb without rebuilding path
 * @param {number} index - crumb index to activate
 */
function updateActiveCrumb(index) {
  const container = detailPanel.querySelector('#pp-path');
  const crumbs = container.querySelectorAll('.pp-crumb');
  
  crumbs.forEach((crumb, i) => {
    if (i === index) {
      crumb.classList.add('pp-crumb-current');
      crumb.replaceWith(crumb.cloneNode(true)); // remove old listener
    } else {
      crumb.classList.remove('pp-crumb-current');
      // re-attach listener if needed
      if (!crumb.onclick) {
        const clone = crumb.cloneNode(true);
        clone.addEventListener('click', () => handleCrumbClick(i));
        crumb.replaceWith(clone);
      }
    }
  });
  
  // refresh after replacements
  const freshCrumbs = container.querySelectorAll('.pp-crumb');
  freshCrumbs.forEach((crumb, i) => {
    if (i === index) {
      crumb.classList.add('pp-crumb-current');
    } else {
      crumb.classList.remove('pp-crumb-current');
    }
  });
}

/**
 * navigates to element at crumb index, preserves full path
 * @param {number} index - crumb index to navigate to
 */
function handleCrumbClick(index) {
  if (!originalCapturedElement) return;
  
  const pathData = getDomPath(originalCapturedElement);
  const targetDepth = pathData[index].depth;
  
  // traverse from original element
  let target = originalCapturedElement;
  for (let i = 0; i < targetDepth && target.parentElement; i++) {
    target = target.parentElement;
  }
  
  if (target && target !== document.body) {
    activeCrumbIndex = index;
    capturedElement = target;
    
    // update panel data without rebuilding path
    const selectorData = getAllSelectorFormats(target);
    const rect = target.getBoundingClientRect();
    const dimensions = `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`;
    const angularAttrs = getAngularAttributes(target);

    let selectorDisplay = selectorData.playwright;
    if (selectorData.depth > 0) {
      selectorDisplay += `\n\n/* Puppeteer */\n${selectorData.puppeteer}`;
      selectorDisplay += `\n\n/* Shadow Depth: ${selectorData.depth} */`;
    }

    renderSelector(selectorDisplay, detailPanel.querySelector('#pp-selector'));
    detailPanel.querySelector('#pp-dimensions').textContent = dimensions;
    detailPanel.querySelector('#pp-angular').textContent = angularAttrs;
    
    // just update active state, don't rebuild
    updateActiveCrumb(index);
    updateHighlight(target);
  }
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
