// pinpoint - ui components
// tooltip and detail panel creation, selector highlighting

(function(P) {
  'use strict';
  
  const C = P.Constants;
  const S = P.State;
  const SD = P.ShadowDOM;
  const SEL = P.Selector;
  const UI = P.UI;
  
  // internal helpers
  
  function createTokenSpan(text, className) {
    if (!className) {
      return document.createTextNode(text);
    }
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  }
  
  function highlightSelector(sel) {
    const frag = document.createDocumentFragment();
    const tokenPattern = /(\[.*?\])|(#[\w-]+)|(\.[\w-]+)/g;
    
    let lastIndex = 0;
    let match;
    
    while ((match = tokenPattern.exec(sel)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(createTokenSpan(sel.slice(lastIndex, match.index)));
      }
      
      const [fullMatch] = match;
      let className = null;
      
      if (match[1]) className = 'tok-attr';
      else if (match[2]) className = 'tok-id';
      else if (match[3]) className = 'tok-class';
      
      frag.appendChild(createTokenSpan(fullMatch, className));
      lastIndex = tokenPattern.lastIndex;
    }
    
    if (lastIndex < sel.length) {
      frag.appendChild(createTokenSpan(sel.slice(lastIndex)));
    }
    
    return frag;
  }
  
  UI.renderSelector = function(selectorText, container) {
    const frag = highlightSelector(selectorText);
    container.replaceChildren(frag);
  };
  
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
  
  UI.renderPathCrumbs = function(pathData, container, activeIndex) {
    container.replaceChildren();
    
    pathData.forEach((segment, index) => {
      const crumb = document.createElement('button');
      crumb.className = 'pp-crumb';
      crumb.textContent = segment.label;
      crumb.setAttribute('data-index', index);
      
      if (index === activeIndex) {
        crumb.classList.add('pp-crumb-current');
      } else {
        crumb.addEventListener('click', () => UI.handleCrumbClick(index));
      }
      
      container.appendChild(crumb);
      
      if (index < pathData.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'pp-crumb-sep';
        sep.textContent = '→';
        container.appendChild(sep);
      }
    });
  };
  
  UI.updateActiveCrumb = function(index) {
    const container = S.detailPanel.querySelector('#pp-path');
    const crumbs = container.querySelectorAll('.pp-crumb');
    
    crumbs.forEach((crumb, i) => {
      if (i === index) {
        crumb.classList.add('pp-crumb-current');
        crumb.replaceWith(crumb.cloneNode(true));
      } else {
        crumb.classList.remove('pp-crumb-current');
        if (!crumb.onclick) {
          const clone = crumb.cloneNode(true);
          clone.addEventListener('click', () => UI.handleCrumbClick(i));
          crumb.replaceWith(clone);
        }
      }
    });
    
    const freshCrumbs = container.querySelectorAll('.pp-crumb');
    freshCrumbs.forEach((crumb, i) => {
      if (i === index) {
        crumb.classList.add('pp-crumb-current');
      } else {
        crumb.classList.remove('pp-crumb-current');
      }
    });
  };
  
  UI.handleCrumbClick = function(index) {
    if (!S.originalCapturedElement) return;
    
    const pathData = SEL.getDomPath(S.originalCapturedElement);
    const targetDepth = pathData[index].depth;
    
    let target = S.originalCapturedElement;
    for (let i = 0; i < targetDepth && target.parentElement; i++) {
      target = target.parentElement;
    }
    
    if (target && target !== document.body) {
      S.activeCrumbIndex = index;
      S.capturedElement = target;
      
      const selectorData = SEL.getAllSelectorFormats(target);
      const rect = target.getBoundingClientRect();
      const dimensions = `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`;
      const angularAttrs = SEL.getAngularAttributes(target);
      const reactName = SEL.getReactComponentName(target);

      let selectorDisplay = selectorData.playwright;
      if (selectorData.depth > 0) {
        selectorDisplay += `\n\n/* Puppeteer */\n${selectorData.puppeteer}`;
        selectorDisplay += `\n\n/* Shadow Depth: ${selectorData.depth} */`;
      }

      UI.renderSelector(selectorDisplay, S.detailPanel.querySelector('#pp-selector'));
      S.detailPanel.querySelector('#pp-dimensions').textContent = dimensions;
      S.detailPanel.querySelector('#pp-angular').textContent = angularAttrs;
      S.detailPanel.querySelector('#pp-component').textContent = reactName || 'none';
      
      UI.updateActiveCrumb(index);
      P.Events.updateHighlight(target);
    }
  };
  
  UI.createTooltip = function() {
    if (!S.shadowRoot) SD.createShadowRoot();
    const el = document.createElement('div');
    el.id = 'pp-tooltip';
    S.shadowRoot.appendChild(el);
    return el;
  };
  
  UI.createDetailPanel = function() {
    if (!S.shadowRoot) SD.createShadowRoot();
    
    const panel = document.createElement('div');
    panel.id = 'pp-panel';
    
    const header = document.createElement('div');
    header.className = 'pp-panel-header';
    
    const title = document.createElement('h3');
    title.textContent = 'pinpoint';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'pp-close';
    closeBtn.textContent = '×';
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'pp-panel-body';
    
    body.appendChild(createField('selector', 'pp-selector'));
    body.appendChild(createField('dimensions', 'pp-dimensions'));
    body.appendChild(createField('component', 'pp-component'));
    body.appendChild(createField('framework attrs', 'pp-angular'));
    body.appendChild(createField('dom path', 'pp-path'));
    
    panel.appendChild(header);
    panel.appendChild(body);
    
    S.shadowRoot.appendChild(panel);
    attachDetailPanelEventListeners(panel);
    return panel;
  };
  
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
  
  function attachDetailPanelEventListeners(panel) {
    const header = panel.querySelector('.pp-panel-header');
    
    panel.querySelector('#pp-close').addEventListener('click', UI.closePanel);
    
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && S.isDetailPanelOpen) UI.closePanel();
    });

    panel.querySelectorAll('.pp-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => handleCopyClick(btn, panel));
    });
    
    header.addEventListener('mousedown', e => handleDragStart(e, panel));
  }
  
  async function handleCopyClick(btn, panel) {
    const targetId = btn.getAttribute('data-copy-target');
    const text = panel.querySelector(`#${targetId}`).textContent;
    
    try {
      await navigator.clipboard.writeText(text);
      showCopySuccess(btn);
    } catch {}
  }
  
  function showCopySuccess(btn) {
    btn.classList.add('copied');
    btn.replaceChildren(createIcon('check'));
    
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.replaceChildren(createIcon('copy'));
    }, C.COPY_SUCCESS_DURATION_MS);
  }
  
  UI.closePanel = function() {
    if (!S.detailPanel) return;
    S.detailPanel.style.display = 'none';
    S.isDetailPanelOpen = false;
    
    // disconnect observer when closing
    P.Events.disconnectObserver();
    
    const overlay = S.shadowRoot?.getElementById('pp-overlay');
    if (overlay) overlay.style.opacity = '0';
  };
  
  UI.showDetachedWarning = function() {
    const panel = S.detailPanel;
    if (!panel) return;
    
    // add warning banner if not exists
    if (!panel.querySelector('.pp-detached-warning')) {
      const warning = document.createElement('div');
      warning.className = 'pp-detached-warning';
      warning.textContent = '⚠ element detached';
      panel.querySelector('.pp-panel-body').prepend(warning);
    }
    
    // grey out the selector field
    const selectorField = panel.querySelector('#pp-selector');
    if (selectorField) selectorField.classList.add('pp-detached');
  };
  
  UI.clearDetachedWarning = function() {
    const panel = S.detailPanel;
    if (!panel) return;
    
    const warning = panel.querySelector('.pp-detached-warning');
    if (warning) warning.remove();
    
    const selectorField = panel.querySelector('#pp-selector');
    if (selectorField) selectorField.classList.remove('pp-detached');
  };

  
  function handleDragStart(e, panel) {
    if (e.target.id === 'pp-close') return;
    
    S.isDragging = true;
    S.dragStartX = e.clientX - S.panelOffsetX;
    S.dragStartY = e.clientY - S.panelOffsetY;
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    e.preventDefault();
  }
  
  function handleDragMove(e) {
    if (!S.isDragging) return;
    
    const deltaX = e.clientX - S.dragStartX;
    const deltaY = e.clientY - S.dragStartY;
    
    if (S.dragRafPending) return;
    S.dragRafPending = true;
    
    requestAnimationFrame(() => {
      S.dragRafPending = false;
      S.panelOffsetX = deltaX;
      S.panelOffsetY = deltaY;
      
      S.detailPanel.style.transform = `translate(calc(-50% + ${S.panelOffsetX}px), calc(-50% + ${S.panelOffsetY}px))`;
    });
  }
  
  function handleDragEnd() {
    S.isDragging = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }

})(window.Pinpoint);
