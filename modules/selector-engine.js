// pinpoint - selector engine
// generates stable css selectors: id > data-* > aria > class > text > anchor > structural

(function(P) {
  'use strict';
  
  const C = P.Constants;
  const SP = P.ShadowPierce;
  const SEL = P.Selector;
  
  const selectorCache = new WeakMap();
  const formatCache = new WeakMap();
  
  const DYNAMIC_TEXT_PATTERNS = [
    /^\d+$/,
    /^\d{1,2}[\/\-]\d{1,2}/,
    /^\$[\d,.]+/,
    /^\d{1,2}:\d{2}/,
    /^[\d,.]+ (min|sec|hr)/,
  ];
  
  /**
   * generates optimal selector, cached
   */
  SEL.getOptimalSelector = function(el) {
    const cached = selectorCache.get(el);
    if (cached) return cached;
    
    const inShadow = el.getRootNode() instanceof ShadowRoot;
    const selector = inShadow ? SP.getPiercingSelector(el).playwright : getLightDOMSelector(el);
    
    selectorCache.set(el, selector);
    return selector;
  };
  
  /**
   * gets all selector formats for ui display
   */
  SEL.getAllSelectorFormats = function(el) {
    const cached = formatCache.get(el);
    if (cached) return cached;
    
    const inShadow = el.getRootNode() instanceof ShadowRoot;
    
    let result;
    if (inShadow) {
      result = SP.getPiercingSelector(el);
    } else {
      const selector = getLightDOMSelector(el);
      result = { playwright: selector, puppeteer: selector, css: selector, custom: selector, depth: 0 };
    }
    
    formatCache.set(el, result);
    return result;
  };
  
  /**
   * extracts ng-* attributes from element
   */
  SEL.getAngularAttributes = function(el) {
    const attrs = Array.from(el.attributes)
      .filter(a => a.name.includes('ng'))
      .map(a => `${a.name}="${a.value}"`)
      .join(' ');
    return attrs || 'none';
  };
  
  /**
   * builds dom path as array of segments for interactive breadcrumbs
   */
  SEL.getDomPath = function(el) {
    const path = [];
    let current = el;
    let depth = 0;
    
    while (current && current !== document.body) {
      let label = current.tagName.toLowerCase();
      
      if (current.id) {
        label += `#${current.id}`;
      } else if (typeof current.className === 'string') {
        const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
        if (cls) label += `.${cls}`;
      }
      
      path.unshift({ label, depth });
      current = current.parentElement;
      depth++;
    }
    
    return path;
  };
  
  /**
   * extracts react/preact component name from element
   * @param {HTMLElement} el
   * @returns {string|null}
   */
  SEL.getReactComponentName = function(el) {
    try {
      // find react fiber key
      const fiberKey = Object.keys(el).find(key => 
        key.startsWith('__reactFiber') || 
        key.startsWith('__reactInternalInstance') ||
        key.startsWith('__reactProps')
      );
      
      if (!fiberKey) return null;
      
      let fiber = el[fiberKey];
      if (!fiber) return null;
      
      // traverse up fiber tree to find component
      const visited = new Set();
      let depth = 0;
      const maxDepth = 20;
      
      while (fiber && depth < maxDepth) {
        // prevent infinite loops
        if (visited.has(fiber)) break;
        visited.add(fiber);
        
        const type = fiber.type || fiber.elementType;
        
        if (type) {
          // function component or class
          if (typeof type === 'function') {
            const name = type.displayName || type.name;
            if (name && name !== 'Anonymous' && !name.startsWith('_')) {
              return name;
            }
          }
          // forwardRef, memo wrapped
          if (typeof type === 'object') {
            const inner = type.render || type.type;
            if (inner) {
              const name = inner.displayName || inner.name;
              if (name && name !== 'Anonymous') {
                return name;
              }
            }
          }
        }
        
        // go up the tree
        fiber = fiber.return || fiber._debugOwner;
        depth++;
      }
      
      return null;
    } catch {
      return null;
    }
  };

  
  // internal helpers
  
  function getLightDOMSelector(el) {
    if (el.id && isUniqueSelector(`#${el.id}`)) return `#${el.id}`;
    
    const dataSelector = getUniqueDataAttributeSelector(el);
    if (dataSelector) return dataSelector;

    const ariaSelector = getUniqueAriaSelector(el);
    if (ariaSelector) return ariaSelector;

    const classSelector = getUniqueClassSelector(el);
    if (classSelector) return classSelector;

    const textSelector = getTextSelector(el);
    if (textSelector) return textSelector;

    const anchorSelector = getAnchoredSelector(el);
    if (anchorSelector) return anchorSelector;

    return buildStructuralPath(el);
  }
  
  function isUniqueSelector(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }
  
  function getUniqueDataAttributeSelector(el) {
    for (const attr of el.attributes) {
      if (!attr.name.startsWith('data-')) continue;
      const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (isUniqueSelector(selector)) return selector;
    }
    return null;
  }
  
  function getUniqueAriaSelector(el) {
    for (const attrName of C.ARIA_ATTRIBUTES) {
      const value = el.getAttribute(attrName);
      if (!value) continue;

      const selector = `[${attrName}="${CSS.escape(value)}"]`;
      if (isUniqueSelector(selector)) return selector;

      const tagSelector = `${el.tagName.toLowerCase()}${selector}`;
      if (isUniqueSelector(tagSelector)) return tagSelector;
    }
    return null;
  }
  
  function getUniqueClassSelector(el) {
    if (typeof el.className !== 'string') return null;
    
    const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'));
    if (!classes.length) return null;

    const classSelector = '.' + classes.join('.');
    if (isUniqueSelector(classSelector)) return classSelector;

    const tagClassSelector = el.tagName.toLowerCase() + classSelector;
    if (isUniqueSelector(tagClassSelector)) return tagClassSelector;
    
    return null;
  }
  
  function getTextSelector(el) {
    const leafTags = ['button', 'a', 'label', 'span', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'p'];
    const tag = el.tagName.toLowerCase();
    if (!leafTags.includes(tag)) return null;
    
    const text = getDirectTextContent(el).trim();
    
    if (!text || text.length < 2 || text.length > 30) return null;
    if (DYNAMIC_TEXT_PATTERNS.some(p => p.test(text))) return null;
    
    const exactSelector = `${tag}:has-text("${CSS.escape(text)}")`;
    if (isUniqueSelector(exactSelector)) return exactSelector;
    
    const parent = el.parentElement;
    if (parent && typeof parent.className === 'string') {
      const parentClass = parent.className.trim().split(/\s+/)[0];
      if (parentClass) {
        const contextSelector = `.${CSS.escape(parentClass)} ${tag}:has-text("${CSS.escape(text)}")`;
        if (isUniqueSelector(contextSelector)) return contextSelector;
      }
    }
    
    return null;
  }
  
  function getDirectTextContent(el) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text;
  }
  
  function getAnchoredSelector(el) {
    const tag = el.tagName.toLowerCase();
    let current = el.parentElement;
    let stepsFromAnchor = [tag];
    let depth = 0;
    
    while (current && current !== document.body && depth < 5) {
      if (current.id) {
        const directSelector = `#${CSS.escape(current.id)} ${tag}`;
        if (isUniqueSelector(directSelector)) return directSelector;
        
        const pathSelector = `#${CSS.escape(current.id)} ${stepsFromAnchor.join(' > ')}`;
        if (isUniqueSelector(pathSelector)) return pathSelector;
        
        const siblings = current.querySelectorAll(tag);
        if (siblings.length > 1) {
          const index = Array.from(siblings).indexOf(el) + 1;
          if (index > 0) {
            const nthSelector = `#${CSS.escape(current.id)} ${tag}:nth-of-type(${index})`;
            if (isUniqueSelector(nthSelector)) return nthSelector;
          }
        }
        
        break;
      }
      
      let step = current.tagName.toLowerCase();
      if (typeof current.className === 'string') {
        const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
        if (cls) step += '.' + cls;
      }
      stepsFromAnchor.unshift(step);
      
      current = current.parentElement;
      depth++;
    }
    
    return null;
  }
  
  function buildStructuralPath(el) {
    const path = [];
    let current = el;
    let depth = 0;
    
    while (current && current !== document.body && depth < C.MAX_STRUCTURAL_PATH_DEPTH) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        path.unshift(selector + `#${current.id}`);
        break;
      }
      
      if (typeof current.className === 'string') {
        const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
        if (cls) selector += '.' + cls;
      }
      
      path.unshift(selector);
      current = current.parentElement;
      depth++;
    }
    
    return path.join(' > ');
  }

})(window.Pinpoint);
