/**
 * Pinpoint - CSS Selector Engine
 * Generates stable, production-grade CSS selectors using priority algorithm:
 * ID > Data Attributes > ARIA > Classes > Structural Path
 * 
 * For Shadow DOM elements, generates piercing selectors for Playwright/Puppeteer
 */

/** @type {WeakMap<HTMLElement, string>} Cache for optimal selectors */
const selectorCache = new WeakMap();

/** @type {WeakMap<HTMLElement, Object>} Cache for full selector formats */
const formatCache = new WeakMap();

/**
 * Generates the most stable CSS selector for an element
 * Uses WeakMap cache and fast-path for light DOM elements
 * @param {HTMLElement} element - Target element
 * @returns {string} Optimized CSS selector (piercing if in Shadow DOM)
 */
function getOptimalSelector(element) {
  const cached = selectorCache.get(element);
  if (cached) return cached;
  
  const root = element.getRootNode();
  const inShadow = root instanceof ShadowRoot;
  
  let selector;
  if (inShadow) {
    const piercing = getPiercingSelector(element);
    selector = piercing.playwright;
  } else {
    selector = getLightDOMSelector(element);
  }
  
  selectorCache.set(element, selector);
  return selector;
}

/**
 * Gets all selector formats for an element (for UI display)
 * Uses WeakMap cache for repeated queries
 * @param {HTMLElement} element - Target element
 * @returns {Object} Selector formats
 */
function getAllSelectorFormats(element) {
  const cached = formatCache.get(element);
  if (cached) return cached;
  
  const root = element.getRootNode();
  const inShadow = root instanceof ShadowRoot;
  
  let result;
  if (inShadow) {
    result = getPiercingSelector(element);
  } else {
    const selector = getLightDOMSelector(element);
    result = {
      playwright: selector,
      puppeteer: selector,
      css: selector,
      custom: selector,
      depth: 0
    };
  }
  
  formatCache.set(element, result);
  return result;
}

/**
 * Generates selector for light DOM element
 * @param {HTMLElement} element - Target element
 * @returns {string} CSS selector
 */
function getLightDOMSelector(element) {
  if (element.id && isUniqueSelector(`#${element.id}`)) {
    return `#${element.id}`;
  }

  const dataSelector = getUniqueDataAttributeSelector(element);
  if (dataSelector) return dataSelector;

  const ariaSelector = getUniqueAriaSelector(element);
  if (ariaSelector) return ariaSelector;

  const classSelector = getUniqueClassSelector(element);
  if (classSelector) return classSelector;

  return buildStructuralPath(element);
}

/**
 * Checks if a selector uniquely identifies a single element
 * @param {string} selector - CSS selector to test
 * @returns {boolean} True if selector matches exactly one element
 */
function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Attempts to generate a unique selector from data-* attributes
 * @param {HTMLElement} element - Target element
 * @returns {string|null} Unique selector or null
 */
function getUniqueDataAttributeSelector(element) {
  const dataAttributes = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'));
  
  for (const attr of dataAttributes) {
    const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
    if (isUniqueSelector(selector)) {
      return selector;
    }
  }
  
  return null;
}

/**
 * Attempts to generate a unique selector from ARIA attributes
 * @param {HTMLElement} element - Target element
 * @returns {string|null} Unique selector or null
 */
function getUniqueAriaSelector(element) {
  for (const attrName of ARIA_ATTRIBUTES) {
    const attrValue = element.getAttribute(attrName);
    if (!attrValue) continue;

    const selector = `[${attrName}="${CSS.escape(attrValue)}"]`;
    if (isUniqueSelector(selector)) {
      return selector;
    }

    const tagSelector = `${element.tagName.toLowerCase()}${selector}`;
    if (isUniqueSelector(tagSelector)) {
      return tagSelector;
    }
  }
  
  return null;
}

/**
 * Attempts to generate a unique selector from CSS classes
 * @param {HTMLElement} element - Target element
 * @returns {string|null} Unique selector or null
 */
function getUniqueClassSelector(element) {
  if (!element.className || typeof element.className !== 'string') {
    return null;
  }

  const classes = element.className
    .trim()
    .split(/\s+/)
    .filter(cls => cls && !cls.startsWith('pp-'));
  
  if (classes.length === 0) return null;

  const classSelector = '.' + classes.join('.');
  if (isUniqueSelector(classSelector)) {
    return classSelector;
  }

  const tagClassSelector = element.tagName.toLowerCase() + classSelector;
  if (isUniqueSelector(tagClassSelector)) {
    return tagClassSelector;
  }
  
  return null;
}

/**
 * Builds a structural CSS path from element to body
 * @param {HTMLElement} element - Target element
 * @returns {string} Structural selector path
 */
function buildStructuralPath(element) {
  const path = [];
  let current = element;
  let depth = 0;
  
  while (current && current !== document.body && depth < MAX_STRUCTURAL_PATH_DEPTH) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(cls => cls && !cls.startsWith('pp-'));
      
      if (classes.length > 0) {
        selector += '.' + classes[0];
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
    depth++;
  }
  
  return path.join(' > ');
}

/**
 * Extracts Angular-specific attributes from an element
 * @param {HTMLElement} element - Target element
 * @returns {string} Space-separated Angular attributes or 'none'
 */
function getAngularAttributes(element) {
  const angularAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.includes('ng'))
    .map(attr => `${attr.name}="${attr.value}"`)
    .join(' ');
  
  return angularAttrs || 'none';
}

/**
 * Builds a human-readable DOM path for display
 * @param {HTMLElement} element - Target element
 * @returns {string} Readable path with → separators
 */
function getDomPath(element) {
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();
    
    if (current.id) {
      part += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(cls => cls && !cls.startsWith('pp-'));
      
      if (classes[0]) {
        part += `.${classes[0]}`;
      }
    }
    
    path.unshift(part);
    current = current.parentElement;
  }
  
  return path.join(' → ');
}
