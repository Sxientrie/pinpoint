// pinpoint - shadow pierce
// generates selectors traversing shadow dom boundaries

(function(P) {
  'use strict';
  
  const SP = P.ShadowPierce;
  const ARIA_ATTRS_PIERCE = ['aria-label', 'role', 'aria-describedby'];
  
  /**
   * generates piercing selector for all tool formats
   * @param {HTMLElement} el
   * @returns {Object}
   */
  SP.getPiercingSelector = function(el) {
    const path = buildShadowPath(el);
    return {
      playwright: formatPlaywrightSelector(path),
      puppeteer: formatPuppeteerSelector(path),
      css: formatCSSSelector(path),
      custom: formatCustomSelector(path),
      path,
      depth: path.filter(p => p.isShadowBoundary).length
    };
  };
  
  // internal helpers
  
  function buildShadowPath(el) {
    const path = [];
    let current = el;
    
    while (current && current !== document.documentElement) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        path.unshift({ selector: getLocalSelector(current, root), isShadowBoundary: false });
        path.unshift({ selector: getHostSelector(root.host), isShadowBoundary: true });
        current = root.host;
      } else {
        path.unshift({ selector: getLocalSelector(current, document), isShadowBoundary: false });
        break;
      }
    }
    
    return path;
  }
  
  function getLocalSelector(el, root) {
    if (el.id) {
      const sel = `#${CSS.escape(el.id)}`;
      if (isUniqueSelectorInRoot(sel, root)) return sel;
    }
    
    for (const attr of el.attributes) {
      if (!attr.name.startsWith('data-')) continue;
      const sel = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (isUniqueSelectorInRoot(sel, root)) return sel;
    }
    
    for (const attrName of ARIA_ATTRS_PIERCE) {
      const value = el.getAttribute(attrName);
      if (!value) continue;
      const sel = `[${attrName}="${CSS.escape(value)}"]`;
      if (isUniqueSelectorInRoot(sel, root)) return sel;
    }
    
    if (typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => c);
      if (classes.length) {
        const sel = el.tagName.toLowerCase() + '.' + classes.join('.');
        if (isUniqueSelectorInRoot(sel, root)) return sel;
      }
    }
    
    return buildNthChildSelector(el);
  }
  
  function getHostSelector(host) {
    const tag = host.tagName.toLowerCase();
    
    if (host.id) return `${tag}#${CSS.escape(host.id)}`;
    
    for (const attr of host.attributes) {
      if (attr.name.startsWith('data-')) {
        return `${tag}[${attr.name}="${CSS.escape(attr.value)}"]`;
      }
    }
    
    if (typeof host.className === 'string') {
      const cls = host.className.trim().split(/\s+/)[0];
      if (cls) return `${tag}.${CSS.escape(cls)}`;
    }
    
    return tag;
  }
  
  function isUniqueSelectorInRoot(sel, root) {
    try {
      return root.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  }
  
  function buildNthChildSelector(el) {
    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement;
    if (!parent) return tag;
    
    const siblings = Array.from(parent.children).filter(c => c.tagName.toLowerCase() === tag);
    if (siblings.length === 1) return tag;
    
    return `${tag}:nth-of-type(${siblings.indexOf(el) + 1})`;
  }
  
  function formatPlaywrightSelector(path) {
    const segments = [];
    let current = [];
    
    for (const part of path) {
      if (part.isShadowBoundary && current.length > 0) {
        segments.push(current.join(' '));
        current = [part.selector];
      } else {
        current.push(part.selector);
      }
    }
    
    if (current.length > 0) segments.push(current.join(' '));
    return segments.join(' >> ');
  }
  
  function formatPuppeteerSelector(path) {
    const hasShadow = path.some(p => p.isShadowBoundary);
    const css = path.map(p => p.selector).join(' ');
    return hasShadow ? `pierce/${css}` : css;
  }
  
  function formatCSSSelector(path) {
    return path.map(p => p.selector).join(' ');
  }
  
  function formatCustomSelector(path) {
    let result = '';
    let inShadow = false;
    
    for (let i = 0; i < path.length; i++) {
      const part = path[i];
      
      if (part.isShadowBoundary) {
        result += part.selector + '::shadow(';
        inShadow = true;
      } else {
        result += part.selector;
        if (inShadow && i < path.length - 1 && !path[i + 1].isShadowBoundary) {
          result += ' ';
        } else if (inShadow && (i === path.length - 1 || path[i + 1].isShadowBoundary)) {
          result += ')';
          inShadow = false;
        } else if (i < path.length - 1) {
          result += ' ';
        }
      }
    }
    
    if (inShadow) result += ')';
    return result;
  }
  
  // exported query utilities
  
  SP.queryDeep = function(root, selector) {
    const segments = selector.split(' >> ').map(s => s.trim());
    let currentRoot = root;
    let el = null;
    
    for (let i = 0; i < segments.length; i++) {
      try {
        el = currentRoot.querySelector(segments[i]);
      } catch {
        return null;
      }
      
      if (!el) return null;
      if (i < segments.length - 1) {
        if (!el.shadowRoot) return null;
        currentRoot = el.shadowRoot;
      }
    }
    
    return el;
  };
  
  SP.queryDeepAll = function(root, selector) {
    const segments = selector.split(' >> ').map(s => s.trim());
    
    if (segments.length === 1) {
      return Array.from(root.querySelectorAll(segments[0]));
    }
    
    const results = [];
    const hosts = root.querySelectorAll(segments[0]);
    const rest = segments.slice(1).join(' >> ');
    
    for (const host of hosts) {
      if (host.shadowRoot) {
        results.push(...SP.queryDeepAll(host.shadowRoot, rest));
      }
    }
    
    return results;
  };
  
  SP.findAllShadowRoots = function(root) {
    const shadowRoots = [];
    const stack = [root];
    
    while (stack.length > 0) {
      const currentRoot = stack.pop();
      const walker = document.createTreeWalker(currentRoot, NodeFilter.SHOW_ELEMENT, null, false);
      
      let node;
      while (node = walker.nextNode()) {
        if (node.shadowRoot) {
          shadowRoots.push(node.shadowRoot);
          stack.push(node.shadowRoot);
        }
      }
    }
    
    return shadowRoots;
  };
  
  SP.isInShadowDOM = function(el) {
    return el.getRootNode() instanceof ShadowRoot;
  };
  
  SP.getShadowDepth = function(el) {
    let depth = 0;
    let current = el;
    
    while (current) {
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        depth++;
        current = root.host;
      } else {
        break;
      }
    }
    
    return depth;
  };

})(window.Pinpoint);
