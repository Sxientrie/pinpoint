/**
 * Pinpoint - Shadow DOM Piercing Selectors
 * 
 * Generates selectors that traverse Shadow DOM boundaries for:
 * - Playwright: `locator('host >> .internal')`
 * - Puppeteer: `pierce/host .internal`
 * - Custom: `host::shadow(.internal)`
 * 
 * @module shadow-pierce
 */

/**
 * Selector format types for different tools
 * @typedef {'playwright' | 'puppeteer' | 'css' | 'custom'} SelectorFormat
 */

const SHADOW_SEPARATOR = {
  playwright: ' >> ',
  puppeteer: '/',
  css: ' ',
  custom: '::shadow('
};

/**
 * Generates a piercing selector that traverses Shadow DOM boundaries
 * @param {HTMLElement} element - Target element (possibly inside shadow root)
 * @returns {Object} Selector object with multiple format outputs
 */
function getPiercingSelector(element) {
  const path = buildShadowPath(element);
  
  return {
    playwright: formatPlaywrightSelector(path),
    puppeteer: formatPuppeteerSelector(path),
    css: formatCSSSelector(path),
    custom: formatCustomSelector(path),
    path: path,
    depth: path.filter(p => p.isShadowBoundary).length
  };
}

/**
 * Builds an array of selector segments traversing shadow boundaries
 * @param {HTMLElement} element - Target element
 * @returns {Array<{selector: string, isShadowBoundary: boolean}>} Path segments
 */
function buildShadowPath(element) {
  const path = [];
  let current = element;
  
  while (current && current !== document.documentElement) {
    const root = current.getRootNode();
    
    if (root instanceof ShadowRoot) {
      const localSelector = getLocalSelector(current, root);
      path.unshift({
        selector: localSelector,
        isShadowBoundary: false
      });
      
      const host = root.host;
      const hostSelector = getHostSelector(host);
      path.unshift({
        selector: hostSelector,
        isShadowBoundary: true
      });
      
      current = host;
    } else {
      const localSelector = getLocalSelector(current, document);
      path.unshift({
        selector: localSelector,
        isShadowBoundary: false
      });
      break;
    }
  }
  
  return path;
}

/**
 * Gets the most stable selector for an element within its local root
 * @param {HTMLElement} element - Target element
 * @param {Document|ShadowRoot} root - Local root context
 * @returns {string} CSS selector
 */
function getLocalSelector(element, root) {
  if (element.id) {
    const selector = `#${CSS.escape(element.id)}`;
    if (isUniqueSelectorInRoot(selector, root)) return selector;
  }
  
  const dataAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'));
  
  for (const attr of dataAttrs) {
    const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
    if (isUniqueSelectorInRoot(selector, root)) return selector;
  }
  
  const ariaAttrs = ['aria-label', 'role', 'aria-describedby'];
  for (const attrName of ariaAttrs) {
    const value = element.getAttribute(attrName);
    if (value) {
      const selector = `[${attrName}="${CSS.escape(value)}"]`;
      if (isUniqueSelectorInRoot(selector, root)) return selector;
    }
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length) {
      const selector = element.tagName.toLowerCase() + '.' + classes.join('.');
      if (isUniqueSelectorInRoot(selector, root)) return selector;
    }
  }
  
  return buildNthChildSelector(element, root);
}

/**
 * Gets selector for shadow host element
 * @param {HTMLElement} host - Shadow host element
 * @returns {string} CSS selector for host
 */
function getHostSelector(host) {
  const tagName = host.tagName.toLowerCase();
  
  if (host.id) return `${tagName}#${CSS.escape(host.id)}`;
  
  const dataAttrs = Array.from(host.attributes)
    .filter(attr => attr.name.startsWith('data-'));
  
  for (const attr of dataAttrs) {
    return `${tagName}[${attr.name}="${CSS.escape(attr.value)}"]`;
  }
  
  if (host.className && typeof host.className === 'string') {
    const firstClass = host.className.trim().split(/\s+/)[0];
    if (firstClass) return `${tagName}.${CSS.escape(firstClass)}`;
  }
  
  return tagName;
}

/**
 * Checks selector uniqueness within a root context
 * @param {string} selector - CSS selector
 * @param {Document|ShadowRoot} root - Root to query
 * @returns {boolean} True if unique
 */
function isUniqueSelectorInRoot(selector, root) {
  try {
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Builds nth-child based selector as fallback
 * @param {HTMLElement} element - Target element
 * @param {Document|ShadowRoot} root - Root context
 * @returns {string} nth-child selector
 */
function buildNthChildSelector(element, root) {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  
  if (!parent) return tag;
  
  const siblings = Array.from(parent.children).filter(
    child => child.tagName.toLowerCase() === tag
  );
  
  if (siblings.length === 1) return tag;
  
  const index = siblings.indexOf(element) + 1;
  return `${tag}:nth-of-type(${index})`;
}

/**
 * Formats selector for Playwright: `host >> .internal`
 * @param {Array} path - Selector path segments
 * @returns {string} Playwright-compatible selector
 */
function formatPlaywrightSelector(path) {
  const segments = [];
  let currentSegment = [];
  
  for (const part of path) {
    if (part.isShadowBoundary && currentSegment.length > 0) {
      segments.push(currentSegment.join(' '));
      currentSegment = [part.selector];
    } else {
      currentSegment.push(part.selector);
    }
  }
  
  if (currentSegment.length > 0) {
    segments.push(currentSegment.join(' '));
  }
  
  return segments.join(' >> ');
}

/**
 * Formats selector for Puppeteer pierce: `pierce/host .internal`
 * @param {Array} path - Selector path segments
 * @returns {string} Puppeteer-compatible selector
 */
function formatPuppeteerSelector(path) {
  const hasShadow = path.some(p => p.isShadowBoundary);
  const cssPath = path.map(p => p.selector).join(' ');
  
  return hasShadow ? `pierce/${cssPath}` : cssPath;
}

/**
 * Formats as standard CSS (flattened, for light DOM only)
 * @param {Array} path - Selector path segments
 * @returns {string} Standard CSS selector
 */
function formatCSSSelector(path) {
  return path.map(p => p.selector).join(' ');
}

/**
 * Formats with custom shadow notation: `host::shadow(.internal)`
 * @param {Array} path - Selector path segments
 * @returns {string} Custom notation selector
 */
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

/**
 * Queries deep into Shadow DOM to find element
 * Validates that a piercing selector actually works
 * @param {Document|ShadowRoot} root - Starting root
 * @param {string} selector - Piercing selector (Playwright format)
 * @returns {HTMLElement|null} Found element or null
 */
function queryDeep(root, selector) {
  const segments = selector.split(' >> ').map(s => s.trim());
  
  let currentRoot = root;
  let element = null;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    try {
      element = currentRoot.querySelector(segment);
    } catch {
      return null;
    }
    
    if (!element) return null;
    
    if (i < segments.length - 1) {
      if (!element.shadowRoot) return null;
      currentRoot = element.shadowRoot;
    }
  }
  
  return element;
}

/**
 * Queries all matching elements deep into Shadow DOM
 * @param {Document|ShadowRoot} root - Starting root
 * @param {string} selector - Piercing selector
 * @returns {HTMLElement[]} Array of found elements
 */
function queryDeepAll(root, selector) {
  const segments = selector.split(' >> ').map(s => s.trim());
  
  if (segments.length === 1) {
    return Array.from(root.querySelectorAll(segments[0]));
  }
  
  const firstSegment = segments[0];
  const restSelector = segments.slice(1).join(' >> ');
  const results = [];
  
  const hosts = root.querySelectorAll(firstSegment);
  
  for (const host of hosts) {
    if (host.shadowRoot) {
      const found = queryDeepAll(host.shadowRoot, restSelector);
      results.push(...found);
    }
  }
  
  return results;
}

/**
 * Finds all Shadow DOMs in a root using iterative traversal
 * Stack-based to prevent call-stack overflow on deep trees
 * @param {Document|ShadowRoot} root - Starting root
 * @returns {ShadowRoot[]} Array of all shadow roots
 */
function findAllShadowRoots(root) {
  const shadowRoots = [];
  const stack = [root];
  
  while (stack.length > 0) {
    const currentRoot = stack.pop();
    
    const walker = document.createTreeWalker(
      currentRoot,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        shadowRoots.push(node.shadowRoot);
        stack.push(node.shadowRoot);
      }
    }
  }
  
  return shadowRoots;
}

/**
 * Checks if element is inside a Shadow DOM
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if inside shadow root
 */
function isInShadowDOM(element) {
  return element.getRootNode() instanceof ShadowRoot;
}

/**
 * Gets the shadow depth of an element (how many shadow boundaries crossed)
 * @param {HTMLElement} element - Target element
 * @returns {number} Shadow depth (0 = light DOM)
 */
function getShadowDepth(element) {
  let depth = 0;
  let current = element;
  
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
}
