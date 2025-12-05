// pinpoint - event handlers
// mouse/click/keyboard with raf throttling

(function(P) {
  'use strict';
  
  const C = P.Constants;
  const S = P.State;
  const SEL = P.Selector;
  const UI = P.UI;
  const E = P.Events;
  
  E.handleMouseMove = function(event) {
    if (!chrome.runtime?.id) { P.Lifecycle.cleanupOrphaned(); return; }
    if (!S.isActive || S.isDetailPanelOpen) return;

    S.lastMouseEvent = {
      target: event.target,
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey
    };

    if (S.rafPending) return;
    S.rafPending = true;
    requestAnimationFrame(processMouseMove);
  };
  
  function processMouseMove() {
    S.rafPending = false;
    if (!chrome.runtime?.id) { P.Lifecycle.cleanupOrphaned(); return; }
    if (!S.lastMouseEvent) return;
    
    const { target, clientX, clientY, altKey } = S.lastMouseEvent;
    
    if (isPinpointElement(target)) return;

    if (!altKey) {
      hideTooltipAndClearHighlight();
      return;
    }

    E.updateHighlight(target);
    updateTooltip(target, clientX, clientY);
  }
  
  function isPinpointElement(el) {
    return (el.id?.startsWith('pp-')) || el.closest?.('#pp-panel');
  }
  
  function hideTooltipAndClearHighlight() {
    S.tooltip.style.display = 'none';
    const overlay = S.shadowRoot?.getElementById('pp-overlay');
    if (overlay) overlay.style.opacity = '0';
    S.hoveredElement = null;
    S.tooltipWidth = 0;
    S.tooltipHeight = 0;
  }
  
  E.updateHighlight = function(target) {
    S.hoveredElement = target;
    const overlay = S.shadowRoot?.getElementById('pp-overlay');
    if (!overlay) return;
    
    const rect = target.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.opacity = '1';
  };
  
  function updateTooltip(target, clientX, clientY) {
    const tag = target.tagName.toLowerCase();
    const classes = typeof target.className === 'string'
      ? target.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-')).join('.')
      : '';
    
    // include react component name if available
    const reactName = SEL.getReactComponentName(target);
    let label = classes ? `${tag}.${classes}` : tag;
    if (reactName) label += ` (${reactName})`;
    
    S.tooltip.textContent = `${label} • Click to capture`;
    S.tooltip.style.display = 'block';
    
    if (!S.tooltipWidth) {
      S.viewportWidth = window.innerWidth;
      S.viewportHeight = window.innerHeight;
      S.tooltipWidth = S.tooltip.offsetWidth;
      S.tooltipHeight = S.tooltip.offsetHeight;
    }
    
    let x = clientX + C.TOOLTIP_OFFSET_X;
    if (x + S.tooltipWidth > S.viewportWidth) {
      x = clientX - C.TOOLTIP_OFFSET_X - S.tooltipWidth;
    }
    
    let y = clientY + C.TOOLTIP_OFFSET_Y;
    if (y + S.tooltipHeight > S.viewportHeight) {
      y = clientY - C.TOOLTIP_OFFSET_Y - S.tooltipHeight;
    }
    
    S.tooltip.style.left = x + 'px';
    S.tooltip.style.top = y + 'px';
  }
  
  function updateTooltipCentered(target) {
    const tag = target.tagName.toLowerCase();
    const classes = typeof target.className === 'string'
      ? target.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-')).join('.')
      : '';
    
    S.tooltip.textContent = `${classes ? `${tag}.${classes}` : tag} • ↑↓←→ navigate`;
    S.tooltip.style.display = 'block';
    
    const rect = target.getBoundingClientRect();
    S.tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    S.tooltip.style.top = (rect.top - 30) + 'px';
  }
  
  E.handleKeyDown = function(event) {
    if (!chrome.runtime?.id) { P.Lifecycle.cleanupOrphaned(); return; }
    if (!S.isActive || S.isDetailPanelOpen || !S.hoveredElement) return;
    
    const key = event.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    let newTarget = null;
    
    switch (key) {
      case 'ArrowUp':
        newTarget = S.hoveredElement.parentElement;
        break;
      case 'ArrowDown':
        newTarget = S.hoveredElement.firstElementChild;
        break;
      case 'ArrowLeft':
        newTarget = S.hoveredElement.previousElementSibling;
        break;
      case 'ArrowRight':
        newTarget = S.hoveredElement.nextElementSibling;
        break;
    }
    
    if (!newTarget) return;
    if (newTarget === document.body || newTarget === document.documentElement) return;
    if (isPinpointElement(newTarget)) return;
    
    E.updateHighlight(newTarget);
    updateTooltipCentered(newTarget);
  };
  
  E.handleClick = function(event) {
    if (!chrome.runtime?.id) { P.Lifecycle.cleanupOrphaned(); return; }
    if (!S.isActive || !event.altKey) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    if (isPinpointElement(target)) return;

    E.captureElementData(target);
    E.showDetailPanel();
  };
  
  E.captureElementData = function(target) {
    // disconnect previous observer
    E.disconnectObserver();
    
    S.capturedElement = target;
    S.originalCapturedElement = target;
    
    const selectorData = SEL.getAllSelectorFormats(target);
    const rect = target.getBoundingClientRect();
    const dimensions = `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`;
    const angularAttrs = SEL.getAngularAttributes(target);
    const pathData = SEL.getDomPath(target);
    const reactName = SEL.getReactComponentName(target);
    
    S.activeCrumbIndex = pathData.length - 1;

    let selectorDisplay = selectorData.playwright;
    
    if (selectorData.depth > 0) {
      selectorDisplay += `\n\n/* Puppeteer */\n${selectorData.puppeteer}`;
      selectorDisplay += `\n\n/* Shadow Depth: ${selectorData.depth} */`;
    }

    UI.renderSelector(selectorDisplay, S.detailPanel.querySelector('#pp-selector'));
    S.detailPanel.querySelector('#pp-dimensions').textContent = dimensions;
    S.detailPanel.querySelector('#pp-angular').textContent = angularAttrs;
    S.detailPanel.querySelector('#pp-component').textContent = reactName || 'none';
    UI.renderPathCrumbs(pathData, S.detailPanel.querySelector('#pp-path'), S.activeCrumbIndex);
    
    // clear any previous detached state
    UI.clearDetachedWarning();
    
    // setup observer on parent to detect removal
    setupElementObserver(target);
  };
  
  function setupElementObserver(target) {
    const parent = target.parentElement;
    if (!parent) return;
    
    S.elementObserver = new MutationObserver(mutations => {
      // check if element was removed
      if (!document.contains(S.capturedElement)) {
        UI.showDetachedWarning();
        E.disconnectObserver();
        
        // clear highlight
        const overlay = S.shadowRoot?.getElementById('pp-overlay');
        if (overlay) overlay.style.opacity = '0';
      }
    });
    
    S.elementObserver.observe(parent, {
      childList: true,
      subtree: true
    });
  }
  
  E.disconnectObserver = function() {
    if (S.elementObserver) {
      S.elementObserver.disconnect();
      S.elementObserver = null;
    }
  };
  
  E.showDetailPanel = function() {
    // show backdrop
    const backdrop = S.shadowRoot?.getElementById('pp-backdrop');
    if (backdrop) backdrop.style.display = 'block';
    
    S.detailPanel.style.display = 'block';
    S.isDetailPanelOpen = true;
    S.tooltip.style.display = 'none';
  };


})(window.Pinpoint);
